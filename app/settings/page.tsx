"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { InatConnect } from "@/components/InatConnect";
import { useUserCode } from "@/lib/useUserCode";

export default function SettingsPage() {
  const { code, loading, setCode } = useUserCode();
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const url = `${window.location.origin}/?code=${code}`;
    QRCode.toDataURL(url, { width: 260, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [code]);

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
          This code is the only key to your log. There is no password and no way
          to recover it — save it somewhere safe.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-muted">Your log code</p>
        <p className="font-mono text-2xl font-bold tracking-wider">
          {loading ? "…" : (code ?? "unavailable")}
        </p>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="QR code for your log"
            className="mx-auto h-44 w-44 rounded-lg bg-white p-2"
          />
        )}
        <p className="text-xs text-muted">
          Screenshot this QR, or copy the code. Scanning it on another phone opens
          your log there.
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

      <InatConnect code={code} />
    </div>
  );
}
