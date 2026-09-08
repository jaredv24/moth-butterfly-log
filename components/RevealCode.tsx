"use client";

import { useEffect, useState } from "react";

export function RevealCode({
  value,
  loading,
  label,
  qr,
  qrAlt,
  helpText,
  note,
  autoHideSeconds,
}: {
  value: string | null;
  loading: boolean;
  label: string;
  qr?: string | null;
  qrAlt?: string;
  helpText?: string;
  note?: string;
  autoHideSeconds?: number;
}) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shown || !autoHideSeconds) return;
    const t = setTimeout(() => setShown(false), autoHideSeconds * 1000);
    return () => clearTimeout(t);
  }, [shown, autoHideSeconds]);

  const masked = (() => {
    if (!value) return "";
    const i = value.indexOf("-");
    const prefix = i >= 0 ? value.slice(0, i + 1) : "";
    const rest = i >= 0 ? value.slice(i + 1) : value;
    return prefix + "•".repeat(rest.length);
  })();

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 text-center">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-mono text-xl font-bold tracking-wider break-all">
        {loading
          ? "…"
          : value
            ? shown
              ? value
              : masked
            : "unavailable"}
      </p>

      {!shown ? (
        <button
          onClick={() => setShown(true)}
          disabled={!value}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          Reveal
        </button>
      ) : (
        <>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt={qrAlt ?? ""}
              className="mx-auto h-40 w-40 rounded-lg bg-white p-2"
            />
          )}
          {helpText && <p className="text-xs text-muted">{helpText}</p>}
          <div className="flex justify-center gap-3">
            <button
              onClick={copy}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"
            >
              {copied ? "Copied ✓" : "Copy code"}
            </button>
            <button
              onClick={() => setShown(false)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
            >
              Hide
            </button>
          </div>
        </>
      )}
      {note && <p className="text-[11px] text-muted">{note}</p>}
    </section>
  );
}
