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
import { Pagination, usePagination } from "./Pagination";

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

  // Page the Hydra/Chimera rows AFTER filter + sort, so a page is a slice of the
  // list the reader is actually looking at. The Total tab pages itself inside
  // TotalPerformanceTable, where its own sort lives; this hook is still called
  // unconditionally (it would be a conditional hook otherwise) and simply sees
  // the empty array that `rows` becomes on that tab.
  const view = usePagination(rows);

  // THE PAGE INDEX RESETS ON EVERY CHANGE THE READER ASKS FOR, and on none that
  // the app does to them. Two different situations that look alike:
  //   * a WEEK CHANGE is something the app does under the reader — the requested
  //     page is kept and t2's clamp folds it into range, so page 3 of a long
  //     week stays page 3. That rule is untouched here; there is still no reset
  //     tied to `rows` changing, and still no effect.
  //   * SEARCH, SORT and TAB are the reader asking for a different list, and the
  //     answer to "show me players matching 'a'" is never "rows 21-22 of the 22
  //     that matched" — which is exactly what the clamp alone produced (page 3
  //     of 3 is in range, so it clamps to nothing). Sorting had the worse
  //     version: clicking a column while on page 3 shows ranks 21-30 of the new
  //     order and never the new top, which is the entire reason to sort.
  // These are event handlers, so `set-state-in-effect` never enters into it.
  const onSort = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setDir("desc");
    }
    view.setPage(1);
  };

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
  // Placeholders stand in for the rows on screen, which is now ONE PAGE of them
  // — feeding the full filtered length would draw a 30-row slab over a 10-row
  // table. skeletonRowCount's own cap never comes into play at this size; its
  // 8-row fallback still covers a currently-empty week.
  const skeletonRows = skeletonRowCount(view.pageRows.length);

  // No internal scroller and no viewport lock any more: the overview page scrolls
  // as one document and a page holds 10 rows, so the card is simply as tall as its
  // rows. `xl:h-full` only makes the card fill its grid cell when it sits beside
  // the Black List.
  // `xl:flex xl:flex-col` is the other half of `xl:h-full`: at 2xl the grid
  // stretches both overview cards to the taller one's height, and without a flex
  // column the pagination bar's top border lands wherever the rows happen to
  // end, with dead space beneath it. `mt-auto` on the control seats it at the
  // card's foot instead. Inert below xl, where nothing stretches.
  return (
    <section className="card-flush xl:flex xl:h-full xl:flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
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
              onClick={() => {
                setScope(t.key);
                // A different tab is a different list. Hydra->Chimera used to
                // keep the index while a detour through Total lost it (that
                // hook unmounts), so the behaviour was not even consistent.
                view.setPage(1);
              }}
              className={`pill ${scope === t.key ? `bg-panel ${t.accent} shadow-[0_0_16px_-6px_currentColor]` : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3">
        <div className="flex w-72 items-center gap-2 inset px-3 py-2">
          <Search size={15} className="text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              view.setPage(1);
            }}
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
        // `filterKey` is the reader's two narrowing controls as one value, so
        // the Total tab can send itself back to page 1 when either moves. Note
        // it is built from `query`/`memberFilter` and NOT from `totalRows`:
        // `totals` is a server prop and gets a new array identity on every week
        // navigation, which would turn a week change into a page reset.
        // `memberFilter` first because it is a closed set with no "|" in it, so
        // the join is unambiguous however the reader spells their search.
        <TotalPerformanceTable
          rows={totalRows}
          emptyQuery={query}
          filterKey={`${memberFilter}|${query}`}
        />
      ) : (
      <>
      {/* The HORIZONTAL scroller stays — the min-w-[860px] grid still needs it
          on a narrow viewport. Only the vertical one, and the sticky header that
          served it, are gone; a page of 10 rows is what replaced them. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
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
            {!showSkeleton && view.pageRows.map((r, i) => (
              <tr
                key={r.member.id}
                className="border-b border-border-soft last:border-0 hover:bg-panel-2/50"
              >
                {/* `offset + i + 1`, so rank 11 opens page 2 instead of a second rank 1. */}
                <td className="px-3 py-2.5 pl-5 text-muted tabular-nums">{view.offset + i + 1}</td>
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
                {/* The quoted term only when there IS one. A genuinely empty
                    week hit this row with `No players match “”.` — a pair of
                    empty quotes reads as a bug, not as an empty week. Same
                    shape TotalPerformanceTable already used. */}
                <td colSpan={7} className="px-5 py-10 text-center text-muted">
                  No players match{query.trim() ? ` “${query}”` : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* OUTSIDE the table, sibling of the scroller, still inside the card. It is
          chrome: it stays real and interactive while the rows swap, and the page
          index is never reset by a week change — the hook clamps a short week
          back into range on its own. `label` names the landmark and the
          announcement, because the Black List's control sits beside this one at
          2xl and "Pagination" twice tells a screen-reader user nothing. */}
      <Pagination
        {...view}
        onPageChange={view.setPage}
        itemLabel="players"
        label="Clan Performance"
        className="xl:mt-auto"
      />
      </>
      )}
    </section>
  );
}
