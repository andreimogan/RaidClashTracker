"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PerformanceRow, ClashType } from "@/lib/types";
import { formatDamage, formatKeys } from "@/lib/format";
import { Avatar } from "./Avatar";
import { TrendBadge } from "./TrendBadge";

type SortKey =
  | "keysThisWeek"
  | "damageThisWeek"
  | "avgDamagePerKey"
  | "participationPct"
  | "trendPct";

export function ClashTable({
  rows,
  clashType,
}: {
  rows: PerformanceRow[];
  clashType: ClashType;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("damageThisWeek");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const onSort = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const filtered = rows.filter((r) =>
      r.member.inGameName.toLowerCase().includes(query.toLowerCase()),
    );
    return [...filtered].sort((a, b) =>
      dir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey],
    );
  }, [rows, query, sortKey, dir]);

  const cols: { key: SortKey; label: string }[] = [
    { key: "keysThisWeek", label: "Keys" },
    { key: "damageThisWeek", label: "Damage" },
    { key: "avgDamagePerKey", label: "Avg Dmg / Key" },
    { key: "participationPct", label: "Participation" },
    { key: "trendPct", label: "Trend" },
  ];
  const accent = clashType === "hydra" ? "text-hydra" : "text-chimera";
  const participationColor = (pct: number) =>
    pct >= 90 ? "text-up" : pct >= 60 ? "text-muted" : "text-down";

  return (
    <section className="rounded-2xl border border-border bg-panel">
      <div className="flex items-center justify-between p-5 pb-3">
        <h2 className={`text-lg font-semibold ${accent}`}>Player Breakdown</h2>
        <div className="flex w-64 items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2">
          <Search size={15} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2 pl-5 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Player</th>
              {cols.map((c) => (
                <th key={c.key} className="px-3 py-2 font-medium">
                  <button
                    onClick={() => onSort(c.key)}
                    className={`inline-flex items-center gap-1 hover:text-text ${sortKey === c.key ? "text-text" : ""}`}
                  >
                    {c.label}
                    {sortKey === c.key && (
                      <span className="text-[10px]">{dir === "desc" ? "▼" : "▲"}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.member.id} className="border-b border-border-soft last:border-0 hover:bg-panel-2/50">
                <td className="px-3 py-2.5 pl-5 text-muted tabular-nums">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.member.inGameName} size={32} badge={r.member.heroLevel} />
                    <span className="font-medium">{r.member.inGameName}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 tabular-nums">{formatKeys(r.keysThisWeek)}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatDamage(r.damageThisWeek)}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatDamage(r.avgDamagePerKey)}</td>
                <td className={`px-3 py-2.5 tabular-nums ${participationColor(r.participationPct)}`}>
                  {r.participationPct.toFixed(0)}%
                </td>
                <td className="px-3 py-2.5 tabular-nums">
                  <TrendBadge value={r.trendPct} />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-muted">
                  No players match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
