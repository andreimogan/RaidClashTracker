// Loading placeholders for the week-change swap (see components/WeekTransition.tsx).
//
// Every shape here MIRRORS the geometry of a real component so the swap does not
// jump the layout: same wrapper classes, same paddings, same column count. Two
// devices do the mirroring:
//   * `h-[1lh]` — one line box of the surrounding text size, so a bar standing in
//     for a line of `text-2xl` is exactly as tall as that line. That is why the
//     bars carry the text class they replace (`text-sm`, `text-2xl`, …). The
//     `lh` unit is Baseline-2023: an engine that doesn't know it DROPS the whole
//     declaration, and every bar would collapse to 0 px — the table would look
//     like it emptied itself. `min-h-[0.75rem]` is the floor that makes that
//     degradation merely imprecise instead of invisible; it sits below every
//     line box in use here, so it never affects a browser that does support `lh`.
//   * AVATAR_PX — MemberCell renders <Avatar size={32}/>, which sets width/height
//     inline in px; the row placeholder does the same rather than guessing a rem.
// Fill comes from the `.skeleton` primitive in app/globals.css — no colors here.
//
// Chrome/labels that do NOT depend on the selected week stay REAL in these
// shapes — the clash name and icon, ClashCard's four stat captions and its
// "Progress" label, "Average Keys Used", table headers. Only the numbers a week
// change actually replaces are covered; blanking the rest would be a lie and
// would make the swap louder than the update. (Both card skeletons follow this;
// it is the invariant stated in .claude/rules/ux.md and in the design-system
// doc's "Week-change pending swap" entry.)

import type { ClashType } from "@/lib/types";
import { THEME } from "./ClashCard";
import { SectionTitle } from "./SectionTitle";

// components/MemberCell.tsx renders <Avatar size={32} />, sized inline in px.
const AVATAR_PX = 32;

function Bar({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton block h-[1lh] min-h-[0.75rem] ${className}`} />;
}

/**
 * How many placeholder rows a swapping table draws. The outgoing week's row
 * count is the best available guess at the incoming one (same roster, same
 * filter), so the table keeps roughly its height; the fallback covers a
 * currently-empty week and the cap covers a pathological one. Shared so
 * ClashTable and PerformanceTable cannot drift apart on it.
 */
export function skeletonRowCount(visibleRows: number): number {
  return Math.min(visibleRows || 8, 30);
}

/**
 * One line of text, exactly as tall as the line it replaces (`h-[1lh]` against
 * the inherited text size). Give it the width class it should occupy.
 */
export function SkeletonLine({ className = "" }: { className?: string }) {
  return <Bar className={className} />;
}

/**
 * One cell of ClashCard's 4-up `inset` stat strip. The label and caption are
 * week-independent chrome and stay REAL — only the value a week change actually
 * replaces is covered. Classes are ClashCard's `Stat`, verbatim.
 *
 * The strings are hand-copied because ClashCard declares them inline in its JSX
 * (only `THEME` is exported). DonutSummarySkeleton copies its labels the same
 * way. If a third copy ever appears, hoist them into ClashCard beside `THEME`.
 */
function StatSkeleton({ label, caption }: { label: string; caption?: string }) {
  return (
    <div className="flex-1 px-4 py-3 text-center">
      <div className="text-[11px] font-medium leading-tight text-muted">{label}</div>
      <Bar className="mx-auto mt-1 w-16 rounded-md text-2xl" />
      {caption && <div className="text-xs text-muted">{caption}</div>}
    </div>
  );
}

/** Mirrors components/ClashCard.tsx — header, 4-cell stat strip, progress row. */
export function ClashCardSkeleton({ clashType }: { clashType: ClashType }) {
  // The real THEME, not a copy — the icon and label are week-independent chrome
  // and stay REAL through the swap, so they must never be able to drift.
  const t = THEME[clashType];
  return (
    <section className="card xl:h-full">
      <div className="flex items-center gap-2.5">
        <t.Icon size={22} className={t.text} />
        <h2 className={`font-display text-base font-semibold ${t.text}`}>{t.label}</h2>
        {/* The clash window text is week-scoped, so it is the one header bit that
            goes. No text class: ClashCard's own `text-s` is not a real Tailwind
            size, so that line inherits the base size — matching it means
            inheriting too, not copying the typo. */}
        <Bar className="ml-auto w-28" />
      </div>

      <div className="mt-4 flex divide-x divide-border overflow-hidden inset">
        <StatSkeleton label="Key Usage" caption="Average" />
        <StatSkeleton label="Total Damage" />
        <StatSkeleton label="Avg Damage / Key" />
        <StatSkeleton label="Members Participated" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        {/* Also real chrome. No text class: ClashCard writes `text-s`, which is
            not a Tailwind size, so its label renders at the inherited base size
            — matching it means inheriting too, not copying the typo. */}
        <span className="text-muted">Progress</span>
        {/* The whole track is the placeholder — same box as ClashCard's
            `h-2 flex-1 rounded-full`. Drawing a fill at some arbitrary width
            would assert a progress value we don't have yet. */}
        <span aria-hidden className="skeleton h-2 flex-1 rounded-full" />
        <Bar className="w-10 text-sm" />
      </div>
    </section>
  );
}

/** Mirrors components/DonutSummary.tsx — donut + two labelled figures. */
export function DonutSummarySkeleton() {
  return (
    // `xl:h-full` mirrors DonutSummary — both are the same grid item on `/`.
    <section className="card xl:h-full">
      <SectionTitle>Key Usage Summary</SectionTitle>

      <div className="mt-3 flex items-center gap-5">
        {/* A RING, not a disc: the real chart is a bright 62%→92% donut, and a
            filled circle in its place reads as "the widget was replaced".
            `.skeleton-ring` carves the same radii out of the fill. */}
        <div aria-hidden className="skeleton skeleton-ring h-36 w-36 shrink-0 rounded-full" />

        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-hydra">
              <span className="h-2.5 w-2.5 rounded-full bg-hydra" /> Hydra Clash
            </div>
            <Bar className="mt-0.5 w-16 rounded-md text-2xl" />
            <div className="stat-label">Average Keys Used</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-chimera">
              <span className="h-2.5 w-2.5 rounded-full bg-chimera" /> Chimera Clash
            </div>
            <Bar className="mt-0.5 w-16 rounded-md text-2xl" />
            <div className="stat-label">Average Keys Used</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The `#` + Player pair both tables open with. */
function IdentityCells() {
  return (
    <>
      <td className="px-3 py-2.5 pl-5">
        <Bar className="w-4" />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="skeleton block shrink-0 rounded-lg"
            style={{ width: AVATAR_PX, height: AVATAR_PX }}
          />
          <Bar className="w-28" />
        </div>
      </td>
    </>
  );
}

function rowKeys(count: number): number[] {
  return Array.from({ length: Math.max(1, count) }, (_, i) => i);
}

// Each placeholder <tr> is hidden from the accessibility tree, not just its
// bars: `aria-busy` on the <tbody> is correct placement but weakly supported, so
// without this a reader browsing mid-swap walks 8–30 rows of "blank, blank,
// blank". The rows contain nothing focusable, so nothing is trapped behind it.
const HIDDEN_ROW = "border-b border-border-soft last:border-0";

/**
 * Rows for components/ClashTable.tsx — 7 columns, matching its `min-w-[680px]`
 * grid so the horizontal scroll position does not shift during the swap.
 * Renders `<tr>`s only: the header, search box and sort controls stay live.
 */
export function ClashTableRowsSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {rowKeys(rows).map((i) => (
        <tr key={i} aria-hidden className={HIDDEN_ROW}>
          <IdentityCells />
          <td className="px-3 py-2.5">
            <Bar className="w-8" />
          </td>
          <td className="px-3 py-2.5">
            <Bar className="w-16" />
          </td>
          <td className="px-3 py-2.5">
            <Bar className="w-16" />
          </td>
          <td className="px-3 py-2.5">
            <Bar className="w-10" />
          </td>
          <td className="px-3 py-2.5">
            <Bar className="w-14" />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Rows for the Hydra/Chimera tabs of components/PerformanceTable.tsx — 7 columns
 * against its `min-w-[860px]`, last cell `pr-5` like the real one. Never used on
 * the "Total (All Weeks)" tab, which is not week-scoped.
 */
export function PerformanceRowsSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {rowKeys(rows).map((i) => (
        <tr key={i} aria-hidden className={HIDDEN_ROW}>
          <IdentityCells />
          <td className="px-3 py-2.5">
            <Bar className="w-8" />
          </td>
          <td className="px-3 py-2.5">
            <Bar className="w-8" />
          </td>
          <td className="px-3 py-2.5">
            <Bar className="w-16" />
          </td>
          <td className="px-3 py-2.5">
            <Bar className="w-16" />
          </td>
          <td className="px-3 py-2.5 pr-5">
            <Bar className="w-10" />
          </td>
        </tr>
      ))}
    </>
  );
}
