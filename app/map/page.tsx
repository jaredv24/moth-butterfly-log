"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useUserCode } from "@/lib/useUserCode";
import type { LogItem, LogResponse } from "@/lib/types";
import type { MapPoint } from "@/components/SightingsMap";

const SightingsMap = dynamic(() => import("@/components/SightingsMap"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-muted">Loading map…</p>,
});

export default function MapPage() {
  const { code } = useUserCode();
  const [log, setLog] = useState<LogItem[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!code) return;
    fetch(`/api/log?code=${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: LogResponse) => {
        setLog(d.log);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [code]);

  // group sightings that share a spot (~11 m) into one marker
  const points = useMemo<MapPoint[]>(() => {
    const groups = new Map<string, MapPoint>();
    for (const s of log ?? []) {
      if (s.lat == null || s.lng == null) continue;
      const key = `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
      const g = groups.get(key);
      if (g) g.sightings.push(s);
      else groups.set(key, { lat: s.lat, lng: s.lng, sightings: [s] });
    }
    return [...groups.values()];
  }, [log]);

  const withoutLocation = (log ?? []).filter((s) => s.lat == null).length;

  return (
    <div className="-mx-4 -mb-8 -mt-5 flex flex-1 flex-col">
      <div className="px-4 pb-2 pt-5">
        <h1 className="text-2xl font-bold tracking-tight">Map</h1>
        <p className="text-sm text-muted">
          {state === "ready"
            ? points.length
              ? `${points.length} location${points.length === 1 ? "" : "s"}` +
                (withoutLocation ? ` · ${withoutLocation} without a location` : "")
              : "No sightings with a location yet."
            : state === "error"
              ? "Couldn't load your sightings."
              : "Loading…"}
        </p>
      </div>

      <div className="relative flex-1 overflow-hidden border-y border-border">
        {state === "ready" && points.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
            Sightings show here once they have a location — turn on location
            access, or upload geotagged photos.
          </div>
        ) : (
          <SightingsMap points={points} />
        )}
      </div>
    </div>
  );
}
