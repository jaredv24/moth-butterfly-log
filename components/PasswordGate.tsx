"use client";

import { useState } from "react";
import { useUserCode } from "@/lib/useUserCode";

/**
 * Shown only when a password-protected code is being adopted on a device that
 * hasn't unlocked it before. After a correct password the device is trusted and
 * this never appears again on it.
 */
export function PasswordGate() {
  const { needsPassword, submitPassword } = useUserCode();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!needsPassword) return null;

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await submitPassword(pw);
      window.location.reload();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Wrong password");
      setBusy(false);
    }
  }

  function useDifferent() {
    try {
      localStorage.removeItem("lep-log:user-code");
    } catch {
      /* ignore */
    }
    document.cookie = "lep_log_code=; path=/; max-age=0";
    window.location.assign(window.location.origin);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6">
      <form
        onSubmit={unlock}
        className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-surface p-5"
      >
        <h2 className="text-lg font-bold">Log is password-protected</h2>
        <p className="text-sm text-muted">
          Enter the password to use{" "}
          <span className="font-mono">{needsPassword}</span> on this device.
          You&apos;ll only be asked once here.
        </p>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Password"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <button
          type="submit"
          disabled={!pw || busy}
          className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
        <button
          type="button"
          onClick={useDifferent}
          className="w-full py-1 text-xs text-muted"
        >
          Use a different code
        </button>
      </form>
    </div>
  );
}
