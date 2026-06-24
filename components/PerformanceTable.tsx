"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PerformanceRow } from "@/lib/types";
import type { PerfScope } from "@/lib/compute";
import { formatDamage, formatKeys } from "@/lib/format";
import { Avatar } from "./Avatar";
import { TrendBadge } from "./TrendBadge";

type SortKey =
  | "keysThisWeek"
  | "keysAverage"
  | "damageThisWeek"
  | "damageAverage"
  | "avgDamagePerKey"
  | "participationPct"
  | "trendPct";

const TABS: { key: PerfScope; label: string; accent: string }[] = [
  { key: "hydra", label: "Hydra Clash", accent: "text-hydra" },
  { key: "chimera", label: "Chimera Clash", accent: "text-chimera" },
  { key: "total", label: "Total", accent: "text-text" },
];

function HeaderCell({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2 font-medium ${className}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-text ${active ? "text-text" : ""}`}
      >
        {label}
        {active && <span className="text-[10px]">{dir === "desc" ? "▼" : "▲"}</span>}
      </button>
    </th>
  );
}

export function PerformanceTable({ data }: { data: Record<PerfScope, PerformanceRow[]> }) {
  const [scope, setScope] = useState<PerfScope>("hydra");
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

  const rows = useMemo(() => {
    const filtered = data[scope].filter((r) =>
      r.member.inGameName.toLowerCase().includes(query.toLowerCase()),
    );
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return dir === "desc" ? bv - av : av - bv;
    });
    return sorted;
  }, [data, scope, query, sortKey, dir]);

  const participationColor = (pct: number) =>
    pct >= 90 ? "text-up" : pct >= 60 ? "text-muted" : "text-down";

  return (
    <section className="rounded-2xl border border-border bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
        <h2 className="text-lg font-semibold">Clan Performance</h2>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-panel-2 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setScope(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                scope === t.key ? `bg-panel ${t.accent}` : "text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-3">
        <div className="flex w-72 items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2">
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
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2 pl-5 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Player</th>
              <HeaderCell label="Keys (Week)" sortKey="keysThisWeek" active={sortKey === "keysThisWeek"} dir={dir} onSort={onSort} />
              <HeaderCell label="Keys (Avg)" sortKey="keysAverage" active={sortKey === "keysAverage"} dir={dir} onSort={onSort} />
              <HeaderCell label="Damage (Week)" sortKey="damageThisWeek" active={sortKey === "damageThisWeek"} dir={dir} onSort={onSort} />
              <HeaderCell label="Damage (Avg)" sortKey="damageAverage" active={sortKey === "damageAverage"} dir={dir} onSort={onSort} />
              <HeaderCell label="Avg Dmg / Key" sortKey="avgDamagePerKey" active={sortKey === "avgDamagePerKey"} dir={dir} onSort={onSort} />
              <HeaderCell label="Participation" sortKey="participationPct" active={sortKey === "participationPct"} dir={dir} onSort={onSort} />
              <HeaderCell label="Trend" sortKey="trendPct" active={sortKey === "trendPct"} dir={dir} onSort={onSort} className="pr-5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.member.id}
                className="border-b border-border-soft last:border-0 hover:bg-panel-2/50"
              >
                <td className="px-3 py-2.5 pl-5 text-muted tabular-nums">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.member.inGameName} size={32} badge={r.member.heroLevel} />
                    <span className="font-medium">{r.member.inGameName}</span>
                    {!r.member.isActive && (
                      <span className="rounded-full border border-border bg-panel-2 px-2 py-0.5 text-xs font-medium text-faint">
                        Former
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 tabular-nums">{formatKeys(r.keysThisWeek)}</td>
                <td className="px-3 py-2.5 tabular-nums text-muted">{formatKeys(r.keysAverage)}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatDamage(r.damageThisWeek)}</td>
                <td className="px-3 py-2.5 tabular-nums text-muted">{formatDamage(r.damageAverage)}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatDamage(r.avgDamagePerKey)}</td>
                <td className={`px-3 py-2.5 tabular-nums ${participationColor(r.participationPct)}`}>
                  {r.participationPct.toFixed(0)}%
                </td>
                <td className="px-3 py-2.5 pr-5 tabular-nums">
                  <TrendBadge value={r.trendPct} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-muted">
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
