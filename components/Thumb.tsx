"use client";

import { useState } from "react";

/**
 * <img> that swaps in a neutral emoji tile if the source fails to load, so a
 * dead photo URL never shows a broken-image icon or sprawling alt text.
 */
export function Thumb({
  src,
  alt = "",
  className = "",
  group,
}: {
  src: string | null;
  alt?: string;
  className?: string;
  group?: "butterfly" | "moth" | null;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={`grid shrink-0 place-items-center bg-border text-lg ${className}`}
        aria-hidden
      >
        {group === "moth" ? "🌙" : "🦋"}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
