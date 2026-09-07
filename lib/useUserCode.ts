"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "lep-log:user-code";

type State = {
  code: string | null;
  loading: boolean;
};

/**
 * Owns the local user code. On first load it asks the server for a fresh code
 * and stores it in localStorage. `setCode` lets Settings restore/switch a log.
 */
export function useUserCode() {
  const [state, setState] = useState<State>({ code: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;

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
          window.localStorage.setItem(KEY, data.code);
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
    window.localStorage.setItem(KEY, data.code);
    setState({ code: data.code, loading: false });
    return data as { code: string; created: boolean };
  }, []);

  return { ...state, setCode };
}
