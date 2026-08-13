# Task ledger: members-week-selector-removal

order: "Fix it now, this session — /members renders a week selector that changes nothing"

status: done   # planning | approved | in-progress | integrating | review | done | blocked
               # Closed 2026-08-13: correctness PASS on first review; doc-sync FAIL closed by t1-fix.
                 # `integrating` skipped: one implementer ran, no cross-slice seams (recipe step 5).
                 # Advanced by the main session, which also corrected one citation in
                 # .claude/rules/rendering.md (`page.tsx:8` -> `:15`, verified against the file).
created: 2026-08-13T19:40:00Z

<!-- SOLO ORDER — one ownership group, ledger written by the main session (recipe step 2, solo path).
     Follows directly from the week-change-pending-state order, which surfaced this as
     owner-decision work rather than fixing it inline. Plan approved at the gate. -->

## Context pack

**Stack:** Next.js 16.2.9 (App Router, Turbopack) · React 19 · Tailwind v4.

**The defect.** `/members` renders a week selector that changes nothing. The roster aggregates
every week — `weeksPresent`, `weeksActive` and both damage totals group across all of `ds.results`
(`app/members/page.tsx:24-46`) — and `selectedWeek` reaches exactly **one** consumer: the `TopBar`
that displays it (`:67`). `docs/user-guide.md` documents the all-weeks aggregation as the intended
semantics, so the roster is correct and the control is wrong.

Pre-existing, but the week-pending order made it louder: a click that used to be silent now spins a
gold loader and announces "Loading week 9…" for a round-trip whose entire visible outcome is an
unchanged page. Compounding it, `components/Sidebar.tsx:14-21` carries bare paths with no query, so
a chosen week is discarded on every sidebar navigation anyway.

**THE TRAP — read this before deleting anything.** `.claude/rules/rendering.md`: the five data pages
are dynamic **only** because each awaits `searchParams`. Verified still true: `app/members/page.tsx:13`
awaits it, the file has **no** `force-dynamic`, and `next.config.ts` is the empty scaffold, so nothing
else holds the page dynamic. Once the picker goes, `week` has no consumer and the `await` reads as dead
code — and **deleting it flips `/members` from `ƒ` to `○` with no error and no warning**, baking one
build's roster into HTML for every visitor, or baking the **demo dataset** if the build environment had
no connection string. That is the deployed-and-lying state this project has already hit once. The
removal and the `force-dynamic` guard land in the **same** change; the build's route table is the proof.

**Files in play** (all verified by survey, not assumed)
- `components/TopBar.tsx` — 4 call sites, all currently passing a full prop set: `app/page.tsx:87`,
  `app/timeline/page.tsx:38`, `app/members/page.tsx:67`, `components/ClashDetailView.tsx:68`
  (reached by `/hydra` and `/chimera`). `weekNumbers`/`currentWeek` required; `exportData`/`weekRanges`
  already optional.
- `app/members/page.tsx` — the only page to edit. Dead after the change: `week` (`:13`), `weeks`,
  `weekNumbers`, `weekRanges`, `requested`, `selectedWeek` (`:15-21`), plus imports `sortedWeeks` and
  `latestWeekNumber` (`:2`) and `formatDateRange` (`:6`). **Still used:** `activeMemberIds` (`:22`),
  `formatDamage`, `formatKeys`.
- `components/ExportButton.tsx:26` — depends only on `exportData`; **no week coupling**, so `/members`'
  CSV export is unaffected.
- `components/WeekTransition.tsx` — provider mounts once at `app/layout.tsx:31` and never unmounts. The
  live region renders unconditionally and sits **empty and silent** on a page with no week control
  (`requested` stays `null`), so nothing breaks. Its comment near `:128` is the one that goes false.
- `app/timeline/page.tsx` — **out of scope and untouched.** Its week genuinely moves a highlight on
  `TimelineStrip` (`:39`) and both `WeeklyBarChart`s (`:41-42`).

**Constraints**
- **Split, don't early-return** — `.claude/rules/ux.md`'s established precedent (`DataManagement`/`DataTools`,
  `ImportPanel`/`ImportForm`, `AvatarEditor`/`AvatarUploader`). An early `return` in front of the three
  `useWeekPending`/`useWeekTarget`/`useStartWeekChange` calls is a conditional hook (`react-hooks/rules-of-hooks`).
- Tokens/primitives only (`.claude/rules/ui.md`); no hex.
- The two-week-change-entry-point invariant stays true — `TopBar` still renders a picker on four pages, and
  `.claude/rules/ux.md`'s `grep -rn 'set("week"' components/` must still return exactly two sites.

**Non-goals**
- `/timeline`'s missing `aria-current` on the selected week card (offered at the gate, declined — stays
  recorded as open work).
- Making `Sidebar` links carry `?week=` (offered at the gate, declined).
- Making the roster week-aware. `docs/user-guide.md` documents all-weeks as intended; changing it is a
  product decision, not a UX fix.
- Any data, auth, schema or API change.

## Cost forecast

**Estimate: 1.6M tokens** (range 1.2–2.6M) · ~$3–5
- Build — one implementer, 6 files, most edits one-line — 0.8M
- Review — `flow-reviewer`, correctness + doc-sync, rendering-rule counts first — 0.5M
- Report, build-log, ledger — 0.3M

No bounce allowance: small surface, and the one real risk (`ƒ` vs `○`) is caught by a build the
implementer runs itself.
Basis: 9 prior `Cost:` lines in `docs/build-log.md`. The immediately preceding order came in **9% under**
forecast, reversing an 8-of-8 over-run streak, so this estimate is deliberately **not** padded the way
that one was.
Window at plan time: 5h 24% used, resets 04:40 — reading is 45h stale; `/usage` is the authority. Fits comfortably.

## Plan cost

**Measured: ~120k tokens** (main session only — solo order, `task-planner` not dispatched; one `Explore`
survey at the gate) · ~8% of the forecast above

## Tasks

- id: t1
  summary: Remove the week control from /members, guard the render mode, and correct the docs it falsifies
  owns:
    - components/TopBar.tsx
    - app/members/page.tsx
    - components/WeekTransition.tsx
    - .claude/rules/rendering.md
    - .claude/rules/ux.md
    - docs/reference/design-system.md
  depends_on: []
  done_when: >
    Criteria are positive assertions at named seams over enumerated corpora — no bare `docs/` grep, and no
    criterion quoting the string whose absence it asserts (the self-matching failure recorded in
    docs/tasks/week-change-pending-state.md). Every grep runs with a positive control, and the control's
    output is pasted so a malformed check cannot read as a clean one.
    (1) `npm run build` route table pasted, showing **`ƒ /members`** — the proof the guard works — alongside
    unchanged `ƒ` on `/`, `/hydra`, `/chimera`, `/timeline` and `○` on `/import`. A `○ /members` means the
    change silently broke the page and the task is NOT done.
    (2) `grep -c "force-dynamic" app/members/page.tsx` → 1; count over `app/` → 10 (4 pages + 6 route handlers).
    (3) `npm run lint` at the approved baseline of 9 errors + 1 warning, with no unused-import error
    introduced by the deletions.
    (4) `grep -n "weekNumbers\|currentWeek\|selectedWeek" app/members/page.tsx` → zero, with a positive
    control on the same file.
    (5) `grep -rn 'set("week"' components/` → still exactly two sites (`TopBar.tsx`, `TimelineStrip.tsx`).
    (6) State the file:line where `TopBar` decides whether to render the picker.
  docs_touched:
    - .claude/rules/rendering.md
    - .claude/rules/ux.md
    - docs/reference/design-system.md
  claimed_by: "ui-design-specialist"
  state: done
  changelist:
    - components/TopBar.tsx — split the week block into a module-local `WeekPicker`
      (calendar/spinner + `<select>` + both chevrons + the three transition hooks).
      `weekNumbers`/`currentWeek`/`weekRanges` are now optional; `TopBar` renders the
      picker only at `:42` (`weekNumbers?.length && currentWeek != null`). `PageTitle`
      and `ExportButton` stay unconditional. Split, not early-return — the hooks would
      have been conditional. Both existing comments (two entry points; live region owned
      by the provider) kept verbatim.
    - app/members/page.tsx — dropped the three week props from `<TopBar>`; deleted
      `week`/`weeks`/`weekNumbers`/`weekRanges`/`requested`/`selectedWeek` and the
      `sortedWeeks`/`latestWeekNumber`/`formatDateRange` imports; removed the
      `searchParams` prop and the page's whole parameter list. **Added
      `export const dynamic = "force-dynamic"` (`:15`) in the same edit**, with a comment
      saying it is load-bearing so it is not tidied away later.
    - .claude/rules/rendering.md — counts corrected (four `searchParams` pages, not five;
      four pages declare `force-dynamic`, not three; ten repo-wide hits, not nine) and a
      new **worked example** bullet: `/members`, 2026-08-13, with the route table as proof
      and the rejected `await searchParams`-for-its-side-effect alternative recorded.
    - components/WeekTransition.tsx — `WeekAnnouncer` docblock no longer claims the live
      region is the only perceivable thing on `/members`; says the page has no week control
      at all, so the region stays silent there.
    - .claude/rules/ux.md — the zero-placeholder clause now gives `/timeline` and `/members`
      their two different reasons; the split-over-early-return precedent list gains
      `TopBar`/`WeekPicker` as the *optional-control* case.
    - docs/reference/design-system.md — four corrections: "five async pages" → the four that
      read `?week=`; the two-entry-point paragraph now records that TopBar's picker is
      per-page optional (with the `:42` seam, and that `ExportButton` sits outside it); the
      "matters most on /timeline and /members" line; the zero-skeletons line.
  verification:
    - (1) `npm run build` → **`ƒ /members`**, with `ƒ` on `/`, `/hydra`, `/chimera`,
      `/timeline` and `○` on `/import`, `/_not-found`. Negative control run: with the
      `force-dynamic` line commented out the same build reports **`○ /members`**, so the
      guard is demonstrably the only thing holding the page dynamic. Line restored and
      diffed byte-identical against a scratchpad backup before finishing.
    - (2) `grep -c force-dynamic app/members/page.tsx` → 1; `grep -rn force-dynamic app/ | wc -l`
      → 10 (4 pages + 6 route handlers), all ten sites listed.
    - (3) `npm run lint` → 9 errors + 1 warning, the approved baseline. All ten sit in
      `.claude/scripts/statusline-cache.js`, `.claude/scripts/token-report.js` and
      `components/ImportPanel.tsx`; neither owned code file appears in the report.
    - (4) `grep -n "weekNumbers\|currentWeek\|selectedWeek" app/members/page.tsx` → zero
      (same grep on `app/timeline/page.tsx` returns 6, as the control). No code use of
      `searchParams` remains — the single textual hit is prose inside the guard comment.
    - (5) `grep -rn 'set("week"' components/` → exactly two, `TimelineStrip.tsx:71` and
      `TopBar.tsx:85`.
    - (6) `components/TopBar.tsx:42`.
  findings:
    - Context pack accurate on every file, line and count it named. One undercount, in the
      order rather than the pack: `docs/reference/design-system.md` carried **four** claims
      this change falsifies, not one — "five async pages" (`:49`), the two-entry-point
      paragraph implying TopBar's picker is unconditional (`:50`), "matters most on /timeline
      and /members" (`:54`) and the zero-skeletons line (`:55`). All four corrected.

## Review bounce 1 - 2026-08-13

`flow-reviewer`: **correctness PASS · doc-sync FAIL.** No code changes needed. Six doc fixes below.

**My planning miss, and it is the second of this class in one session.** `docs_touched` listed three
files; the real blast radius is **six**. The falsified sentence - "the five data pages are dynamic only
because each awaits `searchParams`" - exists **verbatim in four places**, confirmed by the main session:
`.claude/rules/database.md:50`, `docs/engineer-onboarding.md:252` and `:370`, `docs/reference/deployment.md:288`
(plus `.claude/rules/rendering.md`, which the order did correct). **A `grep -rn "five data pages"` at plan
time would have found all four in one command**, and the plan did not run it. Same shape as the week-pending
order's "only week-change entry point" error: a *negative existential* claim about the codebase, restated in
several artifacts, none of which the implementer can check without redoing the survey.

**The onboarding one is the dangerous one.** `docs/engineer-onboarding.md:370` is a titled hazard telling a
new engineer that **none** of the five pages declares `force-dynamic`. They then open `app/members/page.tsx`,
find one on a page that awaits nothing, and have a doc arguing for the exact deletion the code comment
forbids. The doc would have taught them to spring the trap.

- id: t1-fix
  summary: Correct the six living docs that still carry the pre-change rendering claim
  owns:
    - docs/reference/deployment.md
    - docs/engineer-onboarding.md
    - .claude/rules/database.md
    - docs/user-guide.md
    - docs/reference/design-system.md
    - .claude/rules/rendering.md
  depends_on: [t1]
  done_when: >
    (1) `grep -rn "five data pages" --include="*.md" .` returns matches ONLY under `docs/tasks/` and
    `docs/build-log.md` (append-only history, correctly describing the past) - paste the full output and a
    positive control. Enumerate the corpus; do not grep the repo root blind.
    (2) Each of the four counts is consistent everywhere it appears: four `searchParams` pages, four pages
    declaring `force-dynamic`, ten repo-wide hits, `/members` named as the explicit-declaration case.
    (3) `docs/user-guide.md:119`'s two citations resolve to the lines they claim - paste the target lines.
    (4) Lint and build unchanged (9 errors + 1 warning; `f /members`).
  docs_touched:
    - docs/reference/deployment.md
    - docs/engineer-onboarding.md
    - .claude/rules/database.md
    - docs/user-guide.md
    - docs/reference/design-system.md
    - .claude/rules/rendering.md
  claimed_by: "ui-design-specialist"
  state: done
  changelist:
    - docs/reference/deployment.md:288 — the mirror paragraph, all four sub-claims corrected
      to match `rendering.md`: "four `searchParams` data pages" (`/`, `/hydra`, `/chimera`,
      `/timeline`); "none of **those four**" declares `force-dynamic`; among pages **four**
      do (adds `/members`); repo-wide grep returns **ten**, not nine. Added the one-clause
      pointer: `/members` reads no `searchParams` since 2026-08-13, is held dynamic by
      `app/members/page.tsx:15`, and the worked example in `.claude/rules/rendering.md`
      records why the vestigial-`await` alternative was rejected.
    - docs/engineer-onboarding.md:370 — hazard 14 retitled "Four data pages are dynamic
      *only* because they `await searchParams` — `/members` is the exception". Body now
      names the four, scopes "none of **those four**" to them, and adds a paragraph making
      `/members` the explicit-declaration case: cites `app/members/page.tsx:15`, says the
      declaration carries a load-bearing comment, and states **do not tidy it away** —
      deleting it flips `ƒ` to `○` silently. This was the doc that would have taught a new
      engineer to spring the trap.
    - docs/engineer-onboarding.md:252 — **rephrased, though the bounce said to leave it.**
      The claim itself was true and stays true; the *string* "five data pages" had to go to
      satisfy done_when (1), and leaving "five" two hundred lines above a hazard now titled
      "four" read as a contradiction. Now enumerates the five routes explicitly and points at
      hazard 14 for why `/members` gets there differently. Meaning unchanged.
    - .claude/rules/database.md:50 — "the five data pages are dynamic only because each
      awaits `searchParams`" → "the four `searchParams` data pages …", with a parenthetical
      that the fifth, `/members`, awaits nothing and is held dynamic explicitly. Also
      tightened the consequence clause to "stopped doing that **without declaring
      `force-dynamic` in the same change**", so the rule no longer reads as if any removal
      is fatal. `rendering.md` stays the cited authority.
    - docs/user-guide.md:119 — citations corrected `:87`→`:86` and `:39`→`:36`, both
      **verified against the file**, not taken on trust: `:86` is the Participation `<th>`,
      `:36` is the `participationPct` formula. Both target lines pasted in verification.
    - docs/user-guide.md:415 — `components/TopBar.tsx:74`→`:56` for `ExportButton`
      (pre-existing drift from the week-pending order, pulled back up by t1's split).
    - docs/reference/design-system.md:50 — documented the **undocumented behaviour change**:
      the guard takes a *non-empty* `weekNumbers`, so on a connected-but-empty database all
      four picker pages (`weekNumbers = []`, `currentWeek = 0` via `latestWeekNumber`,
      `lib/compute.ts:36`) now render **no picker at all**, where they previously rendered an
      empty `<select>` plus two permanently-disabled chevrons. Recorded as deliberate, tied
      to `.claude/rules/ux.md`'s connected-but-empty state and to hide-don't-disable.
    - .claude/rules/rendering.md:20-48 — worked-example route table replaced with the
      **complete** build output: the six `ƒ /api/*` rows, the blank lines, `ƒ Proxy
      (Middleware)` and the two legend lines, verbatim from the build run for this task.
      A preamble says it is complete and that only the `←` note is added, so a reader
      re-running the build to check the rule gets matching output instead of a subset.
  verification:
    - (1) `grep -n "five data pages"` over an **enumerated 50-file corpus**
      (`git ls-files --cached --others --exclude-standard "*.md"` — tracked *and* untracked,
      so the two uncommitted ledgers are in scope; not a blind root grep). **9 matches, all
      under `docs/tasks/` or `docs/build-log.md`**: `build-log.md:191`;
      `members-week-selector-removal.md:30,181,184,205`; `phase4-…:178,325`;
      `week-change-pending-state.md:27,219`. Zero in `docs/reference/`, `.claude/rules/`,
      or any root doc. **Positive control** — same corpus, same invocation, `force-dynamic`
      instead — returned hits in 8 files **including all four I edited**
      (`database.md:1`, `rendering.md:3`, `deployment.md:1`, `engineer-onboarding.md:3`),
      proving the target grep does reach those files and their absence is real, not a
      malformed command reading as clean. Full output pasted in the report.
    - (1b) Variant sweep for stale phrasings that would carry the same claim without the
      exact string (`five async`, `None of the five`, `all five`, `the five `, `five pages`,
      `nine hits`, `not nine`, `not three`, `returns nine`), same corpus, excluding
      append-only history → **zero rendering-related hits**. The nine remaining are unrelated
      ("all five objects" = DB tables, "all five keys" = RAID keys, "five places" = env reads,
      "four permission cells").
    - (2) Ground truth re-measured, not copied: `grep -rn force-dynamic app/` → **10 sites,
      all ten listed** = 4 pages (`/login`, `/members`, `/members/[memberId]`, `/settings`)
      + 6 `app/api/*/route.ts`. Every corrected doc now states four `searchParams` pages,
      four declaring pages, ten repo-wide hits, and names `/members` as the explicit case.
    - (3) Both `user-guide.md` citations resolved by reading the target lines, and the
      target lines pasted: `app/members/page.tsx:86` → `<th …>Participation</th>`;
      `:36` → `participationPct: weeksPresent ? (weeksActive / weeksPresent) * 100 : 0,`;
      `components/TopBar.tsx:56` → `<ExportButton data={exportData} />`. The two
      already-correct citations on the same line (`ExportButton.tsx:26-33`,
      `members/[memberId]/page.tsx:233`) were re-checked and left alone.
    - (4) `npm run build` → exit 0, **`ƒ /members`**, `ƒ` on `/`, `/hydra`, `/chimera`,
      `/timeline`, `○` on `/import` and `/_not-found` — unchanged from t1.
      `npm run lint` → **9 errors + 1 warning**, the approved baseline, unchanged.
      `git status --porcelain` confirms **no code file was modified by this task**: the
      only files I wrote are the six owned docs plus this ledger entry. The other entries
      in the working tree are t1's and the prior order's uncommitted work.
  findings:
    - **No code change was needed and none was made** — the bounce is doc-only, as scoped.
    - **One deviation, flagged rather than done silently:** the bounce said to leave
      `docs/engineer-onboarding.md:252` alone unless correcting hazard 14 made it read
      oddly. It did — and independently, done_when (1) forbids the string "five data pages"
      outside `docs/tasks/`/`build-log.md`, which that line carried. Rephrased to preserve
      the (still true) claim while removing the string. If the reviewer prefers the original
      wording, done_when (1) is the clause that has to move, not the sentence.
    - **Agreed with the design-system.md:50 behaviour call, and verified it rather than
      accepting it.** `latestWeekNumber` does return `0` at `lib/compute.ts:36`, and it is
      `weekNumbers?.length` — not the `currentWeek != null` test — that rejects `[]`;
      `currentWeek = 0` passes `!= null` on its own. So the empty-database path really does
      fall to the `null` branch. It is an improvement: the old render was a `<select>` with
      no options beside two chevrons that could never enable, i.e. a control advertising an
      action that cannot exist. Documented as deliberate.
    - **The bounce's two suggested line numbers were both correct**, but they were checked
      against the files before use, per the instruction not to trust them.
    - **Pattern worth carrying forward** (third instance of this class): the failing artifact
      each time is a *negative existential* claim ("none of", "the only", "exactly N") that
      an implementer cannot falsify without redoing the survey. `grep -rn` on the claim's
      distinctive phrase is a one-command plan-time check. Worth noting that the exact-string
      grep in done_when (1) would **not** have caught a paraphrase — the (1b) variant sweep
      is the part that closes that gap, and it belongs in the criterion, not just in the
      verification.
