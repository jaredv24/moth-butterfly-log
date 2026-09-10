import { ProgressBar } from "@/components/ProgressRing";
import type { LogResponse } from "@/lib/types";

const TIERS = [
  {
    label: "Other insects & arthropods",
    kind: "arthropod" as const,
    egs: "beetles, dragonflies, bees, spiders",
  },
  {
    label: "Other critters",
    kind: "critter" as const,
    egs: "frogs, turtles, lizards, snakes",
  },
];

/**
 * Life-list summary: butterfly/moth checklist progress, plus every other kind
 * of critter that's been logged. `own` shows a prompt for the empty categories
 * so it's clear those count too.
 */
export function LifeListCard({
  stats,
  own = false,
}: {
  stats: LogResponse["stats"];
  own?: boolean;
}) {
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

      {TIERS.map(({ label, kind, egs }) => {
        const groups = stats.otherGroups.filter((g) => g.kind === kind);
        if (groups.length === 0 && !own) return null;
        const n = groups.reduce((s, g) => s + g.species, 0);
        return (
          <div key={kind} className="space-y-1 pt-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium text-muted">{label}</p>
              {n > 0 && (
                <p className="shrink-0 text-xs text-muted">{n} species</p>
              )}
            </div>
            {groups.length > 0 ? (
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
            ) : (
              <p className="text-[11px] text-muted">
                None yet — {egs} get logged here too.
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
