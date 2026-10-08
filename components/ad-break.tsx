"use client";

// "The Ad That Listens": the mid-show ad break.
//
// Timeline: the show eases down → bumper → iris into the live HappyOyster world
// (pre-warmed ~25 s earlier in a hidden video, so it is already streaming) →
// narration beats, conversation captions and fact cards driven by the voice
// relay → end card → the show comes back exactly where it stopped.
// Without the relay the beats play silently on a local timeline.

import { Mic, Play } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  adPlace,
  adScript,
  BEAT_GAP_S,
  beatSeconds,
  bookingLines,
  estimateAdSeconds,
  spokenToText,
  TAIL_S,
} from "@/lib/ad-script";
import { AdWorld, useWorld } from "@/lib/ad-world";
import { isTyping, useDevPanel } from "@/lib/dev-panel";
import { onRelay, relaySend, useRelay, type RelayIn } from "@/lib/relay";

export type AdPhase = "idle" | "bumper" | "world" | "endcard" | "return";

const DEFAULT_AD_AT = 40;
const PREWARM_LEAD_S = 25;
const SHOW_FADE_MS = 600;
const BUMPER_MIN_MS = 2800;
const BUMPER_MAX_MS = 6000;
const END_CARD_MS = 4500;
const RETURN_MS = 900;
const CARD_MS = 8000;
const BEAT_WATCHDOG_MS = 6000;

type Convo = { listening: boolean; user: string; userFinal: boolean; agent: string; leaving: boolean };
type Card = { id: number; title: string; body: string; leaving: boolean };
type Timing = { beatIndex: number; beatLine: string; beatAt: number; frozen: number | null; worldAt: number };

function readAdAt() {
  const value = Number(new URLSearchParams(window.location.search).get("adAt"));
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_AD_AT;
}

function worldDisabled() {
  return new URLSearchParams(window.location.search).get("world") === "off";
}

function rampVolume(video: HTMLVideoElement, to: number, ms: number) {
  return new Promise<void>((resolve) => {
    const from = video.volume;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      video.volume = from + (to - from) * (t * (2 - t));
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

function tailOf(text: string, max = 190) {
  if (text.length <= max) return text;
  const cut = text.slice(-max);
  return "…" + cut.slice(cut.indexOf(" ") + 1);
}

function formatClock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function AdBreak({
  showVideo,
  showTitle,
  onPhase,
  controlsVisible,
}: {
  showVideo: RefObject<HTMLVideoElement | null>;
  showTitle: string;
  onPhase: (phase: AdPhase) => void;
  controlsVisible: boolean;
}) {
  const worldVideo = useRef<HTMLVideoElement>(null);
  const world = useRef<AdWorld | null>(null);
  const [phase, setPhaseState] = useState<AdPhase>("idle");
  const phaseRef = useRef<AdPhase>("idle");
  const [subtitle, setSubtitle] = useState<{ key: string; line: string } | null>(null);
  const [convo, setConvo] = useState<Convo | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [toast, setToast] = useState(false);
  const hasFrame = useWorld((state) => state.hasFrame);
  const relayUp = useRelay((state) => state.connected);
  const agentState = useRelay((state) => state.status?.agent ?? "off");
  const worldStage = useWorld((state) => state.stage);
  const [prepared, setPrepared] = useState(false);
  const devOpen = useDevPanel((state) => state.open);

  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const fallbackTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const driver = useRef<"relay" | "fallback">("relay");
  const resumeAt = useRef(0);
  const showVolume = useRef(0.8);
  const adAt = useRef(DEFAULT_AD_AT);
  const scheduledDone = useRef(false);
  const timing = useRef<Timing>({ beatIndex: -1, beatLine: "", beatAt: 0, frozen: null, worldAt: 0 });
  const cardId = useRef(0);

  const later = useCallback((fn: () => void, ms: number, bag = timers.current) => {
    const id = setTimeout(() => {
      bag.delete(id);
      fn();
    }, ms);
    bag.add(id);
  }, []);

  const setPhase = useCallback(
    (next: AdPhase) => {
      phaseRef.current = next;
      setPhaseState(next);
      onPhase(next);
    },
    [onPhase],
  );

  const prewarm = useCallback(() => {
    if (world.current || !worldVideo.current) return;
    world.current = new AdWorld();
    setPrepared(true);
    relaySend({ type: "ad.prepare" });
    if (!worldDisabled()) void world.current.prewarm(worldVideo.current);
  }, []);

  // ---- messages (relay or fallback) -------------------------------------------

  const handleRef = useRef<(message: RelayIn, from: "relay" | "fallback") => void>(() => {});

  const stopFallback = useCallback(() => {
    fallbackTimers.current.forEach(clearTimeout);
    fallbackTimers.current.clear();
  }, []);

  const runFallback = useCallback(
    (from: number) => {
      stopFallback();
      driver.current = "fallback";
      let at = 0;
      adScript.beats.slice(from).forEach((beat, offset) => {
        const index = from + offset;
        later(
          () =>
            handleRef.current(
              { type: "beat", id: beat.id, index, total: adScript.beats.length, line: beat.line, scene: beat.scene },
              "fallback",
            ),
          at,
          fallbackTimers.current,
        );
        at += (beatSeconds(beat.line) + BEAT_GAP_S) * 1000;
      });
      later(() => handleRef.current({ type: "ad.end" }, "fallback"), at + TAIL_S * 1000, fallbackTimers.current);
    },
    [later, stopFallback],
  );

  const finish = useCallback(() => {
    if (phaseRef.current === "idle" || phaseRef.current === "return") return;
    stopFallback();
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    setPhase("return");
    setConvo(null);
    const video = showVideo.current;
    later(() => {
      void world.current?.close();
      world.current = null;
      setPrepared(false);
      setSubtitle(null);
      setCards([]);
      if (video) {
        if (Math.abs(video.currentTime - resumeAt.current) > 0.25) video.currentTime = resumeAt.current;
        video.volume = 0;
        video.play().catch(() => undefined);
        void rampVolume(video, showVolume.current, 900);
      }
    }, 450);
    later(() => {
      setPhase("idle");
      setToast(true);
      later(() => setToast(false), 2800);
    }, RETURN_MS + 300);
  }, [later, setPhase, showVideo, stopFallback]);

  const endCard = useCallback(() => {
    if (phaseRef.current !== "world") return;
    stopFallback();
    setPhase("endcard");
    setConvo(null);
    setSubtitle(null);
    later(finish, END_CARD_MS);
  }, [finish, later, setPhase, stopFallback]);

  handleRef.current = (message, from) => {
    const active = phaseRef.current === "world";
    if (!active && message.type !== "ad.end") return;
    if (from === "relay" && driver.current === "fallback" && ["beat", "ad.end", "resume"].includes(message.type))
      return;
    switch (message.type) {
      case "beat": {
        timing.current = { ...timing.current, beatIndex: message.index, beatLine: message.line, beatAt: performance.now(), frozen: null };
        setSubtitle({ key: `${message.id}-${message.index}`, line: message.line });
        setConvo((current) => (current ? { ...current, leaving: true } : null));
        world.current?.instruct(message.scene);
        break;
      }
      case "listening": {
        timing.current.frozen = remainingSeconds(timing.current);
        setSubtitle(null);
        setConvo({ listening: true, user: "", userFinal: false, agent: "", leaving: false });
        break;
      }
      case "user":
        setConvo((current) => ({
          listening: !message.final,
          agent: current?.agent ?? "",
          leaving: false,
          user: message.text,
          userFinal: message.final,
        }));
        break;
      case "agent":
        setConvo((current) => ({
          listening: false,
          user: current?.user ?? "",
          userFinal: true,
          leaving: false,
          agent: message.text,
        }));
        break;
      case "scene":
        world.current?.instruct(message.direction);
        relaySend({ type: "scene.done", direction: message.direction });
        break;
      case "card": {
        const id = ++cardId.current;
        setCards((current) => [...current.slice(-1), { id, title: message.title, body: message.body, leaving: false }]);
        later(() => setCards((current) => current.map((card) => (card.id === id ? { ...card, leaving: true } : card))), CARD_MS);
        later(() => setCards((current) => current.filter((card) => card.id !== id)), CARD_MS + 600);
        break;
      }
      case "resume": {
        // Narration continues at the next beat: restart the clock from there.
        timing.current = { ...timing.current, beatIndex: message.index - 1, beatLine: "", beatAt: performance.now(), frozen: null };
        setConvo((current) => (current ? { ...current, leaving: true } : null));
        later(() => setConvo((current) => (current?.leaving ? null : current)), 700);
        break;
      }
      case "ad.end":
        endCard();
        break;
    }
  };

  useEffect(() => onRelay((message) => handleRef.current(message, "relay")), []);

  // Relay drops mid-ad: carry on silently from the next beat.
  useEffect(() => {
    if (!relayUp && phaseRef.current === "world" && driver.current === "relay") {
      runFallback(Math.max(0, timing.current.beatIndex + 1));
    }
  }, [relayUp, runFallback]);

  // ---- the break itself -------------------------------------------------------

  const goWorld = useCallback(() => {
    setPhase("world");
    timing.current = { beatIndex: -1, beatLine: "", beatAt: performance.now(), frozen: null, worldAt: performance.now() };
    if (relaySend({ type: "ad.start" })) {
      driver.current = "relay";
      // Relay is up but no narration arrives: run the silent timeline instead.
      later(() => {
        const t = timing.current;
        if (phaseRef.current === "world" && driver.current === "relay" && t.beatIndex < 0 && t.frozen === null)
          runFallback(0);
      }, BEAT_WATCHDOG_MS);
    } else {
      runFallback(0);
    }
  }, [later, runFallback, setPhase]);

  const start = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    scheduledDone.current = true;
    prewarm();
    setPhase("bumper");
    setSubtitle(null);
    setConvo(null);
    setCards([]);
    const video = showVideo.current;
    if (video) {
      showVolume.current = video.muted ? showVolume.current : video.volume || 0.8;
      void rampVolume(video, 0, SHOW_FADE_MS).then(() => {
        video.pause();
        resumeAt.current = video.currentTime;
      });
    }
    const began = performance.now();
    const poll = () => {
      if (phaseRef.current !== "bumper") return;
      const waited = performance.now() - began;
      const state = useWorld.getState();
      const noWorldComing = state.stage === "failed" || worldDisabled();
      if (waited >= BUMPER_MIN_MS && (state.hasFrame || noWorldComing || waited >= BUMPER_MAX_MS)) goWorld();
      else later(poll, 100);
    };
    later(poll, BUMPER_MIN_MS);
  }, [goWorld, later, prewarm, setPhase, showVideo]);

  const skip = useCallback(() => {
    if (phaseRef.current === "idle" || phaseRef.current === "return") return;
    relaySend({ type: "ad.stop" });
    finish();
  }, [finish]);

  // Schedule: pre-warm at adAt − 25 s, break at adAt (show time).
  useEffect(() => {
    adAt.current = readAdAt();
    const video = showVideo.current;
    if (!video) return;
    const onTime = () => {
      if (scheduledDone.current || phaseRef.current !== "idle") return;
      const t = video.currentTime;
      if (t >= Math.max(0, adAt.current - PREWARM_LEAD_S) && !world.current && !video.paused) prewarm();
      if (t >= adAt.current) start();
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [prewarm, showVideo, start]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "a" && phaseRef.current === "idle") start();
      if (key === "escape" && phaseRef.current !== "idle") {
        event.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip, start]);

  // Push to talk: hold Space (or the on-screen button) while the ad plays. The
  // laptop mic has no echo cancelling, so the relay keeps it closed while the ad
  // speaks; holding opens it and silences the ad at once.
  const [holding, setHolding] = useState(false);
  const setPtt = useCallback((down: boolean) => {
    setHolding((was) => {
      if (was !== down) relaySend({ type: "ptt", down });
      return down;
    });
  }, []);
  useEffect(() => {
    const onDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || phaseRef.current !== "world" || isTyping(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) setPtt(true);
    };
    const onUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setPtt(false);
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
    };
  }, [setPtt]);
  useEffect(() => {
    if (phase !== "world") setPtt(false);
  }, [phase, setPtt]);

  // Leaving the player mid-ad: stop the audio and close the world session.
  useEffect(() => {
    const bag = timers.current;
    const fallback = fallbackTimers.current;
    const close = () => {
      if (phaseRef.current !== "idle") relaySend({ type: "ad.stop" });
      void world.current?.close();
      world.current = null;
    };
    window.addEventListener("pagehide", close);
    return () => {
      window.removeEventListener("pagehide", close);
      bag.forEach(clearTimeout);
      fallback.forEach(clearTimeout);
      close();
    };
  }, []);

  const booking = bookingLines();
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <>
      <div className={`ad-layer phase-${phase} ${hasFrame ? "world-live" : ""} ${devOpen ? "dev-open" : ""}`} aria-hidden={phase === "idle"}>
        <div className="ad-world">
          <div className="ad-world-plate">
            <span>{adScript.brand}</span>
            <strong>{adPlace}</strong>
          </div>
          <video ref={worldVideo} className="ad-world-video" muted autoPlay playsInline />
          <div className="ad-iris" />
          <div className="ad-scrim" />
        </div>

        <div className="ad-bumper" role="status">
          <div className="bumper-tag">
            Ad <i>·</i> {formatClock(Math.round(estimateAdSeconds(0) / 5) * 5)}
          </div>
          <div className="bumper-rule" />
          <p className="bumper-sponsor">
            Brought to you by <em>{adScript.brand}</em>
          </p>
          <p className="bumper-listens">
            <span className="mic-dot">
              <Mic />
            </span>
            This ad listens — just ask
          </p>
        </div>

        <div className="ad-overlay">
          <AdPill phase={phase} timing={timing} />
          <MicChip active={Boolean(convo?.listening)} />

          <div className="ad-lockup">
            <strong>{adScript.brand}</strong>
            <i>·</i>
            <span>{adPlace}</span>
          </div>

          <div className="ad-cards">
            {cards.map((card) => (
              <article key={card.id} className={`ad-card ${card.leaving ? "leaving" : ""}`}>
                <h4>{spokenToText(card.title)}</h4>
                <p>{spokenToText(card.body)}</p>
              </article>
            ))}
          </div>

          {phase === "world" && (
            <div className="ad-asks" aria-label="Ask the ad">
              <button
                type="button"
                className={`ad-ask ad-hold ${holding ? "holding" : ""}`}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setPtt(true);
                }}
                onPointerUp={() => setPtt(false)}
                onPointerCancel={() => setPtt(false)}
              >
                <Mic size={14} strokeWidth={2.2} />
                {holding ? "Listening — release to send" : "Hold Space to ask"}
              </button>
              {(adScript.suggestions ?? []).map((question) => (
                <button
                  key={question}
                  type="button"
                  className="ad-ask"
                  disabled={Boolean(convo && !convo.leaving)}
                  onClick={() => relaySend({ type: "ask", text: question })}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <div className="ad-captions" aria-live="polite">
            {subtitle && !convo && (
              <p key={subtitle.key} className="ad-subtitle">
                {subtitle.line}
              </p>
            )}
            {convo && (
              <div className={`ad-convo ${convo.leaving ? "leaving" : ""}`}>
                {convo.user ? (
                  <p className={`convo-user ${convo.userFinal ? "final" : ""}`}>
                    <small>You</small>
                    {tailOf(convo.user, 140)}
                  </p>
                ) : (
                  <p className="convo-listening">Listening…</p>
                )}
                {!convo.listening && !convo.agent && convo.userFinal && (
                  <p className="convo-thinking" aria-label="Thinking">
                    <i />
                    <i />
                    <i />
                  </p>
                )}
                {convo.agent && (
                  <p className="convo-agent">
                    <small>{adScript.brand}</small>
                    {tailOf(convo.agent)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="ad-endcard">
          <span className="endcard-brand">{adScript.brand}</span>
          <h2>{adPlace}</h2>
          <div className="endcard-rule" />
          <p className="endcard-url">{booking.url}</p>
          {booking.rest && <p className="endcard-note">{booking.rest}</p>}
        </div>

        {isDev && !relayUp && phase !== "idle" && (
          <div className="ad-dev-warning">relay offline · silent fallback</div>
        )}
      </div>
      {phase === "idle" && (
        <StartButton
          visible={controlsVisible}
          prepared={prepared}
          worldReady={worldDisabled() || (hasFrame && worldStage === "streaming")}
          worldFailed={worldStage === "failed"}
          relayReady={!relayUp || agentState === "ready"}
          onPrepare={prewarm}
          onStart={start}
        />
      )}
      <div className={`ad-toast ${toast ? "show" : ""}`} role="status">
        <i />
        Back to <strong>{showTitle}</strong>
      </div>
    </>
  );
}

function remainingSeconds(timing: Timing) {
  if (timing.frozen !== null) return timing.frozen;
  const elapsed = (performance.now() - timing.beatAt) / 1000;
  if (timing.beatIndex < 0) return estimateAdSeconds(0) - Math.min(elapsed, 1.5);
  const current = timing.beatLine ? beatSeconds(timing.beatLine) + BEAT_GAP_S : 0;
  return estimateAdSeconds(timing.beatIndex + 1) + Math.max(0, current - elapsed);
}

function AdPill({ phase, timing }: { phase: AdPhase; timing: RefObject<Timing> }) {
  const [remaining, setRemaining] = useState(estimateAdSeconds(0));
  useEffect(() => {
    if (phase !== "world" && phase !== "endcard") return;
    const tick = () => setRemaining(phase === "endcard" ? 0 : remainingSeconds(timing.current));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [phase, timing]);
  const total = estimateAdSeconds(0);
  const progress = Math.min(1, Math.max(0, 1 - remaining / total));
  const circumference = 2 * Math.PI * 7;
  return (
    <div className="ad-pill">
      <svg viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r="7" className="ring-track" />
        <circle
          cx="9"
          cy="9"
          r="7"
          className="ring-fill"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <span>
        Ad <i>·</i> {formatClock(remaining)}
      </span>
    </div>
  );
}

function MicChip({ active }: { active: boolean }) {
  const level = useRelay((state) => state.level.mic);
  const glow = Math.min(1, level * 3);
  return (
    <div className={`ad-mic ${active ? "active" : ""}`} style={{ "--mic": glow } as React.CSSProperties}>
      <span className="mic-dot">
        <Mic />
      </span>
      {active ? "Listening" : "This ad listens"}
    </div>
  );
}

function StartButton({
  visible,
  prepared,
  worldReady,
  worldFailed,
  relayReady,
  onPrepare,
  onStart,
}: {
  visible: boolean;
  prepared: boolean;
  worldReady: boolean;
  worldFailed: boolean;
  relayReady: boolean;
  onPrepare: () => void;
  onStart: () => void;
}) {
  const ready = prepared && (worldReady || worldFailed) && relayReady;
  const label = !prepared
    ? "Prepare ad"
    : ready
      ? worldFailed
        ? "Start the ad (no world)"
        : "Start the ad"
      : !worldReady
        ? "Preparing ad…"
        : "Waiting for voice…";
  return (
    <button
      className={`ad-start ${visible ? "visible" : ""} ${ready ? "ready" : prepared ? "preparing" : ""}`}
      disabled={prepared && !ready}
      onClick={(event) => {
        event.stopPropagation();
        if (!prepared) onPrepare();
        else if (ready) onStart();
      }}
    >
      <span className="ad-start-dot" />
      {label}
      {ready && <Play />}
    </button>
  );
}
