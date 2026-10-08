#!/usr/bin/env node
// A stand-in for voice/relay.py that speaks the browser protocol (docs/PROTOCOL.md)
// without any audio. On `ad.start` it plays: beats every ~4 s, an interruption
// (listening → user → agent → scene → card), resume, the remaining beats, ad.end.
//
//   node scripts/fake-relay.mjs            # ws://localhost:8765
//   PORT=8766 node scripts/fake-relay.mjs  # then open /notflix?relay=ws://localhost:8766

import { readFileSync } from "node:fs";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8765);
const script = JSON.parse(readFileSync(new URL("../voice/ad_script.json", import.meta.url), "utf8"));
const beats = script.beats;
const wss = new WebSocketServer({ port: PORT });
console.log(`[fake-relay] listening on ws://localhost:${PORT} (${beats.length} beats)`);

wss.on("connection", (ws) => {
  let timers = [];
  let levelTimer = null;
  let micLevel = 0.02;
  const send = (message) => {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(message));
    if (message.type !== "level") console.log("→", JSON.stringify(message).slice(0, 140));
  };
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const stop = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };
  const status = (agent) => send({ type: "status", agent, mic: "Fake reSpeaker 4-Mic", speaker: "Fake USB speaker" });
  const beat = (index) =>
    send({ type: "beat", id: beats[index].id, index, total: beats.length, line: beats[index].line, scene: beats[index].scene });

  levelTimer = setInterval(() => {
    send({ type: "level", mic: Math.max(0, micLevel + (Math.random() - 0.5) * 0.04), out: Math.random() * 0.3 });
  }, 100);

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    console.log("←", JSON.stringify(message));
    switch (message.type) {
      case "hello":
        status("off");
        break;
      case "ad.prepare":
        status("connecting");
        at(1500, () => status("ready"));
        break;
      case "ad.start": {
        stop();
        const interruptAfter = Math.min(2, beats.length - 1);
        let t = 0;
        for (let i = 0; i <= interruptAfter; i++) {
          at(t, () => beat(i));
          t += 4000;
        }
        // The viewer interrupts.
        at(t - 1500, () => {
          micLevel = 0.35;
          send({ type: "listening" });
        });
        const words = "How much is it for a week in June";
        words.split(" ").forEach((_, i, all) => {
          at(t - 1200 + i * 220, () => send({ type: "user", text: all.slice(0, i + 1).join(" "), final: false }));
        });
        t += 600;
        at(t, () => {
          micLevel = 0.02;
          send({ type: "user", text: words + "?", final: true });
        });
        const reply =
          "Seven nights in June start from twenty-four fifty per person, with flights from New York, breakfast and a private boat day. Here, let me show you the boat.";
        const replyWords = reply.split(" ");
        replyWords.forEach((_, i) => {
          at(t + 500 + i * 160, () => send({ type: "agent", text: replyWords.slice(0, i + 1).join(" "), final: false }));
        });
        at(t + 1200, () => send({ type: "card", title: "Seven nights in June", body: "From 2,450 USD per person, flights, breakfast and a private boat day included." }));
        at(t + 2200, () => send({ type: "scene", direction: "A small wooden boat glides across the calm turquoise water toward a hidden cove." }));
        t += 500 + replyWords.length * 160;
        at(t, () => send({ type: "agent", text: reply, final: true }));
        t += 3000;
        at(t, () => send({ type: "resume", index: interruptAfter + 1 }));
        for (let i = interruptAfter + 1; i < beats.length; i++) {
          at(t, () => beat(i));
          t += 4000;
        }
        at(t + 1000, () => send({ type: "ad.end" }));
        break;
      }
      case "ad.stop":
        stop();
        status("off");
        break;
      case "test.speaker":
        at(1200, () => send({ type: "test.result", test: "speaker", ok: true, detail: "played chime + 'Speaker check.' (fake)" }));
        break;
      case "test.mic": {
        micLevel = 0.3;
        at((message.seconds ?? 4) * 1000, () => {
          micLevel = 0.02;
          send({ type: "test.result", test: "mic", ok: true, detail: "4.0 s recorded, peak 0.41 (fake)", transcript: "Testing, one two three." });
        });
        break;
      }
      case "scene.done":
        break;
    }
  });

  ws.on("close", () => {
    stop();
    clearInterval(levelTimer);
  });
});
