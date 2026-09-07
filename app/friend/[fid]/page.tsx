"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LifeListCard } from "@/components/LifeListCard";
import { LogView } from "@/components/LogView";
import { MapView } from "@/components/MapView";
import { useUserCode } from "@/lib/useUserCode";
import type { LogResponse } from "@/lib/types";

type Tab = "log" | "map";
type FriendLog = LogResponse & {
  friend: { userId: string; name: string; avatarUrl: string | null };
};

export default function FriendLogPage() {
  const { code } = useUserCode();
  const fid = String(useParams().fid ?? "");
  const [data, setData] = useState<FriendLog | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "forbidden">(
    "loading",
  );
  const [tab, setTab] = useState<Tab>("log");

  const refetch = useCallback(() => {
    if (!code) return;
    fetch(`/api/friends/log?code=${code}&friend=${fid}`)
      .then((r) => {
        if (r.status === 403) {
          setStatus("forbidden");
          return null;
        }
        return r.ok ? r.json() : Promise.reject();
      })
      .then((d) => {
        if (d) {
          setData(d);
          setStatus("ready");
        }
      })
      .catch(() => setStatus("error"));
  }, [code, fid]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const name = data?.friend.name ?? "Friend";

  if (status === "forbidden") {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          You&apos;re not following this person, or they removed their code.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackLink />
      <header className="flex items-center gap-3">
        {data?.friend.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.friend.avatarUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-border">
            👤
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          <p className="text-sm text-muted">
            {status === "ready"
              ? `${data!.stats.butterfliesSeen + data!.stats.mothsSeen + data!.stats.otherSpecies} species · read-only`
              : status === "error"
                ? "Couldn't load this log."
                : "Loading…"}
          </p>
        </div>
      </header>

      {data && <LifeListCard stats={data.stats} />}

      <div className="flex gap-2">
        {(["log", "map"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold capitalize ${
              tab === t
                ? "border-accent bg-accent text-accent-fg"
                : "border-border bg-surface"
            }`}
          >
            {t === "log" ? "Log" : "Map"}
          </button>
        ))}
      </div>

      {tab === "log" ? (
        <LogView
          code={code}
          data={data}
          status={status === "ready" ? "ready" : status === "error" ? "error" : "loading"}
          refetch={refetch}
          readOnly
        />
      ) : (
        <MapView
          log={data?.log ?? []}
          emptyHint={`${name} hasn't logged anything with a location.`}
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/friends" className="text-sm font-medium text-accent">
      ← Friends
    </Link>
  );
}
