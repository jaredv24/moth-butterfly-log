"use client";

import { useEffect, useMemo, useState } from "react";
import { SeenBadge } from "@/components/SeenBadge";
import { SpeciesName } from "@/components/SpeciesName";
import { Thumb } from "@/components/Thumb";
import { useUserCode } from "@/lib/useUserCode";
import type { LogResponse } from "@/lib/types";

export default function LogPage() {
  const { code, loading } = useUserCode();
  const [data, setData] = useState<LogResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!code) return;
    fetch(`/api/log?code=${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setData(d);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [code]);

  const entries = useMemo(
    () =>
      [...(data?.log ?? [])].sort((a, b) =>
        b.observedAt.localeCompare(a.observedAt),
      ),
    [data],
  );

  const onList = entries.filter((e) => e.speciesId != null);
  const offList = entries.filter((e) => e.speciesId == null);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Your log</h1>
        {data && (
          <p className="text-sm text-muted">
            {data.stats.butterfliesSeen + data.stats.mothsSeen} species ·{" "}
            {entries.length} sightings
          </p>
        )}
      </header>

      {(loading || state === "loading") && (
        <p className="text-sm text-muted">Loading…</p>
      )}
      {state === "error" && (
        <p className="text-sm text-muted">Couldn&apos;t load your log.</p>
      )}
      {state === "ready" && entries.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          Nothing logged yet. Head to the Identify tab and photograph your first
          moth or butterfly.
        </p>
      )}

      {onList.length > 0 && (
        <ul className="space-y-3">
          {onList.map((e) => (
            <li
              key={e.id}
              className="flex gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <Thumb
                src={e.photoUrl}
                alt={e.identifiedName}
                className="h-20 w-20 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <SpeciesName
                  common={e.identifiedName}
                  scientific={e.identifiedScientific}
                />
                <div className="mt-1.5">
                  <SeenBadge placeLabel={e.placeLabel} observedAt={e.observedAt} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {offList.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Other sightings (not on the NA checklist)
          </h2>
          <ul className="space-y-3">
            {offList.map((e) => (
              <li
                key={e.id}
                className="flex gap-3 rounded-xl border border-dashed border-border bg-surface p-3"
              >
                <Thumb
                  src={e.photoUrl}
                  alt={e.identifiedName}
                  className="h-20 w-20 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <SpeciesName
                    common={e.identifiedName}
                    scientific={e.identifiedScientific}
                  />
                  <div className="mt-1.5">
                    <SeenBadge
                      placeLabel={e.placeLabel}
                      observedAt={e.observedAt}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
