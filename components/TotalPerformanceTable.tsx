"use client";

import { useMemo, useState } from "react";
import type { MemberTotalsRow } from "@/lib/types";
import { formatDamage, formatKeys } from "@/lib/format";
import { MemberCell } from "./MemberCell";
import { Pagination, usePagination } from "./Pagination";

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
  filterKey,
}: {
  rows: MemberTotalsRow[];
  emptyQuery?: string;
  // The reader's two narrowing controls (search text + Active/Former), as one
  // comparable value. It exists because this component cannot see either of
  // them as an event: they live in PerformanceTable and arrive here already
  // applied. See the render-phase reset below for why the `rows` array itself
  // is NOT a usable signal.
  filterKey?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("hDmg");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const get = ACCESS[sortKey];
    return [...rows].sort((a, b) => (dir === "desc" ? get(b) - get(a) : get(a) - get(b)));
  }, [rows, sortKey, dir]);

  // Paged after this table's own sort — the caller filters, this component
  // orders, so the slice can only be taken here.
  const view = usePagination(sorted);

  // NARROWING THE LIST SENDS THE READER BACK TO PAGE 1 — and this is the one
  // place in the app that cannot do it from an event handler, because the
  // search box and the Active/Former pills belong to PerformanceTable while the
  // page index belongs to this component's `usePagination`. Without it, typing
  // "a" on page 3 leaves the reader looking at matches 21-22 of 22 and reading
  // it as "my search found two players"; the clamp cannot help, because page 3
  // of 3 is still in range.
  //
  // This is React's documented "adjusting state when a prop changes": store the
  // previous value in state, compare during RENDER, and set state right there.
  // React discards this render and immediately re-runs the component before
  // committing anything, so no intermediate frame reaches the DOM and there is
  // no empty flash. It is NOT an effect — nothing is deferred to after paint and
  // nothing runs on mount (`useState(filterKey)` seeds prev to the current
  // value, so the condition is false on the first render, always).
  //
  // Do NOT read the lint result as the reason this shape was chosen. Measured,
  // not assumed: writing the same reset as `useEffect(() => setPage(1),
  // [filterKey])` ALSO passes lint at baseline here, because
  // `react-hooks/set-state-in-effect` cannot tie a setter that arrives through a
  // custom hook's return value back to its `useState`. The effect version is
  // wrong for the ordinary reason — it commits and paints one frame of "rows
  // 21-22 of 22" before correcting itself — not because a rule catches it. If
  // someone "simplifies" this into an effect later, lint will not stop them.
  //
  // WHY `filterKey` AND NOT `rows !== prevRows`, which is the shorter form of
  // this pattern: `rows` is the parent's `totalRows` useMemo, whose deps include
  // the server-rendered `totals` prop. A week change is a route navigation, so a
  // structurally identical `totals` array crosses the RSC boundary with a BRAND
  // NEW identity every time — and this tab is all-weeks, so its numbers do not
  // even change. Keying on `rows` would therefore reset the page on exactly the
  // event the week-change rule forbids resetting on. `filterKey` moves only when
  // the reader moves something.
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    view.setPage(1);
  }

  // Sorting is the reader asking for a different order, and showing them ranks
  // 21-30 of it is the one thing sorting is meant to prevent. Reset the page —
  // in an event handler, so the week-change rule (clamp, never reset, never an
  // effect) is untouched. Declared after `view` only because it needs it.
  const onSort = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setDir("desc");
    }
    view.setPage(1);
  };

  // A fragment, not a wrapper div: the pagination has to be a SIBLING of the
  // horizontal scroller inside PerformanceTable's card, never a descendant of
  // the <table>. This tab is all-weeks, so nothing here swaps to placeholders.
  return (
    <>
    {/* The HORIZONTAL scroller stays — 8 metric columns at min-w-[920px] need it
        on a narrow viewport. The vertical one and its sticky header are gone:
        one page is 10 rows and the overview page itself scrolls. */}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
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
          {view.pageRows.map((r, i) => (
            <tr key={r.member.id} className="border-b border-border-soft last:border-0 hover:bg-panel-2/50">
              <td className="px-3 py-2.5 pl-5 text-muted tabular-nums">{view.offset + i + 1}</td>
              <td className="px-3 py-2.5">
                <MemberCell member={r.member} />
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
                No players match{emptyQuery?.trim() ? ` “${emptyQuery}”` : ""}.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    {/* Same `label` as the Hydra/Chimera branch: this IS the Clan Performance
        card, just its Total tab, and the two branches are mutually exclusive so
        only ever one of them is in the landmark list. */}
    <Pagination
      {...view}
      onPageChange={view.setPage}
      itemLabel="players"
      label="Clan Performance"
      className="xl:mt-auto"
    />
    </>
  );
}
