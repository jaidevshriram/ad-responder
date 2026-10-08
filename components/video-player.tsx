"use client";

import {
  ArrowLeft,
  Captions,
  Gauge,
  ListVideo,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Artwork } from "@/components/artwork";
import type { PlaybackSource, Title } from "@/lib/catalog";
import { defaultPlayerConfig, type PlayerConfig } from "@/lib/player-config";

type VideoPlayerProps = {
  source: PlaybackSource;
  title: Title;
  onBack: () => void;
  config?: PlayerConfig;
};

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const total = Math.max(0, Math.floor(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function VideoPlayer({
  source,
  title,
  onBack,
  config = defaultPlayerConfig,
}: VideoPlayerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [hasFrame, setHasFrame] = useState(false);
  const [error, setError] = useState("");
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rate, setRate] = useState(1);
  const [captions, setCaptions] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [seekPreview, setSeekPreview] = useState<{
    left: number;
    time: number;
  } | null>(null);

  const remaining = useMemo(
    () => Math.max(0, duration - time),
    [duration, time],
  );
  const progressPercent = duration ? (time / duration) * 100 : 0;
  const bufferedPercent = duration ? (buffered / duration) * 100 : 0;

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing && !settingsOpen) {
      hideTimer.current = setTimeout(
        () => setControlsVisible(false),
        config.controlsHideDelayMs,
      );
    }
  }, [config.controlsHideDelayMs, playing, settingsOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source.src) return;
    let hls: { destroy: () => void } | undefined;

    setError("");
    setEnded(false);
    setHasFrame(false);
    setBuffering(true);

    if (source.type === "hls") {
      import("hls.js").then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const instance = new Hls();
          instance.loadSource(source.src!);
          instance.attachMedia(video);
          hls = instance;
        } else {
          video.src = source.src!;
        }
      });
    } else {
      video.src = source.src;
    }

    video.volume = 0.8;
    video.play().catch(() => setPlaying(false));
    return () => hls?.destroy();
  }, [source]);

  useEffect(() => {
    const onFullscreen = () =>
      setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    revealControls();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [revealControls]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.ended) video.currentTime = 0;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(
      Math.max(0, video.currentTime + seconds),
      video.duration || 0,
    );
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) shellRef.current?.requestFullscreen();
    else document.exitFullscreen();
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !("pictureInPictureEnabled" in document)) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await video.requestPictureInPicture();
  }, []);

  const updateBuffered = useCallback(() => {
    const video = videoRef.current;
    if (!video?.buffered.length) return;
    setBuffered(video.buffered.end(video.buffered.length - 1));
  }, []);

  const updateSeekPreview = (event: ReactPointerEvent<HTMLInputElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      Math.max((event.clientX - bounds.left) / bounds.width, 0),
      1,
    );
    setSeekPreview({ left: ratio * bounds.width, time: ratio * duration });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ([" ", "k", "arrowleft", "arrowright", "m", "f", "c"].includes(key))
        event.preventDefault();
      if (key === " " || key === "k") togglePlayback();
      if (key === "arrowleft" || key === "j") seekBy(-config.seekStepSeconds);
      if (key === "arrowright" || key === "l") seekBy(config.seekStepSeconds);
      if (key === "m") toggleMute();
      if (key === "f") toggleFullscreen();
      if (key === "c") setCaptions((value) => !value);
      if (key === "escape" && !document.fullscreenElement) onBack();
      revealControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    config.seekStepSeconds,
    onBack,
    revealControls,
    seekBy,
    toggleFullscreen,
    toggleMute,
    togglePlayback,
  ]);

  if (source.type === "orbis") {
    return (
      <div className="watch-screen generated-player">
        <button
          className="player-back"
          onClick={onBack}
          aria-label="Back to title details"
        >
          <ArrowLeft />
        </button>
        <div>
          <p className="kicker">LIVE GENERATED PLAYBACK</p>
          <h1>{title.name}</h1>
          <p>
            This title is ready to connect to the existing Orbis stream adapter.
          </p>
        </div>
      </div>
    );
  }

  const VolumeIcon =
    muted || volume === 0 ? VolumeX : volume < 0.55 ? Volume1 : Volume2;

  return (
    <div
      ref={shellRef}
      style={{ "--red": config.accent } as React.CSSProperties}
      className={`watch-screen ${controlsVisible ? "controls-visible" : "controls-hidden"} ${playing ? "is-playing" : "is-paused"}`}
      onMouseMove={revealControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
    >
      <Artwork artwork={title.artwork} className="player-poster" />
      <video
        ref={videoRef}
        className={`player-video ${hasFrame ? "has-frame" : ""}`}
        playsInline
        onClick={togglePlayback}
        onPlaying={() => {
          setPlaying(true);
          setEnded(false);
          setBuffering(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          setControlsVisible(true);
        }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onLoadedData={() => setHasFrame(true)}
        onProgress={updateBuffered}
        onError={() => {
          setBuffering(false);
          setError("This title could not be loaded.");
        }}
        onTimeUpdate={(event) => {
          setTime(event.currentTarget.currentTime);
          updateBuffered();
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
      />
      <div className="player-vignette" aria-hidden="true" />

      {buffering && !error && (
        <div className="buffer-spinner" aria-label="Buffering" />
      )}
      {error && (
        <div className="player-error">
          <X />
          <strong>Playback unavailable</strong>
          <p>{error}</p>
          <button onClick={onBack}>Back to NotFlix</button>
        </div>
      )}
      {!playing && !buffering && !error && (
        <button
          className="center-play"
          onClick={togglePlayback}
          aria-label={ended ? "Replay" : "Play"}
        >
          {ended ? <RotateCcw /> : <Play fill="currentColor" />}
          {ended && <span>Play again</span>}
        </button>
      )}

      <button
        className="player-back"
        onClick={onBack}
        aria-label="Back to title details"
      >
        <ArrowLeft />
      </button>
      <div className="player-title-top">
        <span>Now playing</span>
        <strong>{title.name}</strong>
      </div>
      <div className="player-quality">HD</div>

      <div className="player-controls">
        <div className="scrubber-wrap">
          {seekPreview && (
            <output className="seek-tooltip" style={{ left: seekPreview.left }}>
              {formatTime(seekPreview.time)}
            </output>
          )}
          <input
            aria-label="Playback position"
            className="scrubber"
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={time}
            onPointerMove={updateSeekPreview}
            onPointerLeave={() => setSeekPreview(null)}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (videoRef.current) videoRef.current.currentTime = next;
              setTime(next);
            }}
            style={
              {
                "--progress": `${progressPercent}%`,
                "--buffered": `${bufferedPercent}%`,
              } as React.CSSProperties
            }
          />
        </div>

        <div className="player-control-row">
          <div className="player-control-group">
            <button
              className="transport primary-transport"
              onClick={togglePlayback}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <Pause fill="currentColor" />
              ) : (
                <Play fill="currentColor" />
              )}
            </button>
            <button
              className="transport skip"
              onClick={() => seekBy(-config.seekStepSeconds)}
              aria-label={`Back ${config.seekStepSeconds} seconds`}
            >
              <RotateCcw />
              <small>{config.seekStepSeconds}</small>
            </button>
            <button
              className="transport skip"
              onClick={() => seekBy(config.seekStepSeconds)}
              aria-label={`Forward ${config.seekStepSeconds} seconds`}
            >
              <RotateCw />
              <small>{config.seekStepSeconds}</small>
            </button>
            <button className="transport" aria-label="Next episode">
              <SkipForward />
            </button>
            <div className="volume-control">
              <button
                className="transport"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                <VolumeIcon />
              </button>
              <input
                aria-label="Volume"
                className="volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setVolume(next);
                  setMuted(false);
                  if (videoRef.current) {
                    videoRef.current.volume = next;
                    videoRef.current.muted = false;
                  }
                }}
                style={
                  {
                    "--volume": `${(muted ? 0 : volume) * 100}%`,
                  } as React.CSSProperties
                }
              />
            </div>
            <span className="timecode">
              {formatTime(time)} <i>/</i> {formatTime(duration)}
            </span>
          </div>

          <div className="player-program">
            <strong>{title.name}</strong>
            <span>
              {title.runtime.includes("episode")
                ? "S1:E1  The beginning"
                : `${formatTime(remaining)} remaining`}
            </span>
          </div>

          <div className="player-control-group player-control-right">
            <button
              className={`transport ${captions ? "active" : ""}`}
              onClick={() => setCaptions((value) => !value)}
              aria-label="Captions"
              aria-pressed={captions}
            >
              <Captions />
            </button>
            <button className="transport" aria-label="Episodes">
              <ListVideo />
            </button>
            <button
              className="transport pip-button"
              onClick={togglePictureInPicture}
              aria-label="Picture in picture"
            >
              <PictureInPicture2 />
            </button>
            <div className="settings-wrap">
              {settingsOpen && (
                <div className="settings-menu">
                  <div className="settings-title">
                    <Gauge />
                    <span>Playback speed</span>
                  </div>
                  <div className="rate-options">
                    {config.rates.map((value) => (
                      <button
                        key={value}
                        className={rate === value ? "selected" : ""}
                        onClick={() => {
                          setRate(value);
                          if (videoRef.current)
                            videoRef.current.playbackRate = value;
                          setSettingsOpen(false);
                        }}
                      >
                        <i />
                        {value === 1 ? "Normal" : `${value}×`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                className={`transport rate-button ${settingsOpen ? "active" : ""}`}
                onClick={() => setSettingsOpen((value) => !value)}
                aria-label="Playback settings"
              >
                {rate}×
              </button>
            </div>
            <button
              className="transport"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <Minimize /> : <Maximize />}
            </button>
          </div>
        </div>
      </div>

      {captions && (
        <div className="caption-sample">The signal is getting stronger.</div>
      )}
    </div>
  );
}
