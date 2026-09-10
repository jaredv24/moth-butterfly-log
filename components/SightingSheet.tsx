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

        <div className="flex items-start gap-3">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <figure className="text-center">
              <button
                type="button"
                onClick={() =>
                  setZoom({ src: head.photoUrl, alt: head.identifiedName })
                }
              >
                <Thumb
                  src={head.photoUrl}
                  alt={head.identifiedName}
                  className="h-24 w-24 rounded-xl bg-border object-cover"
                />
              </button>
              {head.refPhotoUrl && (
                <figcaption className="mt-0.5 text-[10px] text-muted">
                  Sighting
                </figcaption>
              )}
            </figure>
            {head.refPhotoUrl && (
              <figure className="text-center">
                <button
                  type="button"
                  onClick={() =>
                    setZoom({
                      src:
                        inatPhoto(head.refPhotoUrl, "large") ??
                        head.refPhotoUrl!,
                      alt: `${head.identifiedName} — reference`,
                    })
                  }
                >
                  <Thumb
                    src={head.refPhotoUrl}
                    alt=""
                    className="h-12 w-12 rounded-lg bg-border object-cover"
                  />
                </button>
                <figcaption className="mt-0.5 text-[10px] text-muted">
                  iNaturalist
                </figcaption>
              </figure>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{head.identifiedName}</h2>
            {head.identifiedName.toLowerCase() !==
              head.identifiedScientific.toLowerCase() && (
              <p className="text-sm italic text-muted">
                {head.identifiedScientific}
              </p>
            )}
            {group && <p className="mt-1 text-xs text-muted">{group}</p>}
            <a
              href={
                head.inatTaxonId
                  ? `https://www.inaturalist.org/taxa/${head.inatTaxonId}`
                  : `https://www.inaturalist.org/taxa/search?q=${encodeURIComponent(head.identifiedScientific)}`
              }
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs font-medium text-accent"
            >
              View on iNaturalist ↗
            </a>
          </div>
        </div>

        <h3 className="mt-5 mb-2 text-sm font-semibold">
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
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-medium">{fmt(s.observedAt)}</div>
                {s.placeLabel && (
                  <div className="text-xs text-muted">📍 {s.placeLabel}</div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
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
              </div>
            </li>
          ))}
        </ul>

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
