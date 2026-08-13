"use client";

// A week change is a server round-trip: every `?week=` change re-renders five
// async server pages. React keeps the OLD tree on screen until the new RSC
// payload lands, so without this the whole app looks frozen and then blinks.
// This module owns that in-flight state.
//
// There are TWO week-change entry points, not one — `components/TopBar.tsx`
// (the <select> and both chevrons) and `components/TimelineStrip.tsx` (the week
// cards on `/` and `/timeline`, which change exactly the same data). Both must
// route through `useStartWeekChange`; a bare `router.push` from either produces
// a silent swap with no spinner, no placeholder and no announcement. Review
// bounce 1 exists because the second one was missed.
//
// Why a provider and not `loading.tsx` or `useLinkStatus`: a `?week=` change is
// a soft navigation inside the SAME route segment, so the segment never
// remounts and its Suspense fallback never re-fires; and `useLinkStatus` only
// reads status inside a `<Link>` descendant, while this navigation is a
// `router.push` from a <select> and two <button>s. An explicit `useTransition`
// around the push is what is left.
//
// PendingSwap takes its children as a PROP, not as JSX rendered inside a client
// component's body. That is load-bearing: a server-rendered <ClashCard/> passed
// through `children` stays server-rendered, so pages remain server components.
//
// The provider ALSO renders the one live region for the whole app (see
// WeekAnnouncer below). It lives here rather than in TopBar because this
// component mounts in app/layout.tsx and never unmounts: `/` and `/hydra` are
// different page components under different segment keys, so a region owned by
// TopBar is torn down and re-inserted — already populated — on every sidebar
// navigation, and some AT/browser pairs announce a newly inserted populated
// live region. That would end every sidebar click with a spurious
// "Week N loaded".

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

// Next's own guidance is to delay the pending hint so a fast navigation never
// flashes it (node_modules/next/dist/docs/01-app/01-getting-started/
// 04-linking-and-navigating.md:261). A warm local week change is often under
// 100 ms; showing a skeleton for 40 ms of it would strobe.
const DEBOUNCE_MS = 120;

type WeekTransitionValue = {
  /** Debounced: true only once a week change has been in flight for DEBOUNCE_MS. */
  pending: boolean;
  /**
   * The week the in-flight change is heading to, or `null` when nothing is in
   * flight. Undebounced on purpose — the visible week label must move on the
   * click, not 120 ms later — and it lives here rather than in TopBar because
   * TimelineStrip can start a change TopBar never saw. Clearing it on commit is
   * what keeps a browser Back (which moves `currentWeek` with no transition)
   * from leaving a stale week in the selector.
   */
  targetWeek: number | null;
  startWeekChange: (week: number, fn: () => void) => void;
};

// Default value keeps every consumer safe outside a provider: nothing ever
// reports pending, and the navigation still happens (just without the hint).
const WeekTransitionContext = createContext<WeekTransitionValue>({
  pending: false,
  targetWeek: null,
  startWeekChange: (_week, fn) => fn(),
});

export function WeekTransitionProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition();
  // `elapsed` = the debounce timer for the CURRENT change has fired. It is
  // reset in the event handler rather than in an effect, which keeps the effect
  // free of a synchronous setState (react-hooks/set-state-in-effect).
  const [elapsed, setElapsed] = useState(false);
  const [requested, setRequested] = useState<number | null>(null);

  const startWeekChange = useCallback(
    (week: number, fn: () => void) => {
      // Re-arm the debounce only when nothing is already in flight. Stepping
      // two weeks ahead mid-transition must not blink the placeholders off.
      if (!isPending) setElapsed(false);
      setRequested(week);
      startTransition(fn);
    },
    [isPending, startTransition],
  );

  useEffect(() => {
    if (!isPending) return;
    const timer = setTimeout(() => setElapsed(true), DEBOUNCE_MS);
    // Covers both unmount and the transition ending before the timer fires.
    return () => clearTimeout(timer);
  }, [isPending]);

  // `isPending &&` is what makes the OFF edge immediate: the moment the new
  // tree commits the hint is gone, whatever the timer left behind.
  const pending = isPending && elapsed;
  // Derived, not cleared in an effect — `react-hooks/set-state-in-effect`.
  const targetWeek = isPending ? requested : null;

  const value = useMemo<WeekTransitionValue>(
    () => ({ pending, targetWeek, startWeekChange }),
    [pending, targetWeek, startWeekChange],
  );

  return (
    <WeekTransitionContext.Provider value={value}>
      {children}
      <WeekAnnouncer isPending={isPending} pending={pending} requested={requested} />
    </WeekTransitionContext.Provider>
  );
}

/**
 * The app's single week-change live region. Rendered by the provider (which
 * never unmounts) rather than by a page-level control — see the note at the top
 * of this file.
 *
 * The placeholders are invisible to a screen reader beyond `aria-busy`, and
 * Next's route announcer says nothing useful for a query-only change that leaves
 * the document title alone, so both halves are announced here. On `/timeline`,
 * which ships no placeholders at all, this region and the spinner in the week
 * control are the only things there are to perceive. (`/members` used to be the
 * other such page; it now has no week control at all — its roster is all-weeks —
 * so no week change can start there and this region stays empty and silent.)
 *
 * Every state is DERIVED — no timer, no `setState` in an effect, which
 * `react-hooks/set-state-in-effect` forbids in this repo. A live region
 * announces whenever its text CHANGES, so:
 *   * at rest before any week change ever happened → empty, and silent;
 *   * in flight but under the debounce → empty, so a change that lands in <120 ms
 *     clears the old text (silently — an empty region announces nothing) and then
 *     announces the RESULT only, instead of crowding two utterances into 80 ms;
 *   * in flight past the debounce → "Loading week N…", once;
 *   * committed → "Week N loaded", once per landed week.
 * `requested` (the week the user asked for), not the page's `currentWeek`, is
 * the source: the provider cannot see a page prop, and `requested` survives the
 * commit, which is exactly what makes the completion half addressable here.
 *
 * KNOWN GAP, accepted: a browser Back moves the week with no transition, so
 * `requested` never changes and Back announces nothing. Recovering it needs an
 * effect that writes state on a `currentWeek` change — the lint rule above — and
 * Back is a path that has no pending state of any kind already.
 */
function WeekAnnouncer({
  isPending,
  pending,
  requested,
}: {
  isPending: boolean;
  pending: boolean;
  requested: number | null;
}) {
  const message = pending
    ? `Loading week ${requested}…`
    : isPending || requested === null
      ? ""
      : `Week ${requested} loaded`;

  return (
    <span role="status" aria-live="polite" className="sr-only">
      {message}
    </span>
  );
}

/** The debounced in-flight flag. `false` when rendered outside a provider. */
export function useWeekPending(): boolean {
  return useContext(WeekTransitionContext).pending;
}

/** The week a change is heading to; `null` when nothing is in flight. */
export function useWeekTarget(): number | null {
  return useContext(WeekTransitionContext).targetWeek;
}

/**
 * Runs `fn` (a `router.push`) inside the shared week-change transition, telling
 * the provider which week is being requested. **Every** `?week=` push in the app
 * goes through this — see the two entry points named at the top of this file.
 */
export function useStartWeekChange(): (week: number, fn: () => void) => void {
  return useContext(WeekTransitionContext).startWeekChange;
}

/**
 * Swaps a region for its skeleton while a week change is in flight.
 *
 * Only wrap regions whose data actually depends on the selected week — see
 * docs/reference/design-system.md, "Week-change pending swap".
 */
export function PendingSwap({
  skeleton,
  children,
  className = "",
}: {
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const pending = useWeekPending();
  return (
    <div aria-busy={pending} className={className}>
      {pending ? skeleton : children}
    </div>
  );
}
