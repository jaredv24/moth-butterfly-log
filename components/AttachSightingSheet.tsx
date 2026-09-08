"use client";

import { useEffect, useState } from "react";
import { Thumb } from "@/components/Thumb";
import type { LogResponse, LogItem } from "@/lib/types";

/** Pick one of your own logged sightings to attach to a chat message. */
export function AttachSightingSheet({
  code,
  onPick,
  onClose,
}: {
  code: string;
  onPick: (sightingId: string) => void;
  onClose: () => void;
}) {
  const [log, setLog] = useState<LogItem[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch(`/api/log?code=${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: LogResponse) =>
        setLog(
          [...d.log].sort((a, b) => b.observedAt.localeCompare(a.observedAt)),
        ),
      )
      .catch(() => setLog([]));
  }, [code]);

  const rows = (log ?? []).filter((s) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return (
      s.identifiedName.toLowerCase().includes(t) ||
      s.identifiedScientific.toLowerCase().includes(t)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-3 text-base font-bold">Share a sighting</h2>

        {log === null && <p className="text-sm text-muted">Loading your log…</p>}
        {log !== null && log.length === 0 && (
          <p className="text-sm text-muted">
            You haven&apos;t logged anything yet.
          </p>
        )}

        {log !== null && log.length > 0 && (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search your log…"
              className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <ul className="space-y-2">
              {rows.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => onPick(s.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border p-2 text-left"
                  >
                    <Thumb
                      src={s.photoUrl}
                      alt={s.identifiedName}
                      className="h-12 w-12 shrink-0 rounded-lg bg-border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {s.identifiedName}
                      </div>
                      <div className="truncate text-xs text-muted">
                        {s.placeLabel ? `${s.placeLabel} · ` : ""}
                        {new Date(s.observedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-border py-2.5 text-sm font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
