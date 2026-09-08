import Link from "next/link";
import { Thumb } from "@/components/Thumb";
import type { SharedSighting } from "@/lib/types";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** A sighting attached to a chat message — a standalone card, not inside a bubble. */
export function SharedSightingCard({
  sighting,
  href,
}: {
  sighting: SharedSighting;
  /** when set, the card links here (e.g. the sender's friend log) */
  href?: string | null;
}) {
  const inner = (
    <div className="flex gap-2.5">
      <Thumb
        src={sighting.photoUrl}
        alt={sighting.identifiedName}
        className="h-14 w-14 shrink-0 rounded-lg bg-border object-cover"
      />
      <div className="min-w-0 flex-1 self-center">
        <div className="truncate text-sm font-semibold text-foreground">
          {sighting.identifiedName}
        </div>
        <div className="truncate text-xs text-muted">
          {sighting.placeLabel ? `${sighting.placeLabel} · ` : ""}
          {fmt(sighting.observedAt)}
        </div>
      </div>
    </div>
  );

  const cls =
    "block w-60 max-w-full rounded-xl border border-border bg-surface p-2";

  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
