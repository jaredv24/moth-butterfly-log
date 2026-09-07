"use client";

import { useCallback, useEffect, useState } from "react";
import type { InatStatus } from "@/lib/types";

function calloutFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  const r = p.get("inat");
  if (!r) return null;
  return r === "connected"
    ? `Connected to iNaturalist as @${p.get("user")}.`
    : r === "denied"
      ? "iNaturalist authorization was cancelled."
      : "Couldn't connect to iNaturalist — try again.";
}

export function InatConnect({ code }: { code: string | null }) {
  const [status, setStatus] = useState<InatStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(calloutFromUrl);

  const refresh = useCallback(() => {
    if (!code) return;
    fetch(`/api/inat/status?code=${code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d));
  }, [code]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // clean the ?inat= param out of the URL after reading it
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("inat")) return;
    const u = new URL(window.location.href);
    u.search = "";
    window.history.replaceState(null, "", u);
  }, []);

  async function post(action: string, extra: Record<string, unknown> = {}) {
    if (!code) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/inat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (action === "sync") {
        setNote(
          `Pushed ${data.synced} sighting${data.synced === 1 ? "" : "s"}` +
            (data.failed ? `, ${data.failed} failed` : "") +
            (data.remaining ? `, ${data.remaining} more syncing in the background` : ""),
        );
      }
      refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  // Hidden entirely until iNaturalist OAuth is configured for the deployment.
  if (!status || !status.configured) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold">iNaturalist</h2>

      {!status.connected ? (
        <>
          <p className="text-xs text-muted">
            Post your sightings as observations to your iNaturalist account. They
            become public iNaturalist records (locations of sensitive species are
            auto-obscured).
          </p>
          <a
            href={`/api/inat/connect?code=${code}`}
            className="block rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-fg"
          >
            Connect iNaturalist
          </a>
        </>
      ) : (
        <>
          <p className="text-sm">
            Connected as{" "}
            <a
              href={`https://www.inaturalist.org/people/${status.username}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent"
            >
              @{status.username}
            </a>
          </p>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Auto-post new sightings</span>
            <input
              type="checkbox"
              className="accent-accent"
              checked={status.syncEnabled}
              disabled={busy}
              onChange={(e) => post("toggle", { enabled: e.target.checked })}
            />
          </label>

          {status.unsyncedCount > 0 && (
            <button
              onClick={() => post("sync")}
              disabled={busy}
              className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {busy
                ? "Pushing…"
                : `Push ${status.unsyncedCount} sighting${status.unsyncedCount === 1 ? "" : "s"} to iNaturalist`}
            </button>
          )}

          <button
            onClick={() => post("disconnect")}
            disabled={busy}
            className="w-full py-1 text-xs text-muted"
          >
            Disconnect
          </button>
        </>
      )}

      {note && <p className="text-xs text-accent">{note}</p>}
    </section>
  );
}
