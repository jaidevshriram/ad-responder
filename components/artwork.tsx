import type { CSSProperties } from "react";

import type { Artwork as ArtworkData } from "@/lib/catalog";

export function Artwork({
  artwork,
  className = "",
}: {
  artwork: ArtworkData;
  className?: string;
}) {
  const style = {
    "--art-gradient": artwork.gradient,
    "--art-accent": artwork.accent,
    "--art-image": artwork.image ? `url(${artwork.image})` : "none",
  } as CSSProperties;

  return (
    <div
      className={`artwork artwork-${artwork.motif} ${artwork.image ? "artwork-has-image" : ""} ${className}`}
      style={style}
      aria-hidden="true"
    >
      <span className="artwork-shape artwork-shape-one" />
      <span className="artwork-shape artwork-shape-two" />
      <span className="artwork-noise" />
    </div>
  );
}
