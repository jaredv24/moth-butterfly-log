"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useUserCode } from "@/lib/useUserCode";
import type { ThreadsResponse } from "@/lib/types";

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ChatListPage() {
  const { code, loading } = useUserCode();
  const [data, setData] = useState<ThreadsResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    if (!code) return;
    fetch(`/api/messages?code=${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: ThreadsResponse) => {
        setData(d);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 20_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
        <Link href="/friends" className="text-sm font-medium text-accent">
          Friends →
        </Link>
      </header>

      {!loading && !code && (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          Open your log first.
        </p>
      )}
      {status === "error" && (
        <p className="text-sm text-muted">Couldn&apos;t load messages.</p>
      )}
      {data && data.threads.length === 0 && (
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          No conversations yet. When you and a friend follow each other, a chat
          opens up here — start one from their profile on the Friends tab.
        </p>
      )}

      <ul className="space-y-2">
        {data?.threads.map((t) => (
          <li key={t.userId}>
            <Link
              href={`/chat/${t.userId}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <Avatar url={t.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`truncate font-semibold ${t.name ? "" : "text-muted"}`}
                  >
                    {t.name ?? "Someone"}
                  </span>
                  {t.lastMessage && (
                    <span className="shrink-0 text-[11px] text-muted">
                      {ago(t.lastMessage.at)}
                    </span>
                  )}
                </div>
                <div
                  className={`truncate text-sm ${
                    t.unread > 0 ? "font-medium text-foreground" : "text-muted"
                  }`}
                >
                  {t.lastMessage
                    ? (t.lastMessage.mine ? "You: " : "") +
                      t.lastMessage.preview
                    : "No messages yet"}
                </div>
              </div>
              {t.unread > 0 && (
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-fg">
                  {t.unread > 9 ? "9+" : t.unread}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
