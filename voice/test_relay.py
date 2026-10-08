#!/usr/bin/env python3
"""
End-to-end check of the voice relay, acting as the browser.

    ~/esp-tools/bin/python voice/test_relay.py

It starts its own relay with --silent (nothing plays out loud; timing is unchanged)
and stops it at the end. Port 8765 must be free.

It runs one ad and, instead of a viewer, injects three synthesized questions
(macOS `say`) into the agent's audio stream via the debug-only message
`debug.inject_audio`, one per beat: at b1, b2 and b3. For each it checks
listening -> user final -> agent final (no tool names, right figures) ->
scene/card -> resume, then that the later beats play and ad.end arrives.
"""
import asyncio, base64, json, re, subprocess, sys, tempfile, time, wave
from pathlib import Path

import websockets

HERE = Path(__file__).resolve().parent

URL = "ws://localhost:8765"
PAD_S = 1.5                       # silence appended after each question
TOOL_RE = re.compile(r"show_scene|show_card|resume_ad|show scene|show card|resume ad", re.I)

QUESTIONS = [
    {"text": "Wait, what is it like there at night?",
     "need_scene": True, "need_card": False, "expect": None},
    {"text": "How much is it for a three day stay?",
     "need_scene": False, "need_card": True,
     "expect": re.compile(r"1,?290|twelve hundred (and )?ninety|thirteen hundred", re.I)},
    {"text": "Do you provide transport?",
     "need_scene": True, "need_card": False,
     "expect": re.compile(r"driver|ferr|transfer|yes", re.I)},
]

results: list[tuple[bool, str]] = []


def check(ok: bool, what: str):
    results.append((ok, what))
    print(f"{'PASS' if ok else 'FAIL'}  {what}", flush=True)
    return ok


def make_wav(text: str) -> bytes:
    d = Path(tempfile.gettempdir()) / "ad_relay_test"
    d.mkdir(exist_ok=True)
    stem = re.sub(r"\W+", "_", text.lower()).strip("_")
    wav = d / f"{stem}.wav"
    if not wav.exists():
        aiff = d / f"{stem}.aiff"
        subprocess.run(["say", "-v", "Samantha", "-o", str(aiff), text], check=True)
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@24000", "-c", "1",
                        str(aiff), str(wav)], check=True)
    with wave.open(str(wav), "rb") as w:
        assert w.getframerate() == 24000 and w.getnchannels() == 1
        pcm = w.readframes(w.getnframes())
    return pcm + bytes(int(PAD_S * 24000) * 2)


class Client:
    def __init__(self, ws):
        self.ws = ws
        self.q: asyncio.Queue = asyncio.Queue()
        self.t0 = time.monotonic()
        self.beats: list[str] = []
        asyncio.create_task(self.reader())

    async def reader(self):
        async for raw in self.ws:
            m = json.loads(raw)
            m["_t"] = time.monotonic()
            if m["type"] == "beat":
                self.beats.append(m["id"])
            if m["type"] != "level":
                await self.q.put(m)

    async def send(self, type_, **kw):
        await self.ws.send(json.dumps({"type": type_, **kw}))

    async def until(self, pred, timeout, seen=None):
        """Read messages until pred(m); every message read is appended to `seen`."""
        end = time.monotonic() + timeout
        while True:
            left = end - time.monotonic()
            if left <= 0:
                return None
            try:
                m = await asyncio.wait_for(self.q.get(), left)
            except asyncio.TimeoutError:
                return None
            if seen is not None:
                seen.append(m)
            if m["type"] in ("error",):
                print(f"      relay error: {m.get('message')}", flush=True)
            if pred(m):
                return m


async def ask(c: Client, q: dict, n: int):
    pcm = make_wav(q["text"])
    print(f"\n-- Q{n}: \"{q['text']}\"", flush=True)
    await c.send("debug.inject_audio", audio=base64.b64encode(pcm).decode())
    t_send = time.monotonic()
    speech_end = t_send + len(pcm) / 48000 - PAD_S       # estimate until inject_done
    seen: list = []
    lst = await c.until(lambda m: m["type"] == "listening", 15, seen)
    check(lst is not None, f"Q{n} listening"
          + (f" ({lst['_t'] - t_send:.1f}s after inject)" if lst else ""))
    res = await c.until(lambda m: m["type"] == "resume", 45, seen)
    check(res is not None, f"Q{n} resume" + (f" index {res['index']}" if res else ""))

    done = next((m for m in seen if m["type"] == "debug.inject_done"), None)
    if done:
        speech_end = done["_t"] - PAD_S
    user = [m["text"] for m in seen if m["type"] == "user" and m.get("final")]
    agent = [m["text"] for m in seen if m["type"] == "agent" and m.get("final")]
    raw_agent = [m["text"] for m in seen if m["type"] == "agent"]
    scenes = [m for m in seen if m["type"] == "scene"]
    cards = [m for m in seen if m["type"] == "card"]
    audio = next((m for m in seen if m["type"] == "debug.reply_audio"), None)

    check(bool(user), f"Q{n} user final: {user}")
    said = " ".join(agent)
    check(bool(agent), f"Q{n} agent final: {said!r}")
    check(not any(TOOL_RE.search(t) for t in raw_agent), f"Q{n} no tool names in agent text")
    if q["expect"]:
        blob = said + " " + " ".join(f"{c_['title']} {c_['body']}" for c_ in cards)
        check(bool(q["expect"].search(blob)), f"Q{n} answer has expected content")
    for s in scenes:
        print(f"      scene: {s['direction']!r}  (+{s['_t'] - speech_end:.1f}s)", flush=True)
    for cd in cards:
        print(f"      card: {cd['title']!r} / {cd['body']!r}  (+{cd['_t'] - speech_end:.1f}s)",
              flush=True)
    if q["need_scene"]:
        check(bool(scenes), f"Q{n} scene change")
    if q["need_card"]:
        check(bool(cards), f"Q{n} fact card")
    t_audio = audio["_t"] - speech_end if audio else None
    t_scene = scenes[0]["_t"] - speech_end if scenes else None
    print(f"      timing: speech end -> first agent audio "
          f"{t_audio:.2f}s" if t_audio is not None else "      timing: no agent audio seen",
          flush=True)
    if t_scene is not None:
        print(f"      timing: speech end -> scene {t_scene:.2f}s", flush=True)
    return res, t_audio, t_scene


async def main():
    import socket
    with socket.socket() as so:
        if so.connect_ex(("localhost", 8765)) == 0:
            sys.exit("port 8765 is busy - stop the running relay first")
    (Path(tempfile.gettempdir()) / "ad_relay_test").mkdir(exist_ok=True)
    log = open(Path(tempfile.gettempdir()) / "ad_relay_test" / "relay.log", "w")
    relay = subprocess.Popen([sys.executable, "-u", str(HERE / "relay.py"), "--silent"],
                             stdout=log, stderr=subprocess.STDOUT,
                             env={**__import__("os").environ, "RELAY_SILENT": "1"})
    try:
        for _ in range(50):
            await asyncio.sleep(0.2)
            try:
                async with websockets.connect(URL):
                    break
            except OSError:
                pass
        await run()
    finally:
        relay.terminate()
        relay.wait(5)
        print(f"relay log: {log.name}")


async def run():
    async with websockets.connect(URL, max_size=None) as ws:
        c = Client(ws)
        await c.send("hello", client="test", debug=True)
        await c.send("debug.mute_mic", mute=True)      # only injected audio reaches the agent
        st = await c.until(lambda m: m["type"] == "status", 5)
        check(st is not None, f"status on hello: {st and {k: st[k] for k in ('agent', 'mic', 'speaker')}}")
        await c.send("ad.prepare")
        ready = await c.until(lambda m: m["type"] == "status" and m["agent"] == "ready", 20)
        if not check(ready is not None, "agent ready after ad.prepare"):
            return
        await c.send("ad.start")
        b = await c.until(lambda m: m["type"] == "beat", 5)
        check(b is not None and b["id"] == "b1", f"beat b1: {b and b['line']!r}")

        beats_seen = {"b1"}
        timings = []
        for n, q in enumerate(QUESTIONS, 1):
            await asyncio.sleep(0.6)                  # let the line get going
            res, ta, ts = await ask(c, q, n)
            timings.append((ta, ts))
            if res is None:
                break
            nb = await c.until(lambda m: m["type"] in ("beat", "ad.end"), 10)
            if nb and nb["type"] == "beat":
                beats_seen.add(nb["id"])
                check(nb["index"] == res["index"], f"next beat {nb['id']} is resume index")
            elif n < len(QUESTIONS):
                check(False, "beat after resume")
                break

        seen: list = []
        end = await c.until(lambda m: m["type"] == "ad.end", 60, seen)
        total = b["total"] if b else 0
        check(len(set(c.beats)) == total, f"all {total} beats started: {c.beats}")
        check(end is not None, "ad.end")

        print("\nTimings (speech end -> first agent audio / -> scene):")
        for i, (ta, ts) in enumerate(timings, 1):
            fmt = lambda x: f"{x:.2f}s" if x is not None else "-"
            print(f"  Q{i}: {fmt(ta)} / {fmt(ts)}")

    failed = [w for ok, w in results if not ok]
    print(f"\n{'PASS' if not failed else 'FAIL'}: {len(results) - len(failed)}/{len(results)} checks")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
