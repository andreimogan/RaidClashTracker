"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from "lucide-react";
import { ExportButton, type ExportData } from "./ExportButton";
import { PageTitle } from "./PageTitle";
import { useStartWeekChange, useWeekPending, useWeekTarget } from "./WeekTransition";

export type { ExportData };

/**
 * The bar every page header uses. The week picker is OPTIONAL: a page that has
 * nothing week-scoped to change (`/members`, whose roster aggregates every week)
 * passes no `weekNumbers`/`currentWeek` and gets a title + export button only.
 *
 * Why a split and not an early `return` inside one component: the picker's three
 * `useStartWeekChange`/`useWeekPending`/`useWeekTarget` calls sit above any such
 * return, so guarding them that way is a conditional hook
 * (`react-hooks/rules-of-hooks`). The split also has the better property — on a
 * page with no week control those hooks are not in the tree at all, rather than
 * subscribing to a transition that can never move anything here. Same shape as
 * `DataManagement`/`DataTools` and `ImportPanel`/`ImportForm`.
 */
export function TopBar({
  title,
  weekNumbers,
  currentWeek,
  exportData,
  weekRanges,
}: {
  title: string;
  weekNumbers?: number[];
  currentWeek?: number;
  exportData?: ExportData;
  weekRanges?: Record<number, string>;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <PageTitle>{title}</PageTitle>

      <div className="flex items-center gap-2">
        {weekNumbers?.length && currentWeek != null ? (
          <WeekPicker weekNumbers={weekNumbers} currentWeek={currentWeek} weekRanges={weekRanges} />
        ) : null}

        {/* No live region here. The week announcement is owned by
            WeekTransitionProvider (components/WeekTransition.tsx), because this
            bar is re-created under a new segment key on every sidebar
            navigation: a region that unmounts and is re-inserted already holding
            "Week N loaded" can be re-announced by some AT/browser pairs, which
            would tack a spurious completion onto every page change. The provider
            mounts once in app/layout.tsx and never unmounts. */}

        {/* Unconditional, and independent of the picker: ExportButton reads only
            `exportData`, so a page with no week control still exports its CSV. */}
        <ExportButton data={exportData} />
      </div>
    </div>
  );
}

function WeekPicker({
  weekNumbers,
  currentWeek,
  weekRanges,
}: {
  weekNumbers: number[];
  currentWeek: number;
  weekRanges?: Record<number, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // This control is ONE of the app's two week-change entry points — the week
  // cards in components/TimelineStrip.tsx are the other — so all three paths
  // here (select + both chevrons) go through the shared transition, and the
  // in-flight week is read back from it rather than tracked locally: a change
  // TimelineStrip started must move this selector too.
  const startWeekChange = useStartWeekChange();
  const pending = useWeekPending();
  const targetWeek = useWeekTarget();

  const go = (week: number) => {
    const next = new URLSearchParams(params);
    next.set("week", String(week));
    startWeekChange(week, () => router.push(`${pathname}?${next.toString()}`));
  };

  // `currentWeek` is the SERVER's week and stays stale for the whole round-trip,
  // so everything the user steers by reads the in-flight target first: the label
  // updates on the click instead of at the end, and a second chevron press
  // genuinely advances instead of re-requesting the same week.
  const shownWeek = targetWeek ?? currentWeek;
  const idx = weekNumbers.indexOf(shownWeek);
  const canPrev = idx > 0;
  const canNext = idx >= 0 && idx < weekNumbers.length - 1;

  return (
    <>
      {/* Feedback goes where the action is: the calendar glyph becomes the
          spinner. The controls stay ENABLED — the hide-don't-disable rule is
          about permissions, not about a transient in-flight state — and both
          controls genuinely work mid-flight: the <select> carries an absolute
          week, and the chevrons step off `shownWeek`, so a second press
          advances rather than re-requesting the week already in flight. */}
      <div
        aria-busy={pending}
        className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2"
      >
        {pending ? (
          <Loader2 size={15} className="animate-spin text-gold" />
        ) : (
          <Calendar size={15} className="text-muted" />
        )}
        <select
          value={shownWeek}
          onChange={(e) => go(Number(e.target.value))}
          aria-label="Select week"
          className="cursor-pointer bg-transparent text-sm font-medium outline-none"
        >
          {weekNumbers.map((w) => (
            <option key={w} value={w} className="bg-panel text-text">
              Week {w}{weekRanges?.[w] ? ` (${weekRanges[w]})` : ""}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => canPrev && go(weekNumbers[idx - 1])}
        disabled={!canPrev}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-panel text-muted enabled:hover:text-text disabled:opacity-40"
        aria-label="Previous week"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={() => canNext && go(weekNumbers[idx + 1])}
        disabled={!canNext}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-panel text-muted enabled:hover:text-text disabled:opacity-40"
        aria-label="Next week"
      >
        <ChevronRight size={18} />
      </button>
    </>
  );
}
