"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { LatLngBounds } from "leaflet";
import { SpeciesName } from "@/components/SpeciesName";
import { Thumb } from "@/components/Thumb";
import type { LogItem } from "@/lib/types";

export type MapPoint = {
  lat: number;
  lng: number;
  sightings: LogItem[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();

  // Leaflet needs its container's real size; recalc after mount + on resize.
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t = setTimeout(fix, 150);
    window.addEventListener("resize", fix);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", fix);
    };
  }, [map]);

  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 11);
      return;
    }
    const b = new LatLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(b, { padding: [40, 40], maxZoom: 12 });
  }, [points, map]);
  return null;
}

export default function SightingsMap({ points }: { points: MapPoint[] }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () =>
      setDark(
        document.documentElement.dataset.theme === "dark" ||
          (document.documentElement.dataset.theme !== "light" && mq.matches),
      );
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const center = useMemo<[number, number]>(() => {
    if (points.length) return [points[0].lat, points[0].lng];
    return [39.5, -98.35]; // continental US
  }, [points]);

  // Esri's canvas basemaps are keyless; OSM standard is the light fallback.
  const tiles = dark
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
    : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = dark
    ? 'Tiles &copy; Esri'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <MapContainer
      center={center}
      zoom={points.length ? 6 : 4}
      scrollWheelZoom
      className="h-full w-full"
      style={{ background: dark ? "#16150f" : "#f6f4ee" }}
    >
      <TileLayer key={dark ? "dark" : "light"} url={tiles} attribution={attribution} maxZoom={18} />
      {dark && (
        // place + road labels on top of the label-light dark canvas
        <TileLayer
          key="dark-labels"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
          maxZoom={18}
        />
      )}
      <FitBounds points={points} />
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p.lat, p.lng]}
          radius={Math.min(6 + p.sightings.length * 1.5, 14)}
          pathOptions={{
            color: "#3f6f4c",
            fillColor: "#7fb98c",
            fillOpacity: 0.85,
            weight: 2,
          }}
        >
          <Popup>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {p.sightings
                .slice()
                .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
                .map((s) => (
                  <div key={s.id} className="flex gap-2">
                    <Thumb
                      src={s.photoUrl}
                      alt={s.identifiedName}
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0 text-xs leading-tight">
                      <SpeciesName
                        common={s.identifiedName}
                        scientific={s.identifiedScientific}
                      />
                      <div className="mt-0.5 text-[11px] text-muted">
                        {formatDate(s.observedAt)}
                        {s.placeLabel ? ` · ${s.placeLabel}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
