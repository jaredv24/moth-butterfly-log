"use client";

import { useEffect, useMemo, useState } from "react";
import { Thumb } from "@/components/Thumb";
import type { ChecklistItem } from "@/lib/types";

/** Full-screen searchable checklist picker for "none of these are right". */
export function SpeciesPicker({
  title = "Pick the species",
  onSelect,
  onClose,
}: {
  title?: string;
  onSelect: (item: ChecklistItem) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/checklist")
      .then((r) => r.json())
      .then((d) => setItems(d.species ?? []))
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(
        (it) =>
          it.commonName.toLowerCase().includes(q) ||
          it.scientificName.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [items, query]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button onClick={onClose} className="text-sm text-muted">
          Cancel
        </button>
        <h2 className="flex-1 text-center text-sm font-semibold">{title}</h2>
        <span className="w-12" />
      </div>
      <div className="p-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={loading ? "Loading checklist…" : "Search name…"}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </div>
      <ul className="flex-1 divide-y divide-border overflow-y-auto">
        {results.map((it) => (
          <li key={it.id}>
            <button
              onClick={() => onSelect(it)}
              className="flex w-full items-center gap-3 p-3 text-left"
            >
              <Thumb
                src={it.thumbUrl}
                group={it.group}
                className="h-11 w-11 shrink-0 rounded-lg bg-border object-cover"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{it.commonName}</div>
                <div className="truncate text-xs italic text-muted">
                  {it.scientificName} · {it.family}
                </div>
              </div>
            </button>
          </li>
        ))}
        {query.trim() && !results.length && (
          <li className="p-4 text-sm text-muted">No checklist species match that.</li>
        )}
      </ul>
    </div>
  );
}
