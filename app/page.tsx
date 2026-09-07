"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/components/ProgressRing";
import { SeenBadge } from "@/components/SeenBadge";
import { SpeciesName } from "@/components/SpeciesName";
import { SightingSheet } from "@/components/SightingSheet";
import { SpeciesPicker } from "@/components/SpeciesPicker";
import { Thumb } from "@/components/Thumb";
import { readPhotoMeta } from "@/lib/exif";
import { shrinkImage } from "@/lib/resize";
import { useUserCode } from "@/lib/useUserCode";
import type { Candidate, ChecklistItem, IdentifyResponse, LogResponse } from "@/lib/types";

type Phase = "idle" | "identifying" | "results" | "logging" | "done";
type Coords = { lat: number; lng: number } | null;

type LogArgs = {
  name: string;
  scientificName: string;
  speciesId: number | null;
  matchLevel: "species" | "genus" | "off-list";
  confidence: number | null;
  inatTaxonId: number | null;
  otherGroup?: string | null;
};

export default function IdentifyPage() {
  const { code, loading } = useUserCode();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [picking, setPicking] = useState(false);
  const coordsRef = useRef<Coords>(null);
  const observedAtRef = useRef<string | null>(null);
  const photoRef = useRef<Blob | null>(null);
  const [geoState, setGeoState] = useState<
    "idle" | "asking" | "ok" | "denied" | "photo"
  >("idle");
  const [timeFromPhoto, setTimeFromPhoto] = useState(false);
  const [logSummary, setLogSummary] = useState<LogResponse | null>(null);
  const [sheetSpecies, setSheetSpecies] = useState<string | null>(null);
  const [done, setDone] = useState<{
    name: string;
    scientific: string;
    placeLabel: string | null;
    isNewSpecies: boolean;
    checklisted: boolean;
    otherGroup: string | null;
    observedAt: string;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadSummary = () => {
    if (!code) return;
    fetch(`/api/log?code=${code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLogSummary(d));
  };

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    fetch(`/api/log?code=${code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d && setLogSummary(d));
    return () => {
      cancelled = true;
    };
  }, [code]);

  function reset() {
    setPhase("idle");
    setError(null);
    setPhotoPreview(null);
    setCandidates(null);
    setPicking(false);
    setDone(null);
    setTimeFromPhoto(false);
    setGeoState("idle");
    photoRef.current = null;
    coordsRef.current = null;
    observedAtRef.current = null;
    if (fileInput.current) fileInput.current.value = "";
  }

  /**
   * Only called when the photo carried no GPS of its own. Resolves once a fix
   * lands or after `waitMs`, so identification can wait for it without stalling.
   */
  function captureLocation(waitMs = 3000): Promise<void> {
    if (!("geolocation" in navigator)) return Promise.resolve();
    setGeoState("asking");
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      const cap = setTimeout(finish, waitMs);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGeoState("ok");
          clearTimeout(cap);
          finish();
        },
        () => {
          setGeoState("denied");
          clearTimeout(cap);
          finish();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    });
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPhase("identifying");

    try {
      // Read capture GPS + time from EXIF BEFORE shrinking (canvas drops it).
      const meta = await readPhotoMeta(file);
      let locating: Promise<void> = Promise.resolve();
      if (meta.gpsFromPhoto && meta.lat != null && meta.lng != null) {
        coordsRef.current = { lat: meta.lat, lng: meta.lng };
        setGeoState("photo");
      } else {
        locating = captureLocation(); // no photo GPS — use where we are now
      }
      if (meta.takenAt) {
        observedAtRef.current = meta.takenAt;
        setTimeFromPhoto(true);
      }

      const blob = await shrinkImage(file);
      photoRef.current = blob;
      setPhotoPreview(URL.createObjectURL(blob));

      // Wait for a location fix so the identifier gets it as a regional prior.
      await locating;
      const form = new FormData();
      form.append("photo", blob, "photo.jpg");
      const c = coordsRef.current;
      if (c) {
        form.append("lat", String(c.lat));
        form.append("lng", String(c.lng));
      }
      if (observedAtRef.current) form.append("observedAt", observedAtRef.current);
      const res = await fetch("/api/identify", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Identification failed");
      setCandidates((data as IdentifyResponse).candidates);
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  }

  async function logSighting(args: LogArgs) {
    if (!code || !photoRef.current) return;
    setPhase("logging");
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", photoRef.current, "photo.jpg");
      form.append("code", code);
      form.append("name", args.name);
      form.append("scientificName", args.scientificName);
      form.append("matchLevel", args.matchLevel);
      if (args.speciesId != null) form.append("speciesId", String(args.speciesId));
      if (args.confidence != null) form.append("confidence", String(args.confidence));
      if (args.inatTaxonId != null) form.append("inatTaxonId", String(args.inatTaxonId));
      if (args.otherGroup) form.append("otherGroup", args.otherGroup);
      const c = coordsRef.current;
      if (c) {
        form.append("lat", String(c.lat));
        form.append("lng", String(c.lng));
      }
      if (observedAtRef.current) form.append("observedAt", observedAtRef.current);

      const res = await fetch("/api/log", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save to your log");
      setDone({
        name: args.name,
        scientific: args.scientificName,
        placeLabel: data.placeLabel ?? null,
        isNewSpecies: !!data.isNewSpecies,
        checklisted: args.speciesId != null,
        otherGroup: args.otherGroup ?? null,
        observedAt: data.sighting?.observedAt ?? new Date().toISOString(),
      });
      setPhase("done");
      loadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("results");
    }
  }

  const confirmCandidate = (c: Candidate) =>
    logSighting({
      name: c.match.commonName,
      scientificName: c.match.scientificName,
      speciesId: c.match.speciesId,
      matchLevel: c.match.matchLevel,
      confidence: c.confidence,
      inatTaxonId: c.inatTaxonId,
      otherGroup: c.otherGroup,
    });

  const confirmManual = (it: ChecklistItem) => {
    setPicking(false);
    logSighting({
      name: it.commonName,
      scientificName: it.scientificName,
      speciesId: it.id,
      matchLevel: "species",
      confidence: null,
      inatTaxonId: it.inatTaxonId,
    });
  };

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
              <Link href="/checklist" className="block pt-1 text-sm font-medium text-accent">
                Browse the full checklist →
              </Link>
            </section>
          )}

          {logSummary && logSummary.stats.otherSpecies > 0 && (
            <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">Other bugs</h2>
                <span className="text-xs text-muted">
                  {logSummary.stats.otherSpecies} species
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {logSummary.stats.otherGroups.map((g) => (
                  <span
                    key={g.group}
                    className="rounded-full bg-border px-2 py-0.5 text-[11px] font-medium"
                  >
                    {g.group} · {g.species}
                  </span>
                ))}
              </div>
            </section>
          )}

          <RecentStrip
            log={logSummary?.log ?? []}
            onOpen={setSheetSpecies}
          />
        </>
      )}

      {(phase === "identifying" || phase === "results" || phase === "logging") &&
        photoPreview && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="Your photo" className="max-h-72 w-full object-cover" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-muted">
              {geoState === "photo" && <span>📍 Location from photo</span>}
              {geoState === "ok" && <span>📍 Current location</span>}
              {geoState === "asking" && <span>📍 Getting location…</span>}
              {geoState === "denied" && <span>📍 No location — date only</span>}
              {timeFromPhoto && <span>🕑 Date from photo</span>}
            </div>
          </div>
        )}

      {phase === "identifying" && (
        <p className="text-center text-sm text-muted">Identifying…</p>
      )}

      {phase === "results" && candidates && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            {candidates.length ? "Best matches — tap the right one" : "No match found"}
          </h2>
          {candidates.map((c, i) => (
            <button
              key={i}
              onClick={() => confirmCandidate(c)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition active:scale-[0.99]"
            >
              <Thumb
                src={c.match.thumbUrl}
                group={c.match.group}
                className="h-14 w-14 shrink-0 rounded-lg bg-border object-cover"
              />
              <div className="min-w-0 flex-1">
                <SpeciesName common={c.match.commonName} scientific={c.match.scientificName} />
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <span>{Math.round(c.confidence * 100)}% match</span>
                  {c.match.speciesId == null && c.otherGroup && (
                    <span className="rounded bg-border px-1.5 py-0.5">
                      {c.otherGroup} · goes in your bug list
                    </span>
                  )}
                  {c.match.speciesId == null && !c.otherGroup && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
                      not on NA checklist
                    </span>
                  )}
                  {c.match.matchLevel === "genus" && (
                    <span className="rounded bg-border px-1.5 py-0.5">genus-level</span>
                  )}
                </div>
                {c.plausibility && <PlausibilityTag p={c.plausibility} />}
              </div>
              <span className="text-accent">›</span>
            </button>
          ))}

          <button
            onClick={() => setPicking(true)}
            className="w-full rounded-xl border border-dashed border-border py-2.5 text-sm font-medium"
          >
            None of these — pick the species myself
          </button>
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
            {done.name.toLowerCase() !== done.scientific.toLowerCase() && (
              <p className="text-sm italic text-muted">{done.scientific}</p>
            )}
          </div>
          <p className="text-sm">
            {done.isNewSpecies
              ? "New species added to your life list!"
              : done.checklisted
                ? "Already on your life list — sighting logged."
                : done.otherGroup
                  ? `Added to your bug list under ${done.otherGroup}.`
                  : "Logged under “other sightings.”"}
          </p>
          <div className="flex justify-center">
            <SeenBadge placeLabel={done.placeLabel} observedAt={done.observedAt} />
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
        className="hidden"
        onChange={onPick}
      />

      {picking && (
        <SpeciesPicker
          title="What is it?"
          onSelect={confirmManual}
          onClose={() => setPicking(false)}
        />
      )}

      {sheetSpecies && logSummary && (
        <SightingSheet
          sightings={logSummary.log.filter(
            (l) =>
              l.identifiedScientific.toLowerCase() ===
              sheetSpecies.toLowerCase(),
          )}
          onClose={() => setSheetSpecies(null)}
        />
      )}
    </div>
  );
}

function PlausibilityTag({
  p,
}: {
  p: NonNullable<Candidate["plausibility"]>;
}) {
  const style =
    p.verdict === "expected"
      ? "bg-accent/15 text-accent"
      : p.verdict === "out-of-area" || p.verdict === "unusual"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-border text-muted";
  const icon =
    p.verdict === "expected" ? "✓" : p.verdict === "possible" ? "•" : "⚠";
  return (
    <div
      className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${style}`}
    >
      <span aria-hidden>{icon}</span>
      {p.note}
    </div>
  );
}

function RecentStrip({
  log,
  onOpen,
}: {
  log: LogResponse["log"];
  onOpen: (scientific: string) => void;
}) {
  if (log.length === 0) return null;
  const recent = [...log].reverse().slice(0, 6);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Recent sightings</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {recent.map((s) => (
          <button
            key={s.id}
            onClick={() => onOpen(s.identifiedScientific)}
            className="w-24 shrink-0 text-left"
          >
            <Thumb
              src={s.photoUrl}
              alt={s.identifiedName}
              className="h-24 w-24 rounded-lg bg-border object-cover"
            />
            <div className="mt-1 truncate text-[11px] font-medium">
              {s.identifiedName}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
