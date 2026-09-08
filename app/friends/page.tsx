"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { RevealCode } from "@/components/RevealCode";
import { useUnread } from "@/lib/useUnread";
import { useUserCode } from "@/lib/useUserCode";

type Following = {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  addedAt: string;
  sightingsCount: number;
  speciesCount: number;
  lastActiveAt: string | null;
  mutual: boolean;
};
type Follower = {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  followedAt: string;
  speciesCount: number;
  lastActiveAt: string | null;
  youFollowBack: boolean;
};

type Friend = {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  lastActiveAt: string | null;
  speciesCount: number;
  iFollow: boolean;
  followsMe: boolean;
};

function active(iso: string | null): string {
  if (!iso) return "not opened the app yet";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return "active just now";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "active yesterday";
  if (days < 30) return `active ${days}d ago`;
  return `active ${Math.floor(days / 30)}mo ago`;
}

export default function FriendsPage() {
  const { code, username, loading } = useUserCode();
  const unread = useUnread(code);
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [following, setFollowing] = useState<Following[]>([]);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [qr, setQr] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!code) return;
    fetch(`/api/friends?code=${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setFriendCode(d.friendCode);
        setFollowing(d.following);
        setFollowers(d.followers);
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

  const friends = useMemo<Friend[]>(() => {
    const map = new Map<string, Friend>();
    for (const f of following) {
      map.set(f.userId, {
        userId: f.userId,
        name: f.name,
        avatarUrl: f.avatarUrl,
        lastActiveAt: f.lastActiveAt,
        speciesCount: f.speciesCount,
        iFollow: true,
        followsMe: f.mutual,
      });
    }
    for (const f of followers) {
      const cur = map.get(f.userId);
      if (cur) {
        cur.followsMe = true;
        cur.iFollow = cur.iFollow || f.youFollowBack;
      } else {
        map.set(f.userId, {
          userId: f.userId,
          name: f.name,
          avatarUrl: f.avatarUrl,
          lastActiveAt: f.lastActiveAt,
          speciesCount: f.speciesCount,
          iFollow: f.youFollowBack,
          followsMe: true,
        });
      }
    }
    const rank = (p: Friend) =>
      p.iFollow && p.followsMe ? 0 : p.followsMe ? 1 : 2;
    return [...map.values()].sort(
      (a, b) => rank(a) - rank(b) || (a.name ?? "~").localeCompare(b.name ?? "~"),
    );
  }, [following, followers]);

  async function follow(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, friendCode: input.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't add that code");
      setInput("");
      setMsg("Added.");
      refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function unfollow(f: Friend) {
    if (!code) return;
    if (!confirm(`Stop following ${f.name ?? "this person"}?`)) return;
    await fetch("/api/friends", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, friendUserId: f.userId }),
    });
    refresh();
  }

  async function followBack(userId: string) {
    if (!code) return;
    await fetch("/api/friends/follow-back", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, followerUserId: userId }),
    });
    refresh();
  }

  const needsUsername =
    !loading && status === "ready" && !username && followers.length > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Friends</h1>
        <p className="text-sm text-muted">
          People you follow and people who follow you. When you follow each
          other it&apos;s <span className="font-medium">mutual</span> — you can
          chat, and both see everything the other has logged, including where.
        </p>
      </header>

      <Link
        href="/chat"
        className="flex items-center justify-between rounded-xl border border-border bg-surface p-3"
      >
        <span className="text-sm font-semibold">Messages</span>
        <span className="flex items-center gap-2 text-sm text-muted">
          {unread > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-fg">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
          <span aria-hidden>→</span>
        </span>
      </Link>

      {needsUsername && (
        <Link
          href="/profile"
          className="block rounded-xl border border-accent/40 bg-accent/8 p-3 text-sm font-medium text-accent"
        >
          Set a display name so friends know it&apos;s you →
        </Link>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Friends{" "}
          {friends.length > 0 && (
            <span className="text-muted">({friends.length})</span>
          )}
        </h2>
        <ul className="space-y-2">
          {status === "ready" && friends.length === 0 && (
            <li className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
              No friends yet. Share your friend code, or add someone&apos;s
              above.
            </li>
          )}
          {status === "error" && (
            <li className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
              Couldn&apos;t load your friends.
            </li>
          )}
          {friends.map((f) => {
            const mutual = f.iFollow && f.followsMe;
            const body = (
              <>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`truncate font-semibold ${f.name ? "" : "text-muted"}`}
                  >
                    {f.name ?? "Someone (no name set)"}
                  </span>
                  {mutual && (
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      mutual
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {f.iFollow
                    ? `${f.speciesCount} species · ${active(f.lastActiveAt)}`
                    : "follows you"}
                </div>
              </>
            );
            return (
              <li
                key={f.userId}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <Avatar url={f.avatarUrl} />
                {f.iFollow ? (
                  <Link href={`/friend/${f.userId}`} className="min-w-0 flex-1">
                    {body}
                  </Link>
                ) : (
                  <div className="min-w-0 flex-1">{body}</div>
                )}

                {mutual && (
                  <Link
                    href={`/chat/${f.userId}`}
                    className="shrink-0 rounded-lg border border-accent px-2.5 py-1 text-xs font-semibold text-accent"
                  >
                    Message
                  </Link>
                )}
                {f.followsMe && !f.iFollow && (
                  <button
                    onClick={() => followBack(f.userId)}
                    className="shrink-0 rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent"
                  >
                    Follow back
                  </button>
                )}
                {f.iFollow && (
                  <button
                    onClick={() => unfollow(f)}
                    className="shrink-0 px-2 text-xs text-muted"
                  >
                    Unfollow
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Add a friend</h2>
        <form onSubmit={follow} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="PAL-XXXXXXXX"
            autoCapitalize="characters"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm uppercase outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? "…" : "Add"}
          </button>
        </form>
        {msg && <p className="text-sm text-accent">{msg}</p>}
      </section>

      <RevealCode
        value={friendCode}
        loading={loading || status === "loading"}
        label="Your friend code"
        qr={qr}
        qrAlt="Friend code QR"
        note="Different from your MOTH- login code; grants read-only access only."
      />
    </div>
  );
}
