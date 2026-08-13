"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ClashType, MemberTotalsRow, PerformanceRow } from "@/lib/types";
import type { PerfScope } from "@/lib/compute";
import { formatDamage, formatKeys } from "@/lib/format";
import { MemberCell } from "./MemberCell";
import { TotalPerformanceTable } from "./TotalPerformanceTable";
import { SectionTitle } from "./SectionTitle";
import { useWeekPending } from "./WeekTransition";
import { PerformanceRowsSkeleton, SkeletonLine, skeletonRowCount } from "./Skeleton";

type SortKey =
  | "keysThisWeek"
  | "keysAverage"
  | "damageThisWeek"
  | "avgDamagePerKey"
  | "participationPct";

const TABS: { key: PerfScope; label: string; accent: string }[] = [
  { key: "hydra", label: "Hydra Clash", accent: "text-hydra" },
  { key: "chimera", label: "Chimera Clash", accent: "text-chimera" },
  { key: "total", label: "Total (All Weeks)", accent: "text-gold" },
];

type MemberFilter = "all" | "active" | "former";
const MEMBER_FILTERS: { key: MemberFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "former", label: "Former" },
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

export function PerformanceTable({
  data,
  totals,
  weekLabel,
  allWeeksLabel,
}: {
  data: Record<ClashType, PerformanceRow[]>;
  totals: MemberTotalsRow[];
  weekLabel: string;
  allWeeksLabel: string;
}) {
  const [scope, setScope] = useState<PerfScope>("hydra");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("damageThisWeek");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");

  const isTotal = scope === "total";

  const pending = useWeekPending();

  const onSort = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setDir("desc");
    }
  };

  // Weekly tabs (Hydra/Chimera): filter by name + sort.
  const rows = useMemo(() => {
    if (isTotal) return [];
    const list = data[scope as ClashType] ?? [];
    const filtered = list.filter((r) =>
      r.member.inGameName.toLowerCase().includes(query.toLowerCase()),
    );
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return dir === "desc" ? bv - av : av - bv;
    });
  }, [data, scope, isTotal, query, sortKey, dir]);

  // Total (All Weeks) tab: filter by name + active/former (sort lives in the table).
  const totalRows = useMemo(() => {
    return totals.filter((r) => {
      if (!r.member.inGameName.toLowerCase().includes(query.toLowerCase())) return false;
      if (memberFilter === "active") return r.member.isActive;
      if (memberFilter === "former") return !r.member.isActive;
      return true;
    });
  }, [totals, query, memberFilter]);

  const participationColor = (pct: number) =>
    pct >= 90 ? "text-up" : pct >= 60 ? "text-muted" : "text-down";

  // This component is the only thing that knows which tab is open, so the
  // placeholder decision has to live here rather than in a wrapper: the Hydra
  // and Chimera tabs are getPerformance(ds, selectedWeek, …) and DO move with
  // the week, while "Total (All Weeks)" is getAllWeeksTotals(ds) and does NOT —
  // swapping that tab would claim a load that is not happening. The second
  // exclusion is an active search that already matches nobody: the row-count
  // fallback would promise 8 rows the same filter will reject again, so the
  // "No players match" row stands through the swap instead. (A genuinely EMPTY
  // week still gets placeholders — they stand for the unknown incoming week.)
  const emptySearch = query.trim() !== "" && rows.length === 0;
  const showSkeleton = pending && !isTotal && !emptySearch;
  const skeletonRows = skeletonRowCount(rows.length);

  return (
    <section className="card-flush xl:flex xl:h-full xl:w-full xl:flex-col xl:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3 xl:shrink-0">
        <div>
          <SectionTitle>Clan Performance</SectionTitle>
          <p className="mt-1 text-sm text-muted">
            {isTotal ? (
              `All Weeks · ${allWeeksLabel}`
            ) : showSkeleton ? (
              <SkeletonLine className="w-56" />
            ) : (
              `Weekly · ${weekLabel}`
            )}
          </p>
        </div>
        <div className="pill-group">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setScope(t.key)}
              className={`pill ${scope === t.key ? `bg-panel ${t.accent} shadow-[0_0_16px_-6px_currentColor]` : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 xl:shrink-0">
        <div className="flex w-72 items-center gap-2 inset px-3 py-2">
          <Search size={15} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </div>
        {isTotal && (
          <div className="pill-group">
            {MEMBER_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setMemberFilter(f.key)}
                className={`pill ${memberFilter === f.key ? "pill-active" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isTotal ? (
        <TotalPerformanceTable rows={totalRows} emptyQuery={query} />
      ) : (
      <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted xl:sticky xl:top-0 xl:z-10 xl:bg-panel">
            <tr className="border-b border-border">
              <th className="px-3 py-2 pl-5 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Player</th>
              <HeaderCell label="Keys (Week)" sortKey="keysThisWeek" active={sortKey === "keysThisWeek"} dir={dir} onSort={onSort} />
              <HeaderCell label="Keys (Avg)" sortKey="keysAverage" active={sortKey === "keysAverage"} dir={dir} onSort={onSort} />
              <HeaderCell label="Damage (Week)" sortKey="damageThisWeek" active={sortKey === "damageThisWeek"} dir={dir} onSort={onSort} />
              <HeaderCell label="Avg Dmg / Key" sortKey="avgDamagePerKey" active={sortKey === "avgDamagePerKey"} dir={dir} onSort={onSort} />
              <HeaderCell label="Participation" sortKey="participationPct" active={sortKey === "participationPct"} dir={dir} onSort={onSort} className="pr-5" />
            </tr>
          </thead>
          {/* `pending`, NOT `showSkeleton` — the same expression ClashTable's
              tbody uses. In the empty-search carve-out no placeholders are drawn,
              but the region genuinely IS loading, and the two tables must not
              report different busy states for one in-flight week change. */}
          <tbody aria-busy={pending}>
            {showSkeleton && <PerformanceRowsSkeleton rows={skeletonRows} />}
            {!showSkeleton && rows.map((r, i) => (
              <tr
                key={r.member.id}
                className="border-b border-border-soft last:border-0 hover:bg-panel-2/50"
              >
                <td className="px-3 py-2.5 pl-5 text-muted tabular-nums">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <MemberCell member={r.member} />
                </td>
                <td className="px-3 py-2.5 tabular-nums">{formatKeys(r.keysThisWeek)}</td>
                <td className="px-3 py-2.5 tabular-nums text-muted">{formatKeys(r.keysAverage)}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatDamage(r.damageThisWeek)}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatDamage(r.avgDamagePerKey)}</td>
                <td className={`px-3 py-2.5 pr-5 tabular-nums ${participationColor(r.participationPct)}`}>
                  {r.participationPct.toFixed(0)}%
                </td>
              </tr>
            ))}
            {!showSkeleton && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-muted">
                  No players match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}
