"use client";

import { useMemo, useState } from "react";
import type { MemberTotalsRow } from "@/lib/types";
import { formatDamage, formatKeys } from "@/lib/format";
import { Avatar } from "./Avatar";

// Per-clash, all-weeks sort keys.
type SortKey = "hKeys" | "hAvg" | "hPart" | "hDmg" | "cKeys" | "cAvg" | "cPart" | "cDmg";

const ACCESS: Record<SortKey, (r: MemberTotalsRow) => number> = {
  hKeys: (r) => r.hydra.totalKeys,
  hAvg: (r) => r.hydra.avgKeys,
  hPart: (r) => r.hydra.participationPct,
  hDmg: (r) => r.hydra.totalDamage,
  cKeys: (r) => r.chimera.totalKeys,
  cAvg: (r) => r.chimera.avgKeys,
  cPart: (r) => r.chimera.participationPct,
  cDmg: (r) => r.chimera.totalDamage,
};

function SortTh({
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

const participationColor = (pct: number) =>
  pct >= 90 ? "text-up" : pct >= 60 ? "text-muted" : "text-down";

export function TotalPerformanceTable({
  rows,
  emptyQuery,
}: {
  rows: MemberTotalsRow[];
  emptyQuery?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("hDmg");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const onSort = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const get = ACCESS[sortKey];
    return [...rows].sort((a, b) => (dir === "desc" ? get(b) - get(a) : get(a) - get(b)));
  }, [rows, sortKey, dir]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-border">
            <th rowSpan={2} className="px-3 py-2 pl-5 align-bottom font-medium">#</th>
            <th rowSpan={2} className="px-3 py-2 align-bottom font-medium">Player</th>
            <th colSpan={4} className="border-l border-border px-3 py-1.5 text-center font-semibold text-hydra">
              Hydra
            </th>
            <th colSpan={4} className="border-l border-border px-3 py-1.5 text-center font-semibold text-chimera">
              Chimera
            </th>
          </tr>
          <tr className="border-b border-border">
            <SortTh label="Keys" sortKey="hKeys" active={sortKey === "hKeys"} dir={dir} onSort={onSort} className="border-l border-border" />
            <SortTh label="Keys Avg" sortKey="hAvg" active={sortKey === "hAvg"} dir={dir} onSort={onSort} />
            <SortTh label="Participation" sortKey="hPart" active={sortKey === "hPart"} dir={dir} onSort={onSort} />
            <SortTh label="Damage" sortKey="hDmg" active={sortKey === "hDmg"} dir={dir} onSort={onSort} />
            <SortTh label="Keys" sortKey="cKeys" active={sortKey === "cKeys"} dir={dir} onSort={onSort} className="border-l border-border" />
            <SortTh label="Keys Avg" sortKey="cAvg" active={sortKey === "cAvg"} dir={dir} onSort={onSort} />
            <SortTh label="Participation" sortKey="cPart" active={sortKey === "cPart"} dir={dir} onSort={onSort} />
            <SortTh label="Damage" sortKey="cDmg" active={sortKey === "cDmg"} dir={dir} onSort={onSort} className="pr-5" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.member.id} className="border-b border-border-soft last:border-0 hover:bg-panel-2/50">
              <td className="px-3 py-2.5 pl-5 text-muted tabular-nums">{i + 1}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Avatar name={r.member.inGameName} size={32} />
                  <span className="font-medium">{r.member.inGameName}</span>
                  {!r.member.isActive && (
                    <span className="rounded-full border border-border bg-panel-2 px-2 py-0.5 text-xs font-medium text-faint">
                      Former
                    </span>
                  )}
                </div>
              </td>
              <td className="border-l border-border px-3 py-2.5 tabular-nums">{formatKeys(r.hydra.totalKeys)}</td>
              <td className="px-3 py-2.5 tabular-nums text-muted">{formatKeys(r.hydra.avgKeys)}</td>
              <td className={`px-3 py-2.5 tabular-nums ${participationColor(r.hydra.participationPct)}`}>
                {r.hydra.participationPct.toFixed(0)}%
              </td>
              <td className="px-3 py-2.5 tabular-nums">{formatDamage(r.hydra.totalDamage)}</td>
              <td className="border-l border-border px-3 py-2.5 tabular-nums">{formatKeys(r.chimera.totalKeys)}</td>
              <td className="px-3 py-2.5 tabular-nums text-muted">{formatKeys(r.chimera.avgKeys)}</td>
              <td className={`px-3 py-2.5 tabular-nums ${participationColor(r.chimera.participationPct)}`}>
                {r.chimera.participationPct.toFixed(0)}%
              </td>
              <td className="px-3 py-2.5 pr-5 tabular-nums">{formatDamage(r.chimera.totalDamage)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={10} className="px-5 py-10 text-center text-muted">
                No players match{emptyQuery ? ` “${emptyQuery}”` : ""}.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
