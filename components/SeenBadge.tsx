function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "📍 Austin, Texas · Sep 6, 2026" — shown on checked-off species. */
export function SeenBadge({
  placeLabel,
  observedAt,
  className = "",
}: {
  placeLabel: string | null;
  observedAt: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent ${className}`}
    >
      <span aria-hidden>{placeLabel ? "📍" : "📅"}</span>
      <span>
        {placeLabel ? `${placeLabel} · ` : ""}
        {formatDate(observedAt)}
      </span>
    </span>
  );
}
