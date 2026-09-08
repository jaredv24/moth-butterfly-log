"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AttachSightingSheet } from "@/components/AttachSightingSheet";
import { Avatar } from "@/components/Avatar";
import { SharedSightingCard } from "@/components/SharedSightingCard";
import { useUserCode } from "@/lib/useUserCode";
import type { ChatMessage, ThreadResponse } from "@/lib/types";

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChatThreadPage() {
  const { code } = useUserCode();
  const fid = String(useParams().fid ?? "");

  const [data, setData] = useState<ThreadResponse | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "forbidden"
  >("loading");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const load = useCallback(() => {
    if (!code) return;
    fetch(`/api/messages/thread?code=${code}&friend=${fid}`)
      .then((r) => {
        if (r.status === 403) {
          setStatus("forbidden");
          return null;
        }
        return r.ok ? r.json() : Promise.reject();
      })
      .then((d: ThreadResponse | null) => {
        if (d) {
          setData(d);
          setStatus("ready");
        }
      })
      .catch(() => setStatus((s) => (s === "loading" ? "error" : s)));
  }, [code, fid]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 3_000);
    return () => clearInterval(id);
  }, [load]);

  // keep pinned to the newest message when the count grows
  useEffect(() => {
    const n = data?.messages.length ?? 0;
    if (n !== lastCountRef.current) {
      lastCountRef.current = n;
      endRef.current?.scrollIntoView({ block: "end" });
    }
  }, [data?.messages.length]);

  async function post(payload: { body?: string; sightingId?: string }) {
    if (!code) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, to: fid, ...payload }),
      });
      if (res.ok) {
        const { message } = (await res.json()) as { message: ChatMessage };
        setData((d) =>
          d ? { ...d, messages: [...d.messages, message] } : d,
        );
        setText("");
      }
    } finally {
      setSending(false);
    }
  }

  const name = data?.friend.name ?? "Chat";

  if (status === "forbidden") {
    return (
      <div className="space-y-4">
        <Link href="/chat" className="text-sm font-medium text-accent">
          ← Messages
        </Link>
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          You can only message people you both follow. If you were following each
          other, one of you has since unfollowed.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col -mb-8">
      <header className="flex items-center gap-3 border-b border-border pb-3">
        <Link href="/chat" className="text-sm font-medium text-accent">
          ←
        </Link>
        <Avatar url={data?.friend.avatarUrl} size={32} />
        <Link href={`/friend/${fid}`} className="min-w-0 flex-1 truncate font-semibold">
          {name}
        </Link>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-4">
        {status === "loading" && (
          <p className="text-sm text-muted">Loading…</p>
        )}
        {status === "error" && (
          <p className="text-sm text-muted">Couldn&apos;t load this chat.</p>
        )}
        {status === "ready" && data!.messages.length === 0 && (
          <p className="text-center text-sm text-muted">
            No messages yet. Say hello, or share a sighting.
          </p>
        )}

        {data?.messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col gap-1 ${
              m.mine ? "items-end" : "items-start"
            }`}
          >
            {m.sighting && (
              <SharedSightingCard
                sighting={m.sighting}
                href={m.mine ? null : `/friend/${fid}`}
              />
            )}
            {m.body && (
              <div
                className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                  m.mine
                    ? "bg-accent text-accent-fg"
                    : "border border-border bg-surface"
                }`}
              >
                {m.body}
              </div>
            )}
            <span className="px-1 text-[10px] text-muted">{clock(m.at)}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {status !== "error" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = text.trim();
            if (t && !sending) post({ body: t });
          }}
          className="-mx-4 flex items-end gap-2 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            onClick={() => setAttaching(true)}
            disabled={sending}
            aria-label="Share a sighting"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-lg leading-none text-muted disabled:opacity-50"
          >
            +
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const t = text.trim();
                if (t && !sending) post({ body: t });
              }
            }}
            rows={1}
            placeholder="Message"
            className="max-h-28 min-h-9 flex-1 resize-none rounded-2xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="h-9 shrink-0 rounded-2xl bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-40"
          >
            {sending ? "…" : "Send"}
          </button>
        </form>
      )}

      {attaching && code && (
        <AttachSightingSheet
          code={code}
          onClose={() => setAttaching(false)}
          onPick={(sightingId) => {
            setAttaching(false);
            post({ sightingId });
          }}
        />
      )}
    </div>
  );
}
