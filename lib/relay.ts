"use client";

// Browser side of the voice relay protocol (docs/PROTOCOL.md).
// One WebSocket to ws://localhost:8765, reconnecting every 2 s. Everything the
// dev panel shows lives in a small zustand store; the ad subscribes to messages.

import { create } from "zustand";

export type RelayIn =
  | { type: "status"; agent: "off" | "connecting" | "ready"; mic: string; speaker: string }
  | { type: "level"; mic: number; out: number }
  | { type: "beat"; id: string; index: number; total: number; line: string; scene: string }
  | { type: "listening" }
  | { type: "user"; text: string; final: boolean }
  | { type: "agent"; text: string; final: boolean }
  | { type: "scene"; direction: string }
  | { type: "card"; title: string; body: string }
  | { type: "resume"; index: number }
  | { type: "ad.end" }
  | {
      type: "test.result";
      test: "mic" | "speaker";
      ok: boolean;
      detail: string;
      transcript?: string;
    }
  | { type: "error"; message: string };

export type RelayOut =
  | { type: "hello"; client: "notflix" }
  | { type: "ad.prepare" }
  | { type: "ad.start" }
  | { type: "ad.stop" }
  | { type: "test.speaker" }
  | { type: "test.mic"; seconds?: number }
  | { type: "scene.done"; direction: string };

export type RelayLogEntry = { at: number; dir: "in" | "out"; text: string };

type RelayState = {
  connected: boolean;
  status: Extract<RelayIn, { type: "status" }> | null;
  level: { mic: number; out: number };
  log: RelayLogEntry[];
  tests: Partial<Record<"mic" | "speaker", Extract<RelayIn, { type: "test.result" }> | "pending">>;
  lastError: string;
};

export const useRelay = create<RelayState>(() => ({
  connected: false,
  status: null,
  level: { mic: 0, out: 0 },
  log: [],
  tests: {},
  lastError: "",
}));

const DEFAULT_RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL || "ws://localhost:8765";

/** `?relay=ws://localhost:8766` points the page at another relay (e.g. scripts/fake-relay.mjs). */
function relayUrl() {
  const override = new URLSearchParams(window.location.search).get("relay");
  return override && /^wss?:\/\//.test(override) ? override : DEFAULT_RELAY_URL;
}
const listeners = new Set<(message: RelayIn) => void>();
let socket: WebSocket | null = null;
let started = false;

function pushLog(dir: "in" | "out", text: string) {
  useRelay.setState((state) => ({
    log: [{ at: Date.now(), dir, text }, ...state.log].slice(0, 30),
  }));
}

function open() {
  if (typeof window === "undefined") return;
  let ws: WebSocket;
  try {
    ws = new WebSocket(relayUrl());
  } catch {
    setTimeout(open, 2000);
    return;
  }
  socket = ws;
  ws.onopen = () => {
    useRelay.setState({ connected: true });
    pushLog("in", "· connected");
    relaySend({ type: "hello", client: "notflix" });
  };
  ws.onmessage = (event) => {
    let message: RelayIn;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (message.type === "level") {
      useRelay.setState({ level: { mic: message.mic, out: message.out } });
    } else {
      pushLog("in", JSON.stringify(message));
      if (message.type === "status") useRelay.setState({ status: message });
      if (message.type === "error") useRelay.setState({ lastError: message.message });
      if (message.type === "test.result")
        useRelay.setState((state) => ({ tests: { ...state.tests, [message.test]: message } }));
    }
    listeners.forEach((listener) => listener(message));
  };
  ws.onclose = () => {
    if (socket === ws) socket = null;
    if (useRelay.getState().connected) pushLog("in", "· disconnected");
    useRelay.setState({ connected: false, level: { mic: 0, out: 0 } });
    setTimeout(open, 2000);
  };
  ws.onerror = () => ws.close();
}

/** Start the connection loop once per page. */
export function startRelay() {
  if (started) return;
  started = true;
  open();
}

export function relaySend(message: RelayOut) {
  if (message.type === "test.mic" || message.type === "test.speaker") {
    const test = message.type === "test.mic" ? "mic" : "speaker";
    useRelay.setState((state) => ({ tests: { ...state.tests, [test]: "pending" } }));
  }
  if (socket?.readyState !== WebSocket.OPEN) {
    pushLog("out", `${JSON.stringify(message)}  (not sent: offline)`);
    return false;
  }
  socket.send(JSON.stringify(message));
  pushLog("out", JSON.stringify(message));
  return true;
}

export function onRelay(listener: (message: RelayIn) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
