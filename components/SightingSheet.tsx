"use client";

import Link from "next/link";
import { useState } from "react";
import { Lightbox } from "@/components/Lightbox";
import { ShareSightingSheet } from "@/components/ShareSightingSheet";
import { Thumb } from "@/components/Thumb";
import { inatPhoto } from "@/lib/inat-photo";
import type { LogItem } from "@/lib/types";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Bottom-sheet profile for a logged critter: every photo you've taken of it,
 * with when / where. Works for checklist species and off-list bugs alike.
 */
export function SightingSheet({
  sightings,
  code,
  owned = true,
  onClose,
}: {
  sightings: LogItem[];
  /** the viewer's own code — enables "Send to a friend" (own log only) */
  code?: string | null;
  /** false when viewing someone else's log (changes the copy) */
  owned?: boolean;
  onClose: () => void;
}) {
  const [shareFor, setShareFor] = useState<LogItem | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  if (sightings.length === 0) return null;
  const rows = [...sightings].sort((a, b) =>
    b.observedAt.localeCompare(a.observedAt),
  );
  const head = rows[0];
  const group =
    head.otherGroup ??
    (head.speciesId != null
      ? owned
        ? "On your checklist"
        : "On the checklist"
      : null);
  const showSci =
    head.identifiedName.toLowerCase() !==
    head.identifiedScientific.toLowerCase();

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />

        <button
          type="button"
          onClick={() =>
            setZoom({ src: head.photoUrl, alt: head.identifiedName })
          }
          className="block w-full"
        >
          <Thumb
            src={head.photoUrl}
            alt={head.identifiedName}
            className="h-52 w-full rounded-xl bg-border object-cover"
          />
        </button>

        <h2 className="mt-3 text-xl font-bold">{head.identifiedName}</h2>
        {(showSci || group) && (
          <p className="text-sm text-muted">
            {showSci && (
              <span className="italic">{head.identifiedScientific}</span>
            )}
            {showSci && group && " · "}
            {group}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          {head.refPhotoUrl && (
            <button
              type="button"
              onClick={() =>
                setZoom({
                  src:
                    inatPhoto(head.refPhotoUrl, "large") ?? head.refPhotoUrl!,
                  alt: `${head.identifiedName} — reference`,
                })
              }
              className="shrink-0"
            >
              <Thumb
                src={head.refPhotoUrl}
                alt=""
                className="h-14 w-14 rounded-lg bg-border object-cover"
              />
            </button>
          )}
          <a
            href={
              head.inatTaxonId
                ? `https://www.inaturalist.org/taxa/${head.inatTaxonId}`
                : `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(head.identifiedScientific)}`
            }
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-accent"
          >
            {head.refPhotoUrl ? "Reference photo — " : ""}View on iNaturalist ↗
          </a>
        </div>

        {(() => {
          const actions = (s: LogItem) => (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {s.confidence != null && (
                <span>{Math.round(s.confidence * 100)}% match</span>
              )}
              {s.inatObservationId && (
                <a
                  href={`https://www.inaturalist.org/observations/${s.inatObservationId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-accent"
                >
                  iNaturalist ↗
                </a>
              )}
              {code && (
                <button
                  onClick={() => {
                    setSentTo(null);
                    setShareFor(s);
                  }}
                  className="font-medium text-accent"
                >
                  Send to a friend
                </button>
              )}
            </div>
          );

          // one sighting → its photo is already the header photo, don't repeat it
          if (rows.length === 1) {
            const s = rows[0];
            return (
              <div className="mt-4 space-y-1.5 border-t border-border pt-4">
                <div className="text-sm">
                  <span className="font-medium">{fmt(s.observedAt)}</span>
                  {s.placeLabel && (
                    <span className="text-muted"> · 📍 {s.placeLabel}</span>
                  )}
                </div>
                {actions(s)}
              </div>
            );
          }

          return (
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="mb-2 text-sm font-semibold">
                {owned ? "Your sightings" : "Sightings"} ({rows.length})
              </h3>
              <ul className="space-y-3">
                {rows.map((s) => (
                  <li key={s.id} className="flex gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setZoom({ src: s.photoUrl, alt: s.identifiedName })
                      }
                      className="shrink-0"
                    >
                      <Thumb
                        src={s.photoUrl}
                        alt=""
                        className="h-16 w-16 rounded-lg bg-border object-cover"
                      />
                    </button>
                    <div className="min-w-0 flex-1 space-y-1 text-sm">
                      <div className="font-medium">{fmt(s.observedAt)}</div>
                      {s.placeLabel && (
                        <div className="text-xs text-muted">
                          📍 {s.placeLabel}
                        </div>
                      )}
                      {actions(s)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {sentTo && (
          <Link
            href={`/chat/${sentTo}`}
            className="mt-3 inline-block text-sm font-medium text-accent"
          >
            Shared → open the chat
          </Link>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-border py-2.5 text-sm font-semibold"
        >
          Close
        </button>
      </div>
    </div>

      {shareFor && code && (
        <ShareSightingSheet
          code={code}
          sighting={shareFor}
          onClose={() => setShareFor(null)}
          onSent={(userId) => {
            setShareFor(null);
            setSentTo(userId);
          }}
        />
      )}

      {zoom && (
        <Lightbox
          src={zoom.src}
          alt={zoom.alt}
          onClose={() => setZoom(null)}
        />
      )}
    </>
  );
}
