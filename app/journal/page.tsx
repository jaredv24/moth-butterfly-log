"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChecklistView } from "@/components/ChecklistView";
import { LogView } from "@/components/LogView";
import { useUserCode } from "@/lib/useUserCode";
import type { LogResponse } from "@/lib/types";

type Tab = "log" | "checklist";

export default function JournalPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <Journal />
    </Suspense>
  );
}

function Journal() {
  const { code } = useUserCode();
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = params.get("tab") === "checklist" ? "checklist" : "log";

  const [data, setData] = useState<LogResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const refetch = useCallback(() => {
    if (!code) return;
    fetch(`/api/log?code=${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setData(d);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [code]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const setTab = (t: Tab) =>
    router.replace(t === "log" ? "/journal" : "/journal?tab=checklist");

  const stats = data?.stats;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Journal</h1>
        {stats && (
          <p className="text-sm text-muted">
            {stats.butterfliesSeen + stats.mothsSeen + stats.otherSpecies} species
            logged · {data?.log.length ?? 0} sightings
          </p>
        )}
      </header>

      <div className="flex gap-2">
        {(["log", "checklist"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold capitalize ${
              tab === t
                ? "border-accent bg-accent text-accent-fg"
                : "border-border bg-surface"
            }`}
          >
            {t === "log" ? "Log" : "Checklist"}
          </button>
        ))}
      </div>

      {tab === "log" ? (
        <LogView
          code={code}
          data={data}
          status={status}
          refetch={refetch}
          focusSightingId={params.get("sighting")}
        />
      ) : (
        <ChecklistView code={code} />
      )}
    </div>
  );
}
