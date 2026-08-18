"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { PerformanceRow, ClashType } from "@/lib/types";
import { formatDamage, formatKeys } from "@/lib/format";
import { MemberCell } from "./MemberCell";
import { TrendBadge } from "./TrendBadge";
import { SectionTitle } from "./SectionTitle";
import { useWeekPending } from "./WeekTransition";
import { ClashTableRowsSkeleton, skeletonRowCount } from "./Skeleton";
import { Pagination, usePagination } from "./Pagination";

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
  // Every column here is week-scoped (getPerformance(ds, selectedWeek, clashType)),
  // so the rows swap — but only the rows. Search and sort keep working on the
  // outgoing data, which is still the state the user will land back on.
  const pending = useWeekPending();

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
  const participationColor = (pct: number) =>
    pct >= 90 ? "text-up" : pct >= 60 ? "text-muted" : "text-down";

  // Paginate the fully filtered + sorted list. The page index is CHROME: it is
  // never reset on a week change (the clamp inside `usePagination` folds a
  // now-out-of-range page back in) and it stays interactive through a swap,
  // exactly like search and sort above.
  //
  // A WEEK CHANGE AND A SEARCH ARE NOT THE SAME EVENT, though, and the clamp
  // only answers the first one. A week change is something the app does TO the
  // reader, so keeping their position is right. Typing in the box or clicking a
  // column header is something the reader ASKS FOR, and the answer to it starts
  // at the top: on page 3 of 30 players, typing "a" leaves `pageCount` at 3 and
  // the clamp does nothing, so 22 matches render as "21–22 of 22" — two rows at
  // the bottom of a result set that reads like "your search found 2 players".
  // Same on sort: you get ranks 21–30 of the new order, never its new top. So
  // both handlers below call `setPage(1)`. They are EVENT handlers, not effects
  // — `react-hooks/set-state-in-effect` is not in play, and the clamp above is
  // untouched.
  const view = usePagination(sorted);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setDir("desc");
    }
    view.setPage(1);
  };

  // An active search that already matches nobody is the one case where the
  // row-count fallback lies: it would promise 8 rows the same filter will almost
  // certainly reject again. Keep the "No players match" row standing instead.
  // (A genuinely EMPTY week is different and does get placeholders — they stand
  // for the unknown incoming week, not for the current empty one.)
  // It tests the WHOLE filtered list, not the page: a page that happens to be
  // empty can only happen when the filtered list is empty, because the clamp
  // pulls the reader back to page 1 the moment the list shrinks under them.
  const emptySearch = query.trim() !== "" && sorted.length === 0;
  const showSkeleton = pending && !emptySearch;
  // Fed the PAGE's length, not the filtered total: placeholders stand in for the
  // rows this table is about to draw, and it draws at most one page of them.
  const skeletonRows = skeletonRowCount(view.pageRows.length);

  return (
    // SIZES TO ITS CONTENT, CAPPED AT THE SPACE IT IS GIVEN.
    //
    // `/hydra` and `/chimera` keep their viewport lock: ClashDetailView (not
    // ours) hands this card a flex row that is `xl:flex-1` of an `xl:h-screen`
    // page. While the table scrolled internally that was right — the scroller
    // filled whatever it got. Paginated at ten rows it no longer does, and
    // `xl:h-full` + a `flex-1` scroller stretched the card anyway: ~300px of
    // empty card on a 1080p display, with the pagination bar's `border-t`
    // floating in the middle of nothing.
    //
    // So: `xl:self-start` (the parent is a flex row, so the default
    // `align-items: stretch` is what forced full height — height:auto alone
    // does not escape it) + `xl:max-h-full` instead of `xl:h-full`. Under the
    // cap the card ends after its last row and the leftover is page
    // background. Over it — a short xl viewport, where ten rows genuinely do
    // not fit — the cap engages, the scroller shrinks (it is the only child
    // without `xl:shrink-0`) and the sticky thead and internal scrolling work
    // exactly as before. Nothing is ever clipped by the page's
    // `xl:overflow-hidden`, which is what dropping the internal scroller
    // outright would have risked.
    <section className="card-flush xl:flex xl:max-h-full xl:w-full xl:flex-col xl:self-start xl:overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3 xl:shrink-0">
        <SectionTitle tone={clashType}>Player Breakdown</SectionTitle>
        <div className="flex w-64 items-center gap-2 inset px-3 py-2">
          <Search size={15} className="text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Reader-initiated: show them the TOP of their result set.
              view.setPage(1);
            }}
            placeholder="Search player..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </div>
      </div>

      {/* `xl:flex-auto`, not `xl:flex-1`: with the card now content-sized, the
          scroller's flex BASIS has to be its content (`flex: 1 1 auto`) rather
          than 0, so the card's intrinsic height is the height of the rows.
          `xl:min-h-0` is what lets it shrink below that when `xl:max-h-full`
          bites, which is when the sticky thead below earns its keep. */}
      <div className="overflow-x-auto xl:min-h-0 xl:flex-auto xl:overflow-y-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted xl:sticky xl:top-0 xl:z-10 xl:bg-panel">
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
          <tbody aria-busy={pending}>
            {showSkeleton && <ClashTableRowsSkeleton rows={skeletonRows} />}
            {!showSkeleton && view.pageRows.map((r, i) => (
              <tr key={r.member.id} className="border-b border-border-soft last:border-0 hover:bg-panel-2/50">
                {/* `offset + i + 1`, so the rank column keeps counting across
                    pages instead of restarting at 1 on every page. */}
                <td className="px-3 py-2.5 pl-5 text-muted tabular-nums">{view.offset + i + 1}</td>
                <td className="px-3 py-2.5">
                  <MemberCell member={r.member} />
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
            {!showSkeleton && sorted.length === 0 && (
              <tr>
                {/* The quoted term is dropped when there is no search term: a
                    genuinely empty week hits this same row, and `No players
                    match “”.` reads as a bug. Same guard as
                    components/TotalPerformanceTable.tsx. */}
                <td colSpan={7} className="px-5 py-10 text-center text-muted">
                  No players match{query.trim() ? ` “${query}”` : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* OUTSIDE the <table>, a sibling of the scroll wrapper: a <nav> among
          <tbody>s is invalid HTML and the browser hoists it out of the table
          during parsing. Renders nothing when there are no rows at all. */}
      <Pagination
        {...view}
        onPageChange={view.setPage}
        itemLabel="players"
        label="Player Breakdown"
      />
    </section>
  );
}
