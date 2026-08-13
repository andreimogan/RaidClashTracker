# Task ledger: week-change-pending-state

order: "i approve the plan Week-change pending state — skeleton screens for the data that is actually loading / Implement it"

status: done   # planning | approved | in-progress | integrating | review | done | blocked
               # `integrating` skipped: exactly one implementer ran, so there are no
               # cross-slice seams to merge (recipe step 5). Advanced by the main session.
               # Closed 2026-08-13 after two review bounces: correctness PASS, doc-sync PASS.
created: 2026-08-13T18:30:00Z

<!-- SOLO ORDER — one ownership group, ledger written by the main session (recipe step 2, solo path).

     PROVENANCE NOTE, recorded because it matters to whoever reads this next:
     the plan was presented and approved in a PRIOR session, and this session
     does not carry its text (the prior session's scratchpad
     .../87f39c60-…/ is empty, and no draft ledger was ever written — the gate
     runs in plan mode, which blocks writes). The plan below is RECONSTRUCTED
     from the approved title plus a fresh survey of the code. Every design
     decision in it is derived from what the title says and what the codebase
     forces; none of it is recalled. If the owner's approved plan differed,
     this ledger — not their memory — is the thing that is wrong. -->

## Context pack

**Stack:** Next.js 16.2.9 (App Router, Turbopack) · React 19 · Tailwind v4 (`@theme` in `app/globals.css`) · lucide-react icons.

**The problem, stated precisely.** Every week change is a **server round-trip**. `components/TopBar.tsx:27-31` builds a new `?week=` and calls `router.push`. All five data pages are `async` server components that `await searchParams` then `await loadDataset()` (`.claude/rules/rendering.md` — that `await` is the *only* reason they are dynamic). React holds the **old tree fully rendered** until the new RSC payload lands, so the visible result of clicking "Next week" is: nothing happens, then everything changes at once. There is no pending affordance anywhere in the app for this path — the repo's only `useTransition` is in `app/error.tsx:49`, for the retry button.

**Why `loading.tsx` is not the answer** (and why no `app/**/loading.tsx` exists): a `?week=` change is a *soft navigation within the same route segment*. The segment does not remount, so its Suspense fallback does not re-fire. `useLinkStatus` (documented at `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md:233-261`) is also unavailable here — it only reads status inside a `<Link>` descendant, and this navigation is a `router.push` from a `<select>` and two `<button>`s. That leaves an explicit `useTransition` around the push, which is the approach below.

**The discrimination this order is actually about.** "Skeletons for the data that is *actually* loading" means most of the screen must **not** flash. Classified against `lib/compute.ts` call sites — the ones that take `selectedWeek` change, the ones that don't, don't:

| Surface | Source call | Week-dependent? | Treatment |
|---|---|---|---|
| `ClashCard` (`/`, `/hydra`, `/chimera`) | `getOverview(ds, selectedWeek, ct)` | **yes** | skeleton |
| `ClashTable` (`/hydra`, `/chimera`) | `getPerformance(ds, selectedWeek, ct)` | **yes** | skeleton (rows only) |
| `PerformanceTable` Hydra/Chimera tabs (`/`) | `getPerformance(ds, selectedWeek, …)` | **yes** | skeleton (rows only) |
| `PerformanceTable` "Total (All Weeks)" tab | `getAllWeeksTotals(ds)` | **no** | **must not skeleton** |
| `DonutSummary` (`/`) | `getKeyUsageSummary(ds, selectedWeek)` | **yes** | skeleton |
| `TimelineStrip`, `WeeklyBarChart` | `getTimeline(ds)` + `currentWeek` **highlight only** | **no** | no skeleton |
| `/timeline` page (all of it) | `getTimeline(ds)`; week drives only the strip/chart highlight | **no** | **no skeleton at all** |
| `/members` page roster | aggregates over all `ds.results`; `selectedWeek` reaches only `TopBar` | **no** | **no skeleton at all** |

Two pages therefore ship **zero** skeletons. That is the point of the order, not an omission — if `/timeline` or `/members` grows a skeleton, the change is wrong.

**Files in play**
- `components/TopBar.tsx` — ~~the *only* week-change entry point in the app~~ **WRONG — see the review bounce below.** One of **two** week-change entry points (select + prev/next). Client. Where the transition starts. `components/TimelineStrip.tsx:61-65` is the other, and this pack's error propagated into the shipped code as a false comment.
- `app/layout.tsx` — where the provider mounts. Wraps `{children}` only; **must not read the session** (`.claude/rules/rendering.md`: a session read here would opt `/import` out of `○` static).
- `app/page.tsx` — `/` overview; ClashCard ×2, PerformanceTable, TimelineStrip, DonutSummary.
- `components/ClashDetailView.tsx` — the shared body of `/hydra` and `/chimera` (async server component); ClashCard, WeeklyBarChart, ClashTable.
- `components/PerformanceTable.tsx` — client, **holds its own tab state** (`scope`, `:71`). Only it knows whether the visible tab is week-scoped, so its skeleton decision lives inside it, not in a wrapper.
- `components/ClashTable.tsx` — client-or-server table on the clash pages; rows are week-scoped.
- `components/ClashCard.tsx`, `components/DonutSummary.tsx` — shapes the skeletons must mirror.
- `app/globals.css` — the `@layer components` primitives block (`.card`, `.inset`, `.pill`, …). The shimmer primitive goes here.
- `app/error.tsx:49,88-92` — the repo's existing pending idiom (`isPending` + `disabled` + `aria-busy` + `Loader2`). Follow it.

**Seams** (single owner — t1 — so these are internal contracts, not cross-task handoffs)
- `components/WeekTransition.tsx` *(new)* — exports the provider, the `startWeekChange` trigger and the `useWeekPending()` reader. Every other edit in this order consumes one of those three.
- `components/Skeleton.tsx` *(new)* — the shapes. Must mirror the real components' row counts and column widths, or the swap jumps the layout.

**Constraints**
- **Tokens/primitives only** (`.claude/rules/ui.md`) — no hex, no arbitrary greys. The shimmer is built from `--color-panel-2` / `--color-border` and lives in `globals.css` as a named primitive, exactly like `.inset`.
- **Pages stay server components; client components stay leaf-level** (`.claude/rules/ui.md`). The provider is the one exception and is a pure `children` passthrough, so server children still render on the server.
- **Do not change what makes a route dynamic.** No page may stop `await`ing `searchParams`; nothing new may be read in `app/layout.tsx`. The build route table must still show `ƒ` on `/`, `/hydra`, `/chimera`, `/timeline`, `/members` and `○` on `/import` (`.claude/rules/rendering.md`).
- **Accessibility** (`.claude/rules/ux.md`): swapped regions carry `aria-busy`; the week control keeps its `aria-label`s and stays keyboard-operable; skeleton motion respects `prefers-reduced-motion`. `text-faint` is decorative-only and fails AA — do not use it for any skeleton *label*.
- **Debounce the hint.** Next's own guidance (`04-linking-and-navigating.md:261`) is to delay the pending indicator so a fast navigation never flashes. A warm local week change is often <100 ms; an unthrottled swap would strobe. Delay ~120 ms before showing.
- No data-layer, auth, schema, or API change. `requireAdmin()` and the demo-fallback triggers are untouched.

**Prior decisions** (from `docs/build-log.md`, where they bind this order)
- **`lib/compute.ts:162` does `deltaPct(…) ?? 0`, defeating `TrendBadge`'s null contract** — a known open bug shown in the very tables this order touches. **Out of scope; do not fix it here** and do not let a skeleton hide it.
- **Hide, never disable, affordances a visitor can't use** — that rule is about *permissions*. It does **not** apply to a transient in-flight state; the week control stays mounted and operable while pending.
- **Prefix scratchpad filenames per task** — one implementer runs here, but any verification script still goes to the session scratchpad as `t1-*.mjs`.

**Non-goals**
- `loading.tsx` / new Suspense boundaries (they do not fire on a same-segment `?week=` change — see above).
- Optimistic rendering of the *next* week's numbers, route prefetching, or caching `loadDataset()`.
- Any skeleton on `/timeline` or `/members`; any skeleton for `TimelineStrip` / `WeeklyBarChart`.
- Pending states for non-week navigations (sidebar links) or for mutations — the POST paths already have their own spinners.
- Fixing the two open bugs recorded in `docs/project-map.md`.

## Cost forecast

**Estimate: 4.5M tokens** (range 3.5–7M) · ~$9–16 at Opus rates
- Build — one `ui-design-specialist` over ~9 files, 2 of them new — 2.2M
- Review — `flow-reviewer` (correctness + doc-sync) ∥ `ux-specialist` (state coverage, a11y) — 1.3M
- Bounce allowance (1 review bounce) — 0.6M
- Everything else (report, build-log, ledger) — 0.4M

Basis: 8 prior `Cost:` lines in `docs/build-log.md`. The recorded bias is that **the estimate has been under the actual in 8 of 8 orders**, so this figure is deliberately set above what the file count alone suggests; note also that this session is ~1M in already, and per-dispatch cost tracks accumulated session size.
Window at plan time: 5h 24% used, resets 04:40 — reading is stale (44h old); `/usage` is the authority. Fits comfortably.

## Plan cost

**Measured: 963.1k tokens so far** (main 963.1k + planner 0 — solo order, not dispatched) · 6% of the forecast above

## Tasks

- id: t1
  summary: Add a debounced week-change pending state and skeletons for the week-scoped regions only
  owns:
    - components/WeekTransition.tsx
    - components/Skeleton.tsx
    - components/TopBar.tsx
    - components/PerformanceTable.tsx
    - components/ClashTable.tsx
    - components/ClashDetailView.tsx
    - app/layout.tsx
    - app/page.tsx
    - app/globals.css
    - docs/reference/design-system.md
  depends_on: []
  done_when: >
    (1) `npm run build` succeeds and its route table still shows `ƒ` for `/`, `/hydra`, `/chimera`,
    `/timeline`, `/members` and `○` for `/import` — paste the table.
    (2) `npm run lint` shows no NEW errors beyond the approved baseline of 9 errors + 1 warning —
    print both the baseline run and the after run.
    (3) `grep -n "skeleton\|Skeleton" app/timeline/page.tsx app/members/page.tsx components/TimelineStrip.tsx components/WeeklyBarChart.tsx`
    returns **zero** matches (these four surfaces are week-independent; a match means the
    discrimination was lost). Print the command and its exit status, not just "none found" —
    a check that cannot fail is not a check.
    (4) `grep -rniE "#[0-9a-f]{3,8}" components/Skeleton.tsx components/WeekTransition.tsx` returns
    zero — no hardcoded colors; the shimmer resolves through `app/globals.css` tokens.
    (5) The new `.skeleton` primitive is defined inside the `@layer components` block of
    `app/globals.css` and carries a `prefers-reduced-motion: reduce` branch that stops the animation.
    (6) `PerformanceTable` renders skeleton rows only when `scope !== "total"` — state the guard's
    line number in the report.
    (7) `docs/reference/design-system.md` lists the new primitive under Primitives and the
    week-pending swap under Patterns.
  docs_touched:
    - docs/reference/design-system.md
  claimed_by: "ui-design-specialist (2026-08-13 run)"
  state: done
  changelist:
    - components/WeekTransition.tsx (new, "use client") — WeekTransitionProvider (useTransition),
      useStartWeekChange(), debounced useWeekPending() (120 ms on, immediate off, timer cleared on
      unmount), PendingSwap ({skeleton, children} on an aria-busy wrapper; children-as-prop keeps
      server children server-rendered). Context default makes useWeekPending() false and navigation
      still work outside a provider.
    - components/Skeleton.tsx (new) — ClashCardSkeleton, DonutSummarySkeleton,
      ClashTableRowsSkeleton, PerformanceRowsSkeleton, SkeletonLine. Geometry mirrors the originals
      via h-[1lh] (one line box of the replaced text size) and Avatar's inline 32px; week-independent
      chrome (clash name/icon, "Average Keys Used") stays real. No hex, no color literals.
    - app/globals.css — `.skeleton` primitive added inside @layer components (bg-panel-2 +
      --color-border sweep, nested @media (prefers-reduced-motion: reduce) → flat tint, no
      animation) + top-level @keyframes skeleton-sweep. Verified in the compiled CSS.
    - app/layout.tsx — WeekTransitionProvider wraps the existing shell only. No session/cookies/
      headers/searchParams read; /import stays ○.
    - components/TopBar.tsx — all three week paths go through startWeekChange(() => router.push(…));
      Calendar → spinning Loader2 while pending, aria-busy on the week control, controls stay
      enabled, sr-only role="status" aria-live="polite" announcing "Loading week N…". Added an
      aria-label to the previously unlabelled <select>.
    - app/page.tsx — PendingSwap around both ClashCards and DonutSummary. TimelineStrip untouched
      (comment records why). Page stays a server component.
    - components/ClashDetailView.tsx — PendingSwap around ClashCard only; WeeklyBarChart untouched;
      ClashTable swaps its own rows.
    - components/ClashTable.tsx — useWeekPending(); tbody carries aria-busy and swaps rows only
      (header, search, sort stay live). Row count = outgoing week's filtered count (fallback 8, cap 30).
    - components/PerformanceTable.tsx — guard `const showSkeleton = pending && scope !== "total"`
      at line 87; swaps the weekly tbody rows and the `Weekly · {weekLabel}` subtitle only. Tabs,
      search and header stay interactive; the Total (All Weeks) tab never skeletons.
    - docs/reference/design-system.md — `.skeleton` added to Primitives (count 11 → 12) and a
      "Week-change pending swap" entry added to Patterns, including the week-scoped-data-only rule.
  verification:
    - npm run build — ✓ compiled; route table ƒ / /hydra /chimera /timeline /members, ○ /import.
    - npm run lint — 9 errors + 1 warning, identical to the approved baseline (no new findings).
    - clause (3) grep — exit 1, zero matches; positive control on the same four files returned
      22/20/17/11 matches, so the checker fires.
    - clause (4) grep — exit 1, zero matches; positive control found hex in app/globals.css.
  assumptions:
    - The order's item 6 said "wrap ClashTable in PendingSwap" while item 8 said "header stays, rows
      swap". Item 8 won: PendingSwap renders a <div>, which is invalid inside <table>, so ClashTable
      (like PerformanceTable) reads useWeekPending() directly and swaps its <tbody> rows.
    - /timeline and /members ship zero skeletons as required, but their shared TopBar still shows the
      spinner + live-region announcement — feedback at the control, not a skeleton.

## Review bounce 1 — 2026-08-13

`flow-reviewer`: **correctness NEEDS-CHANGES · doc-sync FAIL**. `ux-specialist`: **discrimination confirmed correct**, two must-fix.
Both reviews independently found the same HIGH. Full findings in the session record; the actionable set is below.

**File grants for t1 (all four were outside the original `owns` set, which is exactly why they were missed):**
`components/TimelineStrip.tsx` · `components/DonutSummary.tsx` · `components/ClashCard.tsx` (export-only) · `docs/project-map.md` · plus `.claude/rules/ux.md` (one pointer line).

**Root cause of the HIGH is this ledger, not the implementer.** The Context pack asserted TopBar was the only
week-change entry point. It is not. The implementer inherited the claim, restated it as a code comment in two
files, and the reviewers caught it. Corrected in the Files-in-play list above.

- id: t1-fix
  summary: Close the two must-fix defects and the agreed cleanups from review bounce 1
  owns:                 # t1's original ten, plus the five grants above
    - components/TimelineStrip.tsx
    - components/DonutSummary.tsx
    - components/ClashCard.tsx
    - docs/project-map.md
    - .claude/rules/ux.md
    - components/WeekTransition.tsx
    - components/Skeleton.tsx
    - components/TopBar.tsx
    - components/PerformanceTable.tsx
    - components/ClashTable.tsx
    - components/ClashDetailView.tsx
    - app/page.tsx
    - app/globals.css
    - docs/reference/design-system.md
  depends_on: [t1]
  done_when: >
    (1) Every `?week=` push in the repo runs inside `startWeekChange` — verified by
    `grep -rn 'set("week"' components/` returning exactly two sites, both within a transition, with the
    grep output pasted.
    (2) No file asserts TopBar is the only week-change entry point — `grep -rniE "only .{0,20}week-change|ONLY week"`
    over components/ and docs/ returns zero, run with a positive control.
    (3) The reduced-motion skeleton is visibly distinguishable from the card surface — state the measured
    contrast ratio against `#0e1524` and `#0b1120`, built from tokens only (no hex in the new files).
    (4) `DonutSummary` and its skeleton fill the grid row on `xl` — state the classes on the wrapper and on
    both sections.
    (5) `THEME` is exported from `components/ClashCard.tsx` and imported by `Skeleton.tsx`; the local
    duplicate is gone.
    (6) `docs/project-map.md`'s component count matches `ls components/*.tsx | wc -l` — paste both.
    (7) Build route table unchanged (`ƒ` on the five data pages, `○` on `/import`); lint still 9 errors + 1 warning.
  docs_touched:
    - docs/reference/design-system.md
    - docs/project-map.md
    - .claude/rules/ux.md
  claimed_by: "ui-design-specialist (2026-08-13 bounce-1 run)"
  state: done
  changelist:
    - components/TimelineStrip.tsx — HIGH #1. `go()` now calls
      `startWeekChange(week, () => router.push(…))`. Still ships zero placeholders (clause 3
      re-verified), and the comment records both why it routes through the transition and why its
      own contents never swap.
    - components/WeekTransition.tsx — header comment corrected (TWO entry points, named).
      `startWeekChange(week, fn)` gained the requested week; new `useWeekTarget()` exposes it,
      undebounced, and DERIVED as `isPending ? requested : null` (no setState in an effect — the
      repo lints `react-hooks/set-state-in-effect`). Clearing on commit is what stops a browser
      Back from stranding a stale label. Debounce logic untouched.
    - components/TopBar.tsx — false "ONLY entry point" comment fixed. Optimistic label: the
      `<select>` and both chevrons read `shownWeek = targetWeek ?? currentWeek`, so the label moves
      on the click and repeat chevron presses genuinely advance (option B of item 10 — the
      "stepping two weeks ahead" justification is now TRUE rather than reworded). Local
      `useState` targetWeek removed. The live region now announces completion too:
      `pending ? "Loading week N…" : "Week N loaded"`, the second half derived from `currentWeek`.
    - components/Skeleton.tsx — imports the real `THEME` from ClashCard (local `CLASH` map gone);
      `min-h-[0.75rem]` floor beside `h-[1lh]`; `aria-hidden` on every placeholder `<tr>`; donut is
      a ring (`skeleton skeleton-ring`); ClashCard's progress row is one full-width bar instead of a
      fake 1/3 fill; `skeletonRowCount()` exported so both tables share one rule.
    - app/globals.css — `.skeleton` rebuilt on `--color-border` (base) + `color-mix(border 70%,
      muted)` (peak); reduced-motion holds the PEAK flat instead of dropping to `panel-2`. New
      `.skeleton-ring` shape modifier (mask, 62%→92%, degrades to the old disc).
    - components/DonutSummary.tsx + app/page.tsx + Skeleton — grid stretch: `xl:h-full` on the
      `PendingSwap` and on both sections. All four PendingSwap sites now carry it.
    - components/ClashCard.tsx — `THEME` exported (export-only change; the component is untouched).
    - components/ClashTable.tsx + components/PerformanceTable.tsx — `!isTotal` instead of
      `scope !== "total"`; both hoist `skeletonRowCount(rows.length)`; both keep the "No players
      match" row when a search is active and already matches nobody (empty WEEK still swaps).
    - docs/reference/design-system.md — Primitives 12 → 13 (`.skeleton-ring`), `.skeleton` entry
      carries the measured ratios, the pattern entry corrected to two entry points + the greppable
      invariant, the PendingSwap grid-stretch trap, the announcement design, and the empty-search
      carve-out.
    - docs/project-map.md — 21 → 23 components (measured), plus the two-entry-point note.
    - .claude/rules/ux.md — the "Loading / pending" bullet now encodes the week-scoped-data-only
      rule and points at the design-system entry.
  verification:
    - npm run build — ✓ compiled 3.3s; route table unchanged: ƒ on / /hydra /chimera /timeline
      /members, ○ on /import and /_not-found.
    - npm run lint — 10 problems (9 errors, 1 warning), identical to baseline; every finding is in
      components/ImportPanel.tsx (pre-existing).
    - (1) `grep -rn 'set("week"' components/` → exit 0, exactly TWO sites (TimelineStrip.tsx:71,
      TopBar.tsx:38); `-A2` shows `startWeekChange(week, () => router.push(…))` on the next line of
      each.
    - (2) `grep -rniE "only .{0,20}week-change|ONLY week" components/ docs/ --exclude-dir=tasks` →
      exit 1, zero. Without the exclusion there is exactly one match: this ledger's own criterion
      quoting its regex. Positive control (regex loosened to `only .{0,20}week`) → exit 0, matches
      in Skeleton.tsx, WeekTransition.tsx, build-log.md, project-map.md.
    - (3) contrast — reduced-motion fill measured **2.039:1 vs #0e1524 (.card) and 2.105:1 vs
      #0b1120 (.inset)**, up from 1.045:1 / 1.079:1. Animated base raised too: 1.253:1 / 1.293:1.
      Token-derived (`color-mix(in srgb, var(--color-border) 70%, var(--color-muted))` → #3c4a62,
      which Lightning CSS emits as the no-color-mix fallback); hex grep on the new files → exit 1.
    - (4) `xl:h-full` on the PendingSwap (app/page.tsx:130) and on `section className="card
      xl:h-full"` in both DonutSummary.tsx:19 and Skeleton.tsx:104.
    - (5) `export const THEME` at ClashCard.tsx:11, `import { THEME } from "./ClashCard"` at
      Skeleton.tsx:24; `grep -n "const CLASH" components/Skeleton.tsx` → exit 1.
    - (6) `ls components/*.tsx | wc -l` → 23; project-map.md:21 now says 23.
    - t1 clause (3) re-run — exit 1, zero matches across the four week-independent files; positive
      control (pattern "week") → 14/16/14/5 matches, so the checker still fires.
    - Compiled CSS re-checked: the reduced-motion branch emits
      `background-color:var(--skeleton-peak);background-image:none;animation:none`, and
      `.skeleton-ring` is auto-prefixed with `-webkit-mask-image`.
  assumptions:
    - Item 10: chose to STEP THE CHEVRONS off the in-flight target rather than only reword the
      comment, which required lifting `targetWeek` from TopBar into the WeekTransition context.
      That was the cheapest way to also make item 8 correct for a TimelineStrip-started change —
      TopBar cannot observe one, so a TopBar-local `targetWeek` would have gone stale the moment the
      strip became a real entry point.
    - Item 6: implemented WITHOUT a timer or a pending→false effect. `react-hooks/set-state-in-effect`
      is an active error in this repo's lint, and a live region announces on CHANGE, so deriving the
      text from the committed `currentWeek` fires exactly once per landed week. Cost: the region
      holds `Week N loaded` as resting sr-only text instead of clearing. Benefit beyond the ask: a
      sub-debounce change and a browser Back both announce correctly, where an edge-triggered version
      would announce nothing.
    - The `.skeleton-ring` mask uses `black`/`transparent` stops. Those are mask ALPHA, not theme
      colors, so they are not a token violation; no hex appears in the new component files.
    - Peak contrast deliberately capped below `text-faint` (3.05:1): a placeholder brighter than the
      dimmest real text on the surface starts reading as content rather than as absence.

## Review bounce 2 — 2026-08-13 (final)

Re-review of the t1-fix delta: **correctness PASS · doc-sync PASS.** No CRITICAL, no HIGH. All four measured
claims in the changelist reproduced exactly (contrast to 3 decimals; the Lightning CSS `color-mix` fallback
`#3c4a62` byte-identical to the computed value). Remaining: one MEDIUM that is a design trade, five one-line LOWs.

**MED-1 decided by the main session: take the reviewer's preferred option 1** (hoist the live region into
`WeekTransitionProvider`). Rationale: a spurious "Week N loaded" on *every* sidebar navigation is a recurring
regression for AT users, while the cost — a browser Back no longer announcing — is a path that already has no
pending state at all and is recorded as such. Trading a certain, frequent defect for a known, rare gap.

**Grant added:** `app/layout.tsx` (LOW-1 — the last surviving single-starter enumeration in code).

- id: t1-fix2
  summary: Hoist the live region into the provider (MED-1) and close LOW-1 through LOW-5
  owns:
    - app/layout.tsx
    - components/WeekTransition.tsx
    - components/TopBar.tsx
    - components/ClashTable.tsx
    - components/PerformanceTable.tsx
    - components/Skeleton.tsx
    - docs/reference/design-system.md
    - .claude/rules/ux.md
  depends_on: [t1-fix]
  done_when: >
    (1) The `role="status"` region is rendered by the provider, not by `TopBar` — state the file:line of each.
    (2) `ClashTable` and `PerformanceTable` pass the SAME expression to `aria-busy` — name it.
    (3) `.claude/rules/ux.md` names both entry points literally (`TopBar.tsx`, `TimelineStrip.tsx`).
    (4) Build route table unchanged; lint still 9 errors + 1 warning.
    Criteria reference file:line seams and a named corpus — never a bare `docs/` grep (see the note below).
  docs_touched:
    - docs/reference/design-system.md
    - .claude/rules/ux.md
  claimed_by: "ui-design-specialist (2026-08-13 bounce-2 run)"
  state: done
  changelist:
    - components/WeekTransition.tsx — MED-1. New `WeekAnnouncer` sub-component renders the app's
      ONE `role="status" aria-live="polite" sr-only` region (WeekTransition.tsx:165) from inside
      `WeekTransitionProvider`, which mounts in app/layout.tsx and never unmounts. Text is derived
      from provider state (`requested`, not any page's `currentWeek`, which the provider cannot
      see): "" at rest and under the debounce · `Loading week N…` past it · `Week N loaded` on
      commit. No timer, no setState in an effect. The header comment records why the region cannot
      live in TopBar; the docblock records the accepted Back gap.
    - components/TopBar.tsx — the live region is GONE from here (grep for `role="status"|aria-live`
      over TopBar.tsx → exit 1). A comment in its place records the ownership and the segment-key
      remount reason, so it does not get re-added. Spinner, `aria-busy`, `shownWeek` unchanged.
    - app/layout.tsx — LOW-1. The provider comment no longer enumerates one starter: it names
      TopBar.tsx AND TimelineStrip.tsx, and records that the provider itself now renders the live
      region. Still a pure children passthrough reading no request-time API.
    - components/PerformanceTable.tsx — LOW-3. `<tbody aria-busy={pending}>` (was `showSkeleton`),
      matching ClashTable.tsx:107 exactly; comment states why the narrower expression was wrong.
      No other line moved, so the doc's `:79` / `:128` references still resolve.
    - components/Skeleton.tsx — LOW-4, code made to match the rule. `StatSkeleton` now takes
      `label` / `caption` strings and renders them as REAL text in ClashCard's own `Stat` classes;
      the four captions ("Key Usage", "Total Damage", "Avg Damage / Key", "Members Participated"),
      the "Average" sub-caption and the "Progress" label are all real, only the values stay barred.
      File header comment updated to list them.
    - docs/reference/design-system.md — LOW-2 (`scope !== "total"` → the real `isTotal`, with
      `PerformanceTable.tsx:79` / `:128` as the seam), plus doc-sync for MED-1 (a new paragraph on
      why the region belongs to the provider, what its four text states are, and the accepted Back
      gap), LOW-3 (tables pass `pending`, not `showSkeleton`) and LOW-4 (the real-chrome list now
      names the stat captions and "Progress"; the "never hand-copy chrome" sentence corrected to
      say THEME is imported while the caption strings are copied, with the hoist trigger).
    - .claude/rules/ux.md — LOW-5. The Loading/pending bullet now names `components/TopBar.tsx` and
      `components/TimelineStrip.tsx` literally, gives `grep -rn 'set("week"' components/` as the
      invariant, and states that the live region is owned by the provider rather than the bar.
  verification:
    - npm run build — ✓ compiled 3.5s; route table UNCHANGED: `ƒ` on / /hydra /chimera /timeline
      /members /login /settings /members/[memberId] and the six api routes, `○` on /import and
      /_not-found.
    - npm run lint — 10 problems (9 errors, 1 warning), the approved baseline; a filter of the
      output for any `.tsx` path other than ImportPanel.tsx returns nothing, so every finding is
      still pre-existing.
    - (1) `grep -rn 'role="status"' components/` → exit 0, exactly ONE site:
      components/WeekTransition.tsx:165 (inside WeekAnnouncer, rendered by the provider).
      `grep -n 'role="status"\|aria-live' components/TopBar.tsx` → exit 1, absent. Positive control
      on the same corpus (`role=`) → exit 0, three files, so the checker fires.
    - (2) `grep -n aria-busy components/ClashTable.tsx components/PerformanceTable.tsx` →
      ClashTable.tsx:107 and PerformanceTable.tsx:204, both `<tbody aria-busy={pending}>`. The
      shared expression is **`pending`** (the debounced `useWeekPending()` flag).
    - (3) `grep -n 'TopBar.tsx\|TimelineStrip.tsx' .claude/rules/ux.md` → exit 0, the Loading/
      pending bullet. Its own invariant run for real: `grep -rn 'set("week"' components/` → exit 0,
      exactly TimelineStrip.tsx:71 and TopBar.tsx:38.
    - Doc line refs re-resolved: `sed -n '79p;128p' components/PerformanceTable.tsx` prints
      `const isTotal = scope === "total";` and `const showSkeleton = pending && !isTotal && !emptySearch;`.
    - t1 clause (3) regression — the four week-independent surfaces still match zero on
      `skeleton|Skeleton` (exit 1); positive control (`week`) → 14/16/14/5 matches.
    - No hex in any file touched this pass (WeekTransition, Skeleton, TopBar, ClashTable,
      PerformanceTable, app/layout.tsx) → exit 1.
  assumptions:
    - MED-1 was built with the DEBOUNCED flag gating the loading half, not raw `isPending` as the
      brief's expression had it: `pending ? "Loading week N…" : isPending || requested === null ? ""
      : "Week N loaded"`. Reason — the brief asked me to check the sub-debounce read, and the
      literal version is a regression there: a change landing in ~60 ms would push two utterances
      into the polite queue ("Loading week 24…" then "Week 24 loaded"), where the shipped t1-fix
      behaviour announced the result only. Gating on `pending` keeps that: the region goes empty
      first (an empty live region announces nothing), then speaks the result. Same architecture,
      same state, no timer, no effect — one extra ternary arm.
    - The four stat captions and "Progress" are hand-copied strings in Skeleton.tsx, because
      ClashCard declares them inline in its JSX and only `THEME` is exported — and ClashCard.tsx is
      NOT in this task's `owns` set, so exporting a labels const was not available. Recorded in
      both the code comment and the design-system entry with the hoist trigger (a third copy).
    - "Average" (ClashCard's caption under Key Usage) was made real alongside the five labels the
      brief named. It is the same class of week-independent literal, and leaving it barred would
      have re-created inside one component the exact inconsistency LOW-4 exists to remove.
    - "Progress" renders as `<span className="text-muted">`, dropping ClashCard's `text-s`. That is
      not a real Tailwind size, so it emits nothing and both render at the inherited base size —
      identical geometry, without propagating the typo. Same call the existing date-range bar made.

### Methodology note — `done_when` clause (2) of t1-fix was unfalsifiable

`grep -rniE "only .{0,20}week-change|ONLY week"` over `docs/` **cannot** return zero: this ledger states the
criterion and quotes its own regex. The implementer had to invent `--exclude-dir=tasks` and justify it in prose
— the "contort the check until it passes" failure the done-when memory exists to prevent. `flow-reviewer`
confirms this is **instance 5 in three orders**. The general fix, to be carried into planner guidance:
1. A criterion enumerates its corpus, and the corpus never includes `docs/tasks/`. Never a bare `docs/` or repo root.
2. Prefer a positive assertion at a named `file:line` seam over a negative assertion over a corpus.
3. Never quote the forbidden string in the criterion — put it in a checker script and reference the script path
   plus its expected exit code.
4. Keep the positive-control requirement; it is the part of this convention that already works, and it is what
   proved this clause fired rather than trivially passing.
