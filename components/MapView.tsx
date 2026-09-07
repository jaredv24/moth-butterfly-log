"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { LogItem } from "@/lib/types";
import type { MapPoint } from "@/components/SightingsMap";

const SightingsMap = dynamic(() => import("@/components/SightingsMap"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-muted">Loading map…</p>,
});

/** Plots a set of sightings; grouping ones that share a spot (~11 m). */
export function MapView({
  log,
  emptyHint = "Sightings show here once they have a location.",
}: {
  log: LogItem[];
  emptyHint?: string;
}) {
  const points = useMemo<MapPoint[]>(() => {
    const groups = new Map<string, MapPoint>();
    for (const s of log) {
      if (s.lat == null || s.lng == null) continue;
      const key = `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
      const g = groups.get(key);
      if (g) g.sightings.push(s);
      else groups.set(key, { lat: s.lat, lng: s.lng, sightings: [s] });
    }
    return [...groups.values()];
  }, [log]);

  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        {emptyHint}
      </div>
    );
  }
  return (
    <div className="h-[65dvh] overflow-hidden rounded-2xl border border-border">
      <SightingsMap points={points} />
    </div>
  );
}
