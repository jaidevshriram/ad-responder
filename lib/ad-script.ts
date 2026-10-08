// The ad's script lives with the voice relay (voice/ad_script.json) so both
// sides read the same beats. The browser uses it for subtitles, the silent
// fallback timeline, the first world direction and the end card.

import script from "@/voice/ad_script.json";

export type AdBeat = { id: string; line: string; scene: string };

export const adScript = script as {
  brand: string;
  title: string;
  world_prompt: string;
  beats: AdBeat[];
  facts: Record<string, string>;
};

/** Gap the relay leaves between narration lines, and its wait after the last. */
export const BEAT_GAP_S = 0.6;
export const TAIL_S = 4;

/** Rough on-screen time of a narration line (calibrated on voice/narration). */
export function beatSeconds(line: string) {
  const words = line.trim().split(/\s+/).length;
  return Math.max(3.2, 0.6 + words * 0.36);
}

/** Estimated length of the whole ad from beat `from` on. */
export function estimateAdSeconds(from = 0) {
  return (
    adScript.beats
      .slice(from)
      .reduce((sum, beat) => sum + beatSeconds(beat.line) + BEAT_GAP_S, 0) +
    TAIL_S
  );
}

/** Facts are written for speech; turn "meridian dot travel slash amalfi" back into text. */
export function spokenToText(text: string) {
  return text
    .replace(/\s+dot\s+/gi, ".")
    .replace(/\s+slash\s+/gi, "/")
    .replace(/\bUS dollars\b/g, "USD");
}

/** The ad's title without the brand in front ("Hilton Amalfi Coast" → "Amalfi Coast"). */
export const adPlace =
  adScript.title.replace(new RegExp(`^${adScript.brand}\\s*[-—·,]?\\s*`, "i"), "").trim() ||
  adScript.title;

/** End-card copy from facts.booking: the URL, then the remaining sentences. */
export function bookingLines() {
  const booking = spokenToText(adScript.facts.booking ?? "");
  const url = booking.match(/[a-z0-9-]+\.[a-z]{2,}(\/[a-z0-9-]+)?/i)?.[0] ?? "";
  const rest = booking
    .split(/(?<=\.)\s+/)
    .map((sentence) => {
      if (!url || !sentence.includes(url)) return sentence;
      // "Book at x.com/y, or say 'book it' …" → "Or say 'book it' …"
      const after = sentence.slice(sentence.indexOf(url) + url.length).replace(/^[\s,;:]+/, "");
      return after ? after[0].toUpperCase() + after.slice(1) : "";
    })
    .filter(Boolean)
    .join(" ");
  return { url, rest };
}
