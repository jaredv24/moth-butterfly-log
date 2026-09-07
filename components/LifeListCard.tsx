import { ProgressBar } from "@/components/ProgressRing";
import type { LogResponse } from "@/lib/types";

/** Compact life-list summary — butterflies/moths progress + other-bug groups. */
export function LifeListCard({ stats }: { stats: LogResponse["stats"] }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">Life list</h2>
      <ProgressBar
        label="Butterflies"
        seen={stats.butterfliesSeen}
        total={stats.totalButterflies}
      />
      <ProgressBar
        label="Moths"
        seen={stats.mothsSeen}
        total={stats.totalMoths}
      />
      {stats.otherSpecies > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {stats.otherGroups.map((g) => (
            <span
              key={g.group}
              className="rounded-full bg-border px-2 py-0.5 text-[11px] font-medium"
            >
              {g.group} · {g.species}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
