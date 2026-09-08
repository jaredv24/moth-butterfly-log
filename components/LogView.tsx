"use client";

import { useEffect, useMemo, useState } from "react";
import { Lightbox } from "@/components/Lightbox";
import { SeenBadge } from "@/components/SeenBadge";
import { SightingSheet } from "@/components/SightingSheet";
import { SpeciesName } from "@/components/SpeciesName";
import { SpeciesPicker } from "@/components/SpeciesPicker";
import { Thumb } from "@/components/Thumb";
import type { ChecklistItem, LogItem, LogResponse } from "@/lib/types";

export function LogView({
  code,
  data,
  status,
  refetch,
  readOnly = false,
  focusSightingId = null,
}: {
  /** the viewer's login code — used for edit/delete when not read-only */
  code: string | null;
  data: LogResponse | null;
  status: "loading" | "ready" | "error";
  refetch: () => void;
  readOnly?: boolean;
  /** open straight to this one sighting (e.g. from a shared chat link) */
  focusSightingId?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<LogItem | null>(null);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // a shared chat link (?sighting=<id>) opens straight to that one sighting
  const [focusDismissed, setFocusDismissed] = useState(false);
  const focusEntry =
    focusSightingId && !focusDismissed
      ? (data?.log.find((e) => e.id === focusSightingId) ?? null)
      : null;

  useEffect(() => {
    if (!focusEntry) return;
    // drop ?sighting= so a refresh / back doesn't reopen the sheet
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has("sighting")) {
        u.searchParams.delete("sighting");
        window.history.replaceState(null, "", u);
      }
    } catch {
      /* ignore */
    }
  }, [focusEntry]);

  const entries = useMemo(
    () =>
      [...(data?.log ?? [])].sort((a, b) =>
        b.observedAt.localeCompare(a.observedAt),
      ),
    [data],
  );
  const onList = entries.filter((e) => e.speciesId != null);

  const offGroups = useMemo(() => {
    const map = new Map<string, LogItem[]>();
    for (const e of entries) {
      if (e.speciesId != null) continue;
      const g = e.otherGroup ?? "Other bugs";
      const arr = map.get(g) ?? [];
      arr.push(e);
      map.set(g, arr);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [entries]);

  async function del(entry: LogItem) {
    if (!code) return;
    if (!confirm(`Delete your ${entry.identifiedName} sighting? This can't be undone.`))
      return;
    setBusyId(entry.id);
    setErr(null);
    try {
      const res = await fetch("/api/log", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, sightingId: entry.id }),
      });
      if (!res.ok) throw new Error();
      setOpenId(null);
      refetch();
    } catch {
      setErr("Couldn't delete that sighting.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeSpecies(entry: LogItem, species: ChecklistItem) {
    if (!code) return;
    setPickFor(null);
    setBusyId(entry.id);
    setErr(null);
    try {
      const res = await fetch("/api/log", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          sightingId: entry.id,
          speciesId: species.id,
          name: species.commonName,
          scientificName: species.scientificName,
        }),
      });
      if (!res.ok) throw new Error();
      setOpenId(null);
      refetch();
    } catch {
      setErr("Couldn't update that sighting.");
    } finally {
      setBusyId(null);
    }
  }

  if (status === "loading") return <p className="text-sm text-muted">Loading…</p>;
  if (status === "error")
    return <p className="text-sm text-muted">Couldn&apos;t load the log.</p>;
  if (entries.length === 0)
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        {readOnly
          ? "Nothing logged here yet."
          : "Nothing logged yet. Head to the Identify tab and photograph your first moth or butterfly."}
      </p>
    );

  return (
    <div className="space-y-4">
      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

      {onList.length > 0 && (
        <section className="space-y-3">
          {offGroups.length > 0 && (
            <h2 className="text-sm font-semibold">
              Butterflies &amp; moths{" "}
              <span className="font-normal text-muted">· {onList.length}</span>
            </h2>
          )}
          <ul className="space-y-3">
            {onList.map((e) => (
              <LogCard
                key={e.id}
                entry={e}
                readOnly={readOnly}
                open={openId === e.id}
                busy={busyId === e.id}
                onOpen={() => setSheetFor(e.identifiedScientific)}
                onZoom={() =>
                  setZoom({ src: e.photoUrl, alt: e.identifiedName })
                }
                onToggle={() => setOpenId(openId === e.id ? null : e.id)}
                onChange={() => setPickFor(e)}
                onDelete={() => del(e)}
              />
            ))}
          </ul>
        </section>
      )}

      {offGroups.map(([group, rows]) => (
        <section key={group} className="space-y-3">
          <h2 className="text-sm font-semibold">
            {group} <span className="font-normal text-muted">· {rows.length}</span>
          </h2>
          <ul className="space-y-3">
            {rows.map((e) => (
              <LogCard
                key={e.id}
                entry={e}
                dashed
                readOnly={readOnly}
                open={openId === e.id}
                busy={busyId === e.id}
                onOpen={() => setSheetFor(e.identifiedScientific)}
                onZoom={() =>
                  setZoom({ src: e.photoUrl, alt: e.identifiedName })
                }
                onToggle={() => setOpenId(openId === e.id ? null : e.id)}
                onChange={() => setPickFor(e)}
                onDelete={() => del(e)}
              />
            ))}
          </ul>
        </section>
      ))}

      {pickFor && (
        <SpeciesPicker
          title="Change species"
          onSelect={(sp) => changeSpecies(pickFor, sp)}
          onClose={() => setPickFor(null)}
        />
      )}

      {(focusEntry || sheetFor) && (
        <SightingSheet
          sightings={
            focusEntry
              ? [focusEntry]
              : entries.filter(
                  (e) =>
                    e.identifiedScientific.toLowerCase() ===
                    sheetFor!.toLowerCase(),
                )
          }
          code={readOnly ? null : code}
          owned={!readOnly}
          onClose={() => {
            setSheetFor(null);
            if (focusEntry) setFocusDismissed(true);
          }}
        />
      )}

      {zoom && (
        <Lightbox src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}

function LogCard({
  entry,
  dashed,
  readOnly,
  open,
  busy,
  onOpen,
  onZoom,
  onToggle,
  onChange,
  onDelete,
}: {
  entry: LogItem;
  dashed?: boolean;
  readOnly: boolean;
  open: boolean;
  busy: boolean;
  onOpen: () => void;
  onZoom: () => void;
  onToggle: () => void;
  onChange: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`rounded-xl border bg-surface p-3 ${
        dashed ? "border-dashed border-border" : "border-border"
      }`}
    >
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onZoom}
          aria-label="View photo"
          className="shrink-0"
        >
          <Thumb
            src={entry.photoUrl}
            alt={entry.identifiedName}
            className="h-20 w-20 rounded-lg bg-border object-cover"
          />
        </button>
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => e.key === "Enter" && onOpen()}
          className="flex min-w-0 flex-1 cursor-pointer gap-3"
        >
          <div className="min-w-0 flex-1">
            <SpeciesName
              common={entry.identifiedName}
              scientific={entry.identifiedScientific}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <SeenBadge
                placeLabel={entry.placeLabel}
                observedAt={entry.observedAt}
              />
              {entry.inatObservationId && (
                <a
                  href={`https://www.inaturalist.org/observations/${entry.inatObservationId}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full bg-border px-2 py-0.5 text-[11px] font-medium text-muted"
                >
                  iNaturalist ↗
                </a>
              )}
            </div>
          </div>
        </div>
        {!readOnly && (
          <button
            onClick={onToggle}
            aria-label="Sighting options"
            className="-mr-1 h-8 w-8 shrink-0 rounded-lg text-muted hover:bg-border"
          >
            ⋯
          </button>
        )}
      </div>

      {open && !readOnly && (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <button
            onClick={onChange}
            disabled={busy}
            className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold disabled:opacity-50"
          >
            Change species
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="flex-1 rounded-lg border border-red-300 py-2 text-xs font-semibold text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
          >
            {busy ? "…" : "Delete"}
          </button>
        </div>
      )}
    </li>
  );
}
