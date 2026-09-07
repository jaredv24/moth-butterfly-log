"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { useUserCode } from "@/lib/useUserCode";

type Friend = {
  userId: string;
  nickname: string | null;
  inatUsername: string | null;
  addedAt: string;
  sightingsCount: number;
  speciesCount: number;
  lastSightingAt: string | null;
  mutual: boolean;
};

function ago(iso: string | null): string {
  if (!iso) return "no sightings yet";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "active today";
  if (days === 1) return "active yesterday";
  if (days < 30) return `active ${days}d ago`;
  return `active ${Math.floor(days / 30)}mo ago`;
}

export default function FriendsPage() {
  const { code, loading } = useUserCode();
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [input, setInput] = useState("");
  const [nick, setNick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!code) return;
    fetch(`/api/friends?code=${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setFriendCode(d.friendCode);
        setFriends(d.friends);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [code]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!friendCode) return;
    QRCode.toDataURL(friendCode, { width: 240, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [friendCode]);

  async function copy() {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          friendCode: input.trim().toUpperCase(),
          nickname: nick.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add that friend");
      setInput("");
      setNick("");
      setMsg("Friend added.");
      refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function remove(f: Friend) {
    if (!code) return;
    if (!confirm(`Stop following ${f.nickname ?? "this friend"}?`)) return;
    await fetch("/api/friends", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, friendUserId: f.userId }),
    });
    refresh();
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Friends</h1>
        <p className="text-sm text-muted">
          Share your friend code and someone can follow your log. Following is
          one-way — they see everything you&apos;ve logged, including where.
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-muted">
          Your friend code
        </p>
        <p className="font-mono text-xl font-bold tracking-wider">
          {loading || status === "loading" ? "…" : (friendCode ?? "unavailable")}
        </p>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="Friend code QR"
            className="mx-auto h-40 w-40 rounded-lg bg-white p-2"
          />
        )}
        <button
          onClick={copy}
          disabled={!friendCode}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {copied ? "Copied ✓" : "Copy code"}
        </button>
        <p className="text-[11px] text-muted">
          This is different from your MOTH- login code and only grants
          read-only access.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Follow a friend</h2>
        <form onSubmit={add} className="space-y-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="PAL-XXXXXXXX"
            autoCapitalize="characters"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm uppercase outline-none focus:border-accent"
          />
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="Nickname (optional)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Adding…" : "Follow"}
          </button>
        </form>
        {msg && <p className="text-sm text-accent">{msg}</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Following {friends.length > 0 && `(${friends.length})`}
        </h2>
        {status === "ready" && friends.length === 0 && (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            Not following anyone yet. Add a friend&apos;s code above.
          </p>
        )}
        <ul className="space-y-2">
          {friends.map((f) => (
            <li
              key={f.userId}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-border text-lg">
                👤
              </div>
              <Link href={`/friend/${f.userId}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">
                    {f.nickname ?? f.inatUsername ?? "Friend"}
                  </span>
                  {f.mutual && (
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      mutual
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {f.speciesCount} species · {ago(f.lastSightingAt)}
                </div>
              </Link>
              <button
                onClick={() => remove(f)}
                aria-label="Unfollow"
                className="shrink-0 px-2 text-xs text-muted"
              >
                Unfollow
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
