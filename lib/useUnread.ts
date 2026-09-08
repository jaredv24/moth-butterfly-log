"use client";

import { useEffect, useState } from "react";

/**
 * Polls the unread-message count for the nav badge. Cheap query, fails open,
 * only runs while the tab is visible.
 */
export function useUnread(code: string | null, intervalMs = 30_000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!code) return;
    let stop = false;

    async function tick() {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/messages/unread?code=${code}`);
        if (!r.ok) return;
        const d = await r.json();
        const n: number = d.count ?? 0;
        if (!stop) setCount(n);
        // Home Screen app-icon badge (iOS 16.4+, Chrome). Best-effort: only
        // updates while the app is open — real background push is separate.
        try {
          const nav = navigator as Navigator & {
            setAppBadge?: (n?: number) => Promise<void>;
            clearAppBadge?: () => Promise<void>;
          };
          if (n > 0) void nav.setAppBadge?.(n);
          else void nav.clearAppBadge?.();
        } catch {
          /* unsupported */
        }
      } catch {
        /* offline — keep last value */
      }
    }

    tick();
    const id = setInterval(tick, intervalMs);
    const onVis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [code, intervalMs]);

  return code ? count : 0;
}
