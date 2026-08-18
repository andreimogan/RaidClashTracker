"use client";

// The ONE pagination control. Five tables share it (Clan Performance, its
// "Total (All Weeks)" tab, the Black List, the clash Player Breakdown, the
// /members Roster), so the rules live here once instead of five times.
//
// Four things in here are load-bearing and are the reason this file exists:
//
//  1. THE CLAMP IS DERIVED ON READ, NEVER SYNCED IN AN EFFECT. `useState` holds
//     the page the user ASKED for; the page we hand back is that request clamped
//     into [1, pageCount] against the CURRENT row count. So when the list shrinks
//     under the reader — a week change brings a shorter week, a search narrows
//     the roster — page 4 of 4 silently reads as page 2 of 2 and the table shows
//     rows instead of a blank slab. An effect that syncs the index down instead
//     COMMITS AND PAINTS one wrong frame before correcting itself — and lint does
//     NOT stop you (the rule cannot follow a setter returned by a custom hook;
//     measured, TotalPerformanceTable.tsx:88-104). No effect here; keep it.
//     The requested page is deliberately NOT reset when the rows change: sort and
//     search already persist across a week change, and the clamp makes a reset
//     unnecessary — a reader who was on page 3 of a long list is still on page 3
//     when the list is still long.
//
//  2. PLACEMENT: `<Pagination>` is a SIBLING of the `overflow-x-auto` wrapper,
//     inside the `.card-flush` <section>, AFTER the table — never inside
//     <table>. A <nav>/<div> among <tbody> is invalid HTML; React renders it,
//     the browser hoists it out of the table during parsing/reconciliation, and
//     you get a control that works in dev and detaches in odd ways later. This
//     exact mistake bounced `PendingSwap` in the week-pending order.
//
//  3. PREV/NEXT STAY VISIBLE AND FOCUSABLE AT THE ENDS. They are marked
//     `aria-disabled`, NOT `disabled`, and each handler no-ops when it cannot
//     move. This is a correction to the first version of this file, which used
//     the native attribute:
//       - Paging to the LAST page disables Next *while Next holds focus*. The
//         browser cannot keep focus on a disabled element, so it drops focus to
//         <body> and the reader's next Tab restarts at the top of the document.
//         That is the ordinary happy path of paging to the end of a table, on
//         five surfaces. Mirror case on Prev at page 1. `aria-disabled` keeps the
//         element focusable, so focus survives the state change.
//       - A `disabled` button is also skipped by Tab entirely, so a screen-reader
//         user tabbing the chrome cannot even find the ends of the range.
//     `aria-disabled` still announces the state, so nothing is lost. Because the
//     native attribute is gone, `:disabled` and `enabled:` no longer match: the
//     dimming and the hover suppression are expressed with the `aria-disabled:`
//     variant instead — see GHOST_ICON_BUTTON below.
//     Staying visible (rather than unmounting) is a deliberate carve-out from
//     hide-don't-disable: that rule (.claude/rules/ux.md) governs PERMISSIONS —
//     an action the visitor may never perform, whose control would otherwise
//     advertise an endpoint. "You are on the last page" is a transient position,
//     and a control that vanishes at the ends makes the row of chrome jump.
//     Precedent: the week chevrons at components/TopBar.tsx:129-144, which still
//     carry the native attribute and therefore still have the focus bug — NOT
//     fixed here (not this task's file); flagged as a follow-up.
//
//  4. A ONE-PAGE TABLE GETS NO BUTTONS AND NO LANDMARK. The carve-out in note 3
//     rests on the position being TRANSIENT. At `pageCount === 1` it is
//     permanent: two chevrons that can never move, and "Page 1 of 1", are dead
//     chrome, and a "…pagination" landmark with nothing to navigate is a false
//     promise in a screen reader's landmark list. So the button group and the
//     <nav> around it are dropped; the range summary ("1–6 of 6 players") stays,
//     because the count is useful on its own. The summary lives OUTSIDE the
//     <nav>, in a wrapper whose element type never changes, precisely so that
//     crossing the one-page boundary cannot unmount and re-insert the live
//     region already populated (the hazard that moved WeekAnnouncer up to the
//     provider — see docs/reference/design-system.md).
//
// Contrast: the dimmest text token (`--color-faint`) is FORBIDDEN in this file
// and its class name is deliberately absent so the ban is greppable. It measures
// ~3.05:1 and cannot reach WCAG AA at this project's `html { font-size: 75% }`,
// and every word a pagination control says ("Page 2 of 4", "11-20 of 34
// players") is information the reader needs to navigate. `text-muted` is
// ~6.23:1 and passes, so every label below uses it.

import type React from "react";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Rows per page, everywhere. One number so five tables cannot drift apart. */
export const ROWS_PER_PAGE = 10;

/**
 * The "Ghost icon button (tables)" pattern from
 * docs/reference/design-system.md:58 (the h-7 w-7 in-table one, NOT TopBar's
 * larger h-9 w-9 page-header chevron), carrying the disabled look on the
 * `aria-disabled:` variant rather than `:disabled`, because these buttons keep
 * the native attribute OFF on purpose (note 3 at the top of the file).
 *
 * Two halves to that:
 *   - `aria-disabled:opacity-40` — the same 40% dim `disabled:opacity-40` gave.
 *   - `aria-disabled:hover:*` resets the gold hover back to the resting border
 *     and text colours, so an end button does not light up under the cursor
 *     while refusing to act. It wins over the plain `hover:` pair on
 *     specificity, not source order: `.x[aria-disabled="true"]:hover` is (0,3,0)
 *     against `.y:hover`'s (0,2,0), so the reset holds wherever Tailwind chooses
 *     to emit the two rules.
 *
 * (`enabled:hover:`, the previous form, silently stops working the moment the
 * native attribute is dropped: `:enabled` matches every button that is not
 * `disabled`, so it would have matched BOTH ends.)
 *
 * The buttons stay h-7 w-7 (21 CSS px at the 75% root size), under WCAG 2.2
 * §2.5.8's 24px floor but passing it via the spacing exception — the `gap-2`
 * below keeps a ≥24px target circle clear around each. Bumping to h-8 would
 * fork the shared ghost-icon-button geometry for one caller; deliberately not
 * taken.
 */
const GHOST_ICON_BUTTON =
  "inline-grid h-7 w-7 place-items-center rounded-md border border-border bg-panel-2/50 " +
  "text-muted transition-colors hover:border-gold/40 hover:text-gold " +
  "aria-disabled:opacity-40 aria-disabled:hover:border-border aria-disabled:hover:text-muted";

/**
 * A page size that cannot degenerate. `pageSize: 0` would make `pageCount`
 * Infinity and `pageRows` empty — a table that renders no rows and offers
 * infinite pages. No caller passes `pageSize` today; this is a cheap floor so
 * one cannot introduce that by typo. Fractions floor (3.7 → 3), and anything
 * that is not a usable number (0, negatives, NaN) becomes 1.
 *
 * The ceiling is not decoration either: `Infinity` survives `>= 1`, and then
 * `offset = (page - 1) * Infinity` is `0 * Infinity` = NaN, which slices to an
 * empty page. Capping at MAX_SAFE_INTEGER keeps the arithmetic finite and gives
 * `Infinity` the reading a caller would have meant by it — everything on one
 * page.
 */
function normalizePageSize(pageSize: number): number {
  const size = Math.floor(pageSize);
  return size >= 1 ? Math.min(size, Number.MAX_SAFE_INTEGER) : 1;
}

/**
 * The whole clamp, as a pure function — no React, no state, so it is testable
 * on its own and so `usePagination` below is a two-line wrapper around it with
 * nothing left to get wrong.
 *
 * `pageCount` is at least 1 even for an empty list: "Page 1 of 0" is nonsense,
 * and callers slice against `pageRows` anyway. `offset` is what a table adds to
 * its row index for the `#` column (`offset + i + 1`), so ranks keep counting
 * across pages instead of restarting at 1 on every page.
 */
export function paginate<T>(
  rows: readonly T[],
  requestedPage: number,
  pageSize: number = ROWS_PER_PAGE,
): { page: number; pageCount: number; pageRows: T[]; offset: number; total: number } {
  const size = normalizePageSize(pageSize);
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, Math.floor(requestedPage) || 1), pageCount);
  const offset = (page - 1) * size;
  return { page, pageCount, pageRows: rows.slice(offset, offset + size), offset, total };
}

/**
 * Holds the REQUESTED page and returns the CLAMPED one. Feed it the fully
 * filtered + sorted array; render `pageRows`.
 *
 * `setPage` sets the request. It is never called from an effect and never
 * called in response to `rows` changing — see note 1 at the top of the file.
 */
export function usePagination<T>(
  rows: readonly T[],
  pageSize: number = ROWS_PER_PAGE,
): {
  page: number;
  pageCount: number;
  pageRows: T[];
  offset: number;
  total: number;
  setPage: (p: number) => void;
} {
  const [requestedPage, setPage] = useState(1);
  // Derived on read. `requestedPage` may point past the end of a list that just
  // got shorter; `paginate` folds it back in, and the next render is correct
  // with no extra pass and no state write.
  const view = useMemo(
    () => paginate(rows, requestedPage, pageSize),
    [rows, requestedPage, pageSize],
  );
  return { ...view, setPage };
}

/**
 * Renders nothing at all when there is nothing to page through — an empty table
 * already says "no rows" in its own body, and a "0-0 of 0" strip under it is
 * noise. Note this component holds NO hooks, so the early return is not a
 * conditional-hook problem (`react-hooks/rules-of-hooks`); the state it displays
 * belongs to the caller's `usePagination`.
 *
 * `label` is the human name of the TABLE this control drives — "Clan
 * Performance", "Black List" — not a finished aria-label. It is optional and
 * every call site is correct without it, but two of these can sit side by side
 * (Clan Performance and the Black List, at 2xl on the overview), and unlabelled
 * they show a screen reader two identical "Pagination" landmarks and two range
 * summaries that name no table. Given one, the landmark becomes "<label>
 * pagination" and the live region opens with "<label>: ". A label that already
 * ends in "pagination" is used as-is rather than doubled, so passing either the
 * table name or the finished landmark name works.
 */
export function Pagination({
  page,
  pageCount,
  total,
  offset,
  pageSize = ROWS_PER_PAGE,
  onPageChange,
  itemLabel = "rows",
  label,
  className = "",
}: {
  page: number;
  pageCount: number;
  total: number;
  offset: number;
  pageSize?: number;
  onPageChange: (p: number) => void;
  itemLabel?: string;
  label?: string;
  className?: string;
}): React.ReactElement | null {
  if (total === 0) return null;

  const size = normalizePageSize(pageSize);
  const first = offset + 1;
  const last = Math.min(offset + size, total);
  const tableName = (label ?? "").trim().replace(/\s*pagination$/i, "");
  const canPrev = page > 1;
  const canNext = page < pageCount;

  return (
    // The element type of this wrapper never changes, so the live region inside
    // it stays mounted while the <nav> beside it comes and goes with pageCount.
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 xl:shrink-0 ${className}`}
    >
      {/* The announcement. A query-only page change moves no focus and pushes no
          route, so without a live region a screen-reader user gets silence and a
          table whose contents quietly became different rows. `aria-atomic` so the
          whole sentence is read, not just the digits that changed. It is mounted
          for as long as there are rows, which is what makes the update announce
          at all — a live region inserted already-populated may not. The table
          name rides in an `sr-only` span: on screen the card header already says
          which table this is, in the announcement nothing else does. */}
      <p
        aria-live="polite"
        aria-atomic="true"
        className="text-xs tabular-nums text-muted"
      >
        {tableName ? <span className="sr-only">{tableName}: </span> : null}
        {first}–{last} of {total} {itemLabel}
      </p>

      {/* Dropped entirely on a single-page table — note 4 at the top of the file. */}
      {pageCount > 1 ? (
        <nav
          aria-label={tableName ? `${tableName} pagination` : "Pagination"}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => {
              // No-op guard: the button is aria-disabled, not disabled, so the
              // click and the Enter/Space keypress both still reach us.
              if (!canPrev) return;
              onPageChange(page - 1);
            }}
            aria-disabled={!canPrev}
            aria-label="Previous page"
            className={GHOST_ICON_BUTTON}
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs tabular-nums text-muted">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => {
              if (!canNext) return;
              onPageChange(page + 1);
            }}
            aria-disabled={!canNext}
            aria-label="Next page"
            className={GHOST_ICON_BUTTON}
          >
            <ChevronRight size={13} />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
