"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "lep-log:user-code";
const COOKIE = "lep_log_code";

type State = {
  code: string | null;
  loading: boolean;
};

/** localStorage + a 1-year cookie, so clearing one doesn't lose the log. */
function persist(code: string) {
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    /* private mode */
  }
  try {
    document.cookie = `${COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

function readStored(): string | null {
  // A ?code= in the URL (e.g. from a shared QR) wins and adopts that log.
  const fromUrl = new URLSearchParams(window.location.search).get("code");
  if (fromUrl) return fromUrl.trim().toUpperCase();

  try {
    const ls = window.localStorage.getItem(KEY);
    if (ls) return ls;
  } catch {
    /* ignore */
  }
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Owns the local user code. On first load it asks the server for a fresh code
 * and stores it. `setCode` lets Settings restore/switch a log.
 */
export function useUserCode() {
  const [state, setState] = useState<State>({ code: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    const stored = typeof window !== "undefined" ? readStored() : null;

    (async () => {
      try {
        const res = await fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stored ? { code: stored } : {}),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.code) {
          persist(data.code);
          if (new URLSearchParams(window.location.search).has("code")) {
            const u = new URL(window.location.href);
            u.searchParams.delete("code");
            window.history.replaceState(null, "", u);
          }
          setState({ code: data.code, loading: false });
        } else {
          setState({ code: stored, loading: false });
        }
      } catch {
        if (!cancelled) setState({ code: stored, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setCode = useCallback(async (raw: string) => {
    const res = await fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: raw }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not use that code");
    persist(data.code);
    setState({ code: data.code, loading: false });
    return data as { code: string; created: boolean };
  }, []);

  return { ...state, setCode };
}
