"use client";

import { useState } from "react";
import { useUserCode } from "@/lib/useUserCode";

export default function SettingsPage() {
  const { code, loading, setCode } = useUserCode();
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      const res = await setCode(input);
      setInput("");
      setMsg(
        res.created
          ? `New empty log created for ${res.code}.`
          : `Switched to ${res.code}.`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not use that code");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Your code</h1>
        <p className="text-sm text-muted">
          This code is the key to your log. Save it to open the same log on
          another phone or browser.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-muted">Your log code</p>
        <p className="my-2 font-mono text-2xl font-bold tracking-wider">
          {loading ? "…" : (code ?? "unavailable")}
        </p>
        <button
          onClick={copy}
          disabled={!code}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {copied ? "Copied ✓" : "Copy code"}
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Open a different log</h2>
        <form onSubmit={apply} className="space-y-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="MOTH-XXXXXX"
            autoCapitalize="characters"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm uppercase outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            Use this code
          </button>
        </form>
        {msg && <p className="text-sm text-accent">{msg}</p>}
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <p className="text-xs text-muted">
          Switching changes which log this device shows. Your current log stays
          safe under its own code.
        </p>
      </section>
    </div>
  );
}
