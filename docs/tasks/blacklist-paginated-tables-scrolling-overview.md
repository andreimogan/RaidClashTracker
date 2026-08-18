# Task ledger: blacklist-paginated-tables-scrolling-overview

order: "Black List table, paginated tables, and a scrolling overview — implement it."
status: done   # planning | approved | in-progress | integrating | review | done | blocked
created: 2026-08-17

<!-- The approved plan's specifics were not persisted by the session that produced
     them (no ledger, empty scratchpad). They were re-pinned with the owner on
     2026-08-17 before planning: (1) the Black List is DERIVED from the data, not
     an admin-curated table — no migration, no write endpoint; (2) it sits as a
     separate table BESIDE the Clan Performance table on the overview, not as a
     fourth tab and not on a new route; (3) pagination covers all four tables at
     10 rows per page. -->

## Context pack

**Stack:** Next.js 16.2.9 (App Router, Turbopack) · React 19 · Tailwind v4 (`@theme` + `@layer components` in `app/globals.css`) · lucide-react · postgres.js. No test suite — `npm run build` + `npm run lint` are the verification. Lint baseline is **9 errors + 1 warning**, all pre-existing in `components/ImportPanel.tsx` and two `.claude/scripts/*.js`; matching that baseline is "clean", not zero.

**Prior packs reused — verified fresh, do not re-survey.** `docs/tasks/week-change-pending-state.md` (TopBar / PerformanceTable / ClashTable / WeekTransition / Skeleton) and `docs/tasks/members-week-selector-removal.md` (`app/members/page.tsx`). The only commit touching those paths since they were written is `39f6ebc`, which is the commit the first of them produced. Read both `## Context pack` sections before your own files; this pack only adds what they are silent on.

> **Maintenance note, 2026-08-18 (appended, nothing above edited).** The second of those two ledgers has been **deleted** — *this* order rewrote `app/members/page.tsx` (100+ lines to 73, roster extracted to `components/RosterTable.tsx`), which made every load-bearing fact in its pack counterfactual: it states the file has no `force-dynamic` and awaits `searchParams`, and both are now false at `app/members/page.tsx:15`. Recover it with `git show 39f6ebc:docs/tasks/members-week-selector-removal.md` if the history is wanted. Its one durable lesson survives in two better places: the load-bearing comment at `app/members/page.tsx:7-14` and the worked example in `.claude/rules/rendering.md`.

**Files in play**
- `lib/compute.ts` — all derived metrics, framework-free, data-source agnostic. `getBlackList` lands here. `PerfScope` / `Dataset` are exported from here; row/view types live in `lib/types.ts`.
- `lib/types.ts` — derived/view types (`PerformanceRow`, `MemberTotalsRow`, …). The three new Black List types go here.
- `lib/constants.ts` — `MAX_KEYS {hydra:3, chimera:2}`, `maxKeysFor(scope)` (total = 5), `CLAN_CAP = 30`. The four Black List thresholds go here, named.
- `app/page.tsx` — the overview. Root div `:85`. Four sibling blocks: TopBar (`xl:shrink-0`), empty-state note, ClashCard 2-up grid, Clan Performance (`xl:flex xl:min-h-0 xl:flex-1`, full width, `:120`), TimelineStrip+DonutSummary (`xl:grid-cols-3`, 2+1 — **the layout precedent to copy for the Black List row**).
- `components/PerformanceTable.tsx` — client; holds `scope`/`query`/`sortKey`/`memberFilter`. Section `:132`; scroll wrapper `:187`; sticky thead `:189`; `isTotal` `:79`; `showSkeleton` `:128`; `<tbody aria-busy={pending}>` `:204`. Renders `TotalPerformanceTable` for the Total tab, its own `<table>` otherwise.
- `components/TotalPerformanceTable.tsx` — the Total (All Weeks) body. Own `sortKey`/`dir`, two-row `<thead>` (`colSpan` 4+4, `rowSpan` 2), `colSpan={10}` empty row, scroll wrapper `:77`, sticky thead `:79`.
- `components/ClashTable.tsx` — `/hydra` + `/chimera` Player Breakdown. Scroll wrapper `:86`, sticky thead `:88`, `<tbody aria-busy={pending}>` `:107`, `emptySearch` carve-out `:67`.
- `app/members/page.tsx` — **server component**, roster table inline `:75-118`. `export const dynamic = "force-dynamic"` at `:15` is **load-bearing** (`.claude/rules/rendering.md`). Reads no `searchParams`.
- `components/Skeleton.tsx` — `skeletonRowCount(v) = Math.min(v || 8, 30)`. **Unowned and needs no change**: fed a paginated row count (0–10) it already returns ≤10. If you believe it must change, stop and report.
- `app/layout.tsx` / `components/Sidebar.tsx` — **untouched, unowned.** Layout is `flex min-h-screen` + `main flex-1 min-w-0 overflow-x-hidden`; no vertical `overflow-hidden`, so removing `xl:h-screen xl:overflow-hidden` from `app/page.tsx` is sufficient to make the page scroll.
- `components/ClashDetailView.tsx` — **untouched, unowned.** `/hydra` + `/chimera` keep the viewport lock; only `ClashTable`'s internals change under it.

**Seams**

1. **`components/Pagination.tsx` — owned by t2.** Three exports, pinned character-for-character:
   ```ts
   export const ROWS_PER_PAGE = 10;
   export function usePagination<T>(rows: readonly T[], pageSize?: number):
     { page: number; pageCount: number; pageRows: T[]; offset: number; total: number;
       setPage: (p: number) => void };
   export function Pagination(props: {
     page: number; pageCount: number; total: number; offset: number; pageSize?: number;
     onPageChange: (p: number) => void; itemLabel?: string; className?: string;
   }): React.ReactElement | null;
   ```
   - `page` is **1-based and already clamped** into `[1, pageCount]`; `pageCount = Math.max(1, ceil(total/pageSize))` (≥1 even when empty); `offset = (page-1)*pageSize` — use `offset + i + 1` for the `#` column so ranks continue across pages.
   - **The clamp is derived on read, never an effect.** `useState` holds the *requested* page; the returned `page` is `min(max(1,requested), pageCount)`. This is the fix for the stale-index bug (a week change or a search narrowing the list) **and** it is mandatory: `react-hooks/set-state-in-effect` is an active lint **error** here.
   - Renders `null` only when `total === 0`. Prev/next are always present and `disabled` at the ends — **not a hide-don't-disable violation**: that rule is about permissions, and `components/TopBar.tsx:129-144` sets the disabled-chevron precedent.
   - Markup: `<nav aria-label="Pagination">` holding an `aria-live="polite" aria-atomic="true"` range summary (`"1–10 of 34 players"`) and prev/next `<button type="button">` with `aria-label="Previous page"` / `"Next page"` plus a `Page N of M` label. Labels `text-muted` + `tabular-nums`; **`text-faint` is forbidden here** (~3.05:1, fails AA). Buttons reuse the **"Ghost icon button (tables)"** pattern from `docs/reference/design-system.md:58` plus `disabled:opacity-40`, not TopBar's `h-9 w-9` page-header chevron.
   - **Placement rule, non-negotiable:** the control is a **sibling of the `overflow-x-auto` wrapper, inside the `.card-flush` `<section>`, after the table** — never inside `<table>`. A `<div>`/`<nav>` inside `<table>` is invalid HTML and is exactly what bounced `PendingSwap` in the week-pending order.

2. **`lib/compute.ts` + `lib/types.ts` + `lib/constants.ts` — owned by t1.** Pinned:
   ```ts
   export function getBlackList(ds: Dataset): BlackListResult   // NO week argument
   ```
   with `BlackListRow`, `BlackListRule`, `BlackListResult` exported from `lib/types.ts`:
   `BlackListResult = { rule: BlackListRule; rows: BlackListRow[]; membersJudged: number }` ·
   `BlackListRow = { member: Member; weeksConsidered: number; missedWeeks: number; missedWeekNumbers: number[]; keysUsed: number; keysPossible: number; participationPct: number }` ·
   `BlackListRule = { windowWeeks; minKeysPerWeek; maxKeysPerWeek; minMisses; minWeeksPresent; weekNumbers: number[] }`.

   **The rule (planner's default, accepted at the gate — four named constants, cheap to re-pin):** window = the last **4** weeks present in the dataset (`sortedWeeks(ds).slice(-4)`); a member is judged only if on the **current roster** (`activeMemberIds(ds)`) and present in ≥ **2** window weeks (too new to judge otherwise); a window week is **missed** when the member's combined keys that week are **< 3 of 5**; a member is **listed** at ≥ **2** missed weeks. Sort: `missedWeeks` desc, then `participationPct` asc, then name. Constants: `BLACKLIST_WINDOW_WEEKS`, `BLACKLIST_MIN_KEYS_PER_WEEK`, `BLACKLIST_MIN_MISSES`, `BLACKLIST_MIN_WEEKS_PRESENT`.

   **It takes no `selectedWeek` and is therefore an all-weeks surface**, like `getAllWeeksTotals`. The Black List must **not** skeleton on a week change and must not read `useWeekPending()`.

   **Amended in the fix round (2026-08-17), review defects H1 + H2 — two changes to the above:**
   - **`membersJudged: number` is ADDED to `BlackListResult`** (additive; `rule` and `rows` are unchanged). It is the count of members who passed *both* gates — on the roster and present for ≥ `minWeeksPresent` window weeks — i.e. those actually evaluated. **t3's empty state must branch on it**, not on `rows.length` alone: `rows.length === 0 && membersJudged > 0` is the good-news all-clear; `membersJudged === 0` means nobody could be measured (first import, post-Reset, or no fully-imported week yet) and must NOT render a green all-clear. `lib/types.ts:151-161`.
   - **The window is the last `BLACKLIST_WINDOW_WEEKS` *fully imported* weeks**, not simply the last weeks present. A week is judged only once **both** clashes have rows (`isWeekComplete`, `lib/compute.ts:350`). Hydra closes Wed→Wed and Chimera Fri→Thu and `lib/import.ts` loads one clash for one week at a time, so the routine admin workflow always leaves a half-imported week on a **publicly readable** board; judging it scored members against a 5-key denominator when only 3 keys of rows existed and manufactured misses. Owner's decision: a tracked week always runs both clashes, so an incomplete week is only ever a mid-import state and is not judged. `rule.weekNumbers` still reports exactly which weeks were judged, so the UI contract is unchanged.

**Constraints**
- **Tokens/primitives only**, no hex (`.claude/rules/ui.md`). Never `text-faint` for anything the reader needs (`.claude/rules/ux.md`).
- **Week-pending contract** (`docs/reference/design-system.md`, "Week-change pending swap"): week-scoped rows swap, all-weeks surfaces do not; chrome (headers, search, sort — **and now pagination**) stays real and interactive through a swap; `<tbody aria-busy={pending}>` uses the broad `pending`, not `showSkeleton`. **Pagination is not reset on a week change** — the clamp handles a shorter incoming week, and sort/search already persist across one.
- **`/members` stays `ƒ`.** No `?page=`, no `searchParams` read, no `useSearchParams`. Client-side `useState` only, which forces extracting the inline roster table into a `"use client"` leaf.
- **Pages stay server components; client components stay leaf-level.**
- **Five data-source states.** The Black List's empty state is *good news* — copy must read "nobody is failing participation", never like missing data. A connected-but-empty database yields `rule.weekNumbers = []` and zero rows: it must not throw and must not claim a clean roster.
- **`done_when` methodology** (memory; five failures across three orders): enumerate the corpus, **never include `docs/tasks/`**; prefer a positive assertion at a `file:line` seam over a negative grep; never quote the forbidden string in the criterion; always run a positive control and paste its output.
- **Scratchpad filenames are prefixed per task** (`t1-*`, `t2-*`, …) — parallel subagents share one directory.
- Read `node_modules/next/dist/docs/` before touching anything route/page-shaped.

**Prior decisions**
- `lib/compute.ts:162`'s `deltaPct(...) ?? 0` is a known open bug in these very tables. **Out of scope; do not fix, do not let pagination hide it.**
- **Split, don't early-return**, when a component becomes conditional (`DataManagement`/`DataTools`, `TopBar`/`WeekPicker`) — a `return` above a hook is `react-hooks/rules-of-hooks`.

**Non-goals**
- Any migration, API route, write endpoint, env var, or admin-curated blacklist. Read-only, derived, zero write surface.
- A fourth tab inside `PerformanceTable`, or a `/blacklist` route.
- Unwinding the viewport lock on `/hydra` / `/chimera` (`components/ClashDetailView.tsx`).
- Making the sidebar sticky; touching `app/layout.tsx`, `components/Sidebar.tsx`, `components/Skeleton.tsx`, `components/WeekTransition.tsx`, `components/MemberHistoryTable.tsx`.
- Search/sort on the Roster or Black List; CSV export of the Black List; fixing the two open bugs in `docs/project-map.md`.

## Cost forecast

**Estimate: 10.5M tokens** (range 8–16M) · ~$10–18 at this project's measured blended rate
- Parallel build, 4 code tasks (t1 small · t2 new component · **t3 large** · t4 medium) — 4.5M
- Doc-sync pass t5 (5 living docs, ~10 citations to re-resolve) — 0.8M
- Integrate, 2 waves of parallel slices — 0.9M
- Review — `flow-reviewer` ∥ `ux-specialist` — 1.6M
- Bounce allowance (1 review bounce) — 1.5M
- Report + build-log + ledger — 1.2M

Basis: 7 `Cost:` lines in `docs/build-log.md`. Five of seven came in over forecast (worst 1.9×); the most recent comparable single-implementer UI order landed **9% under at 4.1M** at ~$1.14/M. This order is roughly 2.5× that surface (11 files, 3 new, 4 implementers, 2 waves), so the figure is scaled from that measurement rather than from the shipped baselines.
Window at plan time: 5h 24% used, 76% left, resets 04:40 — **but the reading is 130h stale**, so treat it as unknown and check `/usage`.

## Plan cost

**Measured: 868k tokens so far** (main 734k + planner 134k) · ~8% of the forecast above

## Tasks

- id: t1
  summary: Derive the Black List in lib/compute.ts — named thresholds, exported types, no week argument
  specialist: flow-implementer
  owns:
    - lib/compute.ts
    - lib/types.ts
    - lib/constants.ts
  depends_on: []
  docs_touched: []        # t5 owns every living doc
  claimed_by: "flow-implementer (t1)"
  state: done
  fix_round:   # 2026-08-17, after review — H1 + H2 + L1. No file outside `owns` touched.
    - "H1 — incomplete weeks are no longer judged. `TRACKED_CLASHES` (`lib/compute.ts:336`,
      read off `MAX_KEYS` so completeness and the `maxKeysFor(\"total\")` denominator cannot
      disagree) + `isWeekComplete(ds, week)` (`:350`); the window is now
      `sortedWeeks(ds).filter(isWeekComplete).slice(-windowSize)` (`:378-380`)."
    - "H1 (second half) — the roster gate no longer reads `activeMemberIds(ds)`, which derives
      the roster from the newest week in the dataset. It now takes the roster from the newest
      JUDGED week, `windowWeeks.at(-1)` (`lib/compute.ts:401-403`). Identical set whenever that
      week is complete; they diverge only mid-import, where the old form silently dropped any
      clanmate whose only row in the newest week belonged to the clash that hadn't landed yet
      (the reviewer's `Tindra` case). `activeMemberIds` itself is UNCHANGED and still used by
      `getPerformance` / `getMemberProfile` / `getAllWeeksTotals`."
    - "H2 — `membersJudged` added to `BlackListResult` (`lib/types.ts:160`), returned at
      `lib/compute.ts:456` (and `0` on the empty-window early return, `:394`). The row build
      is now two steps: `judged` = both gates passed (`:417`, `:443`), `rows` = `judged`
      filtered to `missedWeeks >= BLACKLIST_MIN_MISSES` (`:445`). Sort and row shape unchanged."
    - "L1 — `const windowSize = Math.max(1, BLACKLIST_WINDOW_WEEKS)` (`lib/compute.ts:377`).
      Verified by temporarily re-pinning the constant to 0: window went to `[24]` (one week),
      not all five. Reverted."
    - "lib/constants.ts — `BLACKLIST_WINDOW_WEEKS`' comment (`:19-23`) now says the window
      counts fully-imported weeks and that the floor-at-1 guard exists."
  changelist:   # line numbers re-resolved after the fix round
    - lib/constants.ts — four named Black List thresholds appended after `maxKeysFor`:
      `BLACKLIST_WINDOW_WEEKS` 4 (`:24`), `BLACKLIST_MIN_KEYS_PER_WEEK` 3 (`:28`),
      `BLACKLIST_MIN_MISSES` 2 (`:31`), `BLACKLIST_MIN_WEEKS_PRESENT` 2 (`:38`).
    - lib/types.ts — new "Black List" section at the end of the file:
      `BlackListRule` (`:127`), `BlackListRow` (`:141`), `BlackListResult` (`:151`,
      now three fields — see fix_round H2).
    - lib/compute.ts — `getBlackList(ds: Dataset): BlackListResult` at `:374`
      (one parameter, no week), preceded by `TRACKED_CLASHES` (`:336`) and
      `isWeekComplete` (`:350`). Imports the four constants; derives the window as
      `sortedWeeks(ds).filter(isWeekComplete).slice(-windowSize)`, returns
      `{ rule, rows: [], membersJudged: 0 }` early when the window is empty.
  assumptions:
    - "Present in a window week" = the member has any result row that week (incl. a
      benched 0-key row), matching `getMemberProfile`'s `presentWeeks`. Misses are
      counted only over weeks the member was present for; a week with no row at all
      is a roster gap, not a miss. The alternative (absence = a miss) would auto-list
      any member present in exactly `minWeeksPresent` window weeks no matter how they
      played, which contradicts the "too new to judge" intent of that same gate.
    - `keysPossible = weeksConsidered * maxKeysFor("total")`, so `participationPct`
      is measured over present weeks — the same convention as `memberClashStat`.
    - `BlackListRow.member.isActive` is `true` by construction (roster-only filter).
    - `BLACKLIST_MIN_WEEKS_PRESENT` is currently implied by `BLACKLIST_MIN_MISSES`
      (you cannot miss 2 weeks you were absent for); kept explicit and commented so
      the newcomer guard survives a lower miss threshold. **After H2 it is no longer
      inert**: it is half of what `membersJudged` counts.
    - "FIX ROUND — the window FILTERS then SLICES, per the pinned snippet, so it keeps
      its full 4-week size by reaching one week further back when the newest week is
      half imported. The brief predicted 6 rows for the reviewer's half-import
      reproduction; the shipped code returns 8, because the window becomes
      [20,21,22,23] rather than shrinking to [21,22,23]. The 6 the brief expected is
      what slice-then-filter yields. Filter-then-slice was chosen because it is what
      the brief pinned as code, and because it produces output BYTE-IDENTICAL to the
      same dataset with week 24 absent entirely (verified: same 8 members, same
      counts) — i.e. a half-imported week is now indistinguishable from an
      un-imported one, which is the owner's decision stated exactly. Re-pinning to
      slice-then-filter is a one-line change if the churn of week 20 entering and
      leaving the window during an import is judged worse than a shrinking
      denominator. Flagged to the orchestrator, not decided unilaterally."
  done_when:
    1. `npm run build` exits 0; `npm run lint` at the 9-errors-1-warning baseline (paste both runs).
    2. Paste the full signature line of `getBlackList` with its `file:line`. Exactly one parameter, `ds: Dataset`.
    3. Paste the three `export interface` lines from `lib/types.ts` and confirm each field name/type matches the seam contract.
    4. `grep -n "BLACKLIST_" lib/constants.ts lib/compute.ts` — paste it. Four declarations in `constants.ts`, ≥4 references in `compute.ts`, and no bare threshold literal in the `getBlackList` body (walk the body and say so).
    5. Scratchpad `t1-blacklist-check.mts` imports `lib/mock-data.ts`, prints `getBlackList(ds)`. Paste the output AND hand-verify one listed member against the raw rows (which weeks, how many keys, why each is a miss).
    6. Same script against `{members:[],weeks:[],results:[],meta:[]}` returns `{rule, rows: []}`, does not throw, `rule.weekNumbers` is `[]`. Paste it.
    7. `rule.weekNumbers` equals the actual window weeks and is shorter than `windowWeeks` when the dataset has fewer — demonstrate with a 2-week slice.
    # --- fix round, added 2026-08-17 ---
    8. (H1) Run the reviewer's reproduction: demo dataset, then the same dataset with week 24's Chimera rows deleted. Paste both. The half-imported run must not manufacture accusations — state the row count, whether `Tindra` is still listed, and what `rule.weekNumbers` reports for each. ✅ `[21,22,23,24]`/6 rows vs `[20,21,22,23]`/8 rows, Tindra listed in both; the 8 are byte-identical to the same dataset with week 24 absent entirely (positive control run and pasted).
    9. (H2) `membersJudged`: demo → `> 0` with 6 rows; one-week dataset → `0`; empty dataset → `0`, `weekNumbers []`, no throw. Paste all three. ✅ 30 / 0 / 0.
    10. (L1) Temporarily re-pin `BLACKLIST_WINDOW_WEEKS` to 0, run, and show the window did NOT become the whole dataset. Revert and confirm the constant is back to 4. ✅ window `[24]`, one week; reverted.
    11. Build exits 0 and lint sits at the 9-errors-1-warning baseline with zero hits in `lib/`. ✅

- id: t2
  summary: One shared, accessible pagination control + clamping hook (10 rows/page)
  specialist: ui-design-specialist
  owns:
    - components/Pagination.tsx      # new
    - app/globals.css                # only if a primitive is genuinely needed
  depends_on: []
  docs_touched: []
  claimed_by: "ui-design-specialist (t2)"
  state: done   # fix round 1 (H4/M1/M2/L4) + fix round 2 (false lint-guardrail claim) both landed
  changelist:
    - components/Pagination.tsx (new, 191 lines) — the three pinned exports plus one
      additive helper. `ROWS_PER_PAGE = 10` (:49) · `paginate<T>()` (:73) · `usePagination<T>()` (:92)
      · `Pagination()` (:121). No other file touched.
    - `paginate(rows, requestedPage, pageSize)` is the FOURTH export and is additive, not a
      contract change: it is the whole clamp as a pure, React-free function, and
      `usePagination` is `useState(1)` + `useMemo(() => paginate(...))` around it. Extracting it
      is what makes done_when #7 a real test of the shipped code instead of a re-implementation
      of it (the task brief authorized the extraction). t3/t4 import only the pinned three.
    - app/globals.css NOT touched — see done_when #9 below.
    - "FIX ROUND 1 (UX pass: H4 / M1 / M2 / L4). components/Pagination.tsx only,
      now 291 lines; still the ONLY file this task has touched. app/globals.css
      still untouched, and the restyle did not change that answer: `aria-disabled:`
      and its hover reset are stock Tailwind v4.3.1 variants over EXISTING tokens
      (`--color-border`, `--color-muted`), so nothing new belongs in `@theme`, and
      promoting the ghost icon button to a `.btn-icon` primitive would be a
      cross-file refactor of two other components this task does not own."
    - "H4 — the ends no longer destroy focus. Both buttons dropped the native
      `disabled` attribute for `aria-disabled={!canPrev}` / `{!canNext}` (`:266`,
      `:281`) plus a no-op guard as the first statement of each handler
      (`if (!canPrev) return;` `:263`, `if (!canNext) return;` `:278`). A disabled
      element cannot hold focus, so paging to the last page dropped focus to
      <body> and the reader's next Tab restarted at the top of the document — on
      the ordinary happy path, on five surfaces. It also made the ends
      untabbable. `grep -nE '(^|[^-])\\bdisabled=' components/Pagination.tsx`
      now exits 1; the same grep on components/TopBar.tsx exits 0 at `:131`/`:139`."
    - "H4, visual — `disabled:opacity-40` and `enabled:hover:` cannot fire without
      the native attribute (`:enabled` matches EVERY non-disabled button, so the
      old hover gate would have matched both ends). GHOST_ICON_BUTTON (`:107-110`)
      now reads `hover:border-gold/40 hover:text-gold aria-disabled:opacity-40
      aria-disabled:hover:border-border aria-disabled:hover:text-muted`: the same
      40% dim, and the gold hover explicitly reset at the ends. The reset wins on
      SPECIFICITY, not source order — `.x[aria-disabled=\"true\"]:hover` is (0,3,0)
      against `.y:hover`'s (0,2,0). Verified in the emitted bundle, not just in
      source: `.aria-disabled\\:opacity-40[aria-disabled=true]{opacity:.4}` and both
      hover resets are present in .next/static/chunks/*.css."
    - "M1 — new OPTIONAL `label?: string` prop, the fourth optional one; no call
      site changes and every existing one stays correct. Given `label=\"Clan
      Performance\"` the landmark becomes `aria-label=\"Clan Performance pagination\"`
      (`:255`) and the live region opens with an `sr-only` `\"Clan Performance: \"`
      (`:248`), so the two overview controls at 2xl are distinguishable in a
      landmark list AND in the announcement. Omitted, the landmark is `\"Pagination\"`
      and there is no sr-only prefix — byte-identical to what shipped. A label
      already ending in \"pagination\" is used as-is rather than doubled (`:225`),
      so either reading of the prop works."
    - "M2 — at `pageCount === 1` the button group and the <nav> around it are not
      rendered (`:253`): no permanently-dead chevrons, no \"Page 1 of 1\", and no
      landmark promising navigation that does not exist. The range summary stays
      (\"1–6 of 6 players\"). This does NOT reverse the disabled-over-hidden
      decision — that carve-out rests on the position being transient, which is
      exactly what `pageCount === 1` is not."
    - "M2, structural — the outer element is now a <div> (`:232`) carrying the
      border/padding/`xl:shrink-0`, with the <nav> scoped to the button group
      inside it. The wrapper's element type therefore never changes, so crossing
      the one-page boundary cannot unmount and re-insert the aria-live region
      already populated (the WeekAnnouncer hazard). Consequence for the docs: the
      pinned `<nav aria-label=\"Pagination\">` is no longer the OUTER element."
    - "L4 — `normalizePageSize()` (`:125`), applied in both `paginate` (`:145`) and
      the component (`:222`). `pageSize: 0` gave `pageCount: Infinity` and
      `pageRows: []`; 0, negatives, fractions below 1 and NaN now floor to 1.
      The harness found a SECOND degenerate case the brief did not name:
      `pageSize: Infinity` survives `>= 1`, and then `offset = (page-1)*Infinity`
      is `0*Infinity` = NaN, which slices to an empty page. Capped at
      MAX_SAFE_INTEGER, so Infinity now means what a caller would have meant by
      it — everything on one page. Unreachable today either way; no caller passes
      `pageSize`."
    - "FIX ROUND 2 — header note 1 (`:14-17`) claimed an effect-based page reset
      'would render one empty frame first AND is a lint ERROR here
      (`react-hooks/set-state-in-effect`)'. The second half is FALSE and t3 disproved
      it empirically: the rule cannot tie a setter arriving through a custom hook's
      return value back to its `useState`, so no consumer of `usePagination` is
      guarded. Note now states the real reason (an effect commits and paints one wrong
      frame before correcting itself) and says outright that lint will NOT stop you,
      pointing at t3's measurement in `components/TotalPerformanceTable.tsx:88-104`
      rather than repeating it. Comment-only, four lines replaced by four — the file is
      still 291 lines and no `file:line` in it moved. `grep -n 'set-state-in-effect'
      components/Pagination.tsx` → exit 1."
    - "Unchanged, deliberately: the requested-page clamp (`:148`) verbatim, the
      `total === 0 -> null` guard (`:220`), the aria-live/aria-atomic summary
      (`:244-245`), both button `aria-label`s, `ROWS_PER_PAGE`, all four exported
      signatures' existing parameters, and `xl:shrink-0` on the outer element
      (moving it to `className` was offered and declined — ClashTable relies on it
      and passes no className)."
  assumptions:
    - `pageSize` on the `Pagination` component is only used to compute the END of the range
      summary (`min(offset + pageSize, total)`). A caller that passes a non-default `pageSize`
      to `usePagination` must pass the same one here or the "x-y of N" end is wrong. Both
      default to `ROWS_PER_PAGE`, so the common case cannot desync.
    - The nav carries `xl:shrink-0` in its own className. `ClashTable` keeps the viewport lock
      (`xl:flex xl:flex-col xl:overflow-hidden`), so without it the control could be squeezed by
      the `xl:flex-1` scroll wrapper beside it. It is inert outside a flex column.
    - Hover is `enabled:hover:` rather than the bare `hover:` in the design-system's
      "Ghost icon button (tables)" line, because these buttons are genuinely `disabled` at the
      ends and should not light up gold while refusing to act. Same deviation TopBar's chevrons
      already make (`components/TopBar.tsx:132`). t5 may want to note it on that pattern entry.
      **SUPERSEDED by fix round 1**: with the native attribute gone, `enabled:` matches both
      ends, so the deviation is now `aria-disabled:hover:*` resets instead. The design-system
      entry written from the old form is stale — see escalations.
    - "FIX ROUND — `label` is the human name of the TABLE (`label=\"Clan Performance\"`),
      not a finished aria-label; the component appends \" pagination\" for the landmark and
      \": \" for the sr-only announcement prefix. Passing the finished form
      (`\"Clan Performance pagination\"`) also works — a trailing \"pagination\" is stripped
      before composing, so it cannot double. t3/t4 can use either; the table name is the
      intended one."
    - "FIX ROUND — the buttons stay h-7 w-7 (21 CSS px at the 75% root size). The reviewer
      accepted the WCAG 2.2 §2.5.8 spacing exception via `gap-2`, and bumping to h-8 was NOT
      free: it forks the shared \"Ghost icon button (tables)\" geometry for one caller and
      falsifies a design-system line nobody in this order owns. Declined, not overlooked."
    - "FIX ROUND — `components/TopBar.tsx:129-144` has the identical focus defect (native
      `disabled` on both week chevrons, `:131`/`:139`) and is where this shape was inherited
      from. NOT this task's file; left alone and reported as a follow-up."
  done_when:
    1. `npm run build` exits 0; lint at baseline.
    2. Paste the three exported signatures; they match the seam contract character-for-character in parameter names and types. Any deviation is a contract break — report instead of shipping it.
    3. `grep -nE "#[0-9a-fA-F]{3,8}" components/Pagination.tsx` → exit 1. Positive control: same regex on `app/globals.css` → exit 0.
    4. `grep -n "text-faint" components/Pagination.tsx` → exit 1. Positive control: same on `components/PerformanceTable.tsx` → exit 0 (`:166`).
    5. `grep -n "useEffect" components/Pagination.tsx` → exit 1, positive control on `components/WeekTransition.tsx`. State the `file:line` of the derived clamp expression instead.
    6. State the `file:line` of the `<nav aria-label="Pagination">`, both `aria-label`ed buttons, both `disabled` expressions, and the `aria-live="polite"` summary.
    7. Scratchpad `t2-clamp-check.mjs` shows: requested page 4, `total` drops to 12, `pageSize` 10 → `page: 2`, `pageCount: 2`, `pageRows.length === 2`, `offset: 10`. Also `total: 0` → `pageCount: 1`, `page: 1`, `pageRows: []`. Paste both.
    8. State the `file:line` of the `total === 0 → null` guard.
    9. If `app/globals.css` was NOT touched, say so explicitly and give the reason.
    # --- fix round 1, appended; #1-#9 above re-run and still hold, with #6 restated ---
    10. H4: no native `disabled` attribute in the file. `grep -nE "(^|[^-])\bdisabled=" components/Pagination.tsx` → exit 1; positive control on `components/TopBar.tsx` → exit 0 at `:131`, `:139`. **RUN, both as stated.**
    11. H4 visual: the disabled look is emitted CSS, not just source text. Grepped `.next/static/chunks/*.css` after the build → `.aria-disabled\:opacity-40[aria-disabled=true]{opacity:.4}`, `.aria-disabled\:hover\:border-border[aria-disabled=true]:hover{border-color:var(--color-border)}`, `.aria-disabled\:hover\:text-muted[aria-disabled=true]:hover{color:var(--color-muted)}`. **RUN.**
    12. M1: `label` is optional and the no-label render is unchanged. Harness renders the same control with and without it; unlabelled → `aria-label="Pagination"` and no `sr-only` span. **RUN.**
    13. M2: `pageCount === 1` renders the summary and nothing else. Harness asserts the single-page markup contains `1–6 of 6 players` and `aria-live="polite"` and contains no `<nav`, no `<button`, no `Page 1 of 1`. **RUN.**
    14. L4: `paginate(rows(34), 2, s)` for `s` in `[0, -5, -0.5, NaN, 3.7, Infinity, 1]` yields a finite `pageCount` and a non-empty page in every case. **RUN** — this is what caught the `Infinity → offset NaN` case.
    15. #6 restated for the new structure: `<div>` wrapper `:232` · `aria-live="polite"` `:244` · `sr-only` table-name prefix `:248` · `pageCount > 1` guard `:253` · `<nav>` `:254` with its computed `aria-label` `:255` · Previous `aria-disabled` `:266` / `aria-label` `:267` / guard `:263` · Next `aria-disabled` `:281` / `aria-label` `:282` / guard `:278`.
  escalations:   # unowned files — reported, not touched
    - "docs/reference/design-system.md is owned by t5 and its **Pagination** entry
      (`:61-65`) plus the **Ghost icon button** entry (`:58-60`) are now falsified in
      five specific places by this fix round. Not edited — t5 owns them.
      (a) `:64` — 'Prev/next stay visible and go `disabled` at the ends' and the
      TopBar precedent sentence: still visible, but `aria-disabled` + a handler
      guard now, BECAUSE the native attribute destroys focus; TopBar is now cited as
      the unfixed twin, not as the pattern to copy.
      (b) `:65` — '`<nav aria-label=\"Pagination\">` (`:148`)' — the nav is no longer
      the outer element and no longer statically labelled; the outer element is a
      <div> at `:232` and the nav (`:254`) wraps only the button group.
      (c) `:65` — every line number in it moved (the file went 191 → 291 lines).
      (d) `:61` — the exports gained an optional `label`; and `paginate` is described
      as 'exported but not imported anywhere', which is still true of app code.
      (e) `:59-60` — the Ghost icon button entry records `enabled:hover:` as a
      deliberate correction and names `components/Pagination.tsx:58-61` as one of its
      two users. That is now wrong for this file: `enabled:` cannot gate a control
      that is not natively disabled. TopBar remains a correct `enabled:hover:` user.
      A new third form belongs in that entry: `aria-disabled:` + hover reset, for a
      button that must stay focusable.
      Also: `:56` says both tables' skeleton counts are at most ten — unaffected.
      A new sentence is wanted somewhere in the Pagination entry for the
      one-page-drops-the-buttons rule and for why the live region sits outside the nav."
    - ".claude/rules/ux.md (t5's) — the hide-don't-disable paragraph now has a third
      case worth naming: a control that is neither hidden nor natively disabled, because
      the native attribute costs the keyboard user their focus position. Unowned."
    - "FIX ROUND 2 — the SAME false lint claim is live in two more places, both unowned
      by t2. (a) `.claude/rules/ux.md`, Loading/pending bullet: 'syncing the index down
      in an effect renders one empty frame first **and** trips
      `react-hooks/set-state-in-effect`, which is an error here' — t5 owns that file.
      (b) `docs/reference/design-system.md:63`: 'it renders one empty frame before the
      correction lands, and `react-hooks/set-state-in-effect` is an active lint **error**
      in this project, so it would not ship' — the last clause is the falsified one; t5
      owns that file too. Both should say what note 1 now says: the render-phase form is
      right because an effect paints a wrong frame, NOT because lint would catch it.
      (c) This ledger's own context pack, `:48`, makes the same claim ('it is mandatory:
      `react-hooks/set-state-in-effect` is an active lint error here'). The pack is
      immutable after approval, so it is recorded here as wrong rather than edited."
    - "components/TopBar.tsx:129-144 — the same focus defect on both week chevrons,
      and it is where this file inherited the shape. Explicitly out of scope for this
      task; needs its own slice (it is 2 lines of change plus 2 guards, but TopBar is
      the week-transition seam and belongs to whoever owns that)."

- id: t3
  summary: Unwind the overview's viewport lock, place the Black List beside Clan Performance, paginate both overview tables
  specialist: ui-design-specialist
  owns:
    - app/page.tsx
    - components/PerformanceTable.tsx
    - components/TotalPerformanceTable.tsx
    - components/BlackListTable.tsx    # new
  depends_on: [t1, t2]
  docs_touched: []
  claimed_by: "ui-design-specialist (t3)"
  state: done   # fix round 3 landed: rule-paragraph gate on the first-run screen
  fix_round:   # 2026-08-17, UX review. Three of the four owned files touched; app/page.tsx NOT touched.
    - "SCOPE — `app/page.tsx` needed no change and got none. Every defect in this
      round lives in the three components; the grid, the scroll unwind and the
      one-argument `getBlackList(ds)` call were all confirmed correct by the
      reviewer. The L5 flex fix is on the two `<section>`s, not on the grid."
    - "H1 — the good-news shield no longer fires when nobody could be judged.
      `BlackListTable` now destructures `membersJudged` (`:53`) and has THREE
      branches, not two: `noWeeks` (`:60`), `nobodyJudged = !noWeeks &&
      membersJudged === 0` (`:63`), and the good-news default. Reproduced the
      reviewer's one-week dataset before and after — see done_when #14."
    - "H2 — the varying denominator is legible and the explanation sits on the cell
      that needs it. The Participation cell (`:130`) is now two lines: the
      percentage (`:134`), then `8 / 15 keys · 3 weeks judged` in
      `text-xs text-muted` (`:136-139`), so the per-member judged count is VISIBLE
      rather than living only in a `title` that no keyboard or touch user can
      reach. The `title` moved off the Missed Weeks cell onto this one (`:131`)
      and is now the redundant long form, not the only form.
      Header paragraph (`:83-89`) gained the comparison
      warning `docs/user-guide.md:245` already carried: 'key totals are not
      comparable between players, so compare the percentages'. Cost in horizontal
      width: the cell's widest line goes from `53% 8 / 15 keys` (~99px incl.
      padding) to `8 / 15 keys · 3 weeks judged` (~147px), pushing the table's
      min-content from ~430px to ~460px — still inside the ~465px the Black List
      gets at 2xl. `whitespace-nowrap` on the detail line keeps it one line."
    - "H3 — the page index now resets on changes the READER asks for, and on none
      the app does to them. `view.setPage(1)` added to exactly three handlers in
      `PerformanceTable`: the search `onChange` (`:207`), `onSort` (`:134`) and the
      tab `onClick` (`:190`); plus `TotalPerformanceTable`'s own `onSort` (`:83`),
      which has the same defect for the Total tab's sort. `onSort` had to move
      BELOW `const view = usePagination(rows)` in both files (it now reads `view`);
      no other reordering. Resolves L4/L6 as the brief predicted — Hydra↔Chimera
      and a detour through Total now behave identically."
    - "M3 — `:76` now says 'a week under 3 of 5 combined Hydra + Chimera keys is a
      miss'. Everywhere else in the app a key belongs to one clash; this is the one
      place the two are summed and it now says so."
    - "M4 — Missed Weeks prints `W21, W23, W24` (`:119`), so a three-miss row cannot
      be read as the quantity the column header implies, and the bare digits stop
      colliding with the numbers in the next column."
    - "L2 — the rule sentence says `inside the {rule.weekNumbers.length}-week window`
      (`:84`, via the local `weeksJudged`), not `rule.windowWeeks`. It was always
      printing the constant 4 next to a `Weeks …` line that listed the weeks
      actually judged; now that incomplete weeks drop out of the window (t1's H1)
      the two disagree routinely. The whole paragraph is also gated on `!noWeeks`
      (`:82`) — 'inside the 0-week window' is not a sentence."
    - "L3 — the good-news branch says 'missed 2 or more of the weeks they played'
      (`:175`), matching `docs/user-guide.md`. 'of these weeks' overstated the rule,
      which is over the weeks each player was present for."
    - "L1(ux) — `PerformanceTable.tsx:280` now guards the quoted term with
      `query.trim() ? …`, the shape `TotalPerformanceTable` already used. A
      genuinely empty week rendered `No players match “”.`, which reads as a bug
      rather than an empty week. Verified by rendering the component against an
      empty dataset: the row now reads `No players match.`
      `TotalPerformanceTable:142` gained `.trim()` on the same test so a
      whitespace-only query does not print a pair of quotes round three spaces."
    - "L5 — both overview `<section>`s are now `card-flush xl:flex xl:h-full
      xl:flex-col` (`PerformanceTable:167`, `BlackListTable:70`) and all three
      `<Pagination>` calls pass `className=\"xl:mt-auto\"`. At 2xl the grid stretches
      both cards to the taller one; without a flex column the shorter card's
      `border-t` pagination bar sat wherever the rows ended, with dead space under
      it. Applied to BOTH cards, not just the Black List — either can be the
      shorter one depending on the tab and the row counts."
    - "`label` — passed at all three call sites: `label=\"Clan Performance\"`
      (`PerformanceTable:297`, `TotalPerformanceTable:156`, the two mutually
      exclusive branches of one card) and `label=\"Black List\"`
      (`BlackListTable:193`). Rendered output verified, not just the source: the
      landmark is `aria-label=\"Clan Performance pagination\"` and the live region
      opens `<span class=\"sr-only\">Clan Performance: </span>`."
    - "Not changed, deliberately: `app/page.tsx` (nothing in the round touches it),
      the 2xl split and its measurements, the scroll unwind, the week-pending
      contract (`isTotal`, `emptySearch`, `<tbody aria-busy={pending}>`,
      `skeletonRowCount(view.pageRows.length)`), the `title` idea itself (kept as
      the redundant long form), the `placeholder:text-faint` on the search input
      (pre-existing, decorative, and t2's done_when #4 uses it as a positive
      control), and `min-w-[420px]` on the Black List table."
  fix_round_2:   # 2026-08-17, coordinator follow-up. ONE file changed plus its call site.
    - "H3's remaining half is closed. `TotalPerformanceTable` now resets its page index
      when the reader narrows the list, using React's documented *adjusting state when a
      prop changes* — previous value in state, compared during RENDER, `setPage(1)` called
      in the render phase (`components/TotalPerformanceTable.tsx:113-117`). React discards
      that render and re-runs the component before committing, so no intermediate frame
      reaches the DOM. Not an effect: nothing is deferred to after paint, and
      `useState(filterKey)` seeds prev to the current value so the condition is false on
      the first render, always. All four paginated surfaces now behave alike."
    - "NEW OPTIONAL PROP, not a contract change: `filterKey?: string`
      (`TotalPerformanceTable.tsx:57`, `:66`), passed as
      `` filterKey={`${memberFilter}|${query}`} `` from `PerformanceTable.tsx:239`.
      `memberFilter` goes first because it is a closed set containing no `|`, so the join
      is unambiguous however the reader spells their search. The `<Pagination {...view}
      onPageChange={view.setPage}>` shape is untouched at all five call sites, nothing is
      remounted, and `usePagination` is still imported and called here — t3 done_when #5
      and the integrator's five-call-site seam both still hold."
    - "**DEVIATION FROM THE BRIEF, deliberate: keyed on `filterKey`, NOT on
      `rows !== prevRows`.** The shorter form would have reset the page on a WEEK CHANGE,
      which is the one event the rule forbids resetting on. `rows` is the parent's
      `totalRows` useMemo and its deps are `[totals, query, memberFilter]`
      (`PerformanceTable.tsx:107`); `totals` is a SERVER prop, so a week navigation sends
      a structurally identical array across the RSC boundary with a brand-new identity
      every time. `rows !== prevRows` would have been true on every week change — and the
      Total tab is all-weeks, so its numbers would not even have moved. `filterKey` is
      built only from `memberFilter` and `query`, two pieces of client state that a week
      navigation cannot touch, so it is inert to week changes by construction."
    - "**HONEST CORRECTION to a claim this ledger has been making.** The instruction was
      to confirm the lint rule stays quiet rather than assume it. It does — baseline, zero
      hits in this file. But the positive control says the quiet is not meaningful here:
      the same reset written as `useEffect(() => setPage(1), [filterKey])` ALSO passes at
      baseline (measured twice, once with `view.setPage` and once with the setter
      destructured first — the second produced 10 problems, i.e. no new error). The reason
      is that `react-hooks/set-state-in-effect` cannot tie a setter arriving through a
      CUSTOM HOOK's return value back to its `useState`. So for any `usePagination`
      consumer, the lint rule is NOT a guardrail — the render-phase form is right because
      an effect would commit and paint one frame of `21-22 of 22` first, not because
      anything would stop someone writing the effect. Recorded in the code comment at
      `TotalPerformanceTable.tsx:88-104` so the next contributor cannot be misled by a
      green lint run. (The clamp-is-a-lint-error framing in `components/Pagination.tsx`'s
      header note and in `.claude/rules/ux.md` is true for a component holding its own
      `useState` and false for a custom-hook consumer; t5's docs may want that nuance.)"
  fix_round_3:   # 2026-08-17, coordinator follow-up. ONE file, one gate.
    - "The rule paragraph is now gated on `anyoneJudged` (`components/BlackListTable.tsx:67`,
      `= membersJudged > 0`) instead of `!noWeeks` (`:94`). With exactly one fully imported
      week it rendered 'Listed at 2 or more missed weeks inside the **1-week window**'
      directly above the hourglass branch saying nobody can be judged yet — a rule that is
      arithmetically unsatisfiable inside its own stated window, on the screen a clan sees
      right after its first import and after every Settings -> Reset."
    - "Written as the positive `membersJudged > 0` rather than `!nobodyJudged`. They are NOT
      the same: `nobodyJudged` is already `!noWeeks && membersJudged === 0`, so `!nobodyJudged`
      is true in the no-weeks state and would have put 'inside the 0-week window' back on the
      empty-database screen. `!noWeeks && !nobodyJudged` is correct but reads as a double
      negative for what is one plain condition — has anybody actually been measured."
    - "The header does NOT go bare when the paragraph drops. In that state it is still two
      lines: `Black List` plus `Weeks 24 · a week under 3 of 5 combined Hydra + Chimera keys
      is a miss`. That subtitle defines a term rather than asserting the listing rule, so it
      stays true and useful with a one-week window; only the sentence that promises 2 misses
      inside a 1-week window is removed. Verified in the rendered output, below."
    - "Nothing else moved. The two other empty branches and the populated state render
      byte-identically to fix round 2 — the gate only ever hid a paragraph that the no-weeks
      branch was already hiding and that both judged states still show."
    - "NOT touched, as instructed: `lib/compute.ts:434`'s asserted `isActive: true` (accepted
      cost of the owner's decision; self-corrects on the second import) and
      `components/Pagination.tsx`'s `pageCount === 1` unmount (t2's file; the alternative
      reverses a wanted fix). Neither is in this task's `owns` set either."
  changelist:   # line numbers re-resolved after fix round 1
    - app/page.tsx — viewport lock unwound. Root div `:94` is now
      `flex flex-col gap-6 p-6`; the TopBar wrapper div is gone (TopBar is a direct
      child at `:95`) and `xl:shrink-0` / `xl:flex-1` / `xl:min-h-0` / `xl:h-screen` /
      `xl:overflow-hidden` are all removed. `getBlackList(ds)` at `:50`, one argument.
      New 2+1 grid at `:136` holding Clan Performance (`:137`) and the Black List (`:142`).
      **Unchanged by fix round 1.**
    - components/PerformanceTable.tsx — `usePagination(rows)` `:113`; section is
      `card-flush xl:flex xl:h-full xl:flex-col` `:167`; internal vertical scroller +
      sticky thead removed (`:235`); rows are `view.pageRows` with
      `view.offset + i + 1` `:260`; `skeletonRowCount(view.pageRows.length)` `:155`;
      `<Pagination>` `:293`, a sibling of the scroller and after `</table>` `:285`.
      Week-pending contract untouched — `isTotal` `:80`, `emptySearch` `:149`,
      `<tbody aria-busy={pending}>` `:252`.
    - components/TotalPerformanceTable.tsx — `usePagination(sorted)` `:71` (after its own
      sort, which only exists here); returns a fragment so `<Pagination>` `:152` lands
      outside `</table>` `:147`; vertical scroller + sticky thead removed (`:94`).
    - components/BlackListTable.tsx (new, 198 lines) — `"use client"` leaf; four columns
      (#, Player, Missed Weeks, Participation); rule stated off `rule.*` at `:76`, `:84`,
      `:166`, `:175`; THREE distinct empty branches at `:147` (no fully imported week),
      `:157` (weeks, but nobody judged) and `:170` (good news); `<Pagination>` `:189`.
  assumptions:
    - "**The 2+1 split is at `2xl` (1536px), not `xl`.**" Two of three columns is
      `2*(vw - 76 sidebar - 36 padding - 30 gaps)/3 + 15`, so min-w-[860px] needs
      ~1410px of viewport and the Total tab's min-w-[920px] needs ~1500px. Splitting at
      `xl` would leave every 1280–1500px laptop with a permanent horizontal scrollbar on
      the app's primary table. At 1536 Clan Performance gets ~944px (24px of slack over
      920) and the Black List ~465px. Tailwind breakpoints are rem in a media query,
      which resolves against the initial 16px and NOT `html { font-size: 75% }` —
      confirmed against `node_modules/tailwindcss/theme.css:331`.
    - `xl:h-full` (not `2xl:h-full`) on both grid children: min-width variants are
      cumulative, so it is live at 2xl where the stretch is needed, and an inert no-op
      on the single-column rows between xl and 2xl.
    - Black List columns are 4, not 5: at ~465px there is no room for a separate keys
      column. `keysUsed / keysPossible` rides in the Participation cell (`9 / 15 keys`
      discloses a 3-week denominator numerically), the per-member judged count is in the
      cell `title`, and the header paragraph states outright that the number of weeks
      judged differs per player. Estimated min-content ~430px; a roster with a
      20-character single-token name pushes it to ~460px, still inside 465.
      **SUPERSEDED in part by fix round 1 (H2)**: still 4 columns, but the judged count
      is now a visible second line in the Participation cell rather than tooltip-only.
      Re-estimated min-content ~460px (the Participation column goes ~99px → ~147px,
      and it is now the widest thing in that column, not the `53%`), still inside the
      ~465px the card gets at 2xl — but the slack is now ~5px, not ~35px.
    - `participationColor` is hand-copied a THIRD time into BlackListTable. Hoisting it
      would need a file this slice does not own; flagged for t5/reviewer.
    - The requested page is deliberately not reset when the tab changes (Hydra→Chimera
      keeps the page); t2's clamp makes that safe and it matches sort/search persistence.
      **REVERSED by fix round 1 (H3)** — search, sort and tab all reset to page 1 now.
      The clamp alone was not a fix for reader-initiated narrowing: page 3 of 3 is IN
      range after a search cuts 30 rows to 22, so the clamp does nothing and the reader
      sees matches 21–22 as if the search found two players. The week-change half of the
      rule (clamp, never reset, never an effect) is unchanged and untouched.
    # --- fix round 1, appended 2026-08-17 ---
    - "H2's second line was written as the brief pinned it (`8 / 15 keys · 3 weeks
      judged`, one line) rather than as three stacked lines. Three lines would have
      been ~50px NARROWER than what shipped originally, but the brief pinned the
      two-line shape and the measurement says it fits. `whitespace-nowrap` on it means
      the horizontal scroller — not a wrap — absorbs a viewport narrower than the
      table's min-content, matching every other table in the app."
    - "The `nobodyJudged` branch is phrased so it is also correct in the case the brief
      did not name: `membersJudged === 0` with a FULL window, which happens when the
      newest judged week has no result rows for anyone still on the roster. 'Nobody can
      be judged yet — 4 weeks are fully imported, and a player is judged once they have
      results for at least 2 of them' is true in both readings; 'only N weeks are
      imported so far' would have been false in the second."
    - "The `nobodyJudged` icon is `Hourglass` (`text-gold`), deliberately neither the
      `Inbox` of the no-data branch nor the `ShieldCheck` of the good-news one — three
      states, three glyphs, so the branch is distinguishable at a glance and greppable
      in a rendered-HTML check."
    - "REMAINING GAP after fix round 1 — the Total (All Weeks) tab's page index survived
      a SEARCH and an Active/Former filter change. Its pagination state lives in
      `TotalPerformanceTable`'s own `usePagination` (it must: the slice can only be taken
      after that component's own sort), and a search is a PROP change there, not an event.
      Two options were listed and both rejected: (a) threading the page down and using the
      pure `paginate()` breaks the `<Pagination {...view} onPageChange={view.setPage}>`
      shape verified at all five call sites; (b) remounting the child re-inserts the
      already-populated `aria-live` summary on every keystroke.
      **CLOSED in fix round 2 by a third option — see the fix_round_2 block below.**"
  done_when:
    1. `npm run build` exits 0, route table shows `ƒ /` (and `ƒ /members`, `○ /import` unchanged); lint at baseline. Paste the table.
    2. Scroll unwind: `grep -nE "h-screen|overflow-hidden|xl:flex-1|xl:min-h-0|xl:shrink-0" app/page.tsx` → exit 1. Positive control `grep -n "xl:" app/page.tsx` → exit 0 with output.
    3. `grep -nE "xl:overflow-y-auto|xl:sticky" components/PerformanceTable.tsx components/TotalPerformanceTable.tsx` → exit 1. Positive control `grep -n "overflow-x-auto"` on the same two → 2 hits.
    4. Pagination outside the table in all three: for each, give the `file:line` of the `<Pagination` element and of the enclosing `</table>`, showing the pagination line is greater.
    5. `grep -n "usePagination" components/PerformanceTable.tsx components/TotalPerformanceTable.tsx components/BlackListTable.tsx` → import + call in each; paste it.
    6. Black List is all-weeks: `grep -nE "useWeekPending|PendingSwap|selectedWeek" components/BlackListTable.tsx` → exit 1. Positive control on `components/PerformanceTable.tsx` → exit 0.
    7. Paste the `getBlackList(` call line from `app/page.tsx`: exactly one argument.
    8. Reader can see why someone is listed: `grep -nE "rule\.(windowWeeks|minKeysPerWeek|minMisses|maxKeysPerWeek)" components/BlackListTable.tsx` → ≥3 hits, pasted. No threshold written as a literal in the JSX.
    9. State the `file:line` of the zero-rows branch and paste its copy verbatim; it must read as good news. State separately what renders when `rule.weekNumbers` is `[]`.
    10. `grep -nE "#[0-9a-fA-F]{3,8}|text-faint" components/BlackListTable.tsx` → exit 1, positive control on `app/globals.css`.
    11. Paste the className of the grid container holding Clan Performance + Black List and of both children, showing the col-span split and `xl:h-full` on both.
    12. State each table's `min-w-[…]` against the width it now gets, and record the viewport below which Clan Performance scrolls horizontally. If worse than ~1500px, say so and state whether you moved the split to `2xl:` (authorized).
    13. Placeholder counts stay ≤ one page: paste the `skeletonRowCount(...)` call showing its argument is the paginated array's length, and confirm `components/Skeleton.tsx` is unmodified (`git diff --name-only`).
    # --- fix round 1, appended 2026-08-17. #1-#13 re-run and still hold, with #4, #5, #8, #9 restated. ---
    14. (H1) All three empty branches demonstrated on RENDERED HTML, not source.
        Harness renders `<BlackListTable>` through `renderToStaticMarkup` for four datasets
        and reports which lucide glyph came out. ✅
        · **A, empty dataset** — `weekNumbers=[] rows=0 membersJudged=0` → **Inbox**:
          "No clash week is fully imported yet — a week is judged once both Hydra and
          Chimera results are in, so there is nothing to measure participation against."
        · **B, the reviewer's ONE-WEEK dataset** (demo sliced to week 24, both clashes) —
          `weekNumbers=[24] rows=0 membersJudged=0` → **Hourglass**: "Nobody can be judged
          yet — 1 week is fully imported, and a player is judged once they have results
          for at least 2 of them." **This is the reproduction: it used to render the green
          shield.**
        · **C, full demo** — `weekNumbers=[21,22,23,24] rows=6 membersJudged=30` → rows,
          no empty branch.
        · **D, synthetic perfect clan** (every member, every week, both clashes, max keys)
          — `weekNumbers=[21,22,23,24] rows=0 membersJudged=30` → **ShieldCheck**: "Nobody
          is on the Black List — none of the 30 players judged missed 2 or more of the
          weeks they played." The good-news branch still reachable, now gated correctly.
    15. (H2) The reviewer's exact confusing pair, from run C above: "3 V Vorgath W22, W23
        53% 8 / 15 keys · 3 weeks judged" directly above "4 Y Ysolde W22, W23 60% 12 / 20
        keys · 4 weeks judged". Both denominators are now explained on the cell that
        carries them, in visible text. ✅
    16. (H2/M3/L2/L3) Header copy, from the same render: "Weeks 21, 22, 23, 24 · a week
        under 3 of 5 combined Hydra + Chimera keys is a miss" and "Listed at 2 or more
        missed weeks inside the 4-week window. A week a player has no result for is a
        roster gap, not a miss, so the number of weeks judged differs from player to
        player — key totals are not comparable between players, so compare the
        percentages." ✅ (In run B the same sentence reads "the 1-week window", which is
        the L2 fix doing its job — `rule.windowWeeks` would have said 4.)
    17. (H3) The reset is confined to event handlers and the week-change rule is intact.
        `grep -n "setPage" components/PerformanceTable.tsx components/TotalPerformanceTable.tsx
        components/BlackListTable.tsx` → seven hits, and only four are calls:
        `PerformanceTable:134` (inside `onSort`), `:190` (inside the tab `onClick`),
        `:207` (inside the search `onChange`), `TotalPerformanceTable:83` (inside its
        `onSort`). The other three are `onPageChange={view.setPage}` props. ✅
    18. (H3, the week-change side) `grep -n "useEffect" components/PerformanceTable.tsx
        components/TotalPerformanceTable.tsx components/BlackListTable.tsx app/page.tsx`
        → exit 1, so nothing was added that could fire on a prop change. The week-change
        path is `useWeekPending() → pending` and a new `data` prop → `rows` useMemo →
        `usePagination(rows)` re-deriving the SAME requested page through t2's clamp;
        no `setPage` appears anywhere on it. Page 3 of a long week is still page 3 of the
        next long week, and a shorter incoming week still folds down instead of blanking.
        `showSkeleton` / `emptySearch` / `<tbody aria-busy={pending}>` /
        `skeletonRowCount(view.pageRows.length)` are byte-identical to what shipped. ✅
    19. (L1 ux) `<PerformanceTable>` rendered against an empty dataset ends
        "…Participation **No players match.**" — no empty pair of quotes. ✅
    20. (label) Rendered `<PerformanceTable>` on the demo dataset yields
        `aria-label="Clan Performance pagination"` plus `<span class="sr-only">Clan
        Performance: </span>` before "1–10 of 28 players"; `<BlackListTable>` yields
        "Black List: 1–6 of 6 players". Two overview landmarks, two distinct names. ✅
    21. (L5) The utilities are in the EMITTED CSS, not just the source. After the build,
        `.next/static/chunks/*.css` contains `.xl\:mt-auto{margin-top:auto}`,
        `.xl\:flex{display:flex}` and `.xl\:flex-col{flex-direction:column}` inside
        `@media (min-width:80rem)`. Positive control on the pre-existing 2xl split, which
        needs the leading-digit escape to find: `.\32 xl\:grid-cols-3{grid-template-columns:…}`
        and `.\32 xl\:col-span-2{grid-column:span 2/span 2}` are both present. ✅
        (Worth recording: a plain grep for `2xl\:` in the built CSS returns nothing and
        looks like the 2xl split is dead. It is not — CSS escapes a leading digit as
        `\32 ` + space. A probe file carrying `2xl:z-[52]` was built and confirmed it
        emits as `.\32 xl\:z-\[52\]`; the probe was deleted.)
    22. (tokens) `grep -nE "#[0-9a-fA-F]{3,8}|text-faint"` → exit 1 on
        `components/BlackListTable.tsx` and `components/TotalPerformanceTable.tsx`.
        `components/PerformanceTable.tsx` returns one hit, `:210`
        `placeholder:text-faint` — pre-existing, decorative placeholder text, and the
        positive control t2's done_when #4 relies on. Positive control:
        `grep -cE "#[0-9a-fA-F]{3,8}" app/globals.css` → 23. ✅
    23. Build + lint on the merged tree at the end of this round: `npm run build` exits 0
        with the route table unchanged (`ƒ /`, `ƒ /members`, `○ /import`, `○ /_not-found`);
        `npm run lint` → **10 problems (9 errors, 1 warning)**, the baseline, with **zero
        hits in any of the four owned files**. `git status --porcelain` shows no stray
        scratch file (both harnesses and the CSS probe were deleted). Mid-round counts are
        not authoritative — t4 was editing in parallel; the integrator establishes the
        number. ✅
    # --- fix round 2, appended 2026-08-17 ---
    24. (H3, Total tab) The defect and the fix in numbers, run against the SHIPPED clamp
        (`paginate` from `components/Pagination.tsx`) on 30 real `getAllWeeksTotals` rows,
        reproducing the reviewer's walk-through exactly. ✅
        ```
        reader on page 3 of 30           page 3/3  offset 20  showing 21-30 of 30  (10 rows)
        search -> 22, page KEPT (old)    page 3/3  offset 20  showing 21-22 of 22  (2 rows)
        search -> 22, page RESET (new)   page 1/3  offset  0  showing 1-10 of 22  (10 rows)

        clamp is a NO-OP here: requested page 3, pageCount 3, got page 3.
        ```
        The last line is the whole point — the clamp cannot fix this, because page 3 of 3
        is still in range after the list shrinks from 30 to 22.
    25. (H3, mount is inert) `<TotalPerformanceTable>` server-rendered with
        `filterKey` `undefined`, `"all|"` and `"active|vor"`: every one yields
        `1–10 of 30 players`, first rank `1`, no throw and no render loop. The
        render-phase condition is false on the first render because `useState(filterKey)`
        seeds prev to the current value. ✅
    26. (lint, with a POSITIVE CONTROL that changed the conclusion) `npm run lint` →
        10 problems (9 errors, 1 warning), baseline, zero hits in any owned file. Then the
        same reset was temporarily rewritten as `useEffect(() => setPage(1), [filterKey])`
        — twice, once via `view.setPage` and once with the setter destructured first — and
        lint returned **11 problems (only an `exhaustive-deps` warning)** and **10 problems
        (nothing new)** respectively. **`react-hooks/set-state-in-effect` does not fire for
        a setter that arrives through a custom hook's return value.** Both variants were
        reverted from a byte-for-byte backup and the baseline re-confirmed. The
        render-phase form is correct on its merits, not because lint enforces it. ✅
    27. (week change still clamps, never resets) `filterKey` is
        `` `${memberFilter}|${query}` `` (`PerformanceTable.tsx:239`) — two pieces of
        CLIENT state. A week change is a route navigation that changes the server props
        (`data`, `totals`, `weekLabel`) and `useWeekPending()`; it cannot change
        `memberFilter` or `query`, so the render-phase condition is false across one and
        the requested page is carried through t2's clamp exactly as before. The Total tab
        is additionally all-weeks, so its rows do not change at all. The four `setPage(1)`
        call sites are still the three event handlers plus `onSort`; the fifth site is the
        render-phase adjustment, and no `useEffect` exists in any owned file. ✅
    28. (`aria-live` not remounted on a keystroke) The live region is
        `<p aria-live="polite" aria-atomic="true" class="text-xs tabular-nums text-muted">`
        and comes back byte-identical for `filterKey` `"all|"`, `"all|a"` and `"former|"`
        — same element, same attributes, same position; only its text differs. Nothing is
        keyed, nothing is conditionally wrapped, and t2's `pageCount === 1` boundary lives
        on the inner `<nav>`, not on this `<p>` or its `<div>` wrapper. React updates the
        text node in place, so the region is never re-inserted already populated. ✅
    29. Build exits 0, TypeScript clean, route table unchanged; `git status --porcelain`
        shows no scratch file left behind (`t3-total-reset.tsx` and the two lint-probe
        backups deleted). ✅
    # --- fix round 3, appended 2026-08-17 ---
    30. All four states re-rendered through `renderToStaticMarkup` after the gate change,
        reporting the lucide glyph and whether the rule paragraph is present. Only state B
        changed. ✅
        · **A, empty dataset** — `weekNumbers=[] rows=0 membersJudged=0` · Inbox ·
          rule paragraph **false** (unchanged — `!noWeeks` already hid it):
          "Black List / No fully imported week yet" then the Inbox sentence.
        · **B, ONE fully imported week — the first-run screen** — `weekNumbers=[24] rows=0
          membersJudged=0` · Hourglass · rule paragraph **false (was true — this is the
          fix)**. Full header now reads:
          "Black List / Weeks 24 · a week under 3 of 5 combined Hydra + Chimera keys is a
          miss", then "Nobody can be judged yet — 1 week is fully imported, and a player is
          judged once they have results for at least 2 of them."
          The self-contradicting line — "Listed at 2 or more missed weeks inside the 1-week
          window" — is gone, and the heading is not left bare: two header lines remain.
        · **C, full demo, populated rows** — `weekNumbers=[21,22,23,24] rows=6
          membersJudged=30` · rule paragraph **true**, all six rows, "Black List: 1–6 of 6
          players". Byte-identical to fix round 2.
        · **D, perfect clan** — `weekNumbers=[21,22,23,24] rows=0 membersJudged=30` ·
          ShieldCheck · rule paragraph **true**, "Nobody is on the Black List — none of the
          30 players judged missed 2 or more of the weeks they played." Byte-identical to
          fix round 2.
    31. `npm run build` exits 0, TypeScript clean, route table unchanged; `npm run lint` →
        10 problems (9 errors, 1 warning), baseline, zero hits in any owned file.
        `git status --porcelain` clean of scratch files. ✅
  escalations:   # fix round 1 — t5's living docs, NOT edited (docs_touched for t3 is [])
    - "docs/user-guide.md has one falsified CLAIM and one falsified COUNT, plus moved
      citations. **(a) `:244-245` — 'the exact count for one player is in the tooltip on
      their Missed Weeks cell' is now wrong twice over**: the count is visible text in the
      **Participation** cell, and the `title` moved there too. The guide should now say the
      table prints `8 / 15 keys · 3 weeks judged` under the percentage. **(b) `:256-263`
      'When it is empty — TWO different empty messages' is now THREE**, and the new middle
      one is the important one: weeks exist but `membersJudged === 0`, 'Nobody can be judged
      yet — N weeks are fully imported…' (`components/BlackListTable.tsx:163`). **(c)** the
      good line `:245` 'Do not compare two players' key totals directly' is no longer
      guide-only — the app's own header says it, which is worth recording as a
      cross-check. **(d) `:229` 'prints the actual week numbers'** — still true, but they
      are now `W`-prefixed. Citations to re-point: `:122` `PerformanceTable.tsx:217`→`:245` ·
      `:125` `BlackListTable.tsx:93`→`:134` · `:203` `BlackListTable.tsx:51`,`:56`→`:76`,`:84` ·
      `:261` `:118`→`:174` · `:263` `:110`→`:153`."
    - "docs/reference/design-system.md citations that moved under this round (content still
      true): `:55` `PerformanceTable.tsx:136`→`:150` (`:80` for `isTotal` is unchanged) ·
      `:56` `PerformanceTable.tsx:141`→`:155` · `:62` `PerformanceTable.tsx:259`→`:293`,
      `TotalPerformanceTable.tsx:144`→`:152`, `BlackListTable.tsx:131`→`:189` · `:66`
      `PerformanceTable.tsx:123`→`:137`, `BlackListTable.tsx:33`→`:47`
      (`TotalPerformanceTable.tsx:51` and `ClashTable.tsx:60` unchanged).
      **One thing to ADD, not just re-point:** the Pagination entry's page-index rule now
      has two halves, and only one of them was written down. Clamp-never-reset is right for
      a WEEK change; a reader-initiated change (search, sort, tab) resets to page 1 in the
      event handler, because the clamp is a no-op when the shrunken list still contains the
      current page. Same sentence is wanted in `.claude/rules/ux.md`, whose page-index
      paragraph currently states only the clamp half."
    - "docs/project-map.md:56 — `components/PerformanceTable.tsx:123`→`:137` and
      `components/BlackListTable.tsx:33`→`:47` for the participation-tier debt bullet.
      Still four copies; this round added none."
    - "`label` is now passed at all three of this task's `<Pagination>` call sites but NOT
      at t4's two (`ClashTable`, `RosterTable`). Those two are alone on their pages, so
      the unlabelled 'Pagination' landmark is unambiguous there and nothing is broken —
      but if uniformity is wanted it is a one-prop change in t4's files, not mine."
    # --- fix round 2 ---
    - "FIX ROUND 2 — two living-doc statements are now imprecise in the same way, and both
      are t5's. `components/Pagination.tsx`'s header note 1 and `.claude/rules/ux.md`'s
      page-index paragraph both say that correcting the page index in an effect 'trips
      `react-hooks/set-state-in-effect`, which is an error here'. **Measured false for
      every consumer of `usePagination`**: the rule cannot follow a setter through a
      custom hook's return value, so an effect-based reset in `ClashTable`,
      `RosterTable`, `PerformanceTable`, `TotalPerformanceTable` or `BlackListTable`
      passes lint at baseline. It remains true for a component holding its own
      `useState`. The reason to avoid the effect is unchanged and sufficient — it commits
      and paints a wrong frame first — but the sentence should not promise a guardrail
      that is not there. `components/Pagination.tsx` is t2's file and `.claude/rules/ux.md`
      is t5's; neither was edited."
    - "FIX ROUND 3 — t5 has already re-synced its docs against fix round 2, and this round
      shifts `components/BlackListTable.tsx` again: **+4 lines** from old `:64` (the new
      `anyoneJudged` const and its comment) and **+12 lines** from old `:82` (that plus the
      eight-line comment explaining the gate). Anything cited above old `:64` is untouched.
      Re-point, all verified by re-reading the target line:
      `docs/user-guide.md:134` `:133`→`:145` · `:230` `:76`,`:84`→`:80`,`:96` ·
      `:278` `:133-139`→`:145-151` · `:299` `:172-176`→`:184-188` ·
      `:303` `:161-167`→`:173-179` · `:309` `:151-156`→`:163-168` ·
      `docs/reference/design-system.md:67` `BlackListTable.tsx:189`→`:201`.
      Unchanged and still resolving: `design-system.md:77` and `project-map.md:56`, both
      `BlackListTable.tsx:47` (the participation tiers, above the edit)."
    - "FIX ROUND 3, one CONTENT note for t5 — `docs/user-guide.md:230` says the Black List
      'states these live values in its own header'. Still true, but the header is now
      conditional: the listing-rule sentence ('Listed at N or more missed weeks inside the
      M-week window…') appears only once at least one player has been measured. In the
      first-import / post-Reset state the header is just the title and the what-counts-as-a-
      miss line, and the hourglass row carries the explanation instead. Worth one clause
      there so a reader who cannot find the sentence does not think it is a bug."
    - "FIX ROUND 2 — `.claude/rules/ux.md`'s page-index rule should gain the second half
      it is missing, now that all four paginated surfaces implement it: reset to page 1
      on a change the READER asks for (search, sort, tab, member filter), clamp-don't-reset
      on a change the APP makes (a week swap). And it is worth naming the one case where
      the reset cannot be an event handler — `TotalPerformanceTable`, whose filter controls
      live in its parent — together with the render-phase pattern used there and the reason
      it must key on the reader's own state rather than on the incoming rows array."

- id: t4
  summary: Paginate the clash Player Breakdown and the /members Roster; extract the roster into a client leaf without breaking force-dynamic
  specialist: ui-design-specialist
  owns:
    - components/ClashTable.tsx
    - components/RosterTable.tsx       # new
    - app/members/page.tsx
  depends_on: [t2]
  docs_touched: []
  claimed_by: "ui-design-specialist (t4)"
  state: done   # fix round 1 landed: H3, M6, M8, L1 + t2's `label` prop at both call sites
  fix_round:   # 2026-08-17, after UX review — H3 + M6 + M8 + L1. No file outside `owns` touched;
               # app/members/page.tsx needed no change this round and was not edited.
    - "H3 — the page index no longer survives a reader-initiated change. `view.setPage(1)`
      now runs in the search input's `onChange` (`components/ClashTable.tsx:127`) and as the
      last statement of `onSort` (`:79`). Both are EVENT handlers, so there is no
      `react-hooks/set-state-in-effect` exposure, and the week-change behaviour is
      untouched — the clamp inside `usePagination` still folds an out-of-range page in and
      nothing resets on a week swap. The distinction is written out in the comment above
      `usePagination` (`:55-70`): a week change is done TO the reader, a search or a sort is
      asked FOR by them, and only the second one starts at the top."
    - "H3, structural — `onSort` moved from `:36` to `:73`, below `const view =
      usePagination(sorted)` (`:71`). Purely so the handler reads in declaration order
      rather than closing over a `const` declared 35 lines later; behaviour identical."
    - "M6 — the clash card sizes to its content again. `components/ClashTable.tsx:117`:
      `xl:h-full` → `xl:max-h-full`, plus `xl:self-start`; the scroll wrapper (`:135`) goes
      `xl:flex-1` → `xl:flex-auto`. `xl:flex xl:w-full xl:flex-col xl:overflow-hidden`,
      `xl:min-h-0`, `xl:overflow-y-auto` and the sticky thead all STAY.
      `components/ClashDetailView.tsx` was NOT touched and needed no change — the fix is
      entirely inside the card. Why each of the three: `align-items: stretch` on the parent
      flex row is what forced full height, so dropping `xl:h-full` alone would have changed
      nothing (`xl:self-start` is the actual fix); `xl:max-h-full` keeps the card from ever
      exceeding the locked viewport, because ten rows do NOT fit on a short xl laptop
      (~510 CSS px of card against ~254 px of space at 1366x768) and without the cap the
      page's own `xl:overflow-hidden` would clip rows with no scrollbar anywhere; and
      `flex-auto` (`flex: 1 1 auto`) rather than `flex-1` (`flex: 1 1 0%`) gives the scroller
      a content-based flex basis, which is what makes the now-auto-height card's intrinsic
      height equal the height of its rows. Emitted CSS verified in the built stylesheet, not
      just in source: `.xl\:self-start{align-self:flex-start}`,
      `.xl\:max-h-full{max-height:100%}`, `.xl\:flex-auto{flex:auto}`, all under
      `@media (min-width:80rem)`."
    - "M8 — `components/RosterTable.tsx:115-135` gains a `colSpan={8}` empty row, same shape
      as `components/BlackListTable.tsx`'s (`<td className=\"px-5 py-10 text-center\">` →
      `<span className=\"inline-flex items-center gap-2.5 text-sm text-muted\">` + `Inbox`
      `size={18}` `text-gold`) and the same destination and link styling as
      `app/page.tsx:103-114`'s empty-state note. New imports: `Link` from `next/link` and
      `Inbox` from `lucide-react` (`:17-18`). Copy verbatim: **\"No players yet — the roster
      builds itself from imported clash weeks. Add one from Clan Settings → Import data.\"**
      with `Clan Settings → Import data` linking to `/settings`. Connected-but-empty, not
      read-only and not demo: it names the missing first import and nothing else."
    - "L1 — `components/ClashTable.tsx:189` now renders the quoted term only when there IS
      one (a `query.trim() ? …  : \"\"` conditional around the interpolation), so a genuinely
      empty week reads `No players match.` instead of `No players match “”.`. Same guard shape as
      `components/TotalPerformanceTable.tsx:137`; `query.trim()` rather than a bare `query`
      so it agrees with the `emptySearch` test three lines' worth above it (`:90`), which
      already treats a whitespace-only box as no search."
    - "t2 dependency — `label` added at both call sites: `label=\"Player Breakdown\"`
      (`ClashTable.tsx:204`) and `label=\"Roster\"` (`RosterTable.tsx:142`). Table names, not
      finished aria-labels, per t2's prop contract. Nothing else about either call site
      changed; the `pageCount === 1` and `aria-disabled` changes inside `Pagination` needed
      no call-site work."
    - "Confirmed unchanged by this round (the reviewer verified them and they were not
      disturbed): `app/members/page.tsx` in its entirety, incl. `force-dynamic` at `:15`;
      `<tbody aria-busy={pending}>` (`ClashTable.tsx:161`, still the broad `pending`);
      `skeletonRowCount(view.pageRows.length)` (`:94`); the `emptySearch` carve-out (`:90`);
      the active/former/tracked `useMemo` over the whole `rows` prop
      (`RosterTable.tsx:40-43`); the Former pill's `text-muted`; both `<Pagination>`
      placements, still after `</table>` (`:194`/`:200` and `:137`/`:142`)."
  changelist:   # line numbers re-resolved after fix round 1
    - components/ClashTable.tsx (208 lines) — imports `Pagination`/`usePagination`
      (`:12`); `const view = usePagination(sorted)` (`:71`); rows render
      `view.pageRows` (`:163`) with `view.offset + i + 1` in the `#` column
      (`:167`); `skeletonRowCount(view.pageRows.length)` (`:94`);
      `<Pagination>` (`:200`) as a sibling of the scroll wrapper, after
      `</table>` (`:194`). Untouched: `<tbody aria-busy={pending}>` (`:161`,
      broad `pending`) and the `emptySearch` carve-out (`:90`). The section's
      viewport-lock classes DID change in fix round 1 — see M6 above.
    - components/RosterTable.tsx (new, 145 lines) — `"use client"` on line 1;
      exports `RosterRow` (`:26`) and `RosterTable` (`:37`). Holds the whole
      `.card-flush` section: header + count line, the 8-column table, the
      connected-but-empty row (`:115-135`, fix round 1) and `<Pagination …>`
      (`:142`) after `</table>` (`:137`). The Former pill is `text-muted`
      (`:93`). Counts are `useMemo`'d over the WHOLE `rows` prop (`:40-43`),
      never `view.pageRows`.
    - app/members/page.tsx — still a server component, still `force-dynamic`
      (`:15`, comment intact and extended by one sentence). Now imports
      `RosterTable`/`RosterRow` instead of `MemberCell`/`SectionTitle`, types
      `summaries` as `RosterRow[]` (`:23`), drops the local `activeCount`/
      `formerCount` (they moved into the leaf), and renders `<RosterTable
      rows={summaries} />` (`:69`).
  assumptions:
    - The active/former/tracked counts are derived INSIDE the leaf from the full
      `rows` prop rather than passed as two extra props from the page. Two props
      can desync from the array they describe; one derivation cannot, and it makes
      "whole roster, not the page" structurally true instead of a convention.
    - The `emptySearch` carve-out keeps testing `sorted.length === 0` (the whole
      filtered list), not the page slice. Because the clamp is derived on read, an
      empty page can only occur when the filtered list itself is empty, so the two
      tests coincide — but the filtered-list form is the one that stays correct if
      the clamp ever changes.
    - `<Pagination {...view}>` passes `setPage` along as an ignored extra prop.
      That is deliberate per t2's instruction (spread, don't hand-pick, so the
      `pageSize`-derived range end cannot desync); TS accepts it and a function
      component silently drops unknown props.
    - The `force-dynamic` comment gained one sentence (extraction does not make the
      page static) partly so the declaration STAYS on line 15 — `.claude/rules/
      rendering.md`'s worked example cites `app/members/page.tsx:15` and that file
      is owned by nobody in this order.
    - "SUPERSEDED by fix round 1 (M8): the roster no longer renders headers over a void.
      It has a `colSpan={8}` connected-but-empty row like every other table in this order.
      The original judgement — pre-existing, out of scope — was defensible at the time and
      is recorded here so the reversal is legible, not silent."
    - "FIX ROUND — `xl:max-h-full` + `xl:self-start` was chosen over simply deleting the
      card's xl flex classes and letting it flow. Deleting them is what 'sizes to content'
      sounds like, but it removes the internal scroller too, and on a 1366x768 xl viewport
      the ten-row card (~510 CSS px) is taller than the space the locked page gives it
      (~254 px) — the page's `xl:overflow-hidden` would then clip six rows with no
      scrollbar on the page and none in the card. The cap keeps the pre-order behaviour as
      the fallback and only removes the stretch."
    - "FIX ROUND — the M6 fix is reasoned from the box model and verified as far as emitted
      CSS; it was NOT observed in a browser (no browser in this environment). The three
      utilities exist in the built stylesheet under the xl media query, and the layout
      argument is spelled out in the comment at `components/ClashTable.tsx:97-116` so a
      reader with a browser can check it against a stated prediction: at 1920x1080 the card
      ends after its last row and the ~300px band becomes page background BELOW the card;
      at a short xl viewport the card fills the space and scrolls internally as before."
    - "FIX ROUND — `components/ClashTable.tsx:130` still carries `placeholder:text-faint` on
      the search box. Pre-existing, not flagged by this review round, and a placeholder is
      the one arguable decorative case; left alone rather than smuggled into a fix round."
  escalations:   # unowned files — reported, not touched (t5 owns all five living docs)
    - "`.claude/rules/ux.md`'s page-index rule now states only half of it. It reads 'clamp it
      on read, never reset it on a week change, never correct it in an effect' — all three
      still true — but H3 adds the missing clause: DO reset to page 1 on a change the reader
      asked for (search, sort), from the event handler. Landed in `ClashTable` and, per the
      brief, in t3's overview tables; the rule should name both halves and the reason
      (who initiated the change), or the next contributor reads the existing sentence as a
      blanket never-reset. Unowned by t4."
    - "`docs/reference/design-system.md`'s Pagination entry wants the same sentence, plus one
      about sizing: the week-pending contract now covers 'the page index is chrome' AND
      'reader-initiated changes reset it'. Separately, if that entry or any other doc
      describes the clash Player Breakdown as filling the locked viewport, M6 falsifies it —
      the card now sizes to its content under an `xl:max-h-full` cap. Unowned by t4."
    - "`components/MemberCell.tsx`'s Former pill still carries the `text-faint` contrast
      failure that was fixed on the Roster's own pill. Unowned; confirmed as a follow-up by
      the reviewer, not fixed here."
    - "M7 (no search, no sort and 10 rows on the Roster, so finding a clanmate is a
      three-page hunt) is DEFERRED by explicit instruction and was not implemented."
  done_when:
    1. `npm run build` exits 0 and the route table shows `ƒ /members` — a `○` means the extraction broke the page and the task is NOT done. Paste the table. Lint at baseline.
    2. `grep -c "force-dynamic" app/members/page.tsx` → 1, and the load-bearing comment above it is intact (paste `:8-15`).
    3. `grep -nE "searchParams|useSearchParams" app/members/page.tsx components/RosterTable.tsx` → the only match is prose inside the guard comment; paste every hit. Positive control `grep -n "dynamic" app/members/page.tsx` → exit 0.
    4. Line 1 of `components/RosterTable.tsx` is `"use client"`; `grep -n "use client" app/members/page.tsx` → exit 1. Paste both.
    5. Pagination outside `<table>` in both files: `file:line` of each `<Pagination` vs its `</table>`.
    6. `ClashTable`'s placeholder count derives from the page slice — paste the `skeletonRowCount(...)` line — and `<tbody aria-busy={pending}>` still uses the broad `pending`. `components/Skeleton.tsx` unmodified.
    7. The `emptySearch` carve-out still holds: state its `file:line` and describe in one sentence what it does when the search matches nobody on page 3.
    8. The Roster's "Former" pill moves to `text-muted` (it was `text-faint` at `app/members/page.tsx:104` — an AA failure on a label the reader needs). Paste the new line; `grep -n "text-faint" components/RosterTable.tsx` → exit 1.
    9. `grep -nE "#[0-9a-fA-F]{3,8}" components/RosterTable.tsx` → exit 1, positive control on `app/globals.css`.
    10. The active/former/tracked count line still reflects the WHOLE roster, not the current page — paste the line and its source expression.
    # --- fix round 1, appended 2026-08-17; #1-#10 above re-run and still hold ---
    11. (H3) `grep -n "setPage(1)" components/ClashTable.tsx` → exactly two call sites, one in the search `onChange` and one in `onSort`; paste both with their `file:line`. `grep -n "useEffect" components/ClashTable.tsx` → exit 1 (the reset must be an event handler, not an effect). ✅ `:79` (onSort) and `:127` (onChange); no `useEffect` in the file.
    12. (H3) The week-change path is unchanged: no `setPage` call anywhere near `useWeekPending`, and `usePagination` is still called with the filtered+sorted array and nothing else. State the `file:line` of the `usePagination` call and confirm the only two `setPage` callers are the two handlers plus `onPageChange={view.setPage}`. ✅ `:71`; the third `setPage` reference is the `<Pagination>` prop at `:202`.
    13. (M6) Grep the CLASS ATTRIBUTES, not the file — the comment above the section names the old utilities on purpose, so a bare grep for them exits 0 and proves nothing. `grep -nE 'className="[^"]*(xl:h-full|xl:flex-1)' components/ClashTable.tsx` → exit 1; the same regex with `xl:max-h-full|xl:self-start|xl:flex-auto` → exit 0 with the two lines (`:117` section, `:140` scroller), pasted. `git diff --name-only -- components/ClashDetailView.tsx` → empty. ✅ all three.
    14. (M6) The three utilities are emitted CSS, not just source text: after the build, grep the built stylesheet for each. ✅ `.xl\:self-start{align-self:flex-start}`, `.xl\:max-h-full{max-height:100%}`, `.xl\:flex-auto{flex:auto}`, under `@media (min-width:80rem)`.
    15. (M8) `grep -n "colSpan={8}" components/RosterTable.tsx` → one hit, and its copy pasted verbatim. The copy must name a first import and must contain no read-only/permission wording and no demo-mode wording (walk it and say so). The link target is `/settings`. ✅ `:118`.
    16. (M8) `grep -nE "#[0-9a-fA-F]{3,8}|text-faint" components/RosterTable.tsx` → exit 1, positive control on `app/globals.css` → exit 0. ✅ 23 hex matches in the control.
    17. (L1) With an empty search box and zero rows, the empty cell renders no quote marks. State the `file:line` and the guard expression; confirm it matches `components/TotalPerformanceTable.tsx:137`'s shape. ✅ `components/ClashTable.tsx:189`.
    18. (t2 seam) `grep -n "label=" components/ClashTable.tsx components/RosterTable.tsx` → `label="Player Breakdown"` and `label="Roster"`, both table names rather than finished aria-labels. ✅ `:204` / `:142`.
    19. `npm run build` exits 0 with `ƒ /members` still in the route table; lint at the 9-errors-1-warning baseline with zero hits in the three owned files. ✅ (mid-flight, t3 editing in parallel — the integrator's count is authoritative.)

- id: t5
  summary: Doc-sync — the living docs this order falsifies, every citation re-resolved against landed code
  specialist: ui-design-specialist
  owns:
    - docs/reference/design-system.md
    - docs/user-guide.md
    - docs/project-map.md
    - docs/engineer-onboarding.md
    - .claude/rules/ux.md
  depends_on: [t1, t2, t3, t4]
  docs_touched: [all five owned]
  claimed_by: "ui-design-specialist (t5)"
  state: done   # PASS 3 completed 2026-08-17 — see `pass3` below
  pass3:   # 2026-08-17, after t3's `anyoneJudged` edit. Three docs touched; no code file.
           # Build exit 0, route table unchanged; lint 10 problems (9 errors, 1 warning) = baseline.
    - "TRIGGER — `components/BlackListTable.tsx` gained `anyoneJudged` (`:67`) and the rule
      paragraph's gate moved from `!noWeeks` to it (`:94`). File 198 -> 210 lines, so
      everything past `:67` shifted +4 and everything past the paragraph +12."
    - "CITATIONS — all seven supplied by t3 were re-read against their targets before
      applying; **all seven verified.** `user-guide:134` `:133`->`:145` ·
      `user-guide:230` `:76`,`:84`->`:80`,`:96` · `user-guide:278` `:133-139`->`:145-151` ·
      `user-guide:299` `:172-176`->`:184-188` (ShieldCheck confirmed) ·
      `user-guide:303` `:161-167`->`:173-179` (Hourglass confirmed) ·
      `user-guide:309` `:151-156`->`:163-168` (Inbox confirmed) ·
      `design-system:67` `:189`->`:201`.
      **TWO MORE were stale and were NOT on the supplied list** — both bare `:NNN` refs,
      which is the same class that was invisible to the resolver in pass 2:
      (a) `design-system.md:75` cites `BlackListTable.tsx:70` for the card's `<section>`
      className — that line sits BELOW `anyoneJudged` at `:67`, so it shifted to `:74`;
      the +4 band was easy to miss because the visible edit is 27 lines further down.
      (b) `user-guide.md:278`'s two bare refs inside the sentence: the `title` `:131`->`:143`
      and the comparison-warning `:87`->`:99`.
      Confirmed unmoved as predicted: `BlackListTable.tsx:47` (participation tiers, cited by
      `design-system:77` and `project-map:56`) sits above `:67`. Full re-resolve after the
      pass: 211 citations, zero out-of-range, zero missing."
    - "CONTENT — `docs/user-guide.md`'s rule section now describes a header in TWO parts and
      says the second is conditional by design. Reworded clause, verbatim: the subtitle is
      present whenever any week is fully imported (`:80`); the listing rule appears **only
      once at least one player has actually been measured** (`:96`, gated `:94`), and
      **'If you don't see that sentence, nothing is wrong'** — it is hidden on the two
      screens where it would be nonsense, because with a single fully imported week it
      would read 'Listed at 2 or more missed weeks inside the 1-week window', a rule you
      cannot break, directly above a message saying nobody can be judged yet. Import a
      second week and it appears.
      The three empty states now each say whether the rule paragraph is with them: present
      only in the green-shield all-clear (people were measured, so the bar they cleared is
      worth stating), absent in both the hourglass and the inbox branches — with the note
      that the hourglass message carries the one threshold that matters on that screen and
      the inbox branch's subtitle reads 'No fully imported week yet' instead of a week list.
      One knock-on the brief did not name: the guide's 'the app now says the key totals
      warning on screen too' claim is scoped, because that warning is the last clause of
      the rule paragraph (`:99`) and therefore shares its visibility."
    - "`react-hooks/set-state-in-render` — VERIFIED before writing, not taken on report.
      `npx eslint --print-config components/TotalPerformanceTable.tsx` reports BOTH
      `react-hooks/set-state-in-effect` and `react-hooks/set-state-in-render` at severity
      `2`. It earns the words, and for a sharper reason than 'also blind': the shipped
      render-phase adjustment at `TotalPerformanceTable.tsx:113-117` **is** a set-state
      during render, the exact thing that error-level rule exists to flag, and lint is at
      baseline with zero hits in that file. So the gap is demonstrable from the shipped tree
      without writing any bad code. Added to `docs/engineer-onboarding.md` hazard 9 as a
      paragraph with the reproducible command, and framed so nobody reads it as 'the render
      form is also suspect': the code is correct (React's documented pattern, idempotent
      setter, terminates in two passes) — the linter is simply not what tells you so."
    - "`design-system.md:54`'s `WeekTransitionProvider` distinction left exactly as written,
      per the reviewer's two ESLint probes."
    - "Re-swept the four content clauses over the same 43-file corpus after the edits — all
      still exit 1 ('two empty messages/states', 'tooltip on their Missed Weeks', 'last four
      tracked weeks', `<nav aria-label=\"Pagination\">`)."
  rerun:   # 2026-08-17, second pass. The five docs only; no code file touched.
           # Build exit 0 (route table unchanged, `ƒ /` `ƒ /members` `○ /import`);
           # lint 10 problems (9 errors, 1 warning) = baseline, zero hits in docs.
           # `git status --porcelain` = the 11 code files from t1-t4 + these five docs + this ledger.
    - "THE FALSIFIED CLAIM, corrected in both places it was live. `.claude/rules/ux.md`
      (Loading/pending bullet) and `docs/reference/design-system.md` (Pagination entry)
      both said an effect-based page reset 'trips `react-hooks/set-state-in-effect`,
      which is an error here' / 'is an active lint **error** in this project, so it would
      not ship'. Both now give the REAL reason — an effect commits and paints one wrong
      frame (`21-22 of 22`) before correcting itself — and both state outright that lint
      will NOT stop you, because the rule cannot follow a setter arriving through a
      CUSTOM HOOK's return value, so none of the five `usePagination` consumers is
      guarded. Both cite t3's measurement at `components/TotalPerformanceTable.tsx:88-104`
      and match `components/Pagination.tsx:14-17`'s wording. Both also say explicitly that
      the doc previously claimed lint was the guardrail, so a contributor who remembers the
      old sentence sees it retracted rather than quietly gone.
      Deliberately NOT flattened: `design-system.md:54` still says the rule forbids the
      effect inside `WeekTransitionProvider` — TRUE there, because that component holds its
      own `useState`, which is the case the rule can see. A disambiguating clause was added
      there pointing at the Pagination entry, so `:54` and the Pagination entry cannot read
      as contradicting each other.
      A third instance is live in THIS ledger's context pack (`:48`, and quoted again in
      t2's escalation at `:364`). The pack is immutable after approval — recorded as wrong,
      not edited. It was used as the positive control for the sweep below."
    - "docs/reference/design-system.md — the **Pagination** entry rebuilt (it was wrong in
      six places) and the **Ghost icon button** entry given its third form.
      · The outer element is a `<div>` (`Pagination.tsx:232`), not a `<nav>`; the `<nav>`
        (`:254`) wraps only the button group. Both halves of why that split is load-bearing
        are stated: the wrapper's element type never changes (so the live region cannot be
        re-inserted already populated — the WeekAnnouncer hazard), and the nav can vanish
        without taking the summary with it.
      · NEW bullet: at `pageCount === 1` the button group and the `<nav>` are dropped
        (`:253`), with the reason the disabled-over-hidden carve-out does not cover it —
        that carve-out rests on the position being TRANSIENT, which one page is not.
      · Native `disabled` is gone: `aria-disabled` (`:266`, `:281`) + no-op guards as the
        first statement of each handler (`:263`, `:278`), because a disabled button holding
        focus drops focus to `<body>`. **`TopBar.tsx:129-144` is now named as the UNFIXED
        twin, not as the pattern to copy**, and the entry says so in those words.
      · NEW bullet for `label?: string` — the human name of the table, naming the landmark
        (`:255`) and prefixing the live region (`:248`), with the rule for when to pass it.
      · The page-index rule now has BOTH halves: clamp-never-reset for a change the APP
        makes (a week change), reset-to-page-1 from the event handler for a change the
        READER initiates (search / sort / tab / filter), with the worked reason the clamp
        cannot substitute (page 3 of 3 is still in range after 30 rows become 22). The
        Total tab's render-phase adjustment is named as the one prop-driven case.
      · NEW bullet on the layout consequences, which is where **M6** lands: `/` no longer
        locks to the viewport (`app/page.tsx:94`, 2+1 grid at `2xl` not `xl`, `:136`), and
        **the clash Player Breakdown no longer fills the locked region** — `xl:max-h-full`
        + `xl:self-start` + `xl:flex-auto` (`ClashTable.tsx:117`, `:140`). No doc described
        it as filling that region (swept), so this is prevention, not repair.
      · **Ghost icon button** now documents THREE forms with the rule for choosing between
        them: bare `hover:` (unconditionally live — `MemberHistoryTable.tsx:156`);
        `enabled:hover:` + `disabled:opacity-40` (native attribute present — TopBar's
        chevrons, still correct for that file); and `aria-disabled:opacity-40` +
        `aria-disabled:hover:*` resets (must stay focusable — `Pagination.tsx:107-110`),
        including the trap that form 2 silently stops gating the moment the native
        attribute is dropped, and the specificity argument (0,3,0) vs (0,2,0)."
    - "docs/user-guide.md — the two hand-checkable sections rewritten against the new rule.
      · NEW subsection **'A half-imported week is never judged'** before the rule table,
        in the admin's terms: between the Hydra and the Chimera import the Black List
        behaves exactly as if that week did not exist, reaches one week further back to
        keep its four-week window, and prints the weeks it judged. Names both harms the
        owner's decision was made to stop (manufactured misses on a public board; a real
        offender vanishing because the roster was read off the half-imported week).
      · The rule table's first row is now 'the last **4** weeks that are **fully imported**
        (both clashes)'. Step 1 of the walkthrough carries a worked both-ways example
        (window `21,22,23,24` complete vs `20,21,22,23` mid-import — four weeks either way).
        Step 2 now says the roster comes from the newest **judged** week and explains when
        that differs from `/members`' Active.
      · Weekly routine step 6 gained 'do both imports before you read the Black List'.
      · 'It does not move with the week picker' now says 'trailing window of fully imported
        weeks' rather than 'every tracked week's trailing window'.
      · **Two empty messages → THREE**, each with its icon, verbatim from the shipped
        component (`BlackListTable.tsx:172-176` shield / `:161-167` hourglass /
        `:151-156` inbox), with the hourglass explicitly marked as NOT an all-clear and
        noted as the state that used to render the green shield.
      · `:244-245`'s FALSE claim removed: the explanation is no longer 'the tooltip on
        their Missed Weeks cell'. The Participation cell is now two lines (`:133-139`),
        the `title` moved onto that same cell (`:131`) and is described as the redundant
        long form (unreachable by keyboard, absent on touch), and the guide now records
        that the app carries the 'key totals are not comparable' warning itself (`:87`).
      · The pagination paragraph went from four bullets to five: arrows *dim* rather than
        grey out and keep their place in the Tab order; a one-page table shows no arrows
        at all; and the reader-initiated reset is stated beside the week-change non-reset,
        with the 'matches 21 and 22' example so the two do not read as contradicting."
    - "docs/project-map.md — the `lib/` read-path bullet now records the fully-imported
      window (`isWeekComplete` `lib/compute.ts:350`, the filter-then-slice at `:378-380`),
      the roster-off-the-newest-judged-week gate (`:401-403`), and `membersJudged`
      (`lib/types.ts:160`) with what it is for. Two NEW 'Open unknowns' bullets: TopBar's
      focus defect (unowned, with the corrected form to copy instead) and README's two
      stale facts. Component count re-measured: still **26** (`ls components/*.tsx | wc -l`)."
    - "docs/engineer-onboarding.md — hazard 9 ('lint exits 1 by design') gained its
      corollary, which is the transferable half of this round: **a lint run at baseline is
      not evidence that what you wrote is correct**, with `usePagination` as the worked
      case and both measurements. Hazard 14 re-verified a second time: the fix round
      touched `RosterTable` (the `colSpan={8}` empty row, `:118`) and did NOT touch
      `app/members/page.tsx`; `force-dynamic` is still line 15."
    - "CITATIONS — every `file:line` reference into `app/`/`components/`/`lib/` across the
      five docs re-resolved with the scratchpad script (`t5-citations.mjs`) and each target
      line read back; the ~15 bare `:NNN` refs the resolver cannot see were walked by hand.
      **44 were stale and are corrected**, spread 23 / 13 / 8 across design-system,
      user-guide and project-map; **engineer-onboarding had zero stale** (all 30 of its
      citations, including `app/members/page.tsx:15`, still resolve). Post-pass: 210
      resolver-visible citations, zero out-of-range, zero missing files.
      (Pass 3 moved nine more; see `pass3`. Running total across both passes: **53**.)
      Two failure modes worth naming for the next doc-sync. (a) `Pagination.tsx` went
      191 → 291 lines in fix round 1, so EVERY citation into it moved — the later
      comment-only edit moved nothing, so the whole drift is from one change. (b) A RANGE
      citation can rot by growing a hole in the middle without going out of range:
      `lib/constants.ts:20-34` still resolves to real lines, it just no longer contains the
      constant it was cited for. Only reading the target catches that."
    - "SWEEP — corpus built as `git ls-files --cached --others --exclude-standard \"*.md\"`
      MINUS `docs/tasks/` and `docs/build-log.md` (43 files; the ledger quotes every
      falsified claim verbatim, so including it guarantees false positives). Seven clauses
      swept, all exit 1 on the corpus and all exit 0 on the ledger as the positive control:
      lint-as-guardrail (affirmative phrasing only — the negated mentions in three docs are
      intentional and were counted separately), `<nav aria-label=\"Pagination\">` as the
      outer element, prev/next 'go disabled at the ends', 'two empty messages/states',
      'tooltip on their Missed Weeks', 'last four tracked weeks' / 'every tracked week's
      trailing window', and TopBar-as-precedent. Stale component counts: the only corpus
      hit is `docs/project-map.md:58`, which is the escalation note quoting README."
  changelist:   # FIRST RUN (2026-08-17, before the fix round) — superseded in the places `rerun` names
    - docs/reference/design-system.md — two NEW Patterns entries: **Pagination**
      (seam file + its three contract exports + the additive `paginate`; the placement
      rule; the derived-on-read clamp and why an effect is both wrong and unshippable
      here; the disabled-at-the-ends carve-out with the TopBar precedent; markup/tokens)
      and **Participation colour tiers** (the four-file hand-copy, flagged as debt).
      The **Ghost icon button** entry now records t2's deliberate `enabled:hover:`
      deviation as a correction, not drift, so the next contributor does not "fix" it
      back. Citations repaired: `lib/compute.ts:36`→`:46`, `PerformanceTable.tsx:79`→`:80`,
      `:128`→`:136`. Week-pending chrome list gained pagination; `skeletonRowCount`'s
      "outgoing rows" now says it means one page, with both caller lines.
    - docs/user-guide.md — NEW `## The Black List` section (rule as a 5-row table of
      named constants + a 4-step hand-check, absence-is-not-a-miss, per-member judged
      counts and the moving denominator, "does not move with the week picker", the two
      opposite empty states, what it is not). NEW ten-rows-a-page paragraph under
      "The pages". Home row now names the Black List and says the page scrolls.
      A Black List row added to the Participation table. 20 citations re-pointed.
    - docs/project-map.md — component count 23 → **26** (measured), the three new files
      named, `Pagination.tsx` called out as shared by five tables. `lib/` read-path
      bullet now splits week-scoped vs all-weeks derivations and names
      `getBlackList` (`lib/compute.ts:349`), the constants and the three types.
      Open-bug citations `:276`→`:286`, `:162`→`:172`. New "Open unknowns" bullet for
      the two hand-copied strings.
    - docs/engineer-onboarding.md — hazard 14 re-verified against the roster
      extraction and extended: `force-dynamic` is still `app/members/page.tsx:15`,
      the page is still a server component reading no `searchParams`, and the reusable
      shape (client state in a leaf, never a `?page=`) is now stated.
    - .claude/rules/ux.md — pagination added to the chrome that stays real through a
      week swap, plus the page-index rule (clamp on read, never reset on a week
      change, never an effect) and `getBlackList` → `BlackListTable` in the
      all-weeks list.
  assumptions:
    - `lib/compute.ts` line numbers shifted **+10 for every line past the import
      block** (t1 grew two import statements from 7 lines to 17). That accounts for
      14 of the corrected citations; each was re-read, not offset arithmetic.
    - `docs/user-guide.md:171`'s "on one screen" is a sweep false positive — it is the
      em-dash-vs-`0%` passage, not a claim about the overview's layout. Left as is.
    - The user guide's window example is phrased off "the newest tracked week is 24"
      rather than a fixed week list, because the live database has more weeks than the
      demo dataset and the table prints its own window anyway.
  escalations:   # unowned files, reported not fixed
    - README.md:197 says "21 UI components" — stale BEFORE this order (it disagreed
      with project-map's own 23) and now two counts behind. README.md is unowned.
      **Re-run: still unfixed; now also recorded in `docs/project-map.md`'s Open
      unknowns so it is not lost when this ledger is archived.**
    - README.md:56's `/` row lists the overview's contents and does not mention the
      Black List. Unowned. **Re-run: same, recorded in project-map alongside the count.**
    # --- re-run, appended 2026-08-17. Mentioned in the docs where a reader would
    #     otherwise be misled; NOT fixed, because none of these files is t5's. ---
    - "components/TopBar.tsx:129-144 — the native `disabled` focus defect on both week
      chevrons, unfixed. Named in THREE of t5's docs, always as the unfixed twin rather
      than as a precedent: `docs/reference/design-system.md`'s Pagination entry (which
      previously cited it as the pattern to copy — that sentence is gone),
      `.claude/rules/ux.md`'s new third hide-don't-disable case, and a new
      `docs/project-map.md` Open-unknowns bullet carrying the two-attribute-two-guard fix.
      TopBar is the week-transition seam and needs its own slice."
    - "`participationColor` hand-copied in four files (`ClashTable.tsx:52`,
      `PerformanceTable.tsx:137`, `TotalPerformanceTable.tsx:51`, `BlackListTable.tsx:47`).
      All four citations were stale and are corrected in both docs that carry them; the
      entries now record that the fix round added NO fifth copy. Still debt, not a defect."
    - "components/MemberCell.tsx's Former pill still carries the `text-faint` contrast
      failure that was fixed on the Roster's own pill. Unowned, unchanged, not newly
      documented — `.claude/rules/ux.md` already bans the token for anything the reader
      needs, which is the rule this violates."
    - "components/ClashTable.tsx:130's `placeholder:text-faint` — decorative, pre-existing,
      and t2's done_when #4 uses a sibling of it as a positive control. Left alone; the
      existing 'decorative only' carve-out in `.claude/rules/ux.md` already covers it."
  rerun_findings:   # things the fix round changed that neither the orchestrator's brief nor the integrator listed
    - "`docs/reference/design-system.md:56`'s two `skeletonRowCount` caller citations were
      BOTH stale and neither was on anyone's list: `PerformanceTable.tsx:141` → `:155` and
      `ClashTable.tsx:81` → `:94` (the latter had drifted onto a blank line). The claim
      itself — placeholder counts are one page, not thirty — is still true."
    - "`docs/reference/design-system.md:55`'s bare `:136` for `showSkeleton` in
      `PerformanceTable` is now `:150`. Bare `:NNN` refs are invisible to a
      `file:line` resolver, so they need a manual pass; there were nine of them in the
      Pagination entry alone, every one stale."
    - "`docs/user-guide.md`'s Participation and Trend tables carried FIVE stale component
      citations that no escalation mentioned, because the fix round moved code in files
      those rows point at for unrelated reasons: `ClashTable.tsx:57`→`:174`, `:58`→`:178`,
      `PerformanceTable.tsx:217`→`:279`, `RosterTable.tsx:68`→`:102`,
      `BlackListTable.tsx:93`→`:133`."
    - "`lib/constants.ts:20-34` (cited by BOTH `user-guide.md` and `project-map.md`) no
      longer spans the four thresholds: t1's fix round grew the `BLACKLIST_WINDOW_WEEKS`
      comment, pushing `BLACKLIST_MIN_WEEKS_PRESENT` out to `:38`. Corrected to `:19-38`
      in both. A range citation can rot by growing a hole in the middle, which no
      out-of-range check catches."
    - "`docs/project-map.md`'s `lib/types.ts:127`/`:140`/`:150` triple is off by one for the
      last two — `BlackListRow` is `:141` and `BlackListResult` is `:151`, because H2 added
      `membersJudged` plus its comment. Corrected."
    - "The integrator's flag that project-map's `:162` anchor for `deltaPct(...) ?? 0` is
      stale is **already resolved** — t5's FIRST run corrected it to `lib/compute.ts:172`
      and it resolves correctly today. Re-verified, no change needed. Recorded because the
      brief listed it as outstanding."
    - "`design-system.md:54`'s `react-hooks/set-state-in-effect` claim about
      `WeekTransitionProvider` is a THIRD instance of the string but is NOT falsified — the
      provider holds its own `useState`, the case the rule can see. Flattening every mention
      would have replaced one wrong claim with another; a disambiguating clause was added
      instead. This is the distinction t3's fix_round_2 note predicted t5 would need."
    - "No doc anywhere in the corpus described the clash Player Breakdown as filling the
      locked viewport, so M6 falsified nothing that was live. A positive statement of the
      new behaviour was added to `design-system.md` anyway, since the next contributor
      reading `ClashDetailView`'s lock would otherwise assume the old shape."
  known_blast_radius:   # grepped at plan time — the negative-existential check
    - docs/reference/design-system.md:55 cites components/PerformanceTable.tsx:79 and :128 — both move under t3. Patterns needs a Pagination entry; the chrome list ("table headers, search, sort") needs pagination added.
    - docs/user-guide.md:107 → ClashTable.tsx:50; :108 → PerformanceTable.tsx:174; :119 → app/members/page.tsx:86 (that `<th>` moves file entirely, to RosterTable.tsx) and :36; :135 → ClashTable.tsx:51. Plus a new section: what the Black List is, the threshold rule in plain words, and that it is all-weeks so the week picker does not change it.
    - docs/project-map.md:21 says 23 UI components — becomes 26. The lib/ bullet should name getBlackList.
    - docs/engineer-onboarding.md:374 — verify it still reads true after t4; correct if the extraction moved anything it cites.
    - .claude/rules/ux.md — the Loading/pending chrome list; plus one line on the pagination page-index rule (clamp, never reset, never an effect).
  done_when:
    1. Every `file:line` citation in the five owned files pointing into `app/`, `components/` or `lib/` is re-read and pasted with the target line beside it. Any that no longer resolves is corrected. List them all.
    2. `ls components/*.tsx | wc -l` → paste it; `docs/project-map.md` states the same number.
    3. Corpus grep for the stale component count over `git ls-files --cached --others --exclude-standard "*.md"` MINUS `docs/tasks/` and `docs/build-log.md` → exit 1. Paste the corpus-building command and a positive control.
    4. Variant sweep for paraphrases of the falsified claims (overview viewport-locked / internally scrolling; tables unpaginated) over the same corpus → zero live hits; list the terms swept.
    5. design-system.md Patterns contains a Pagination entry naming the seam file, the placement rule, the derived-clamp rule and why it is not an effect, and the disabled-at-the-ends carve-out.
    6. user-guide.md states the Black List rule in numbers a clanmate can check by hand, and says it does not move with the week picker.
    7. `git status --porcelain` shows only the five owned docs and this ledger moved.

## Ordering

```
wave 1 (parallel):   t1 ──┐      t2 ──┐
                          │           │
wave 2 (parallel):        └─► t3 ◄────┤      t4 ◄──┘
                                 │            │
integrator ──────────────────────┴────────────┘
                                 │
wave 3:                          t5
                                 │
                    flow-reviewer ∥ ux-specialist
```

## Integration

Run 2026-08-17 by `integrator`, after t1–t4 all reported `state: done`. t5 (doc-sync) is
still `pending` and runs next, per the wave-3 ordering above.

**Nothing was merged in the git sense** — the four slices landed in one working tree, so
integration was seam verification plus one authoritative build. **No file was edited to
resolve a seam**; every seam held as written.

**Authoritative verification, on the merged tree:**
- `npm run build` → exit 0. Route table: `ƒ /` · `ƒ /members` · `○ /import` · `○ /_not-found`,
  all four as required. Both data pages stayed dynamic.
- `npm run lint` → **10 problems (9 errors, 1 warning) — exactly the baseline.** Hits are
  confined to `.claude/scripts/statusline-cache.js`, `.claude/scripts/token-report.js` and
  `components/ImportPanel.tsx`. **Zero hits in any of the 11 files this order touched.**
  This supersedes every mid-flight per-task lint claim, including t4's unstable 10-vs-11.

**Seams verified:**
- **Pagination API, all five call sites identical**: `<Pagination {...view} onPageChange={view.setPage} itemLabel="…" />`
  at `PerformanceTable.tsx:259`, `TotalPerformanceTable.tsx:144`, `BlackListTable.tsx:131`,
  `ClashTable.tsx:154`, `RosterTable.tsx:109`. No site hand-picks props, so the
  `pageSize`-derived range end cannot desync. The spread's extra `setPage`/`pageRows` are
  dropped by `Pagination`'s destructuring and never reach the DOM — harmless, and uniform.
- **No `<Pagination>` inside a `<table>`** at any of the five: each sits after both `</table>`
  and the closing `</div>` of the `overflow-x-auto` wrapper, inside the `.card-flush` section.
  `PerformanceTable`'s two branches are mutually exclusive (`isTotal ?`), so exactly one
  control renders per card.
- **t1→t3 type seam**: `getBlackList(ds: Dataset): BlackListResult` (`lib/compute.ts:349`, one
  argument) → `app/page.tsx:50` → `BlackListTable({ data: BlackListResult })`. The three
  interfaces at `lib/types.ts:127/140/150` match the pinned contract field-for-field.
- **t2↔t4 flex seam**: `Pagination`'s nav carries `xl:shrink-0` (`Pagination.tsx:150`), which is
  live inside `ClashTable`'s retained viewport lock
  (`<section class="card-flush xl:flex xl:h-full xl:w-full xl:flex-col xl:overflow-hidden">`, `:84`)
  and inert on the now-unlocked overview cards. No conflict.
- **`components/Skeleton.tsx` unmodified** (`git status --porcelain`). Both
  `skeletonRowCount(...)` callers are fed a paginated slice: `PerformanceTable.tsx:141` and
  `ClashTable.tsx:81`, each `view.pageRows.length`.
- **2xl split agrees end to end**: container `grid grid-cols-1 gap-5 2xl:grid-cols-3`
  (`app/page.tsx:136`), Clan Performance `xl:h-full 2xl:col-span-2` (`:137`), Black List
  `xl:h-full` (`:142`). t4 touched nothing on the overview.
- **`force-dynamic` is still `app/members/page.tsx:15`**, so `.claude/rules/rendering.md`'s
  worked-example citation still resolves.
- Scope held: `git status --porcelain` lists only the 11 owned files plus this ledger.
  `app/globals.css`, `app/layout.tsx`, `components/Sidebar.tsx`, `components/MemberCell.tsx`,
  `components/ClashDetailView.tsx` untouched. `lib/compute.ts:162` left alone as instructed.

**Handed to review rather than fixed:**
1. **`participationColor` is duplicated in FOUR files, not three** — the integration brief
   undercounted it. `ClashTable.tsx:60` holds a fourth copy that **pre-dates this order**
   (absent from t4's diff), alongside `PerformanceTable.tsx:123` and
   `TotalPerformanceTable.tsx:51`, both also pre-existing. This order added exactly one copy,
   `BlackListTable.tsx:33`. All four bodies are logically identical
   (`>= 90 → text-up`, `>= 60 → text-muted`, else `text-down`), so there is no behavioural
   drift and **no seam defect** — only debt. **Judged a follow-up, not this order:** hoisting
   touches `lib/format.ts`, which no task owns; it is a behaviour-neutral refactor across five
   files; and it would move `file:line` anchors in three files while t5 is re-resolving
   citations against them. `lib/format.ts` is also arguably the wrong home (it formats values,
   it does not pick tokens), which is a design call that deserves its own gate.

## Integration — second pass (after the fix round)

Run 2026-08-17 by `integrator`, after the review bounce and the fix round that touched all
four code tasks (t1 H1/H2/L1 · t2 H4/M1/M2/L4 + note-1 correction · t3 H1/H2/H3/M3/M4/L1–L5
+ fix round 2 · t4 H3/M6/M8/L1 + `label`). **Every per-task claim in that round was taken
mid-flight with siblings editing the same tree; the numbers below supersede all of them.**

**Nothing was merged in the git sense and NO FILE WAS EDITED** — the four slices land in one
working tree and every seam held as written. This pass is verification only.

**Authoritative build + lint, on the merged tree:**
- `npm run build` → **exit 0**, Turbopack, TypeScript clean. Route table:
  ```
  ┌ ƒ /            ├ ƒ /chimera        ├ ƒ /members
  ├ ○ /_not-found  ├ ƒ /hydra          ├ ƒ /members/[memberId]
  ├ ƒ /api/*  (6)  ├ ○ /import         ├ ƒ /settings
                   ├ ƒ /login          └ ƒ /timeline
  ```
  `ƒ /` · `ƒ /members` · `ƒ /hydra` · `ƒ /chimera` · `○ /import` — all five as required.
- `npm run lint` → **10 problems (9 errors, 1 warning) — exactly the baseline.** Grouped by
  file: `.claude/scripts/statusline-cache.js` 4 (3 errors + the 1 warning),
  `.claude/scripts/token-report.js` 3, `components/ImportPanel.tsx` 3.
  **Zero hits in any of the 11 files this order touched.**

**Seams re-verified after the fix round:**

1. **`membersJudged` (t1 producer → t3 consumer).** `BlackListResult.membersJudged`
   (`lib/types.ts:160`) is returned at `lib/compute.ts:456` as `judged.length` and as `0` on
   the empty-window early return (`:394`). `rows` is `judged.filter(missedWeeks >= minMisses)`
   (`:445`), so `rows ⊆ judged` **structurally** — `membersJudged === 0` implies
   `rows.length === 0`, and the invariant `rows.length <= membersJudged` was also checked at
   runtime on four datasets. `BlackListTable` destructures it at `:53` and branches
   `noWeeks` (`:60`) → `nobodyJudged = !noWeeks && membersJudged === 0` (`:63`) → good news,
   as one ternary chain inside `rows.length === 0` (`:144`), so the three are mutually
   exclusive by construction. **All three demonstrated reachable** against the shipped code:
   empty dataset → `weeks=[] rows=0 judged=0` → Inbox · demo sliced to the one newest complete
   week → `weeks=[24] rows=0 judged=0` → Hourglass · synthetic max-keys clan → `weeks=[21,22,23,24]
   rows=0 judged=30` → ShieldCheck ("none of the 30 players judged…") · full demo →
   `rows=6 judged=30`, no empty branch.
2. **`label` (t2 prop → t3 + t4 call sites).** All **five** sites still spread `{...view}` and
   hand-pick nothing, so the `pageSize`-derived range end cannot desync:
   `PerformanceTable:304-310` · `TotalPerformanceTable:198-204` · `BlackListTable:189-195` ·
   `ClashTable:200-205` · `RosterTable:142`. Four distinct label values — `"Clan Performance"`
   (twice, but `PerformanceTable:228` is `isTotal ? <TotalPerformanceTable> : <>…</>`, so the
   two are mutually exclusive branches of one card and only ever one is in the landmark list),
   `"Black List"`, `"Player Breakdown"`, `"Roster"`. Verified on **rendered markup**, not
   source: the Total tab emits `aria-label="Clan Performance pagination"` +
   `<span class="sr-only">Clan Performance: </span>1–10 of 30 players`; the Black List emits
   `Black List: 1–6 of 6 players` (and, at 6 rows, `pageCount === 1` correctly drops its
   `<nav>`). The two overview landmarks are distinct.
3. **Render-phase adjustment, `TotalPerformanceTable.tsx:113-117`.** Cannot loop:
   `setPrevFilterKey(filterKey)` makes the condition false on the immediate re-run, and
   `view.setPage(1)` is idempotent (React bails on an `Object.is`-equal `useState` value), so
   it terminates in exactly two render passes; `filterKey` is a template literal over two
   stable state strings, not a fresh identity per render. Inert on mount: `useState(filterKey)`
   seeds prev to the current value, so the condition is false on the first render — rendered
   with `filterKey` omitted, `"all|"`, `"active|vor"`, `"former|"`, `"all|a"` and every one
   yields `1–10 of 30 players`, first rank `1`, identical byte length, no throw.
   **Keys on CLIENT state, confirmed:** `filterKey={`${memberFilter}|${query}`}`
   (`PerformanceTable.tsx:239`), both `useState` in `PerformanceTable`; a week change moves
   only the server props (`data`, `totals`, `weekLabel`) and `useWeekPending()`.
   `grep -rn "prevRows\|rows !==" components/` returns **one comment line and no code**
   (`TotalPerformanceTable.tsx:105`), so nothing anywhere keys on `rows` identity. `useEffect`
   appears in **no** owned component (one comment mention, `TotalPerformanceTable.tsx:97`).
4. **`aria-disabled` did not break the ends.** Rendered markup at pageCount 3:
   page 1 → `<button type="button" aria-disabled="true" aria-label="Previous page">` + Next
   `false`; page 2 → both `false`; page 3 → Prev `false`, Next `"true"`. **No native `disabled`
   attribute in any rendered state**, no `tabIndex`, so both buttons stay focusable and
   tabbable at the ends. The guards are the first statement of each `onClick`
   (`Pagination.tsx:263`, `:278`) — and because the buttons are `type="button"` with the
   native attribute absent, the Enter/Space keypress dispatches an ordinary `click`, so the
   same guard covers keyboard activation; there is no separate `onKeyDown` path to leak past.
   **Visual dim verified in the EMITTED stylesheet** (`.next/static/chunks/3b3cbb_t4v8ez.css`),
   not source: `.aria-disabled\:opacity-40[aria-disabled=true]{opacity:.4}` (byte 41431),
   `.aria-disabled\:hover\:border-border[aria-disabled=true]:hover{border-color:var(--color-border)}`
   (41510), `.aria-disabled\:hover\:text-muted[aria-disabled=true]:hover{color:var(--color-muted)}`
   (41606), against `.hover\:border-gold\/40:hover` (39393) and `.hover\:text-gold:hover`
   (40207). t2's specificity argument holds — (0,3,0) over (0,2,0) — **and** source order
   happens to agree, so the resets win twice over.
5. **t1's filter-then-slice actually has the property claimed.** `lib/compute.ts:378-380` is
   `sortedWeeks(ds).filter(isWeekComplete).slice(-windowSize)`. Measured on the demo dataset:
   full → window `[21,22,23,24]`, 6 rows, 30 judged; newest week's Chimera rows deleted →
   window `[20,21,22,23]`, **still 4 weeks wide**, 8 rows, 28 judged; the same dataset with
   week 24 removed **entirely** → identical fingerprint (same window, same 8 members, same
   `weeksConsidered`/`missedWeeks`/`missedWeekNumbers`/`keysUsed`/`keysPossible`/`participationPct`).
   A half-imported week is byte-indistinguishable from an un-imported one and the denominator
   stays at 4 weeks. The choice is confirmed as implemented, not re-litigated.
6. **t4's flex change is self-contained.** `git diff --name-only -- components/ClashDetailView.tsx`
   → empty. `grep -nE 'className="[^"]*(xl:h-full|xl:flex-1)' components/ClashTable.tsx` → exit 1;
   the section is `card-flush xl:flex xl:max-h-full xl:w-full xl:flex-col xl:self-start
   xl:overflow-hidden` (`:117`) and the scroller `overflow-x-auto xl:min-h-0 xl:flex-auto
   xl:overflow-y-auto` (`:140`). All three utilities are in the emitted stylesheet under
   `@media (min-width:80rem)`: `.xl\:self-start{align-self:flex-start}`,
   `.xl\:max-h-full{max-height:100%}`, `.xl\:flex-auto{flex:auto}` (plus `.xl\:mt-auto{margin-top:auto}`).
7. **Placement rule still holds at all five sites** — every `<Pagination>` line number is
   greater than its enclosing `</table>`: 304 > 296 · 198 > 193 · 189 > 182 · 200 > 194 · 142 > 137.
8. **Carry-forward, all re-checked:** `git diff --name-only` is empty for
   `components/Skeleton.tsx`, `app/globals.css`, `app/layout.tsx`, `components/Sidebar.tsx`,
   `components/MemberCell.tsx`, `components/ClashDetailView.tsx` **and** `components/TopBar.tsx`.
   `force-dynamic` is still `app/members/page.tsx:15`. `lib/compute.ts:172`'s `deltaPct(...) ?? 0`
   is untouched (the line moved from `:162` with the import growth; the bug is unchanged).
   The 2xl split is intact: `app/page.tsx:136` `grid grid-cols-1 gap-5 2xl:grid-cols-3`,
   `:137` `xl:h-full 2xl:col-span-2`. `git status --porcelain` lists exactly the 11 code files,
   t5's five docs and this ledger — no stray scratch file.

**Handed on rather than fixed:**
- **To t5 (docs).** t5 already ran once, BEFORE the fix round, so its five owned docs are now
  stale again in the specific ways t2/t3/t4 enumerated in their `escalations` blocks. The
  integrator confirms two of those escalations are factually correct against the shipped code
  and are the highest-value ones: (a) `docs/reference/design-system.md`'s Pagination entry
  still describes `<nav aria-label="Pagination">` as the OUTER element — it is a `<div>`
  (`Pagination.tsx:232`) with the `<nav>` (`:254`) scoped to the button group, and the whole
  group disappears at `pageCount === 1`; (b) the `react-hooks/set-state-in-effect`-as-guardrail
  claim is live in `.claude/rules/ux.md` and `docs/reference/design-system.md:63` and is
  measurably false for any `usePagination` consumer. t2 has already corrected its own header
  note; the two docs have not. This ledger's context pack `:48` carries the same false claim
  and is immutable — recorded, not edited.
- **To the reviewer.** `components/TopBar.tsx:129-144` still carries the native `disabled` on
  both week chevrons — the exact focus defect t2 fixed in `Pagination`, in the file the shape
  was inherited from. Unowned by every task in this order; needs its own slice.
  `participationColor` remains hand-copied in four files (`ClashTable:60`,
  `PerformanceTable:137`, `TotalPerformanceTable:51`, `BlackListTable:47`) — unchanged debt,
  this round added no copy.
- **No slice-level bounce.** Nothing found in this pass belongs to an implementer.

## Open items flagged to the owner

1. **The threshold rule is the planner's choice**, accepted at the gate: 4-week window / <3 of 5 keys is a miss / ≥2 misses lists you / ≥2 weeks present to be judged / current roster only. Four named constants in `lib/constants.ts` — cheap to re-pin.
2. **The sidebar will scroll away** once the overview unlocks (non-sticky `<aside>` in `flex min-h-screen`). Already true on `/members`, `/timeline` and `/settings`, so it is consistent — but it is a change on `/`. Follow-up if wanted: `sticky top-0 h-screen`.
3. **`/hydra` and `/chimera` stay viewport-locked** — after this order the app has one scrolling data page shell and two locked ones. Deliberate per the order's scope; unwinding `ClashDetailView.tsx` is a small follow-up.
4. **"Beside" costs horizontal room.** Clan Performance is `min-w-[860px]` (Total tab `min-w-[920px]`); at 2 of 3 columns it starts scrolling horizontally below roughly 1500px. t3 is authorized to move the split to `2xl:` and must record which it chose.
5. **The Black List is absent from the overview CSV export** — not asked for, not built.
