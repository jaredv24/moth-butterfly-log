/**
 * Renders a common name with the scientific name beneath it — but only when
 * they actually differ (iNaturalist returns the scientific name as the common
 * name for species that have none).
 */
export function SpeciesName({
  common,
  scientific,
  className = "",
}: {
  common: string;
  scientific: string;
  className?: string;
}) {
  const sameName = common.trim().toLowerCase() === scientific.trim().toLowerCase();
  return (
    <div className={className}>
      <div className={`truncate font-medium ${sameName ? "italic" : ""}`}>
        {common}
      </div>
      {!sameName && (
        <div className="truncate text-xs italic text-muted">{scientific}</div>
      )}
    </div>
  );
}
