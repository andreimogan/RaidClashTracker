# Task ledger: member-trend-week-over-week

order: "Let's improve the Trend column in the members week by week history table. First, i want to know what does the trend column shows and what the increase/decrease means and on what is based on. I suspect it has noting to do with the total damage. The reason i want to know the current functionality is to propose that the trend will take into consideration the previous total damange from the week before and calculates based on the current week total dmg numbers and the trend will show a reduction or a greater increase (+x % if i increased my total dmg compared to last week by x %)."
status: done   # integration skipped — a single implementer ran, so there were no seams to merge
created: 2026-08-11T19:44:59Z

## Context pack

**Stack:** Next.js 16.2.9 (App Router, TS) · React 19.2.4 · Tailwind v4 · Recharts 3 · libSQL `@libsql/client` 0.17. No test suite — verify with `npm run build` + exercising `/members/[memberId]`.

**Diagnosis (of the current behavior the order questions):** the Trend column is *not* week-over-week total damage. `lib/compute.ts:252-270` computes this week's **damage per key** (Hydra+Chimera combined) against the **unweighted mean of that same per-key figure over all the member's prior present weeks** — a cumulative lifetime average. Consequences the order is right to dislike: a benched 0-key week reads as −100% (perKey 0 vs a positive average), and a member's first week yields `0` which renders as the neutral grey `Minus 0%` badge, indistinguishable from a genuinely flat week.

**Files in play**
- `lib/compute.ts` — `getMemberProfile()` builds `history[]` incl. `trendPct` (lines ~245-272); `aggregateMemberWeek(ds, memberId, weekId, "total")` (line 59) returns `{keys, damage}`; `presentWeeks` already computed at lines 240-243, ascending by week number.
- `lib/types.ts` — `MemberWeekRow.trendPct` at line 82, currently `number`.
- `components/TrendBadge.tsx` — the whole indicator, 21 lines; takes a plain `number`, hardcoded ±0.5 dead zone, hand-built `+`/`%` string.
- `components/MemberHistoryTable.tsx` — `HistoryRow.trendPct` is already `number | null` (line 24); the Trend cell at line 109 does `<TrendBadge value={r.trendPct ?? 0} />`; absent-week rows render em-dash cells (lines 112-121) and never reach the badge.
- `app/members/[memberId]/page.tsx` — merges `ds.weeks` (sorted **descending**) with `profile.history` into `historyRows` (lines 91-124); CSV export emits `"Trend %"` as `(r.trendPct ?? 0).toFixed(0)` at line 162.
- `lib/format.ts` — `formatPct(value, withSign)` at line 14 already produces exactly the `+12%` form TrendBadge hand-builds. **Defined but called nowhere in the repo.**

**Seams** — none. Single ownership group; one implementer owns all five files.

**Constraints**
- Read-path/display change only. Do **not** touch the write pipeline (`parse.ts` → `import.ts` → `persist.ts`), the API routes, `db/schema.sql`, or any SQL.
- `compute.ts` is pure and framework-free (works for both the libSQL and `mock-data.ts` paths) — keep it that way.
- Style only with `app/globals.css` tokens/primitives; the existing `text-up` / `text-down` / `text-faint` tokens cover this. Never hardcode hex (`.claude/rules/ui.md`).
- The zero-config demo fallback must keep working — `lib/mock-data.ts` (weeks 20–24) is what renders on an empty DB.
- Icons from `lucide-react` (already imported in TrendBadge).

**Prior decisions**
- The same `TrendBadge` is used on three surfaces with **two different meanings**: `getPerformance` (`compute.ts:148-155`, dmg/key vs the *immediately previous global week*, single clash) feeds `ClashTable` and, via `memberClashStat` (lines 212-218), the per-clash cards on the member page. That second meaning is deliberately **left alone** this order — see Non-goals.
- Ledger `docs/tasks/import-clash-aware-week-tags.md` (2026-08-07) established the precedent that display-only fixes stay out of the write path even when the underlying data is already correct.

**Non-goals**
- Unifying the other two trend meanings (`getPerformance` / `ClashTable` / the per-clash cards). Extracting `deltaPct` makes a later unification cheap; doing it now is out of scope.
- Adding a sparkline, a "vs W12" label, or any new column.
- Schema, migration, or ingest changes of any kind.

## Cost forecast

**Estimate: ~4.6M tokens** (range 3.6M–5.6M) — tokens measure the work, not the model.
- Build, 1 implementer task — ~0.4M
- Review pass — ~0.5M
- Bounce allowance (1 review bounce) — ~1.0M (low end assumes none, high end two)
- Order overhead + report/commit — ~2.7M

Basis: shipped baselines, no history yet — `docs/build-log.md` carries no `Cost:` lines to calibrate from; this order writes the first. **Solo order** (one ownership group): no planner dispatch, no integrate component.
Window at plan time: unknown — the only sample in `.claude/budget-state.json` was bootstrap's synthetic statusline payload, not a real reading. Check `/usage`.
Model: planning ran on Fable 5 ($10/$50 per MTok); implementation on Opus 5 ($5/$25) at the user's direction — half the per-token rate of the planning phase.

## Plan cost

**Measured: 420k tokens so far** (main 420k + planner not dispatched — solo order) · ~9% of the forecast above

## Tasks

- id: t1
  summary: Trend column = this week's total damage vs the member's most recent prior present week, ±x%; dash when there is no baseline.
  owns:
    - lib/compute.ts
    - lib/types.ts
    - components/TrendBadge.tsx
    - components/MemberHistoryTable.tsx
    - app/members/[memberId]/page.tsx
  depends_on: []
  done_when: |
    1. `deltaPct(current, previous): number | null` exported from lib/compute.ts — returns null when previous <= 0.
    2. getMemberProfile's per-week trendPct = deltaPct(thisWeek.totalDamage, priorPresentWeek.totalDamage), where priorPresentWeek is the member's most recent present week with a LOWER weekNumber (skip gaps); null when no such week exists.
    3. MemberWeekRow.trendPct is `number | null` and its comment says what it now means.
    4. TrendBadge accepts `number | null`; null renders an em-dash in `text-muted` —
       deliberately DISTINCT from the absent-week cells' `text-faint` (amended
       post-review: text-faint fails WCAG AA at this size, and "present but no
       baseline" is a different state from "no data"); the numeric path uses
       formatPct(value, true).
    5. MemberHistoryTable passes `r.trendPct` (drop the `?? 0`).
    6. CSV export emits "" for a null trendPct instead of "0".
    7. getPerformance / memberClashStat trend semantics unchanged (getPerformance may reuse deltaPct only if behavior is identical: `deltaPct(...) ?? 0`).
    8. `npm run build` passes; no new `npm run lint` errors vs HEAD.
  docs_touched:
    - docs/reference/design-system.md
  claimed_by: "flow-implementer/t1"
  state: done
  changelist: |
    - lib/compute.ts — added exported `deltaPct(current, previous): number | null`
      (null when previous <= 0). getMemberProfile's history now maps with an index
      and sets `trendPct: deltaPct(totalDamage, priorDamage)` where priorDamage is
      `presentWeeks[i-1]`'s total damage (ascending list ⇒ most recent prior
      PRESENT week, gaps skipped); the old cumulative-lifetime dmg/key average is
      gone. getPerformance's trend now reads `deltaPct(thisPerKey, prevPerKey) ?? 0`
      — same arithmetic, same result, unchanged semantics. memberClashStat untouched.
    - lib/types.ts — `MemberWeekRow.trendPct` is now `number | null`, with a
      comment stating it is total damage vs the prior present week and that null
      means "no baseline".
    - components/TrendBadge.tsx — prop widened to `number | null`; null renders
      an em-dash in `text-muted` (post-review; see assumptions — originally
      `text-faint` to match absent-week cells);
      the numeric path now uses `formatPct(value, true)` from lib/format.ts instead
      of the hand-built sign/`toFixed(0)`/`%`. ±0.5 dead zone and up/down tokens
      unchanged. Widening is source-compatible with the two `number` callers
      (ClashTable, ClashBreakdown).
    - components/MemberHistoryTable.tsx — Trend cell passes `r.trendPct` (dropped
      `?? 0`); documented what HistoryRow.trendPct means. Post-review: the column
      header is now "Dmg vs Prev Week" instead of "Trend", so the metric is
      self-describing next to the two dmg/key badges on the same page. This table
      has no sort/SortKey wiring (that is ClashTable), so only visible text moved.
    - app/members/[memberId]/page.tsx — CSV "Trend %" emits `""` for a null
      trendPct instead of `"0"`.
    - docs/reference/design-system.md — new "Trend indicator" pattern bullet:
      tokens, the null→em-dash rule, formatPct, and the note that the percentage's
      *meaning* still differs between the history table and the clash tables.
  verification: |
    `npm run build` passes (Next 16.2.9, TS clean). `npm run lint`: 10 errors +
    1 warning, all in components/ImportPanel.tsx and .claude/scripts/*.js — none in
    the five owned files, so no new errors vs HEAD. Behavior checked with a
    throwaway tsx script over lib/mock-data.ts + a synthetic dataset: first present
    week → null, 0-damage baseline → null, W4 vs W2 across a missing W3 → +50%
    (gap skipped), W20→W21 = +17.9% matching 36.21B/30.70B.
  assumptions: |
    - Kept TrendBadge's ±0.5 dead zone ("Minus 0%") for the numeric path; the
      ledger only redefined the null case.
    - Left the CSV header "Trend %" as-is (renaming would change the export
      contract and was not in scope). Reconfirmed post-review: user declined.
    - REVERSAL of done_when #4, user-approved after review: the null em-dash is
      `text-muted`, NOT `text-faint`. The ledger's original "matching the
      absent-week cells" was wrong on two counts — text-faint (#586478) is ~3.0:1
      on the card gradient and fails WCAG AA at the ~10.5px `text-sm` yields under
      `html { font-size: 75% }`, and matching the two collapsed a real distinction
      ("present, no baseline" vs "no data this week"). done_when #4 has been amended
      in place so the ledger no longer asserts the superseded requirement.
    - Strict previous-PRESENT-week baseline retained by explicit user decision
      ("I will not have benched week. Keep the calculation based on previous
      week."): no `damage > 0` filter on the baseline, and a 0-damage week still
      reads -100%. Reviewers raised it; the user declined.
    - Also declined post-review and deliberately not done: sr-only up/down text,
      the single-pass totals/baseline aggregation refactor, the CSV header rename,
      and the formatPct-in-the-dead-zone doc nit.
