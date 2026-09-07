"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "lep-log:user-code";
const COOKIE = "lep_log_code";

type State = {
  code: string | null;
  username: string | null;
  hasPassword: boolean;
  loading: boolean;
  /** a code was found but needs a password on this (new) device */
  needsPassword: string | null;
};

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

function stripUrlCode() {
  if (new URLSearchParams(window.location.search).has("code")) {
    const u = new URL(window.location.href);
    u.searchParams.delete("code");
    window.history.replaceState(null, "", u);
  }
}

async function resolve(body: Record<string, string>) {
  const res = await fetch("/api/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
}

export function useUserCode() {
  const [state, setState] = useState<State>({
    code: null,
    username: null,
    hasPassword: false,
    loading: true,
    needsPassword: null,
  });

  useEffect(() => {
    let cancelled = false;
    const stored = typeof window !== "undefined" ? readStored() : null;

    (async () => {
      try {
        const { res, data } = await resolve(stored ? { code: stored } : {});
        if (cancelled) return;
        if (res.status === 401 && data.needsPassword) {
          setState({ code: null, username: null, hasPassword: false, loading: false, needsPassword: data.code ?? stored });
          return;
        }
        if (data.code) {
          persist(data.code);
          stripUrlCode();
          setState({ code: data.code, username: data.username ?? null, hasPassword: !!data.hasPassword, loading: false, needsPassword: null });
        } else {
          setState({ code: stored, username: null, hasPassword: false, loading: false, needsPassword: null });
        }
      } catch {
        if (!cancelled)
          setState({ code: stored, username: null, hasPassword: false, loading: false, needsPassword: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setCode = useCallback(async (raw: string, password?: string) => {
    const { res, data } = await resolve(
      password ? { code: raw, password } : { code: raw },
    );
    if (res.status === 401 && data.needsPassword) {
      const e = new Error(data.error ?? "This log is password-protected.");
      (e as Error & { needsPassword?: boolean }).needsPassword = true;
      throw e;
    }
    if (!res.ok || !data.code) throw new Error(data.error ?? "Could not use that code");
    persist(data.code);
    stripUrlCode();
    setState({ code: data.code, username: data.username ?? null, hasPassword: !!data.hasPassword, loading: false, needsPassword: null });
    return data as { code: string; created: boolean; username: string | null };
  }, []);

  /** answer the password prompt for the pending code */
  const submitPassword = useCallback(
    async (password: string) => {
      if (!state.needsPassword) return;
      await setCode(state.needsPassword, password);
    },
    [state.needsPassword, setCode],
  );

  const setUsername = useCallback(
    (username: string | null) => setState((s) => ({ ...s, username })),
    [],
  );

  const setHasPassword = useCallback(
    (hasPassword: boolean) => setState((s) => ({ ...s, hasPassword })),
    [],
  );

  return { ...state, setCode, submitPassword, setUsername, setHasPassword };
}
