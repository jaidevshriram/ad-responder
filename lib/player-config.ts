export type PlayerFeature =
  | "seek"
  | "volume"
  | "captions"
  | "playbackRate"
  | "fullscreen"
  | "keyboard";

/** Central editing surface for the custom player and future backend config. */
export const defaultPlayerConfig = {
  accent: "#ef233c",
  controlsHideDelayMs: 2_600,
  seekStepSeconds: 10,
  rates: [0.5, 1, 1.25, 1.5, 2],
  features: [
    "seek",
    "volume",
    "captions",
    "playbackRate",
    "fullscreen",
    "keyboard",
  ] satisfies PlayerFeature[],
};

export type PlayerConfig = typeof defaultPlayerConfig;
