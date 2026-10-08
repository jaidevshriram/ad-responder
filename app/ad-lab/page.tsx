"use client";

// Developer page for the HappyOyster travel ad: build or reopen the world,
// start it, send instructions, and log how long each step takes.

import { useEffect, useRef, useState } from "react";
import { HappyOysterModel } from "@reactor-models/happy-oyster";

const WORLD_KEY = "ad-lab.world";
const DEFAULT_PROMPT =
  "The Amalfi Coast in Italy on a bright summer morning. Pastel houses stacked up a steep cliff above a turquoise bay, lemon trees on terraces, small wooden boats in the harbour, a winding coastal road. Cinematic travel film, warm golden light, slow graceful camera.";

async function openSession() {
  const r = await fetch("/api/happy-oyster/token", { method: "POST" });
  const out = await r.json();
  if (!out.jwt) throw new Error(out.error || "no token");
  return out as { jwt: string; sessionId: string };
}

export default function AdLab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const modelRef = useRef<HappyOysterModel<"directing"> | null>(null);
  const t0 = useRef(performance.now());
  const [log, setLog] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [instruction, setInstruction] = useState("The sun sets and lanterns light up along the harbour.");
  const [worldId, setWorldId] = useState("");

  const say = (line: string) => {
    const t = ((performance.now() - t0.current) / 1000).toFixed(1).padStart(6);
    console.log(`[ad-lab] ${t}s ${line}`);
    setLog((l) => [`${t}s  ${line}`, ...l].slice(0, 200));
  };

  useEffect(() => {
    setWorldId(localStorage.getItem(WORLD_KEY) || "");
  }, []);

  const run = (name: string, fn: () => Promise<unknown>) => async () => {
    const start = performance.now();
    say(`${name} …`);
    try {
      const out = await fn();
      say(`${name} done in ${((performance.now() - start) / 1000).toFixed(1)}s ${out ? JSON.stringify(out).slice(0, 160) : ""}`);
    } catch (e) {
      say(`${name} FAILED: ${(e as Error).message}`);
    }
  };

  const connect = run("connect", async () => {
    const m = new HappyOysterModel({ mode: "directing", videoElement: videoRef.current! });
    modelRef.current = m;
    m.onPhaseChanged((p) => say(`phase → ${p}`));
    m.onWorldState((w) => say(`world → ${w.phase}`));
    let last = "";
    m.onTravelState((s) => {
      const brief = `${s.status} | instructions: ${s.user_instructions
        .map((i) => `${i.status}@${i.start_time}-${i.end_time}`)
        .join(", ")}`;
      if (brief !== last) say(`travel → ${brief}`);
      last = brief;
    });
    m.onTravelError((e) => say(`travel error: ${String(e)}`));
    const { jwt, sessionId } = await openSession();
    await m.connect(jwt, { sessionId });
  });

  const create = run("createWorld", async () => {
    const w = await modelRef.current!.createWorld({
      prompt,
      resolution: "720p",
      layout: "Stable",
      narrative: "Calm",
    });
    if (w.encrypted_world_id) {
      localStorage.setItem(WORLD_KEY, w.encrypted_world_id);
      setWorldId(w.encrypted_world_id);
    }
    return { id: w.encrypted_world_id?.slice(0, 12) };
  });

  const attach = run("attachWorld", () => modelRef.current!.attachWorld(worldId));
  const travel = run("startTravel", () => modelRef.current!.startTravel());
  const instruct = run(`instruct "${instruction}"`, () => modelRef.current!.instruct(instruction));
  const pause = run("pause", () => modelRef.current!.pause());
  const resume = run("resume", () => modelRef.current!.resume());
  const disconnect = run("disconnect", () => modelRef.current!.disconnect());

  const btn = { padding: "8px 14px", marginRight: 8, marginBottom: 8, cursor: "pointer" } as const;
  return (
    <main style={{ padding: 24, fontFamily: "ui-monospace, monospace", background: "#111", color: "#eee", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 20 }}>HappyOyster ad lab</h1>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: 960, aspectRatio: "16/9", background: "#000", display: "block", marginBottom: 12 }} />
      <div>
        <button style={btn} onClick={connect}>1 connect</button>
        <button style={btn} onClick={create}>2a create world</button>
        <button style={btn} onClick={attach} disabled={!worldId}>2b attach saved world</button>
        <button style={btn} onClick={travel}>3 start travel</button>
        <button style={btn} onClick={pause}>pause</button>
        <button style={btn} onClick={resume}>resume</button>
        <button style={btn} onClick={disconnect}>disconnect</button>
      </div>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} style={{ width: 960, display: "block", marginBottom: 8 }} />
      <input value={instruction} onChange={(e) => setInstruction(e.target.value)} style={{ width: 760, padding: 6 }} />
      <button style={btn} onClick={instruct}>instruct</button>
      <p style={{ color: "#888" }}>saved world: {worldId ? worldId.slice(0, 16) + "…" : "none"}</p>
      <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
    </main>
  );
}
