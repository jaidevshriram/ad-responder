import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";

import { StreamingApp } from "@/components/streaming-app";

import "./ad-break.css";

// Editorial type for the ad break: a refined serif for captions, a clean sans.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-ad-serif",
});
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-ad-sans" });

export const metadata: Metadata = {
  title: "NotFlix — Stories after dark",
  description: "A cinematic streaming experience for unforgettable stories.",
};

export default function NotFlixPage() {
  return (
    <div className={`${serif.variable} ${sans.variable}`}>
      <StreamingApp />
    </div>
  );
}
