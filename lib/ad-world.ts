"use client";

// The live HappyOyster world behind the ad break.
//
// Pre-warm ~25 s before the break: token → connect → attach (or create) the
// Amalfi world → startTravel into a hidden <video>. At the break the world is
// already streaming. instruct() is rate-limited to one call per 1.5 s, keeping
// only the latest queued direction. pause()/resume() are never used: they hang
// or fail for this world.

import { HappyOysterModel } from "@reactor-models/happy-oyster";
import { create } from "zustand";

import { adScript } from "@/lib/ad-script";

export type WorldStage =
  | "idle"
  | "token"
  | "connecting"
  | "attaching"
  | "creating"
  | "starting"
  | "streaming"
  | "failed"
  | "closed";

type WorldState = {
  stage: WorldStage;
  phase: string;
  travel: string;
  worldId: string;
  hasFrame: boolean;
  lastInstruct: string;
  lastInstructMs: number | null;
  queued: string;
  error: string;
  timings: Record<string, number>;
};

const initial: WorldState = {
  stage: "idle",
  phase: "idle",
  travel: "—",
  worldId: "",
  hasFrame: false,
  lastInstruct: "",
  lastInstructMs: null,
  queued: "",
  error: "",
  timings: {},
};

export const useWorld = create<WorldState>(() => initial);

const LEGACY_KEY = "ad-lab.world";
const INSTRUCT_GAP_MS = 1500;

async function resolveWorldId(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_AD_WORLD_ID;
  if (fromEnv) return fromEnv;
  try {
    const saved = (await (await fetch("/api/happy-oyster/world", { cache: "no-store" })).json()) as {
      worldId: string | null;
    };
    if (saved.worldId) return saved.worldId;
  } catch {
    /* fall through */
  }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      saveWorldId(legacy);
      return legacy;
    }
  } catch {
    /* storage unavailable */
  }
  return "";
}

function saveWorldId(worldId: string) {
  void fetch("/api/happy-oyster/world", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldId }),
  }).catch(() => undefined);
}

export class AdWorld {
  private model: HappyOysterModel<"directing"> | null = null;
  private video: HTMLVideoElement | null = null;
  private closed = false;
  private lastSentAt = 0;
  private lastSent = "";
  private pending = "";
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private t0 = 0;
  private frameWatch: (() => void) | null = null;

  private mark(step: string) {
    useWorld.setState((state) => ({
      timings: { ...state.timings, [step]: Math.round(performance.now() - this.t0) },
    }));
  }

  get ready() {
    return useWorld.getState().hasFrame;
  }

  /** Open the world into `video`. Safe to call once; never throws. */
  async prewarm(video: HTMLVideoElement) {
    if (this.model || this.closed) return;
    this.video = video;
    this.t0 = performance.now();
    useWorld.setState({ ...initial, stage: "token" });
    this.watchFrames(video);
    try {
      const model = new HappyOysterModel({ mode: "directing", videoElement: video });
      this.model = model;
      model.onPhaseChanged((phase) => useWorld.setState({ phase }));
      model.onTravelState((state) => useWorld.setState({ travel: state.status }));
      model.onTravelError((error) => useWorld.setState({ error: String(error) }));

      const response = await fetch("/api/happy-oyster/token", { method: "POST" });
      const token = (await response.json()) as { jwt?: string; sessionId?: string; error?: string };
      if (!token.jwt || !token.sessionId) throw new Error(token.error || "no token");
      this.mark("token");
      if (this.closed) return;

      useWorld.setState({ stage: "connecting" });
      await model.connect(token.jwt, { sessionId: token.sessionId });
      this.mark("connect");
      if (this.closed) return void model.disconnect().catch(() => undefined);

      let worldId = await resolveWorldId();
      if (worldId) {
        useWorld.setState({ stage: "attaching", worldId });
        await model.attachWorld(worldId);
        this.mark("attach");
      } else {
        useWorld.setState({ stage: "creating" });
        const world = await model.createWorld({
          prompt: adScript.world_prompt,
          resolution: "720p",
          layout: "Stable",
          narrative: "Calm",
        });
        worldId = world.encrypted_world_id ?? "";
        if (worldId) saveWorldId(worldId);
        useWorld.setState({ worldId });
        this.mark("create");
      }
      if (this.closed) return void model.disconnect().catch(() => undefined);

      useWorld.setState({ stage: "starting" });
      await model.startTravel();
      this.mark("travel");
      if (this.closed) return void model.disconnect().catch(() => undefined);
      useWorld.setState({ stage: "streaming" });
      video.play().catch(() => undefined);
      // Open on the first beat's picture so the break lands on the right shot.
      this.instruct(adScript.beats[0]?.scene ?? "");
    } catch (error) {
      useWorld.setState({ stage: "failed", error: (error as Error).message ?? String(error) });
    }
  }

  private watchFrames(video: HTMLVideoElement) {
    const check = () => {
      if (video.readyState >= 2 && video.videoWidth > 0 && !useWorld.getState().hasFrame) {
        useWorld.setState({ hasFrame: true });
        this.mark("first frame");
      }
    };
    const events = ["loadeddata", "playing", "resize", "timeupdate"] as const;
    events.forEach((name) => video.addEventListener(name, check));
    this.frameWatch = () => events.forEach((name) => video.removeEventListener(name, check));
  }

  /** Steer the picture. At most one call per 1.5 s; the latest direction wins. */
  instruct(direction: string) {
    if (!direction || this.closed) return;
    if (direction === this.lastSent || direction === this.pending) return;
    this.pending = direction;
    useWorld.setState({ queued: direction });
    this.flush();
  }

  private flush() {
    if (this.flushTimer || !this.pending) return;
    const model = this.model;
    if (!model || model.phase !== "streaming") {
      // Not streaming yet: keep the latest direction and try again shortly.
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush();
      }, 500);
      return;
    }
    const wait = this.lastSentAt + INSTRUCT_GAP_MS - performance.now();
    if (wait > 0) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush();
      }, wait);
      return;
    }
    const direction = this.pending;
    this.pending = "";
    this.lastSent = direction;
    this.lastSentAt = performance.now();
    useWorld.setState({ queued: "", lastInstruct: direction });
    const started = performance.now();
    model
      .instruct(direction)
      .then(() => useWorld.setState({ lastInstructMs: Math.round(performance.now() - started) }))
      .catch((error) => useWorld.setState({ error: `instruct: ${(error as Error).message}` }));
  }

  /** End the travel and the session. The world itself is kept on the account. */
  async close() {
    this.closed = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.frameWatch?.();
    const model = this.model;
    this.model = null;
    useWorld.setState({ stage: "closed", hasFrame: false });
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    try {
      await model?.disconnect();
    } catch {
      /* already gone */
    }
  }
}
