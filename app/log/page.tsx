"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SeenBadge } from "@/components/SeenBadge";
import { SpeciesName } from "@/components/SpeciesName";
import { SpeciesPicker } from "@/components/SpeciesPicker";
import { Thumb } from "@/components/Thumb";
import { useUserCode } from "@/lib/useUserCode";
import type { ChecklistItem, LogItem, LogResponse } from "@/lib/types";

export default function LogPage() {
  const { code, loading } = useUserCode();
  const [data, setData] = useState<LogResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<LogItem | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!code) return;
    fetch(`/api/log?code=${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setData(d);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [code]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const entries = useMemo(
    () =>
      [...(data?.log ?? [])].sort((a, b) => b.observedAt.localeCompare(a.observedAt)),
    [data],
  );
  const onList = entries.filter((e) => e.speciesId != null);

  // off-checklist sightings grouped by bug type, biggest group first
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
    if (!confirm(`Delete your ${entry.identifiedName} sighting? This can't be undone.`)) return;
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

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Your log</h1>
        {data && (
          <p className="text-sm text-muted">
            {data.stats.butterfliesSeen +
              data.stats.mothsSeen +
              data.stats.otherSpecies}{" "}
            species · {entries.length} sightings
          </p>
        )}
      </header>

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

      {(loading || state === "loading") && <p className="text-sm text-muted">Loading…</p>}
      {state === "error" && (
        <p className="text-sm text-muted">Couldn&apos;t load your log.</p>
      )}
      {state === "ready" && entries.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          Nothing logged yet. Head to the Identify tab and photograph your first moth or
          butterfly.
        </p>
      )}

      {onList.length > 0 && (
        <ul className="space-y-3">
          {onList.map((e) => (
            <LogCard
              key={e.id}
              entry={e}
              open={openId === e.id}
              busy={busyId === e.id}
              onToggle={() => setOpenId(openId === e.id ? null : e.id)}
              onChange={() => setPickFor(e)}
              onDelete={() => del(e)}
            />
          ))}
        </ul>
      )}

      {offGroups.map(([group, rows]) => (
        <section key={group} className="space-y-3">
          <h2 className="text-sm font-semibold">
            {group}{" "}
            <span className="font-normal text-muted">· {rows.length}</span>
          </h2>
          <ul className="space-y-3">
            {rows.map((e) => (
              <LogCard
                key={e.id}
                entry={e}
                dashed
                open={openId === e.id}
                busy={busyId === e.id}
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
    </div>
  );
}

function LogCard({
  entry,
  dashed,
  open,
  busy,
  onToggle,
  onChange,
  onDelete,
}: {
  entry: LogItem;
  dashed?: boolean;
  open: boolean;
  busy: boolean;
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
        <Thumb
          src={entry.photoUrl}
          alt={entry.identifiedName}
          className="h-20 w-20 shrink-0 rounded-lg bg-border object-cover"
        />
        <div className="min-w-0 flex-1">
          <SpeciesName
            common={entry.identifiedName}
            scientific={entry.identifiedScientific}
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <SeenBadge placeLabel={entry.placeLabel} observedAt={entry.observedAt} />
            {entry.inatObservationId && (
              <a
                href={`https://www.inaturalist.org/observations/${entry.inatObservationId}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-border px-2 py-0.5 text-[11px] font-medium text-muted"
              >
                iNaturalist ↗
              </a>
            )}
          </div>
        </div>
        <button
          onClick={onToggle}
          aria-label="Sighting options"
          className="-mr-1 h-8 w-8 shrink-0 rounded-lg text-muted hover:bg-border"
        >
          ⋯
        </button>
      </div>

      {open && (
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
