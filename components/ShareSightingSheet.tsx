"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { LogItem } from "@/lib/types";

type Mutual = { userId: string; name: string | null; avatarUrl: string | null };

/** Send one of your sightings to a mutual follower as a chat message. */
export function ShareSightingSheet({
  code,
  sighting,
  onClose,
  onSent,
}: {
  code: string;
  sighting: LogItem;
  onClose: () => void;
  onSent: (userId: string) => void;
}) {
  const [mutuals, setMutuals] = useState<Mutual[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/friends?code=${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) =>
        setMutuals(
          (d.following as (Mutual & { mutual: boolean })[])
            .filter((f) => f.mutual)
            .map((f) => ({
              userId: f.userId,
              name: f.name,
              avatarUrl: f.avatarUrl,
            })),
        ),
      )
      .catch(() => setMutuals([]));
  }, [code]);

  async function send(userId: string) {
    setBusy(userId);
    setErr(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, to: userId, sightingId: sighting.id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Couldn't send");
      }
      onSent(userId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send");
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <h2 className="text-base font-bold">Send to a friend</h2>
        <p className="mt-1 text-xs text-muted">
          {sighting.identifiedName} · sends into a private chat
        </p>

        {err && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>
        )}

        {mutuals === null && (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        )}
        {mutuals !== null && mutuals.length === 0 && (
          <p className="mt-4 text-sm text-muted">
            You can only message people you both follow. Follow each other on the
            Friends tab first.
          </p>
        )}

        <ul className="mt-3 space-y-2">
          {mutuals?.map((m) => (
            <li key={m.userId}>
              <button
                onClick={() => send(m.userId)}
                disabled={busy != null}
                className="flex w-full items-center gap-3 rounded-xl border border-border p-2.5 text-left disabled:opacity-50"
              >
                <Avatar url={m.avatarUrl} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {m.name ?? "Someone"}
                </span>
                <span className="shrink-0 text-xs font-medium text-accent">
                  {busy === m.userId ? "Sending…" : "Send"}
                </span>
              </button>
            </li>
          ))}
        </ul>

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
