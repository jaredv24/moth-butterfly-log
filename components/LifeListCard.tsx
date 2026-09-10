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
      {(
        [
          ["Other insects & arthropods", "arthropod"],
          ["Other critters", "critter"],
        ] as const
      ).map(([label, kind]) => {
        const groups = stats.otherGroups.filter((g) => g.kind === kind);
        if (groups.length === 0) return null;
        return (
          <div key={kind} className="space-y-1 pt-1">
            <p className="text-xs font-medium text-muted">{label}</p>
            <div className="flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <span
                  key={g.group}
                  className="rounded-full bg-border px-2 py-0.5 text-[11px] font-medium"
                >
                  {g.group} · {g.species}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
