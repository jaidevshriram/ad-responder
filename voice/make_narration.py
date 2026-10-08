#!/usr/bin/env python3
"""
Record the ad's narration, one WAV per beat, in the same voice the live agent uses.

The Voice Agent speaks its `greeting` verbatim as soon as a session opens, so each
line is one short session: send the line as the greeting, keep the reply audio,
hang up. The narration and the live answers then sound like one speaker.

    ~/esp-tools/bin/python make_narration.py          # only missing lines
    ~/esp-tools/bin/python make_narration.py --all    # re-record everything
"""
import asyncio, base64, json, sys, wave
from pathlib import Path

import websockets

HERE = Path(__file__).parent
OUT = HERE / "narration"
RATE = 24_000


def key() -> str:
    for line in (HERE / ".env").read_text().splitlines():
        if line.startswith("ASSEMBLYAI_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("No ASSEMBLYAI_API_KEY in voice/.env")


async def record(line: str, voice: str) -> bytes:
    async with websockets.connect(
        "wss://agents.assemblyai.com/v1/ws",
        additional_headers={"Authorization": f"Bearer {key()}"},
        max_size=None,
    ) as ws:
        await ws.send(json.dumps({"type": "session.update", "session": {
            "system_prompt": "You are a narrator. Say nothing beyond your greeting.",
            "greeting": line,
            "input": {"format": {"encoding": "audio/pcm", "sample_rate": RATE}},
            "output": {"voice": voice, "format": {"encoding": "audio/pcm", "sample_rate": RATE}},
        }}))
        pcm = b""
        async with asyncio.timeout(30):
            async for raw in ws:
                m = json.loads(raw)
                if m["type"] == "reply.audio":
                    pcm += base64.b64decode(m["data"])      # outbound audio is "data"
                elif m["type"] == "reply.done" and pcm:
                    return pcm
                elif m["type"] == "session.error":
                    raise RuntimeError(m)
    return pcm


async def main():
    script = json.loads((HERE / "ad_script.json").read_text())
    OUT.mkdir(exist_ok=True)
    for beat in script["beats"]:
        path = OUT / f"{beat['id']}.wav"
        if path.exists() and "--all" not in sys.argv:
            continue
        pcm = await record(beat["line"], script["voice"])
        with wave.open(str(path), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm)
        print(f"{beat['id']}  {len(pcm) / 2 / RATE:4.1f}s  {beat['line']}")


asyncio.run(main())
