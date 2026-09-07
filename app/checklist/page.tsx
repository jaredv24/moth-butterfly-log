"use client";

import { useEffect, useMemo, useState } from "react";
import { SeenBadge } from "@/components/SeenBadge";
import { SpeciesName } from "@/components/SpeciesName";
import { Thumb } from "@/components/Thumb";
import { useUserCode } from "@/lib/useUserCode";
import type {
  ChecklistItem,
  Group,
  LogItem,
  LogResponse,
  NearbyResponse,
} from "@/lib/types";

type SeenMap = Map<number, LogItem>; // speciesId -> earliest sighting

export default function ChecklistPage() {
  const { code } = useUserCode();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [log, setLog] = useState<LogItem[]>([]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group>("butterfly");
  const [onlySeen, setOnlySeen] = useState(false);
  const [detail, setDetail] = useState<ChecklistItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [nearby, setNearby] = useState<NearbyResponse | null>(null);
  const [nearbyState, setNearbyState] = useState<"loading" | "ready" | "unavailable">(
    () =>
      typeof navigator !== "undefined" && "geolocation" in navigator
        ? "loading"
        : "unavailable",
  );
  const [showAllNearby, setShowAllNearby] = useState(false);

  useEffect(() => {
    fetch("/api/checklist")
      .then((r) => r.json())
      .then((d) => setItems(d.species ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (nearbyState !== "loading") return;
    // once on mount: nearbyState only transitions away from "loading" here
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch(
          `/api/nearby?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`,
        )
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((d: NearbyResponse) => {
            setNearby(d);
            setNearbyState("ready");
          })
          .catch(() => setNearbyState("unavailable"));
      },
      () => setNearbyState("unavailable"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/log?code=${code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: LogResponse | null) => d && setLog(d.log));
  }, [code]);

  const seenMap: SeenMap = useMemo(() => {
    const m: SeenMap = new Map();
    for (const entry of log) {
      if (entry.speciesId == null) continue;
      const existing = m.get(entry.speciesId);
      if (!existing || entry.observedAt < existing.observedAt) {
        m.set(entry.speciesId, entry);
      }
    }
    return m;
  }, [log]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (it.group !== group) return false;
      if (onlySeen && !seenMap.has(it.id)) return false;
      if (!q) return true;
      return (
        it.commonName.toLowerCase().includes(q) ||
        it.scientificName.toLowerCase().includes(q) ||
        it.family.toLowerCase().includes(q)
      );
    });
  }, [items, group, query, onlySeen, seenMap]);

  const byFamily = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const it of filtered) {
      const arr = map.get(it.family) ?? [];
      arr.push(it);
      map.set(it.family, arr);
    }
    return [...map.entries()].sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
    );
  }, [filtered]);

  const seenCount = filtered.filter((it) => seenMap.has(it.id)).length;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Checklist</h1>
        <p className="text-sm text-muted">
          {seenCount} of {filtered.length}{" "}
          {group === "butterfly" ? "butterflies" : "moths"} logged
          {query || onlySeen ? " (filtered)" : ""}
        </p>
      </header>

      {nearbyState === "loading" && (
        <p className="text-xs text-muted">Checking what&apos;s flying near you…</p>
      )}
      {nearby && nearby.species.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-accent/40 bg-accent/8 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              Flying near you · {nearby.monthName}
            </h2>
            <span className="text-[11px] text-muted">
              within {nearby.radiusKm} km
            </span>
          </div>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface">
            {(showAllNearby ? nearby.species : nearby.species.slice(0, 8)).map(
              (it) => {
                const seen = seenMap.has(it.id);
                return (
                  <li key={it.id} className={seen ? "bg-accent/8" : ""}>
                    <button
                      onClick={() => setDetail(it)}
                      className="flex w-full items-center gap-2.5 p-2 text-left"
                    >
                      <Thumb
                        src={it.thumbUrl}
                        group={it.group}
                        className="h-9 w-9 shrink-0 rounded-md bg-border object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {it.commonName}
                        <span aria-hidden className="ml-1 text-xs">
                          {it.group === "moth" ? "🌙" : "🦋"}
                        </span>
                      </span>
                      {seen && <span className="text-accent">✓</span>}
                    </button>
                  </li>
                );
              },
            )}
          </ul>
          {nearby.species.length > 8 && (
            <button
              onClick={() => setShowAllNearby((v) => !v)}
              className="text-xs font-medium text-accent"
            >
              {showAllNearby
                ? "Show fewer"
                : `Show all ${nearby.species.length}`}
            </button>
          )}
        </section>
      )}

      <div className="flex gap-2">
        {(["butterfly", "moth"] as Group[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold capitalize ${
              group === g
                ? "border-accent bg-accent text-accent-fg"
                : "border-border bg-surface"
            }`}
          >
            {g === "butterfly" ? "🦋 Butterflies" : "🌙 Moths"}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name or family…"
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlySeen}
          onChange={(e) => setOnlySeen(e.target.checked)}
          className="accent-accent"
        />
        Only species I&apos;ve logged
      </label>

      {loading && <p className="text-sm text-muted">Loading checklist…</p>}

      <div className="space-y-5">
        {byFamily.map(([family, rows]) => (
          <section key={family}>
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {family}
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {rows.map((it) => {
                const seen = seenMap.get(it.id);
                return (
                  <li key={it.id} className={seen ? "bg-accent/8" : ""}>
                    <button
                      onClick={() => setDetail(it)}
                      className="flex w-full items-center gap-3 p-2.5 text-left"
                    >
                      <Thumb
                        src={it.thumbUrl}
                        group={it.group}
                        className={`h-12 w-12 shrink-0 rounded-lg bg-border object-cover ${
                          seen ? "" : "opacity-80"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <SpeciesName
                            className="min-w-0"
                            common={it.commonName}
                            scientific={it.scientificName}
                          />
                          {seen && <span className="text-accent">✓</span>}
                        </div>
                        {seen && (
                          <SeenBadge
                            className="mt-1"
                            placeLabel={seen.placeLabel}
                            observedAt={seen.observedAt}
                          />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {!loading && byFamily.length === 0 && (
          <p className="text-sm text-muted">No species match that search.</p>
        )}
      </div>

      {detail && (
        <SpeciesDetail
          item={detail}
          sightings={log.filter((l) => l.speciesId === detail.id)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function SpeciesDetail({
  item,
  sightings,
  onClose,
}: {
  item: ChecklistItem;
  sightings: LogItem[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-start gap-3">
          <Thumb
            src={item.thumbUrl}
            group={item.group}
            className="h-20 w-20 rounded-xl object-cover"
          />
          <div>
            <h2 className="text-lg font-bold">{item.commonName}</h2>
            {item.commonName.toLowerCase() !==
              item.scientificName.toLowerCase() && (
              <p className="text-sm italic text-muted">{item.scientificName}</p>
            )}
            <p className="mt-1 text-xs text-muted">
              {item.family} · {item.group}
            </p>
            <a
              href={`https://www.inaturalist.org/taxa/${item.inatTaxonId}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs font-medium text-accent"
            >
              View on iNaturalist →
            </a>
          </div>
        </div>

        <h3 className="mt-5 mb-2 text-sm font-semibold">
          Your sightings ({sightings.length})
        </h3>
        {sightings.length === 0 ? (
          <p className="text-sm text-muted">
            Not logged yet. Photograph one to check it off.
          </p>
        ) : (
          <ul className="space-y-3">
            {[...sightings]
              .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
              .map((s) => (
                <li key={s.id} className="flex gap-3">
                  <Thumb
                    src={s.photoUrl}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                  <div className="text-sm">
                    <SeenBadge
                      placeLabel={s.placeLabel}
                      observedAt={s.observedAt}
                    />
                    {s.confidence != null && (
                      <p className="mt-1 text-xs text-muted">
                        {Math.round(s.confidence * 100)}% match at ID time
                      </p>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-border py-2.5 text-sm font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  );
}
