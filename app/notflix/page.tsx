import type { Metadata } from "next";

import { StreamingApp } from "@/components/streaming-app";

export const metadata: Metadata = {
  title: "NotFlix — Stories after dark",
  description: "A cinematic streaming experience for unforgettable stories.",
};

export default function NotFlixPage() {
  return <StreamingApp />;
}
