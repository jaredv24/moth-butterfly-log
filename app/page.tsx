"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/components/ProgressRing";
import { SeenBadge } from "@/components/SeenBadge";
import { SpeciesName } from "@/components/SpeciesName";
import { Thumb } from "@/components/Thumb";
import { useUserCode } from "@/lib/useUserCode";
import type { Candidate, IdentifyResponse, LogResponse } from "@/lib/types";

type Phase = "idle" | "identifying" | "results" | "logging" | "done";
type Coords = { lat: number; lng: number } | null;

export default function IdentifyPage() {
  const { code, loading } = useUserCode();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [result, setResult] = useState<IdentifyResponse | null>(null);
  const [coords, setCoords] = useState<Coords>(null);
  const coordsRef = useRef<Coords>(null);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "ok" | "denied">("idle");
  const [logSummary, setLogSummary] = useState<LogResponse | null>(null);
  const [done, setDone] = useState<{
    name: string;
    scientific: string;
    placeLabel: string | null;
    isNewSpecies: boolean;
    checklisted: boolean;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadSummary = useCallback(async () => {
    if (!code) return;
    const res = await fetch(`/api/log?code=${code}`);
    if (res.ok) setLogSummary(await res.json());
  }, [code]);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/log?code=${code}`);
      if (!cancelled && res.ok) setLogSummary(await res.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  function reset() {
    setPhase("idle");
    setError(null);
    setPhotoPreview(null);
    setResult(null);
    setDone(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function captureLocation() {
    if (!("geolocation" in navigator)) return;
    setGeoState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        coordsRef.current = c;
        setCoords(c);
        setGeoState("ok");
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPhotoPreview(URL.createObjectURL(file));
    captureLocation();
    setPhase("identifying");

    try {
      // give a cached GPS fix a moment to arrive so the model gets a geo prior
      await new Promise((r) => setTimeout(r, 400));
      const form = new FormData();
      form.append("photo", file);
      const c = coordsRef.current;
      if (c) {
        form.append("lat", String(c.lat));
        form.append("lng", String(c.lng));
      }
      const res = await fetch("/api/identify", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Identification failed");
      setResult(data as IdentifyResponse);
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  }

  async function confirm(candidate: Candidate) {
    if (!code || !result) return;
    setPhase("logging");
    setError(null);
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          photoUrl: result.photoUrl,
          name: candidate.match.commonName,
          scientificName: candidate.match.scientificName,
          inatTaxonId: candidate.inatTaxonId,
          confidence: candidate.confidence,
          speciesId: candidate.match.speciesId,
          matchLevel: candidate.match.matchLevel,
          lat: (coordsRef.current ?? coords)?.lat ?? null,
          lng: (coordsRef.current ?? coords)?.lng ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save to your log");
      setDone({
        name: candidate.match.commonName,
        scientific: candidate.match.scientificName,
        placeLabel: data.placeLabel ?? null,
        isNewSpecies: !!data.isNewSpecies,
        checklisted: candidate.match.speciesId != null,
      });
      setPhase("done");
      loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("results");
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Moth &amp; Butterfly Log</h1>
        <p className="text-sm text-muted">
          Photograph one, identify it, tick it off your North American life list.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {phase === "idle" && (
        <>
          <button
            onClick={() => fileInput.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/50 bg-surface px-4 py-10 text-accent transition active:scale-[0.99]"
          >
            <span className="text-4xl">🦋</span>
            <span className="text-base font-semibold">Take or upload a photo</span>
            <span className="text-xs text-muted">JPEG / PNG · up to 12 MB</span>
          </button>

          {logSummary && (
            <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold">Life list</h2>
              <ProgressBar
                label="Butterflies"
                seen={logSummary.stats.butterfliesSeen}
                total={logSummary.stats.totalButterflies}
              />
              <ProgressBar
                label="Moths"
                seen={logSummary.stats.mothsSeen}
                total={logSummary.stats.totalMoths}
              />
              <Link
                href="/checklist"
                className="block pt-1 text-sm font-medium text-accent"
              >
                Browse the full checklist →
              </Link>
            </section>
          )}

          <RecentStrip log={logSummary?.log ?? []} />
        </>
      )}

      {(phase === "identifying" || phase === "results" || phase === "logging") &&
        photoPreview && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Your photo"
              className="max-h-72 w-full object-cover"
            />
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
              {geoState === "ok" && <span>📍 Location captured</span>}
              {geoState === "asking" && <span>📍 Getting location…</span>}
              {geoState === "denied" && <span>📍 Location off — badge will show the date only</span>}
            </div>
          </div>
        )}

      {phase === "identifying" && (
        <p className="text-center text-sm text-muted">Identifying…</p>
      )}

      {phase === "results" && result && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Best matches — tap the right one
          </h2>
          {result.candidates.map((c, i) => (
            <button
              key={i}
              onClick={() => confirm(c)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition active:scale-[0.99]"
            >
              <Thumb
                src={c.match.thumbUrl}
                group={c.match.group}
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <SpeciesName
                  common={c.match.commonName}
                  scientific={c.match.scientificName}
                />
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <span>{Math.round(c.confidence * 100)}% match</span>
                  {c.match.speciesId == null && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
                      not on NA checklist
                    </span>
                  )}
                  {c.match.matchLevel === "genus" && (
                    <span className="rounded bg-border px-1.5 py-0.5">genus-level</span>
                  )}
                </div>
              </div>
              <span className="text-accent">›</span>
            </button>
          ))}
          <button onClick={reset} className="w-full py-2 text-sm text-muted">
            Cancel
          </button>
        </section>
      )}

      {phase === "logging" && (
        <p className="text-center text-sm text-muted">Saving to your log…</p>
      )}

      {phase === "done" && done && (
        <section className="space-y-4 rounded-2xl border border-accent/40 bg-accent/8 p-5 text-center">
          <div className="text-4xl">{done.isNewSpecies ? "🎉" : "✓"}</div>
          <div>
            <h2 className="text-lg font-bold">{done.name}</h2>
            <p className="text-sm italic text-muted">{done.scientific}</p>
          </div>
          <p className="text-sm">
            {done.isNewSpecies
              ? "New species added to your life list!"
              : done.checklisted
                ? "Already on your life list — sighting logged."
                : "Logged under “other sightings.”"}
          </p>
          <div className="flex justify-center">
            <SeenBadge placeLabel={done.placeLabel} observedAt={new Date().toISOString()} />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={reset}
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg"
            >
              Log another
            </button>
            <Link
              href="/checklist"
              className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
            >
              View checklist
            </Link>
          </div>
        </section>
      )}

      {loading && phase === "idle" && (
        <p className="text-center text-xs text-muted">Setting up your log…</p>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}

function RecentStrip({ log }: { log: LogResponse["log"] }) {
  if (log.length === 0) return null;
  const recent = [...log].reverse().slice(0, 6);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Recent sightings</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {recent.map((s) => (
          <div key={s.id} className="w-24 shrink-0">
            <Thumb
              src={s.photoUrl}
              alt={s.identifiedName}
              className="h-24 w-24 rounded-lg object-cover"
            />
            <div className="mt-1 truncate text-[11px] font-medium">
              {s.identifiedName}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
