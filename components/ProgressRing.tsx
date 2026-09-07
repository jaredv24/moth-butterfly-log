export function ProgressBar({
  label,
  seen,
  total,
}: {
  label: string;
  seen: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((seen / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">
          {seen} / {total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
