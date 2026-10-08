"use client";

// Audio check / dev panel: relay connection, devices, live levels, speaker and
// mic tests, the HappyOyster state, and the last 30 protocol messages.
// Toggle with D, or from the profile menu ("Audio check").

import { X } from "lucide-react";
import { useEffect } from "react";

import { useWorld } from "@/lib/ad-world";
import { isTyping, useDevPanel } from "@/lib/dev-panel";
import { relaySend, startRelay, useRelay } from "@/lib/relay";

function Meter({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.round(Math.sqrt(Math.max(0, value)) * 100));
  return (
    <div className="dev-meter">
      <span>{label}</span>
      <div>
        <i style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <b>{value.toFixed(2)}</b>
    </div>
  );
}

function TestLine({ test }: { test: "mic" | "speaker" }) {
  const result = useRelay((state) => state.tests[test]);
  if (!result) return null;
  if (result === "pending") return <p className="dev-test pending">{test === "mic" ? "Recording 4 s… speak now" : "Playing…"}</p>;
  return (
    <p className={`dev-test ${result.ok ? "ok" : "bad"}`}>
      {result.ok ? "OK" : "Failed"} — {result.detail}
      {result.transcript !== undefined && (
        <>
          <br />
          <q>{result.transcript || "(nothing heard)"}</q>
        </>
      )}
    </p>
  );
}

export function DevPanel() {
  const open = useDevPanel((state) => state.open);
  const toggle = useDevPanel((state) => state.toggle);

  useEffect(() => {
    startRelay();
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === "d") toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return open ? <DevPanelBody /> : null;
}

function DevPanelBody() {
  const setOpen = useDevPanel((state) => state.set);
  const relay = useRelay();
  const world = useWorld();
  const connected = relay.connected;
  return (
    <aside className="dev-panel" aria-label="Audio check">
      <header>
        <strong>Audio check</strong>
        <span className={`dev-dot ${connected ? "on" : ""}`} />
        <small>{connected ? "relay connected" : "relay offline — retrying"}</small>
        <button onClick={() => setOpen(false)} aria-label="Close audio check">
          <X />
        </button>
      </header>

      <section>
        <dl>
          <dt>Agent</dt>
          <dd>{relay.status?.agent ?? "—"}</dd>
          <dt>Mic</dt>
          <dd>{relay.status?.mic || "—"}</dd>
          <dt>Speaker</dt>
          <dd>{relay.status?.speaker || "—"}</dd>
        </dl>
        <Meter label="mic" value={relay.level.mic} />
        <Meter label="out" value={relay.level.out} />
        <div className="dev-buttons">
          <button disabled={!connected} onClick={() => relaySend({ type: "test.speaker" })}>
            Test speaker
          </button>
          <button disabled={!connected} onClick={() => relaySend({ type: "test.mic", seconds: 4 })}>
            Test mic
          </button>
        </div>
        <TestLine test="speaker" />
        <TestLine test="mic" />
        {relay.lastError && <p className="dev-test bad">relay error: {relay.lastError}</p>}
      </section>

      <section>
        <h5>HappyOyster</h5>
        <dl>
          <dt>Stage</dt>
          <dd>{world.stage}{world.hasFrame ? " · frames" : ""}</dd>
          <dt>Phase</dt>
          <dd>{world.phase}</dd>
          <dt>Travel</dt>
          <dd>{world.travel}</dd>
          <dt>World</dt>
          <dd>{world.worldId ? `${world.worldId.slice(0, 14)}…` : "—"}</dd>
          <dt>Instruct</dt>
          <dd>
            {world.lastInstructMs !== null ? `${world.lastInstructMs} ms` : "—"}
            {world.queued ? " · 1 queued" : ""}
          </dd>
          <dt>Timings</dt>
          <dd>
            {Object.entries(world.timings)
              .map(([step, ms]) => `${step} ${(ms / 1000).toFixed(1)}s`)
              .join(" · ") || "—"}
          </dd>
        </dl>
        {world.lastInstruct && <p className="dev-note">“{world.lastInstruct}”</p>}
        {world.error && <p className="dev-test bad">{world.error}</p>}
      </section>

      <section className="dev-log">
        <h5>Protocol · last 30</h5>
        <ol>
          {relay.log.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className={entry.dir}>
              <time>{new Date(entry.at).toLocaleTimeString([], { hour12: false })}</time>
              <span>{entry.dir === "in" ? "←" : "→"}</span>
              <code>{entry.text}</code>
            </li>
          ))}
        </ol>
      </section>
      <footer>D toggles this panel · A starts the ad break · Esc skips it</footer>
    </aside>
  );
}
