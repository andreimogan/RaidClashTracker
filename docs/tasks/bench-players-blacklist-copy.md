# Task ledger: bench-players-blacklist-copy

order: "1) Replace both Black List header lines (subtitle at BlackListTable.tsx:77-81 and rule paragraph at :94-101) with the single line 'Last 4 weeks of participation.', the 4 rendered as rule.windowWeeks; empty-state branches unchanged. 2) Bench players: persisted is_benched flag on members (migration 0003), admin-only write via setMemberBenched + new route POST /api/members/[memberId]/bench copying the avatar route's shape, Bench/Unbench toggle on /members/[memberId] only (client leaf, absent when readOnly), benched members excluded at getBlackList's roster gate (out of rows AND membersJudged), green ShieldCheck after the name on every name surface with native title 'This player is safe from the blacklist' + matching aria-label. CSV exports unchanged."
status: done   # planning | approved | in-progress | integrating | review | done | blocked
created: 2026-08-18

<!-- Approved at the plan-mode gate 2026-08-18. Written BEFORE any dispatch, deliberately:
     the two previous orders each lost their approved plan to a session boundary because
     plan mode blocks the write that would have persisted it. See project memory,
     "approved-plans-die-with-the-session". Plan file: C:\Users\Andrei\.claude\plans\not-yet-i-want-eventual-wall.md -->

## Context pack

**Stack.** Next.js 16.2.9 (breaking changes vs. training data — read the relevant guide in `node_modules/next/dist/docs/` before writing route code), Supabase Postgres via postgres.js, Tailwind v4 tokens in `app/globals.css`, lucide-react. No test suite: verify with `npm run build` + `npm run lint`. **Lint's clean state is the existing 9-errors-1-warning baseline** (pre-existing hits in `components/ImportPanel.tsx` and two `.claude/scripts/*.js`), not zero.

**Survey provenance.** A full read-only survey ran at plan time this session and is embedded below — it is current against the working tree as of 2026-08-18. Do not re-survey these files; read only where this pack is silent. Where the ground contradicts the pack, go look and report that it misled you.

**Files in play (role, owning task):**
- `supabase/migrations/0003_*.sql` — new, one idempotent `alter table` (t1). Match the naming style of the existing files; forward-only, never edit 0001/0002.
- `lib/types.ts:5-12` — `Member` gains required `isBenched: boolean` (t2). `BlackListRule.windowWeeks` already exists (`:128`) — no type change needed for order part 1.
- `lib/data.ts:27-35, 99-106` — `MemberRow` + `toMember()` (the single coercion boundary); `:67` is `select *`, no edit (t2).
- `lib/backup.ts` — export inherits via `select *` (`:35-42`); restore normalizer `:99-107` needs `is_benched: bool(m.is_benched, false)` (helper at `:80-88`); restore insert `:137-143` needs the column in **both** the column list and the values (t2).
- `lib/persist.ts:104-107` — **NO edit.** Its `on conflict do update set` touches only `in_game_name`, so bench state survives a re-import — the same mechanism that preserves `avatar_url` and `is_active` today. Do not "fix" this.
- `lib/import.ts`, `lib/seed.ts` — no member columns, no edit.
- `lib/mock-data.ts:48-55` — a required field forces edits; see the pinned demo decision below (t2).
- `lib/compute.ts:417-418` — the roster gate in `getBlackList`; add the `!m.isBenched` exclusion so benched members leave `rows` **and** `membersJudged`. `:434`'s spread inherits the field. While in the file (t2 owns it): reword the `:406` comment's "a benched 0-key row" to "a zero-key row" — the word now means something else.
- `lib/members.ts:5-8` — `setMemberAvatar` is the sanctioned direct-SQL precedent for member *metadata* (`.claude/rules/data-pipeline.md` forbids bypassing the pipeline for **ingest**, which this is not); add `setMemberBenched` beside it (t2).
- `app/api/members/[memberId]/avatar/route.ts:8-64` — the template t3 copies: `runtime` + `force-dynamic` exports, `requireAdmin()` as the first statement, `.catch(() => ({}))` body parse, validation → 400, `{ ok: true }`, a local `42P01`-aware error helper. **Not** `lib/results.ts` — that path goes through `persist()`; bench is metadata like avatar.
- `app/members/[memberId]/page.tsx:206-235` — identity header, the toggle's seat; `readOnly`/`readOnlyReason` already computed at `:108-111`; the `<h1>` at `:217` sits in a flex row (`:216`) beside the Active/Former pill (`:218-226`) and gets its own shield (t3).
- `components/MemberCell.tsx:8-14, 25-26` — widen the `Pick` to include `"isBenched"`; the shield is the fourth flex child between `</Link>` (`:25`) and the Former pill (`:26`) (t4).
- `components/BlackListTable.tsx` — header edit only (t4).

**The five MemberCell render sites (a shield there lands on all of them free):** `ClashTable.tsx:169`, `PerformanceTable.tsx:273`, `TotalPerformanceTable.tsx:169`, `BlackListTable.tsx:125`, `RosterTable.tsx:81`. All pass full `Member`-shaped objects, so widening the `Pick` compiles with **zero call-site edits**. `RosterTable` spreads (`{...s.member, isActive: s.isActive}`) and inherits new fields automatically. **The detail-page `<h1>` is the only name rendered outside MemberCell.** CSV exports (`app/page.tsx:78`, `ClashDetailView.tsx:56`, `app/members/page.tsx:51`), name-as-prop sites (`AvatarEditor`, `MemberHistoryTable`) and search filters need nothing.

**BlackListTable header anatomy (t4's target).** Subtitle `<p>` at `:77-81` (ternary on `noWeeks`; reads `rule.weekNumbers`, `rule.minKeysPerWeek`, `rule.maxKeysPerWeek`) and the gated paragraph at `:82-101` (comment + JSX; reads `rule.minMisses`, `weeksJudged`) are **both** replaced by one static line. Derived gates: `:56` `weeksJudged`, `:60` `noWeeks`, `:63` `nobodyJudged`, `:67` `anyoneJudged`; destructure at `:53`. **`anyoneJudged` has exactly one reader — the paragraph being removed — so the const goes with it.** `weeksJudged`/`noWeeks`/`nobodyJudged` stay (read at `:159`, `:169`, `:175-178`) and `membersJudged` stays (`:186`). The three tbody empty-state branches (`:156-192`) are untouched. The file's header comment (`:1-35`) asserts that **every threshold is read off `rule`, never a literal** — which is why the new line renders `rule.windowWeeks` rather than a hardcoded 4.

**getBlackList anatomy (t2's target).** Window `:377-380`; `rule` built `:382-389`; empty-window early return `:394`; roster gate `:401-404`; **the judged filter at `:417-418` is where the exclusion lands**; min-weeks-present gate `:443`; `rows` `:445`; `membersJudged: judged.length` at `:456` — i.e. counted **after** the roster and min-weeks gates and **before** the min-misses listing filter, so an exclusion at `:418` reduces it, which feeds the three empty states and the all-clear sentence.

**Avatar/badge collision:** none. `Avatar.tsx`'s `badge` slot (bottom-centre, `:66-70`) is dead code repo-wide, and `MemberCell`'s avatar is `size={32}` with no wrapper. A shield placed *after the name* collides with nothing. (A shield placed *on* the avatar would collide with the unused badge slot and, at `size={56}` on the detail page, with `AvatarEditor`'s camera button at `:127-135` — so don't.)

**Tooltip landscape:** there is no `Tooltip` component, no `aria-describedby`, no `group-hover`, no `role="tooltip"` anywhere, and `docs/reference/design-system.md` has no tooltip entry. The repo's one bare `title=` is `BlackListTable.tsx:143`, whose own comment records that `title` is not keyboard-reachable, never appears on touch, and is announced inconsistently. **The owner was shown that trade-off and chose native `title` anyway** — see pinned decisions.

## Seams (pinned — do not drift)

- **`Member.isBenched: boolean`** — required, camelCase in app code, `is_benched` in SQL.
- **`setMemberBenched(id: string, benched: boolean): Promise<void>`** in `lib/members.ts`.
- **Route:** `POST /api/members/[memberId]/bench`, body `{ benched: boolean }`, success `{ ok: true }`.
- **Header line, exact copy:** `Last {rule.windowWeeks} weeks of participation.`
- **Shield markup — byte-identical in both render sites except `size`.** REVISED in the
  2026-08-18 fix round (owner decision + a measured a11y defect); the block below is the
  one to diff against, and the pre-fix form with `text-up` and no `role` is superseded:
  ```tsx
  <span className="inline-flex shrink-0" role="img" title="This player is safe from the blacklist" aria-label="This player is safe from the blacklist">
    <ShieldCheck size={N} className="text-gold" />
  </span>
  ```
  gated by `{member.isBenched && …}`. `N` = **14** in MemberCell, **18** in the detail `<h1>` (matches the pill/icon scale there).
  `role="img"` because lucide-react stamps `aria-hidden="true"` on the svg unless an a11y
  prop is passed and `aria-label` on a bare `<span>` (role `generic`) is prohibited by ARIA
  in HTML and dropped — without the role the marker does not exist for AT. `text-gold`
  because the good-number token means "high participation / positive trend" in the very
  rows this marker appears in, so it read as "good player" rather than "excused"; gold is
  not a performance tier. **The tooltip copy is unchanged** — the owner was offered a
  rewrite and declined.

## Pinned decisions — do not relitigate

- **Native `title` tooltip** over an accessible pattern: the owner chose it after being shown that it is invisible on touch, unreachable by keyboard, and inconsistently announced. `aria-label` rides along (zero visual cost, matches the icon-only precedent); nothing more.
- **Static "Last 4 weeks"** over a dynamic count: the owner's call, made knowing it overstates the window on a young database.
- **Blacklist exclusion at the roster gate** — benched players are invisible to the list *including* the all-clear denominator.
- **Demo data:** bench **exactly one** demo member who is **not** among the 6 listed on the demo Black List, so the 6 rows are unchanged. `membersJudged` shifts 30 → 29, which is invisible in demo (that count renders only in the all-clear empty state, and demo has 6 rows). The implementer picks the member and **proves the choice by script**, not by eye.
- **CSV exports stay text-only** — no bench column; not asked for.
- **Not fixing here:** the TopBar chevron `disabled` focus defect; `participationColor` ×4; error-mapper consolidation. ~~the `aria-label`-on-a-bare-span announcement question~~ — **reopened and FIXED in the 2026-08-18 fix round**: the reviewer measured that it is not "weak announcement" but no announcement at all (lucide hides the svg; `aria-label` on role `generic` is dropped), so both spans gained `role="img"`. The native-`title` decision above is untouched.

## Doc blast radius (grepped at plan time — t5's edit list)

**The "six admin routes" count becomes seven, in eleven files:** `CLAUDE.md:16`, `README.md:196`, `.env.example:101`, `docs/project-map.md:30` (check `:20`), `docs/engineer-onboarding.md:227,393`, `docs/reference/auth.md:163,165,344` (**leave `:154`** — that says six data *pages* — **and `:178`**, a historical measurement), `docs/reference/deployment.md:295`, `.claude/rules/rendering.md:15` ("six declare it… ten hits" → seven/eleven) and `:20-41` (the verbatim sixteen-route table gains the bench route — **paste from a real `npm run build`, never hand-edit**), `.claude/rules/data-pipeline.md:28` (enumeration), `:33` (the backup/avatar/reset fragile-discrimination list gains bench → four), `:35` ("Six local mappers" → seven).

**`docs/user-guide.md`:** header description `:222`, `:229-243`, `:259` (the header no longer prints week numbers — say the dashboard shows only the summary line; the Missed Weeks column still prints them); `:288-295` (the on-screen key-totals warning is gone — the guide keeps the explanation, the app no longer shows it); a new Bench section; and **disambiguate `:269`** — the guide already uses "benched" for a present-with-0-keys row, so rename that older usage.

**`docs/reference/design-system.md` does not quote the header copy** (verified) — it gains the shield-icon pattern entry. **`docs/reference/data-pipeline.md`:** check for the member-metadata write path and add bench beside avatar if documented; state its absence if not.

**Honesty constraint for `auth.md`:** the six routes were *measured* refusing anonymous at Phase 3b. The seventh is guarded by construction (copied template) and verified by build + reading the guard. Never write that seven were measured.

## Constraints

- **Migrations** (`.claude/rules/supabase-schema.md`): numbered, forward-only, **idempotent** (`db:migrate` keeps no applied-migrations table and re-applies every file every run). Never edit an applied migration. Created via `db:migrate`, never the dashboard. A new **column** needs no `enable row level security` line — lever 1 already covers `members`; that caveat is for new *tables*.
- **Auth** (`.claude/rules/` + CLAUDE.md): `requireAdmin()` is the **first statement** of the handler body and **returns** a 401 rather than throwing. No data mutation may move to a Server Action. **Hide, don't disable** — the toggle must not exist in the tree for a non-writer, via the split pattern (`AvatarEditor`/`AvatarUploader`, `DataManagement`/`DataTools`). Check all four cells of the 2×2 permission grid.
- **UI:** tokens and primitives only, no hardcoded hex. `text-faint` (~3.05:1) is for decorative text only — never for anything the reader needs.
- **`done_when` methodology** (project memory; six instances across four orders): enumerate the corpus and **exclude `docs/tasks/` and `docs/build-log.md`**; prefer a positive assertion at a `file:line` seam over a negative grep; **never spell a banned identifier in the criterion *or* in a comment** (three implementers hit this last order by writing comments that matched their own greps); always run a positive control and paste its output.
- **Scratchpad filenames are prefixed per task** (`t1-`, `t2-`, …) — parallel agents share one directory and have clobbered each other before.
- **Mid-flight build/lint counts are unstable** while siblings edit the same tree; the integrator establishes the authoritative numbers.

## Cost forecast

**Estimate: 6.8M tokens** (range 5.8M–8.8M) by the planner's method
- Parallel build, 5 tasks (t1 tiny, t5 doc-heavy) — 2.2M
- Everything else (analyze, plan, gate, integrate, review) — 2.3M
- Report + commit — 1.3M
- Bounce allowance (1 review bounce) — 1.0M

**Calibration caveat, now on record.** `docs/build-log.md`'s `Cost:` actuals are **not** a usable basis: the 2026-08-17 maintenance pass proved `token-report.js` omits subagent transcripts entirely (they live in `<session>/subagents/agent-*.jsonl`, not inline as its header assumes), under-measuring orders roughly **15×**. The recent "−9%" and "−50%" under-runs are meter artifacts; the honest prior is the older **8-of-8 over-run** streak. By dispatch-count (~9 dispatches × last measured per-agent spend), true all-in cost plausibly lands nearer **$25–35** than the nominal figure. Padding left as shipped, none added.

Window at plan time: 5-hour 24% used per the last status-line render — **154h stale**, so treat as unknown; `/usage` is the authority.

## Plan cost

**Measured: ~1.1M tokens at the gate** (main session ~1.1M + task-planner 80.3k) · ~16% of the forecast above. Nominal figures from the same under-measuring meter.

## Tasks

- id: t1
  summary: Migration 0003 — add is_benched to members, idempotent
  agent: db-migration-specialist
  owns:
    - supabase/migrations/0003_*.sql
  depends_on: []
  docs_touched: []
  claimed_by: "db-migration-specialist"
  state: done
  changelist:
    - "NEW `supabase/migrations/0003_add_members_is_benched.sql` — one statement:
      `alter table members add column if not exists is_benched boolean not null default false;`
      Name matches the existing style (zero-padded number + lowercase snake_case phrase:
      `0001_init.sql`, `0002_lock_down_public_api.sql`); it sorts last, so `db:migrate`
      applies it after 0001 creates the table."
    - "Re-run safety by construction, two clauses: (a) `if not exists` makes every pass after
      the first a no-op instead of `42701 duplicate_column` — which matters more than usual
      because db-migrate sends each file as ONE simple query wrapped in an implicit
      transaction, so a duplicate-column error would abort the whole file and fail the run;
      (b) the default is the CONSTANT `false`, not an expression, so the one-time backfill is
      deterministic, cannot be re-evaluated over rows an admin has since benched, and is
      recorded as catalog metadata (no table rewrite, no long lock)."
    - "`alter table members`, deliberately not `alter table if exists members`: 0001 creates
      the table and sorts first, and a missing table should fail loudly (42P01) rather than be
      skipped while the run reports success."
    - "No `enable row level security` line, and the file says why: 0002's lever 1 already
      enabled RLS on `public.members`; RLS is a table-level property a new column inherits.
      The `.claude/rules/supabase-schema.md` per-table RLS invariant is scoped to new TABLES
      (lever 4 revokes future grants but does not enable RLS). Lever 2's `revoke all … from
      anon, authenticated` is relation-wide (relacl), not per column, so the column is
      unreachable to those roles by inheritance. No view is recreated, so 0001's
      `create or replace view` / `reloptions` `security_invoker` trap is not in play."
    - "Type: `boolean`, mirroring `is_active boolean not null default true` (0001_init.sql:32,
      intent recorded at :17). Measured read-back for this project is Postgres `boolean` -> JS
      `boolean`, so no coercion is needed in `lib/data.ts` (t2's file regardless). No `numeric`
      introduced."
    - "0001 and 0002 untouched: `git diff --name-only supabase/migrations/` is EMPTY and
      `git status --porcelain supabase/migrations/` shows only `?? 0003_add_members_is_benched.sql`."
  migration_command: "npm run db:migrate  — NOT RUN. No agent in this project has database
    access; the owner applies it. Running it twice is the intended re-runnability proof."
  assumptions:
    - "Nothing outside `supabase/migrations/` was edited; `lib/types.ts` / `lib/data.ts` row
      mappers are t2's slice, as is `lib/mock-data.ts`."
    - "Backfill semantics taken as unambiguous: existing rows -> false = pre-feature behaviour
      (nobody benched until an admin says so). No data backfill statement was written."
    - "No `npm run build` here: a SQL file is not compiled, and t2 is editing `lib/` in
      parallel, so a mid-flight build would report the sibling's state, not this task's."
  done_when:
    1. A new `supabase/migrations/0003_<name>.sql` exists, named in the same style as the existing files (list them first). Paste the filename and the full contents.
    2. It contains in substance `alter table members add column if not exists is_benched boolean not null default false;`.
    3. Re-run safety is asserted by construction — cite the `if not exists` clause and the constant default in the changelist.
    4. `git diff --name-only supabase/migrations/` shows only the new file; 0001 and 0002 are untouched.
    5. No RLS statement added — state why (lever 1 already covers `members`; a column is not a new table).
    6. No DB access from agents. The owner applies it with `npm run db:migrate`; say so rather than implying it was applied.

- id: t2
  summary: Member.isBenched through the read/write lib layer + the blacklist exclusion
  agent: data-pipeline-specialist
  owns:
    - lib/types.ts
    - lib/data.ts
    - lib/backup.ts
    - lib/compute.ts
    - lib/members.ts
    - lib/mock-data.ts
  depends_on: []
  docs_touched: []
  claimed_by: "data-pipeline-specialist"
  state: done   # fix round 2026-08-18 (excusedCount) landed; see the FIX ROUND changelist entries
  changelist:
    - "`lib/types.ts:18` — `Member.isBenched: boolean`, REQUIRED. Comment above it records why
      required beats optional (an optional field renders a false negative for a member whose
      flag was never threaded) and names the column + migration. Also reworded `:81`'s
      'incl. benched 0-key weeks' to 'zero-key weeks' — same terminology collision as
      compute.ts `:406`, same file class, so it was fixed in the same pass."
    - "`lib/data.ts:34` — `MemberRow.is_benched: boolean`; `:111` — `isBenched: m.is_benched
      === true` in `toMember()`. No `Number()`-style coercion (Postgres `boolean` reads back as
      a JS boolean here), but `=== true` is kept deliberately so a row from a database without
      0003 applied yields `false`, not `undefined`, on a required field. `:67`'s `select *`
      needed no edit."
    - "`lib/backup.ts:108` — restore normalizer `is_benched: bool(m.is_benched, false)`, via the
      existing `bool()` helper at `:80`. Default false, unlike `is_active`'s true: a backup
      taken before this order has no such key and 'nobody excused' is that file's truth, so an
      old backup restores cleanly. `:142` / `:144` — the column added to BOTH the insert's
      column list and its values list. Export side inherits via `select *` (`:36`), unchanged."
    - "`lib/persist.ts` — NO edit; `git diff -- lib/persist.ts` is 0 bytes. Its
      `on conflict do update set` touches only `in_game_name`, so a re-import can neither clear
      nor set the flag: bench state survives exactly as `avatar_url` and `is_active` do today.
      Adding the column there would have made every import silently un-excuse the roster."
    - "`lib/members.ts:17` — `setMemberBenched(id: string, benched: boolean): Promise<void>`,
      shaped on `setMemberAvatar(id: string, avatarUrl: string | null): Promise<void>` (`:5`)
      directly above: `getDb()`, one tagged-template `update … where id = ${id}`, no return
      value, no transaction. Direct SQL is in-rule — `.claude/rules/data-pipeline.md` forbids
      bypassing `persist()` for INGEST, and this is member metadata (one column, one existing
      row, no payload, no week), the same class as the avatar write."
    - "`lib/compute.ts:426` — the roster gate is now
      `.filter((m) => activeIds.has(m.id) && !m.isBenched)`. Because `membersJudged` is
      `judged.length` (`:464`), computed AFTER this gate, an excused member leaves `rows` AND
      the all-clear denominator — the pinned decision. Comment at `:422-425` says so, and the
      function's doc comment gained the exception at `:375-377`."
    - "`lib/compute.ts` terminology: `:410` (was `:406`) now reads 'incl. a zero-key row'. The
      same collision at `:114`, `:135`, `:256` and `:371` was reworded in the same pass, so
      inside this file the old word survives only as part of the column name. Checked:
      `grep -nE '(^|[^_])benched' lib/compute.ts lib/types.ts` returns nothing (exit 1);
      positive control, same pattern against `lib/parse.ts lib/results.ts`, returns 4 hits.
      Those two files still use the old sense and are NOT in this task's owns set — flagged
      for t5/a later pass, not touched."
    - "`lib/mock-data.ts:53` — `const EXCUSED_DEMO_MEMBER = \"NcRoughNeck\"` (m7, a NAMED
      mockup member); `:64` — `isBenched: name === EXCUSED_DEMO_MEMBER` in the MEMBERS map, so
      exactly one of the 30 demo members carries the flag. NcRoughNeck is not among the six the
      demo Black List lists (m28 Tindra, m16 Korgath, m29 Vorgath, m20 Ysolde, m26 Nephele,
      m12 Vael), so the demo list is byte-identical apart from `membersJudged` 30 → 29, which
      renders only in the all-clear empty state demo never reaches. Being a NAMED member, m7
      sits high in the performance tables, so t4's shield has a visible demo home."
    - "No doc edits: t2's `docs_touched` is empty and every doc in the blast radius (incl.
      `docs/reference/data-pipeline.md`, whose member-metadata write path is t5's done_when #7)
      belongs to t5. `setMemberBenched` is the second member-metadata writer and wants a line
      beside `setMemberAvatar` there — noted for t5, not written here."
    - "FIX ROUND 2026-08-18 (UX review) — `BlackListResult.excusedCount: number`, TWO files,
      no behaviour change to `rows` or `membersJudged`. The review found that the shield can
      never render on the Black List: the roster gate drops excused members before `rows` is
      built, so every `BlackListRow.member` reaching `MemberCell` has the flag false BY
      CONSTRUCTION — the one surface where 'exempt from this list' is on-topic is the one place
      the marker cannot appear. The all-clear sentence separately read 'none of the 28 players
      judged' on a 30-member roster with nothing on screen explaining the 28. One number fixes
      both, and t4 renders it."
    - "`lib/types.ts:184` — `excusedCount: number` on `BlackListResult`, required, after
      `membersJudged`. Comment (`:170-183`) records three things a future reader will otherwise
      re-derive: WHY it exists (the exclusion is invisible without it), that it is
      ROSTER-SCOPED, and that it is **not a partition** — it applies only the roster gate while
      `membersJudged` also applies `rule.minWeeksPresent`, so the two need not sum to the roster
      size and neither is derivable from the other."
    - "`lib/compute.ts:422-424` — `ds.members.filter((m) => activeIds.has(m.id) && m.isBenched)
      .length`, computed off the SAME `activeIds` set the roster gate at `:433` uses, so the
      number cannot disagree with the gate that produced it. Roster-scoped deliberately: someone
      excused who is ALSO off the current roster was never going to be judged, and counting them
      would print a figure that reconciles with nothing the reader can see. Proven by run 4
      below, which adds exactly that member and still reports 1."
    - "`lib/compute.ts:404` — the empty-window early return returns `excusedCount: 0` alongside
      the other zeroed fields, so the shape is uniform across BOTH exits and no caller has to
      branch on which one it got. Comment says why 0 is the honest value there rather than
      'unknown': with no judged week there is no roster to scope the count to."
    - "`lib/compute.ts:481` — the success exit returns it. `:378-380` — the function's doc
      comment now names `excusedCount` beside the roster exception it explains."
    - "Nothing else moved: `rows`, its ordering, `membersJudged`, the roster-gate conjunct
      ordering, the restore default, `lib/persist.ts` (still a 0-byte diff) and `toMember`'s
      `=== true` are all untouched, per the review's do-not-touch list. An mtime sort over
      `lib/*.ts` puts `compute.ts` and `types.ts` alone in this round's window (09:43-09:44);
      the other four owned files sit at 06:31-06:32 from the first pass."
    - "Terminology sweep re-run after the edit: `grep -nE '(^|[^_])benched' lib/compute.ts
      lib/types.ts` still returns nothing (exit 1) — the new comments use 'excused' throughout.
      Positive control, same pattern against `lib/parse.ts lib/results.ts`: 4 hits, unchanged."
    - "No doc edits in the fix round either — t2's `docs_touched` is still empty and
      `docs/reference/data-pipeline.md` is t5's file. `excusedCount` is a read-path/derived
      field, so the ingest doc has nothing to say about it; the surface that DOES want a line
      is the Black List description in `docs/user-guide.md` (also t5's), whose all-clear-N
      paragraph now understates what the screen shows. Flagged, not written."
  assumptions:
    - "Migration 0003 is NOT applied — no agent has DB access. Nothing here queries the column;
      correctness against the migrated schema is by construction, and `toMember`'s `=== true`
      plus the restore normalizer's `false` default keep an unmigrated/old-backup row sane."
    - "`lib/seed.ts` needs no edit and got none, but note the consequence: `npm run seed` goes
      through `persist()`, which writes no member metadata, so a SEEDED database has nobody
      excused while demo mode shows m7 excused. Same asymmetry avatars already have; benign."
    - "`git diff` on `lib/compute.ts` and `lib/types.ts` shows more than this task: the Black
      List section itself was uncommitted working-tree work from the previous order at session
      start. The t2 edits are only the ones enumerated above."
  done_when:
    1. `lib/types.ts` `Member` carries required `isBenched: boolean` (cite file:line).
    2. `lib/data.ts`: `MemberRow` has `is_benched: boolean`; `toMember()` maps `isBenched: m.is_benched === true` (cite both).
    3. `lib/backup.ts`: the restore normalizer maps `is_benched` through the existing `bool()` helper defaulting false, and the restore insert names the column in **both** the column list and the values (cite all three).
    4. `git diff lib/persist.ts` is **empty** — state in the changelist WHY (the conflict-update touches only `in_game_name`, so bench state survives re-imports).
    5. `lib/members.ts` exports `setMemberBenched(id: string, benched: boolean)`, shaped on `setMemberAvatar` directly above it (paste both signatures).
    6. `lib/compute.ts`'s roster gate excludes benched members (cite the line), so a benched member is absent from `rows` **and** from `membersJudged`; the `:406` comment no longer uses the word "benched" for a zero-key row.
    7. Scratchpad script `t2-bench-check.mts`: import `lib/mock-data` + `getBlackList`; with shipped demo data → `rows.length === 6`, the chosen benched member's id **absent** from the row member ids, `membersJudged === 29`. Positive control: negate that member's flag in memory → `membersJudged === 30`, rows still 6. Paste both outputs.
    8. `npm run build` exits 0; `npm run lint` at the 9-errors-1-warning baseline with nothing new in `lib/`.
    9. *(fix round)* `BlackListResult` carries `excusedCount: number` (cite file:line) and `getBlackList` returns it from **both** exits, the empty-window one as `0` (cite both).
    10. *(fix round)* It counts only members who pass the roster gate and are dropped by the flag — not every excused member in the dataset. Prove the scoping with a control that adds an excused member who is off the roster and shows the count unmoved.
    11. *(fix round)* `t2-bench-check.mts` EXTENDED (not replaced), three runs pasted: shipped demo → `excusedCount === 1`, `membersJudged === 29`, rows 6 · flag negated → `excusedCount === 0`, `membersJudged === 30`, rows 6 · empty dataset → `excusedCount === 0`, no throw.
    12. *(fix round)* `rows`, `membersJudged`, the roster-gate conjunct ordering and the four other owned files are unchanged; build 0 and lint at baseline.

- id: t3
  summary: Bench write route + Bench/Unbench toggle + detail-page shield
  agent: flow-implementer
  owns:
    - app/api/members/[memberId]/bench/route.ts
    - components/BenchToggle.tsx
    - app/members/[memberId]/page.tsx
    - app/api/restore/route.ts   # fix round 2026-08-18 only — one mapper branch, see owns_note
  depends_on: [t2]
  docs_touched: []
  claimed_by: "flow-implementer"
  state: done   # fix round 2026-08-18 complete: H1 (restore 42703 mapper), H2 (role="img"),
                # owner's text-gold change, M4 (aria-disabled + guard), M5 (live region + consequence)
  owns_note: "app/api/restore/route.ts added to owns for the fix round only, by instruction."
  changelist:
    - "NEW `app/api/members/[memberId]/bench/route.ts` — `POST`, body `{ benched: boolean }`,
      `{ ok: true }` on success. Shaped on the avatar sibling: `runtime = \"nodejs\"` (`:9`) +
      `dynamic = \"force-dynamic\"` (`:10`), `.catch(() => ({}))` body parse (`:35`), 400 with
      `{ ok: false, error }` (`:41-46`), local `42P01`-aware mapper `benchError` (`:62`).
      **`const denied = await requireAdmin(); if (denied) return denied;` at `:16-17` — the
      first statement of the handler body** (body opens `:15`), ahead of `await params`, the
      body read and the try. Validation is `typeof benched !== \"boolean\"`, not truthiness, so
      a missing or typo'd field can never be read as one of the two states."
    - "DECODE: the route **does** `decodeURIComponent` the segment (`:28-32`), following the
      `results` sibling and `app/members/[memberId]/page.tsx:86-90` rather than `avatar`, which
      skips it. Reason is specific to what the id is used for: `lib/persist.ts:23` slugs member
      ids with a `\\p{L}`-preserving pattern, so a non-ASCII name yields a non-ASCII id and the
      segment arrives percent-encoded. A raw segment makes `where id = …` match zero rows;
      postgres.js raises nothing for a zero-row UPDATE, so the caller would be handed
      `{ ok: true }` for a write that never happened — a silent lie, not a visible error. The
      avatar route has the same latent hole (not my file; flagged, not touched)."
    - "One mapped code beyond the template, with the reason in-comment (`:65-68`): `42703`
      (undefined_column) → \"Run `npm run db:migrate` first\". Tables exist but 0003 unapplied is
      this route's likeliest first real failure, and the generic branch would print a bare code
      number where the fix is the one `42P01` already names. Same sanitization discipline
      otherwise — the driver's message is never echoed."
    - "NEW `components/BenchToggle.tsx` — client leaf, no read-only branch inside it by design.
      `fetch` → `res.ok && data.ok` → `router.refresh()` (`:36-47`), copied from
      `AvatarEditor.tsx:103-121`; `Loader2` spinning while pending, `ShieldCheck`/`ShieldOff`
      otherwise; errors in-place as `text-xs text-down` (`:57`). Label names the ACTION:
      `next = !isBenched` (`:28`) drives both the icon and the word, so an unbenched member's
      button reads Bench and a benched one's reads Unbench. Icons at 15 to match its neighbour
      `ExportButton`; `btn-ghost`, no hardcoded colour."
    - "`app/members/[memberId]/page.tsx:221-226` — the shield in the `<h1>` flex row, between
      the name and the Active/Former pill, gated `{member.isBenched && …}`, markup byte-identical
      to the pinned contract with `size={18}`. Rendered HTML verified:
      `<span class=\"inline-flex shrink-0\" title=\"This player is safe from the blacklist\"
      aria-label=\"This player is safe from the blacklist\">` + an 18×18 svg."
    - "`app/members/[memberId]/page.tsx:247` — `{!readOnly && <BenchToggle … />}` inside the
      header's `ml-auto` action group (now `flex flex-wrap items-start gap-2`, `:240`), beside
      the export button. ABSENT, not disabled. `readOnly = !signedIn || source === \"demo\"`
      (`:111`) is a single boolean covering three of the four permission cells, so demo+admin —
      the one that gets forgotten — is hidden by the same expression as the other two; there is
      no second condition that could miss it. No read-only reason copy added here: the avatar in
      this same header already prints it, and a second copy would say it twice."
    - "No doc edits — t3's `docs_touched` is empty; the six→seven route count is t5's."
    - "FIX ROUND 2026-08-18 · OWNERSHIP EXTENDED by `app/api/restore/route.ts` for this round
      only (the reviewer found a real defect no task owned). H1: `databaseError()` gains a
      `42703` branch at `:86-88`, mirroring the one already on `benchError`
      (`bench/route.ts:71-73`). t2 added `is_benched` to `lib/backup.ts`'s restore INSERT
      column list, so against an unmigrated database a restore now wipes all four tables and
      fails on the first member insert — inside the same `begin()`, so the rollback loses no
      data, but the old mapper printed `Restore failed — the database rejected it (code
      42703).` and never named the one command that fixes it. Copy: \"This database is missing
      a column the backup needs. Run `npm run db:migrate` first.\" NOTHING ELSE in that file
      moved: `git diff --stat` is `1 file changed, 12 insertions(+)`, one hunk
      `@@ -74,6 +74,18 @@`, entirely inside `databaseError` — the guard, the split catch, the
      `DatabaseFailure` provenance marker, `fromDatabase()`, both status codes and the
      no-`code` passthrough are byte-identical."
    - "FIX ROUND · H2 + owner colour change, `app/members/[memberId]/page.tsx:235-236`. The span
      gains `role=\"img\"` and the icon becomes `text-gold`. The reviewer MEASURED that
      lucide-react stamps `aria-hidden=\"true\"` on the svg unless an a11y prop is passed
      (`node_modules/lucide-react/dist/cjs/lucide-react.js:92`) and that `aria-label` on a bare
      `<span>` (role `generic`) is prohibited by ARIA in HTML and dropped by browsers and AT —
      so the marker did not exist for AT at all, which is stronger than the 'weakly announced'
      this ledger recorded as accepted. `role=\"img\"` makes the `aria-label` valid and
      announced; it does NOT reopen the native-`title` decision, it repairs the second carrier.
      `text-gold` is the owner's call: the good-number token means high participation / a
      positive trend in the very rows this marker appears in (and is the Black List's own
      all-clear glyph+colour), so green read as 'good player' rather than 'excused'; gold is
      not a performance tier. Tooltip copy UNCHANGED — the owner was offered a rewrite and
      declined. The pinned Seams block was updated to the new markup so the integrator diffs
      against the current contract; t4 ships the identical span at `size={14}`. Comment at
      `:219-233` records both reasons so neither is 'tidied' back."
    - "FIX ROUND · M4, `components/BenchToggle.tsx:39`, `:80-81`. `disabled={pending}` →
      `aria-disabled={pending}` plus `if (pending) return;` as the FIRST statement of `save()`,
      with the dim moved onto the `aria-disabled:` variant. A focused button that goes natively
      `disabled` mid-flight cannot hold focus, so the browser drops it to `<body>` and the
      admin's next Tab restarts at the top of the document — on the control they are most
      likely to press twice. Exactly the defect `Pagination.tsx` was fixed for last order and
      exactly its shipped shape (`:107-110`, `:263`, `:266`, `:278`, `:281`); `BenchToggle` is
      new, so it takes the corrected form without touching a sibling. The class string is
      `btn-ghost aria-disabled:opacity-40 aria-disabled:hover:border-border
      aria-disabled:hover:text-muted` — btn-ghost's own `disabled:opacity-40`
      (`app/globals.css:86`) can no longer match anything. All three variants verified present
      in the built CSS: `.aria-disabled\\:opacity-40[aria-disabled=true]{opacity:.4}` and the
      two hover suppressions. THIS SUPERSEDES the third assumption below, which argued the
      native attribute was fine here; the reviewer is right that the argument is about focus,
      not about permissions, so pagination's reasoning transfers whole."
    - "FIX ROUND · M5, `components/BenchToggle.tsx:28`, `:42`, `:54-58`, `:62`, `:88-92`. A
      `role=\"status\" aria-live=\"polite\"` `sr-only` span (the `WeekTransition.tsx:167`
      precedent) carries a `status` string set from the CLICK HANDLER, never an effect:
      'Benching this player…' on start, then 'Benched. This player is excluded from the Black
      List.' / 'Unbenched. This player is judged by the Black List again.' on success, and
      'Bench update failed. <copy>' on failure — both halves, start and outcome, as
      `.claude/rules/ux.md` requires, because `router.refresh()`, the shield and the label
      change are all silent. Second half of M5, `:96-100`: a `text-xs text-muted` line under
      the button WHEN BENCHED (and not mid-flight) reading 'Excluded from the Black List until
      unbenched.' — 'Unbench' names what is now available and never what benching did.
      `text-muted` (~6.23:1), not `text-faint`, because the reader needs it. Admin-only by
      construction: the whole component is gated at `page.tsx:260`."
    - "FIX ROUND · unchanged on purpose: the guard and the whole security path, the
      `decodeURIComponent` decision, `benchError`'s `42703` branch, the absence of a
      confirmation dialog on Bench (the UX reviewer recorded that a confirm would be
      inconsistent here — reversible in one click, confirmations reserved for lossy
      operations), the tooltip copy, and the `size={18}`. Still no doc edits: `docs_touched` is
      empty and t5 owns the knowledge layer. Two things t5 (or a follow-up) should carry, since
      they are now falsified in files I do not own: `docs/reference/design-system.md`'s shield
      entry quotes the pre-fix markup (`text-up`, no `role`), and `.claude/rules/ux.md`'s
      anti-`disabled` paragraph names TopBar as the only remaining native-`disabled` focus
      defect — true again now, but it was written before `BenchToggle` existed."
  assumptions:
    - "Migration 0003 is NOT applied on any database an agent can reach, and no agent has
      credentials. The route targets the migrated schema; against an unmigrated one it returns
      the new `42703` sentence instead of a bare code."
    - "`.env.local` in this workspace points at a LIVE, reachable database (member ids read
      `m-kr4d`-style, persist.ts's slug format, not mock-data's `m1`), so the two anonymous
      cells below were measured against real states, not stubs."
    - "SUPERSEDED in the fix round, kept for the record: `disabled={pending}` was argued to be
      in-flight state rather than a permission or a position, following the AvatarEditor
      precedent. That reads the pagination rule too narrowly — the argument there is about
      FOCUS (a browser cannot hold focus on a disabled element), which applies to any control
      that disables itself under a focused finger. Now `aria-disabled` + a no-op guard."
    - "FIX ROUND: `app/api/restore/route.ts` was outside t3's `owns` set as planned and was
      added to it for this round only, by explicit instruction, because the reviewer found a
      defect there that t2's `lib/backup.ts` change created and no task owned. It is not
      claimed beyond the one mapper branch."
  verification:
    - "Route table (real `npm run build`, exit 0): `├ ƒ /api/members/[memberId]/bench` between
      `/avatar` and `/results`; seventeen routes total."
    - "MEASURED, live + anonymous, `next start` on 3117: `POST /api/members/m1/bench` returns
      `401 {\"ok\":false,\"error\":\"Sign in as the clan admin to do that.\"}` for a valid body,
      an absent body AND a `\"yes\"` body — identical each time, so the 400 branch is provably
      never reached before the guard. `GET /members/m-kr4d` contains 0 occurrences of \"Bench\";
      positive controls in the same HTML: 1 `>Export<`, and the avatar's
      \"Sign in as the clan admin to change this photo\"."
    - "MEASURED, demo + anonymous, `next start` on 3118 with `DATABASE_URL`/`POSTGRES_URL`
      blanked: `/members/m7` (NcRoughNeck) renders exactly 1 shield with the byte-identical span
      and an 18×18 svg, 0 occurrences of \"Bench\", and the demo copy control \"Sample-data photo
      — connect the clan database to change it\". Negative control: `/members/m1` (unbenched
      demo member) renders 0 shields."
    - "NOT VERIFIABLE HERE — live + admin. Only the owner holds the password, so the signed-in
      session path was never exercised: no agent has rendered the toggle, clicked it, or seen
      `setMemberBenched` reach Postgres. What IS established is branch selection (one boolean at
      `:111`), copy, markup, the guard's refusal of everyone else, and compilation. Demo + admin
      is likewise unexercised; it is covered by the same expression as demo + anonymous, which
      was measured."
    - "`npm run lint`: 9 errors, 1 warning — the stated baseline; zero hits in the three owned
      files. Counts are mid-flight (t4 edits concurrently); the integrator is authoritative."
    - "FIX ROUND, MEASURED — demo + anonymous, `next start` on 3123 with `DATABASE_URL` and
      `POSTGRES_URL` blanked, against a fresh `npm run build`. `/members/m7` renders exactly
      ONE shield and its serialized HTML is
      `<span class=\"inline-flex shrink-0\" role=\"img\" title=\"This player is safe from the
      blacklist\" aria-label=\"This player is safe from the blacklist\">` wrapping an 18×18
      `lucide-shield-check` svg carrying `class=\"… text-gold\"` AND `aria-hidden=\"true\"` —
      the lucide behaviour the reviewer measured, visible in the shipped output, which is what
      makes the wrapper's role the only thing announcing this marker. Negative control:
      `/members/m1` renders 0 shields. Both pages contain 0 occurrences of the toggle's label,
      i.e. it is still absent for a reader who cannot write."
    - "FIX ROUND, MEASURED — built CSS. `.text-gold{color:var(--color-gold)}`,
      `.aria-disabled\\:opacity-40[aria-disabled=true]{opacity:.4}`,
      `.aria-disabled\\:hover\\:border-border[aria-disabled=true]:hover{…}`,
      `.aria-disabled\\:hover\\:text-muted[aria-disabled=true]:hover{…}` and `.sr-only` all
      present in `.next/static/chunks/*.css`, so no class in this round is a dead string."
    - "FIX ROUND — `npm run build` exit 0, seventeen routes, table unchanged from the
      integrator's. `npm run lint`: 10 problems (9 errors, 1 warning), the baseline exactly,
      with zero hits in any of the four files this round touched (grepped by filename over the
      lint output: no matches). Counts are again mid-flight — t2 and t4 are running their own
      fix rounds in this tree — so the integrator is authoritative."
    - "FIX ROUND — STILL NOT VERIFIABLE: live + admin. Only the owner holds the password, so
      nobody has rendered the toggle signed in, pressed it, watched the live region announce,
      or seen the focus stay on the button through a real in-flight save. The keyboard-focus
      fix is verified by construction (the attribute is no longer native `disabled`) and by the
      CSS above, not by a keypress. Likewise nobody has triggered either `42703` branch: that
      needs a database with tables but without migration 0003, and no agent has database
      access."
  done_when:
    1. Read the route-handler guide in `node_modules/next/dist/docs/` before writing the route; say which file you read.
    2. The route mirrors the avatar template: `runtime` + `force-dynamic` exports; `const denied = await requireAdmin(); if (denied) return denied;` as the **first statement** of the handler body (cite the line); `.catch(() => ({}))` body parse; non-boolean `benched` → 400; `{ ok: true }` after `setMemberBenched`; a local `42P01`-aware error helper following `avatarError`.
    3. `npm run build`'s route table gains `ƒ /api/members/[memberId]/bench` — paste the route section.
    4. `components/BenchToggle.tsx` is a client leaf: POST → `res.ok && data.ok` → `router.refresh()`, `Loader2` while pending, in-place `text-xs text-down` error, label reflecting the action (Bench when unbenched, Unbench when benched).
    5. The page renders it in the identity header **only when `!readOnly`** (cite the conditional's file:line) — absent from the tree, not disabled, in all three read-only cells of the 2×2 grid, exactly as `AvatarEditor` gates.
    6. The `<h1>` flex row renders the pinned shield markup at size 18, gated on `member.isBenched` (cite file:line), byte-identical to the pack's contract apart from `size`.
    7. Build exits 0; lint at baseline. **State plainly that the live+admin path could not be exercised** (only the owner holds the password) — branch selection and copy verified, session path not.
    8. *(fix round, H1)* `app/api/restore/route.ts`'s `databaseError()` maps `42703` to a sentence naming `npm run db:migrate` (cite file:line), and **nothing else in that file changed** — show `git diff --stat` and the single hunk.
    9. *(fix round, H2 + owner decision)* Both shield render sites carry `role="img"` and `className="text-gold"`, tooltip copy unchanged, `size` the only difference between them. Paste the serialized span from a real render, not the source.
    10. *(fix round, M4)* `BenchToggle`'s button uses `aria-disabled`, not the native attribute, with the no-op guard as the first statement of the handler and the dim on the `aria-disabled:` variant (cite all three). Show the generated CSS proving the variants emit.
    11. *(fix round, M5)* A `role="status" aria-live="polite"` `sr-only` region announces start AND outcome, set from the handler and never from an effect; a `text-xs text-muted` line names the consequence while benched (cite both).
    12. *(fix round)* Build exits 0, lint at baseline, no lint hits in the four touched files, and the live+admin gap is restated rather than glossed.

- id: t4
  summary: MemberCell shield on five surfaces + Black List header single line
  agent: ui-design-specialist
  owns:
    - components/MemberCell.tsx
    - components/BlackListTable.tsx
  depends_on: [t2]
  docs_touched: []
  claimed_by: "ui-design-specialist"
  state: done   # fix round 2026-08-18 complete: shield text-gold + role="img", the miss rule in
                # the Missed-weeks column header, excusedCount in the header line and the all-clear
  changelist:
    - "`components/MemberCell.tsx:20` — the `Pick` widened to
      `\"id\" | \"inGameName\" | \"avatarUrl\" | \"isActive\" | \"isBenched\"`. ZERO call-site edits:
      all five render sites already pass a whole member object. Verified by hashing every
      git-tracked+untracked file before and after this task — the only files this task changed
      are its two owned ones (the sibling's three are t3's, landing concurrently)."
    - "`components/MemberCell.tsx:47-51` — the pinned shield, gated `{member.isBenched && …}`,
      placed after the name `</Link>` (`:33`) and before the Former pill (`:52`), `size={14}`,
      `className=\"text-up\"`. Cross-checked against t3's copy at
      `app/members/[memberId]/page.tsx:222-224`: the `<span>` line is byte-identical, the icon
      line differs only in `size` (14 vs 18) and indentation. `ShieldCheck` imported at `:2`
      (lucide-react, as everywhere else); the file stays server-safe — no `\"use client\"` added."
    - "`components/MemberCell.tsx:10-15, 34-46` — comments record why the marker lives in this one
      component rather than five tables, why it sits after the name rather than on the avatar
      (corner slot + the camera button at the larger size), and that the native hover text is a
      deliberate, accepted trade-off rather than an oversight."
    - "`components/BlackListTable.tsx:86-88` — the header is now one unconditional line,
      `Last {rule.windowWeeks} weeks of participation.`, replacing BOTH the old ternary subtitle
      and the gated rule paragraph. The header `<div>` (`:71-89`) holds the `SectionTitle` and
      exactly one `<p>`; no ternary, no week list, no second paragraph. Rendered proof from the
      running dev server: `<p class=\"mt-1 text-sm text-muted\">Last <!-- -->4<!-- --> weeks of
      participation.</p>`, with the two old sentences absent from the HTML."
    - "`components/BlackListTable.tsx` — the fourth derived gate (the one whose only reader was
      the paragraph just deleted) removed with it; `weeksJudged` (`:56`), `noWeeks` (`:60`) and
      `nobodyJudged` (`:63`) stay, and `membersJudged` stays. Exactly three gates after the
      destructure."
    - "The three tbody empty-state branches are UNTOUCHED (now `:143-179` after a 13-line drift
      up). The change is two hunks, `@@ -62,8 +62,4 @@` and `@@ -75,29 +71,20 @@`; the second ends
      at old line 103, so neither reaches the empty-state region that started at old `:156`.
      (The file is untracked, so `git diff` shows nothing for it — the hunks come from a
      scratchpad reconstruction of the pre-edit file, `t4-rebuild-orig.js`, whose diff against the
      current file contains those two hunks and nothing else, which is itself the check that the
      reconstruction was exact.)"
    - "`npm run build` exits 0 (17 routes, `ƒ /api/members/[memberId]/bench` already present from
      t3). `npm run lint`: 10 problems, 9 errors 1 warning — the baseline exactly, nothing in
      either owned file."
    - "FIX ROUND 2026-08-18 (UX review) — four changes across the same two owned files: the
      shield's colour + role, the Missed-weeks column header, and `excusedCount` rendered in
      two places. No third file touched; `git status --porcelain` shows nothing new."
    - "FIX ROUND · owner decision + H2, `components/MemberCell.tsx:61-62`. The span gains
      `role=\"img\"` and the icon becomes `text-gold`. Byte-diffed against t3's copy
      (`app/members/[memberId]/page.tsx:235-236`): the `<span>` line is byte-identical and the
      icon line differs only in `size` (14 vs 18) and indentation, which is the pinned contract.
      MEASURED in served HTML (demo mode, `next start`): the svg carries
      `class=\"lucide lucide-shield-check text-gold\" aria-hidden=\"true\"` — lucide's own
      hiding, which is exactly why the wrapper's `role=\"img\"` is now the only thing that
      announces this marker. Comment at `:40-56` records BOTH reasons (the a11y mechanism and
      why gold rather than the good-number token) so neither is tidied back. Tooltip copy
      untouched; the native-`title` decision is not reopened."
    - "FIX ROUND · H1, `components/BlackListTable.tsx:136`. The Missed-weeks column header now
      reads `Missed weeks (under {rule.minKeysPerWeek} of {rule.maxKeysPerWeek} keys)` —
      rendered `MISSED WEEKS (UNDER 3 OF 5 KEYS)` under the thead's `uppercase`. The definition
      of the accusation now sits in the same row as the accusation, at zero vertical cost and
      without touching the owner's one-line header. Both numbers come off `rule`, per this
      file's no-literals invariant. The `th` has no `whitespace-nowrap`, and the longest
      unbreakable token is short, so the column's min-content width is unchanged and no new
      horizontal scroll is forced; the header cell simply wraps in a narrow column."
    - "FIX ROUND · H3 + M1, `components/BlackListTable.tsx:62` (destructure), `:110-114`
      (header line) and `:221-226` (all-clear clause). Both readers of t2's `excusedCount` are
      gated `excusedCount > 0`, so at zero the header is EXACTLY the owner's single line and
      the all-clear sentence is byte-identical to what shipped. Singular handled through the
      file's existing `plural()` helper — 'player is'/'players are' in the header,
      'player was'/'players were' in the clause. The clause is one clause and restates no
      threshold: the sentence it hangs off already states the rule."
    - "FIX ROUND · the three tbody empty-state branches were NOT restructured. The all-clear
      branch's `<span>`, its icon, its wrapper and the two branches above it are unchanged; the
      only edit inside that region is the conditional fragment appended to the all-clear's
      existing sentence, with the terminating `.` moved onto its own JSX line (JSX strips
      newline-adjacent whitespace, so the rendered punctuation is unchanged at zero — verified
      in the render below, not assumed)."
    - "FIX ROUND · this round's comment additions: `:31-41` at the top of the file records that
      the excused are structurally invisible on this card and that BOTH renderings are gated;
      `:96-108` on the header line; `:127-135` on the column header; `:208-217` on the clause.
      They exist because the next reader will otherwise ask why a list of failures mentions
      people who are not on it."
    - "FIX ROUND · MEASURED, demo mode (`next start`, `DATABASE_URL` and `POSTGRES_URL`
      blanked), overview page. Header HTML: `<p class=\"mt-1 text-sm text-muted\">Last 4 weeks
      of participation.</p>` then `<p class=\"mt-0.5 text-sm text-muted\">1 player is excused
      from this list.</p>` — the singular, from m7 NcRoughNeck. Column header:
      `<th class=\"px-3 py-2 font-medium\">Missed weeks (under 3 of 5 keys)</th>`. The Black
      List's 6 demo rows are unchanged and the section contains ZERO shield spans, which is the
      structural point: the marker cannot appear here, which is why the count is rendered
      instead. `/members` and `/` each render exactly ONE shield (m7), serialized in the
      verification block below."
    - "FIX ROUND · MEASURED, live database (`next start`, real `.env.local`), overview page —
      the ZERO case on a real render: nobody excused, so the header is the single line with the
      excused `<p>` ABSENT from the HTML (`excused from this list` occurs 0 times) and 0 shield
      spans on the page. The owner's one-line header is exactly what ships today."
    - "FIX ROUND · MEASURED, all-clear branch. Demo always has 6 rows, so the branch is
      unreachable from a page render; it was driven directly with a synthetic
      `BlackListResult` (`rows: []`, `membersJudged: 28`) at excusedCount 2 / 1 / 0 via
      `react-dom/server`, script `t4-allclear-render.mts` in the scratchpad (t4- prefixed,
      imports the repo by file URL — nothing written into the project tree). Rendered text:
      2 → '…none of the 28 players judged missed 2 or more of the weeks they played, and 2
      excused players were not measured.' · 1 → '…and 1 excused player was not measured.' ·
      0 → '…of the weeks they played.' with no clause and no header line."
    - "FIX ROUND · `npm run build` exits 0, seventeen routes, table identical to the one in
      `.claude/rules/rendering.md`. `npm run lint`: 10 problems (9 errors, 1 warning) — the
      baseline — and a filename grep over the lint output returns 0 hits in either owned file.
      Counts are mid-flight; the integrator is authoritative."
  assumptions:
    - "The pinned markup was used verbatim, including its one long attribute line: there is no
      prettier in this repo (no config, no dev dependency, `lint` is bare `eslint`), so nothing
      reformats it and byte-identity with t3's copy survives."
    - "`git diff --name-only` could not be the literal test for done_when #1 — the working tree
      arrived with ~20 files already modified by earlier orders, one owned file
      (`components/BlackListTable.tsx`) is still untracked, and t3 was writing three files in
      parallel. A before/after content-hash manifest over `git ls-files -co` was used instead;
      it is the same assertion, scoped to this task's own writes."
    - "The benched state could not be seen rendered. The dev server already running on this repo
      is pointed at the LIVE database, where migration 0003 is not applied and nobody is excused,
      so every member serialises as not-excused (`\"isBenched\":false` appears in `/members`'s
      flight payload — which does prove the field reaches a MemberCell call site) and the gate
      correctly renders nothing. The demo member t2 flagged is unreachable while a connection
      string resolves. The gate's true branch is verified by construction and by the type check,
      not by a screenshot."
    - "No doc edits: t4's `docs_touched` is empty. The shield-icon entry for
      `docs/reference/design-system.md` is t5's done_when #6."
    - "FIX ROUND · done_when #3 below is SUPERSEDED in one clause by the reviewer's instruction:
      the header `<div>` now holds the `SectionTitle` and up to TWO `<p>`s, the second gated on
      `excusedCount > 0`. Everything else in #3 still holds — no ternary, no week-number list,
      and at zero excused the rendered header is exactly the one line #3 pins (proved on a live
      render). Read #3 as 'exactly one unconditional `<p>`'."
    - "FIX ROUND · ESCALATED, not fixed: `docs/reference/design-system.md:78-89` is now
      falsified twice over and is t5's file, not mine. Its 'Name-adjacent status marker' entry
      still calls the shield green, quotes the pre-fix markup (`text-up`, no `role`) and does
      not mention that lucide hides the svg — i.e. it prescribes the exact defect this round
      repaired. t3 flagged the same entry. Nothing there covers the Black List's new
      rule-in-the-column-header pattern or the gated `excusedCount` lines either. Left for the
      integrator to route to a doc-sync pass rather than edited from outside my `owns` set."
    - "FIX ROUND · a fourth thing NOT done, deliberately: the all-clear's own `ShieldCheck` at
      `:207` keeps `text-up`. The reviewer noted it now shares a glyph with the name marker and
      recorded that the gold change resolves the colour half; changing the all-clear icon was
      explicitly out of scope."
    - "FIX ROUND · the excused figure is roster-scoped (t2's decision) and the copy is worded to
      survive that: 'excused from this list' and 'were not measured' claim nothing about the
      whole roster, so the number never has to reconcile with a member count the reader could
      get from elsewhere."
  done_when:
    1. `MemberCell`'s prop type is `Pick<Member, "id" | "inGameName" | "avatarUrl" | "isActive" | "isBenched">` and **no call site changed** — `git diff --name-only` touches only the two owned files.
    2. The shield renders as the fourth flex child between the name `</Link>` and the Former pill, matching the pinned markup at size 14 (cite file:line).
    3. `BlackListTable`'s header `<div>` contains the `SectionTitle` and **exactly one** `<p>`, whose text is `Last {rule.windowWeeks} weeks of participation.` — no ternary, no week-number list, no second paragraph (cite the lines).
    4. After the destructure the component declares exactly three derived gates — `weeksJudged`, `noWeeks`, `nobodyJudged` — and the three tbody empty-state branches are unchanged apart from line drift. Show the diff hunks and confirm none falls inside the tbody empty-state region.
    5. Build exits 0; lint at baseline.
    6. *(fix round, owner decision + H2)* `MemberCell`'s shield span carries `role="img"` and the icon `className="text-gold"`, byte-identical to t3's copy apart from `size` (cite file:line, paste the serialized span from a real render).
    7. *(fix round, H1)* The Missed-weeks column header states the miss rule off `rule.minKeysPerWeek` and `rule.maxKeysPerWeek`, no digit typed (cite file:line, paste the rendered `<th>`).
    8. *(fix round, H3+M1)* `excusedCount` renders as a conditional header line **and** as a clause on the all-clear sentence, both gated `> 0`, singular handled. Paste the header HTML with the line present (demo, m7 excused) and the zero case with it absent, plus the all-clear text at 2 / 1 / 0.
    9. *(fix round)* The three tbody empty-state branches are not restructured; build 0 and lint at baseline with no hits in either owned file.

- id: t5
  summary: Doc-sync — seventh admin route everywhere, Black List header copy, Bench section, terminology split
  agent: ui-design-specialist
  owns:
    - docs/user-guide.md
    - docs/reference/auth.md
    - docs/reference/design-system.md
    - docs/reference/deployment.md
    - docs/reference/data-pipeline.md
    - docs/project-map.md
    - docs/engineer-onboarding.md
    - README.md
    - CLAUDE.md
    - .env.example
    - .claude/rules/data-pipeline.md
    - .claude/rules/rendering.md
  depends_on: [t1, t2, t3, t4]
  docs_touched: [all of owns]
  claimed_by: "ui-design-specialist"
  state: done   # PASS 1 done 2026-08-18 (below). PASS 2 (re-run after the fix round) done the
                # same day — see the "SECOND PASS" changelist entries at the end of this list.
  changelist:
    - "SEVEN-ROUTE COUNT, eleven sites, all positive assertions: `CLAUDE.md:16`,
      `README.md:146` + `:196-198`, `.env.example:101`, `docs/project-map.md:30`,
      `docs/engineer-onboarding.md:227` + `:393` (the bench guard cited at
      `app/api/members/[memberId]/bench/route.ts:16`), `docs/reference/auth.md:163`/`:165`/`:370`,
      `docs/reference/deployment.md:297`, `.claude/rules/rendering.md:15`,
      `.claude/rules/data-pipeline.md:29`. Left untouched exactly as the pack directed:
      `auth.md:154` (six data PAGES) and `auth.md:178` (a historical measurement).
      `docs/user-guide.md:63` (six SIDEBAR entries) is also correct and untouched —
      re-measured against `components/Sidebar.tsx:14-21`, still six."
    - "`.claude/rules/rendering.md:24-49` — the route table was **PASTED**, not hand-edited.
      Mechanically: `npm run build` output was captured to a scratchpad file and a node script
      spliced it into the fence, so no character was typed by hand. The script re-applied the
      one annotation the doc licenses (the `←` note on `/members`) and threw rather than
      writing if either the annotation anchor or the fence was not found. Seventeen routes,
      `ƒ /api/members/[memberId]/bench` between `/avatar` and `/results`; matches the
      integrator's authoritative table byte-for-byte. `:20` 'all sixteen routes' → seventeen.
      `:15`'s two counts → seven declare `force-dynamic` / eleven repo-wide hits, re-measured:
      `grep -rn force-dynamic app/` returns 11 = 7 routes + 4 pages."
    - "`docs/reference/auth.md` — heading and body now say SEVEN carry the guard and **SIX were
      measured** at Phase 3b; the seventh is guarded by construction plus its own narrower
      evidence (t3's 401 to anonymous with valid / absent / malformed bodies), explicitly NOT
      folded into the sweep. The paragraph ends with a do-not-restate warning
      (`:181-191`). Guard citation re-resolved against landed code: `route.ts:16-17`, body
      opens `:15`, ahead of `await params` (`:19`), the body read (`:36`) and the `try` (`:35`)."
    - "`docs/reference/design-system.md:78-124` — new pattern entry **Name-adjacent status
      marker — the bench shield**: the pinned markup as a fenced block with `N` called out
      (14 in MemberCell / 18 in the `<h1>`), the MemberCell insertion point (fourth flex child,
      after the name `</Link>` at `:33`, before the Former pill at `:52`) and why one insertion
      covers five tables with zero call-site edits, why it is not on the avatar, and the
      native-`title` decision written as a settled owner choice — named as made AFTER being
      shown that `title` is invisible on touch, unreachable by keyboard and inconsistently
      announced, with an explicit 'a contributor who corrects this without being asked is
      relitigating a settled decision' and a pointer that any future tooltip order must convert
      both copies plus `BlackListTable.tsx:130` together."
    - "`docs/reference/data-pipeline.md:47-88` — **the doc had NO member-metadata write path
      section; `setMemberAvatar` had never been written up there at all** (verified: zero
      occurrences of `members.ts` or `setMemberAvatar` in the pre-edit file). Rather than
      silently inventing a precedent, the new section says that in its first line and then
      records BOTH writers in a table with the in-rule reasoning lifted from
      `lib/members.ts:10-16` (ingest vs. metadata is the test, not SQL vs. no SQL), plus the
      three shared consequences: zero-row UPDATE is silent, `persist()`'s conflict update
      touches only `in_game_name` so a re-import cannot clear either value, and `npm run seed`
      sets neither. Also `:98` — `is_benched` added to the backup-format section, with the
      flipped `bool(..., false)` default explained (`lib/backup.ts:36`, `:108`, `:142`, `:144`)."
    - "`.claude/rules/data-pipeline.md` — `:29` enumeration gains bench (seven);
      `:34` the fragile `typeof err.code` discrimination list gains bench (**four**: backup /
      avatar / reset / bench), noting bench is the least exposed of the four because its only
      validation returns early before the mapper is reachable (`route.ts:41-46`);
      `:36` 'Six local mappers' → **seven**, and the integrator's nuance is recorded —
      `benchError` is the ONLY mapper carrying a branch beyond the template (`42703`
      undefined_column, `route.ts:71-73`) and a consolidation order must preserve it, not
      flatten it. That line's own history phrasing was reworded so it no longer spells a stale
      count (it was firing on this task's own sweep pattern)."
    - "`docs/user-guide.md` — the largest share, five separate concerns:
      (a) BLACK LIST HEADER: `:234-256` rewritten — the header is now one unconditional line,
      quoted as a blockquote, cited at `components/BlackListTable.tsx:86-88`, with the `4`
      explained as the rule's INTENDED window (it overstates a young database, the owner's
      pinned call) rather than the weeks judged; `:223-229` no longer claims the header lets you
      watch a half-import happen, and redirects the reader to the Missed Weeks column and the
      weeks-judged count; `:266-271` step 1 no longer says the header names the window weeks.
      (b) KEY-TOTALS WARNING: `:309-316` — the advice is kept in full and explicitly marked as
      no longer printed anywhere on screen, with what the screen DOES still give you (each
      Participation cell states its own denominator and weeks-judged count).
      (c) EMPTY STATES `:331-353` — all three re-cited after the 13-line drift (`:171-175`,
      `:160-166`, `:150-155`), the 'this one still shows the listing rule above it' and 'the
      subtitle reads No fully imported week yet' claims removed (both described copy that no
      longer exists), and the all-clear N documented as excluding benched players.
      (d) NEW BENCH SECTION `:355-411` — where the toggle lives (`/members/<player>` header,
      beside Export), admin-only and hidden rather than greyed, the label naming the action,
      the shield on all five tables + the detail `<h1>` and its hover sentence, the removal
      being TOTAL including the all-clear denominator (worked example: bench 4 of 30 →
      'none of the 26 players judged'), and five things it does NOT do (changes no numbers,
      no CSV column, per-player not per-week, survives imports, round-trips through backups).
      Plus the one setup step — `npm run db:migrate` — and the exact refusal copy an
      unmigrated database returns.
      (e) `:205-207` and `:413-417` — 'there is no way to add or remove someone by hand' was
      falsified by this order and is now scoped to 'apart from the Bench, which only ever
      removes'."
    - "TERMINOLOGY SPLIT in the guide, done as a rename not a deletion: the five old-sense uses
      (`:269`, `:367`, `:449`, `:469`, `:475` pre-edit) now read **zero-key week** /
      **zero-key value**, and a blockquote at `:457-461` states the split outright and warns
      that `lib/parse.ts` / `lib/results.ts` still carry the older word. Post-edit the word
      appears in the guide **six times, every one of them the new admin-control sense**
      (listed in the sweep below). Mirrored in `docs/reference/data-pipeline.md:82-88`."
    - "BEYOND THE BLAST-RADIUS LIST — nine further falsified claims found by re-resolving
      citations, all inside owned files, all caused by this order:
      1. `docs/reference/deployment.md:277-283` — its own reflowed route table was missing the
         bench route; added. `:270-271` re-dated and the seventeen-route count stated.
      2. `docs/reference/auth.md:257-268` — 'all FOUR affordance-bearing components' was
         falsified by `BenchToggle`, which takes neither `readOnly` nor `readOnlyReason`. Written
         up as the SECOND shape of hide-don't-disable (gate at the call site, `page.tsx:247`,
         so the POST helper never enters the tree) with guidance on which shape to copy.
      3. `docs/project-map.md:33` and `README.md:200` — component count 26 → **27**
         (`BenchToggle.tsx`); re-measured with `ls components/*.tsx | wc -l`.
      4. `docs/project-map.md:35` — `getBlackList` cited at `lib/compute.ts:374`, which now
         resolves to a blank comment line; → `:378`.
      5. `docs/project-map.md:36` — four drifted citations: window `:378-380`→`:382-384`,
         roster gate `:401-403`→`:405-408`, `lib/types.ts:160`→`:167`, view types
         `:127`/`:141`/`:151`→`:134`/`:148`/`:158`. The bench exclusion added at `:426`.
      6. `docs/user-guide.md:134` — `BlackListTable.tsx:145` resolved to a `<td colSpan>` and
         `lib/compute.ts:440` to a blank line; → `:132` and `:448`.
      7. `docs/user-guide.md:666` — ExportButton cited at `page.tsx:233`; → `:248`.
      8. `docs/user-guide.md:673-680` — the hidden-write-controls list gained Bench, with the
         note that it is the one control leaving no explanatory sentence (deliberate: the avatar
         beside it already prints the reason).
      9. `docs/reference/design-system.md` — two Black List citations drifted with t4's
         13-line removal: Pagination placement `:201`→`:188`, stretched-card section
         `:74`→`:70`. `:47` (participationColor) re-checked and still correct."
    - "`.claude/rules/data-pipeline.md:12` — ONE addition not on the list and flagged as a
      judgement call: the rule's opening 'never bypass with direct SQL' would now read as
      indicting `lib/members.ts` to the next implementer, since the rule loads for `app/api/**`
      and the bench route sits under it. Added a one-bullet scoping clause (ban is on INGEST;
      members.ts is the sanctioned exception, two writers) plus a pointer to the full entry.
      No other rule text changed."
    - "=== SECOND PASS 2026-08-18 (re-run after the t2/t3/t4 fix round) ===
      SIX of the twelve owned files changed: `docs/reference/design-system.md`,
      `docs/user-guide.md`, `docs/project-map.md`, `docs/reference/data-pipeline.md`,
      `docs/reference/auth.md`, `docs/engineer-onboarding.md`. The other six
      (`README.md`, `CLAUDE.md`, `.env.example`, `docs/reference/deployment.md`,
      `.claude/rules/rendering.md`, `.claude/rules/data-pipeline.md`) were re-checked and
      needed nothing: the seven-route counts still hold, `rendering.md`'s pasted route table
      is still byte-identical to a fresh `npm run build` (seventeen routes, `←` annotation
      intact), and `.claude/rules/data-pipeline.md:36` still quotes `benchError`'s `42703`
      copy at `route.ts:71-73` correctly. mtime sort confirms only those six plus this ledger
      were written this pass — no thirteenth file."
    - "SECOND PASS · `design-system.md:78-124` REWRITTEN — the entry that prescribed the
      repaired defect. It now (a) says gold, not green; (b) quotes the shipped markup with
      `role=\"img\"` and `text-gold`; (c) replaces the accepted-weak-announcement claim with the
      measured mechanism — lucide stamps `aria-hidden=\"true\"` on the svg and `aria-label` on a
      bare `<span>` (role `generic`) is prohibited by ARIA in HTML and dropped, so the marker
      was SILENT, not faint — written as 'load-bearing, deleting it re-silences the icon' so
      nobody removes the role as redundant; (d) gives the owner's `text-gold` reasoning (the
      good-number token means high participation / positive trend in these very rows and is the
      all-clear's own glyph+colour, so green read as 'good player'; gold is not a performance
      tier) with a do-not-harmonise instruction; (e) keeps the native-`title` decision framed as
      the owner's, and adds that the rewrite offer was declined; (f) adds that the shield is
      structurally impossible on the Black List, so nobody chases it as a rendering bug. All
      four citations in the entry re-resolved: `MemberCell.tsx:60-64`,
      `page.tsx:234-238`, Former pill `:65`, participation-cell `title` `:169`;
      `</Link>` `:33` and `Pick` `:20` re-checked and unchanged."
    - "SECOND PASS · `design-system.md` NEW ENTRY 'Black List: two patterns that put the rule
      beside the accusation' — the rule encoded in the Missed-weeks `<th>`
      (`BlackListTable.tsx:136-138`, both numbers off `rule`, zero vertical cost, no
      `whitespace-nowrap` so min-content width is unchanged) and the gated `excusedCount`
      renderings (header `<p>` `:111-116`, all-clear clause `:222-227`, both `> 0`, `plural()`
      for singular, byte-identical to the pre-count output at zero). Written as reusable
      guidance, not a changelog: state a threshold in the row that already exists rather than in
      a subtitle an owner will ask you to shorten, and print a derived figure only when it is
      non-zero."
    - "SECOND PASS · `design-system.md` — three drifted citations elsewhere in the file, all
      re-resolved by script and confirmed by target-line content: Pagination placement
      `BlackListTable.tsx:188` → **`:242`**, stretched-card `<section>` `:70` → **`:79`**,
      `participationColor` `:47` → **`:56`**."
    - "SECOND PASS · `design-system.md` ghost-icon-button form 3 gained a clause for
      `BenchToggle` — the `aria-disabled` shape is no longer pagination-only and is no longer
      tied to that button geometry (`btn-ghost`, `:80` attribute, `:39` guard,
      `app/globals.css:86` the now-unmatched `disabled:opacity-40`). `.claude/rules/ux.md` is
      NOT in this task's owns set, so its anti-`disabled` paragraph was left alone; the clause
      states that its TopBar claim is still accurate and scoped to the POSITIONAL case."
    - "SECOND PASS · `docs/user-guide.md`, six concerns.
      (a) BLACK LIST HEADER is now documented as CONDITIONAL: the one line
      (`BlackListTable.tsx:96-98`) plus a second line, present only when someone is benched,
      quoted as 'N players are excused from this list.' (`:111-116`), with the zero case named
      as what the clan database renders today.
      (b) THE MISS RULE IS BACK ON SCREEN — a new paragraph corrects the guide's 'the app no
      longer shows the rule' framing: the Missed Weeks column header states it
      (`:136-138`), so the definition of the accusation sits beside the accusation; the
      LISTING threshold is still off-screen except in the all-clear.
      (c) ALL-CLEAR gains its conditional clause, quoted at 2 and 1 and stated absent at 0
      (`:222-227`), inside the empty-states list.
      (d) THE SHIELD IS GOLD, with the owner's reason in the reader's language, plus the note
      that it can never appear on the Black List itself.
      (e) MIGRATION 0003 stated as MEASURED-unapplied, not as caution, and the setup paragraph
      now covers BOTH consequences — the Bench refusing and **restore refusing** — with the
      exact copy from `app/api/restore/route.ts:86-88` and the fact that the transaction rolls
      back so nothing is lost. A matching warning was added to the Restore section of
      'Three ways to lose data', because a reader planning a recovery never reads the Bench
      section.
      (f) Six drifted citations re-resolved: `compute.ts:378`→`:381`, `:382-384`→`:385-387`,
      the three empty states →`:189-194`/`:199-205`/`:218-229`, ExportButton
      `page.tsx:248`→`:261`, BenchToggle gate `:247`→`:260`, participation tooltip
      `BlackListTable.tsx:130`→`:169` and the two-line cell `:132-138`→`:171-177`."
    - "SECOND PASS · `docs/reference/auth.md` — one citation: the hide-don't-disable second
      shape cited `page.tsx:247` → **`:260`**. Everything else re-checked and correct, including
      the bench guard at `route.ts:16-17` with body opening `:15`, `await params` `:19`, body
      read `:36`, `try` `:35`, and the six-measured/seven-guarded honesty statement."
    - "SECOND PASS · `docs/project-map.md` — three bare relative cites on `:36`, invisible to any
      automated resolver and therefore found by a manual pass: window `:382-384`→**`:385-387`**,
      roster gate `:405-408`→**`:411-414`**, bench exclusion `:426`→**`:443`**; plus
      `:35`'s `getBlackList` `lib/compute.ts:378`→**`:381`**. Those four are BYTE-NEUTRAL.
      `lib/types.ts:167`/`:134`/`:148`/`:158` and `lib/compute.ts:350` re-checked, unchanged.
      One ADDITION on `:41` (the pending migration, see below) cost 201 B, so 201 B was cut
      elsewhere to keep the headroom: the Turso blockquote `:24` was compressed (all three
      engine names kept, so the grep-landing purpose survives) and the stale-`:162` parenthetical
      on the TrendBadge open bug `:65` was deleted — a transient warning about a citation that
      every doc has since had re-resolved twice by script. **File is 17149 B, 259 B under the
      17408 B cap; it arrived at 17123 B, so the net cost of this pass is 26 B.**"
    - "SECOND PASS · MIGRATION 0003 RECORDED IN A LIVING DOC, since the ledger is archived and
      `.claude/rules/supabase-schema.md:21` (NOT owned here) still reads 'Applied today: 0001,
      0002'. Written in three owned places at three depths: `docs/project-map.md:41` one clause
      (0001–0002 applied, 0003 not, measured, Bench and Restore both refuse);
      `docs/engineer-onboarding.md` §11 the full paragraph (the statement, the measurement, the
      column list returned by `information_schema.columns`, why rendering is unaffected via
      `toMember`'s `=== true` at `lib/data.ts:111`, which two routes fail with `42703`, and an
      explicit note that the rules file's line is correct about what has RUN and silent about
      what is waiting); `docs/user-guide.md` the owner-facing version in both the Bench section
      and the Restore section."
    - "SECOND PASS · `docs/reference/data-pipeline.md:98` — the 'an old backup restores cleanly'
      sentence was true only post-0003. Reworded, and a following paragraph states the condition:
      restore requires 0003 for ANY backup because the column is in the insert's column list;
      `42703` on the first member row; one `begin()` so it rolls back and loses nothing;
      `app/api/restore/route.ts:86-88` names the fix; 0003 measured unapplied 2026-08-18. The
      relative cites `:108`, `:142`, `:144` and `lib/backup.ts:36` were re-checked and are all
      still correct — t2's file did not move in the fix round."
    - "SECOND PASS · VERIFICATION.
      CORPUS: the same 16 files, same build command, `docs/tasks/` and `docs/build-log.md`
      excluded.
      SWEEP RUN A (before any edit), pattern
      `grep -nEi 'weakly announced|decorative-green|green \`?ShieldCheck|the only token is|no role is'`
      → **3 hits, all inside the falsified entry**: `design-system.md:80`, `:119`, `:123`.
      SWEEP RUN B (after, identical pattern and corpus) → **0 hits**.
      POSITIVE CONTROL for run B, identical pattern against a target OUTSIDE the corpus that
      still quotes the pre-fix claims — this ledger — → **5 hits** when run (the fix round's own
      account of the defect, at what were then `:367`, `:1101`, `:1104` and `:1148` ×2), so the
      pattern demonstrably still fires and run B's zero is real. Re-running it after this
      changelist landed returns **6**, because this entry spells the pattern out; that is
      expected and harmless — the ledger is a control TARGET and is never part of the swept
      corpus, which is exactly why spelling it here does not poison run B. Run B was re-run once
      more after this entry was written and is still **0**.
      SWEEP 2, every shield span quoted anywhere in the corpus:
      `grep -nE 'ShieldCheck size=|inline-flex shrink-0'` → exactly 2 lines, both the new
      `design-system.md` block, both carrying `role=\"img\"` and `text-gold`.
      SWEEP 3, terminology re-run after the new prose:
      `grep -nEi '(^|[^_\`/-])benched' docs/user-guide.md` → 11 hits, every one the
      admin-control sense (up from 6 only because this pass added text); positive control, same
      pattern against `lib/parse.ts lib/results.ts` → 4 hits, unchanged.
      CITATIONS: `t5b-cites.mjs` (scratchpad, t5b- prefixed) parsed every `file:line` in the
      corpus pointing into `app/`/`components/`/`lib/`/`scripts/`/`supabase/`/`globals.css` and
      printed the TARGET LINE CONTENT for each — **302 citations, 1 unresolvable**, the same
      known false positive (`auth.md:99` cites a `node_modules/@supabase/auth-js/…` fragment).
      Every citation this pass touched was read back and lands on the construct it claims.
      Bare `:NNN` refs are invisible to that script and were swept separately with
      `grep -nE '\`:[0-9]+(-[0-9]+)?\`'` over the corpus and checked by hand.
      DOC-TO-DOC line cites: checked that nothing cites `design-system.md` or `user-guide.md`
      by line (my rewrites moved ~60 lines in one and ~40 in the other); the only doc-to-doc
      line cites in the corpus are four in `engineer-onboarding.md` pointing at
      `deployment.md`, which this pass did not touch.
      BUILD/LINT: `npm run build` **exit 0**, seventeen routes, table identical to
      `.claude/rules/rendering.md`'s pasted copy. `npm run lint` **10 problems (9 errors,
      1 warning)** — the baseline. No code was changed by this task, so neither could move."
    - "SECOND PASS · THREE THINGS FOUND THAT WERE ON NOBODY'S LIST.
      1. **The guide contradicted itself about the key-totals warning.** `:308-316` said the
         'don't compare key totals' advice is 'no longer printed anywhere on the screen', while
         the paragraph two above it says hovering a Participation cell repeats exactly that
         sentence. The tooltip at `BlackListTable.tsx:169` does carry it. Reworded to 'no longer
         standing text', with the tooltip named and its limits stated (not on a phone, not for a
         keyboard, not in a screenshot). This was a pass-1 defect of my own, not a fix-round
         consequence.
      2. **Two of the integrator's suggested new positions were arithmetic, not semantic**, and
         better targets exist. `user-guide.md:134` cited `BlackListTable.tsx:132` and
         `lib/compute.ts:448` for the Black List participation FORMULA; the handed-over targets
         (`:150-152`, `:452`) land on the MemberCell `<td>` and on `missedWeekNumbers`. Used
         `components/BlackListTable.tsx:171-177` (the two-line participation cell) and
         `lib/compute.ts:465` (`participationPct: keysPossible ? …`) instead. Same for
         `user-guide.md:304`, re-resolved to `:171-177` rather than to the `<th>`.
      3. **`BenchToggle` is now the ONLY in-flight control using `aria-disabled`, and the repo
         has ~15 native `disabled=` sites that were never audited** —
         `grep -rn 'disabled=' components/ app/ | grep -v aria-disabled` over `AvatarEditor`,
         `DataManagement`, `ImportPanel`, `MemberHistoryTable`, `app/error.tsx`, `LoginForm`,
         most of them the same `disabled={pending}` in-flight case. `app/login/LoginForm.tsx`
         is the sharp one: `:31-39` documents that it hit this exact focus defect and pays for
         it with a `useEffect` that re-focuses the email field on the pending edge — a hook that
         `aria-disabled` would make unnecessary. Recorded in `design-system.md` as a
         per-control judgement (the modal ones sit in a focus trap) with 'copy `BenchToggle`
         for a NEW control'. **Not filed as an order; flagged.**"
    - "SECOND PASS · NOT DONE, and why: `.claude/rules/ux.md` and
      `.claude/rules/supabase-schema.md` are both outside this task's `owns` set and were not
      touched. `supabase-schema.md:21`'s 'Applied today: 0001, 0002' needs a one-clause update
      naming 0003 as pending; the fact itself is now in three living docs I do own, so nothing
      is lost when this ledger is archived, but the rules file will keep reading as complete
      until its owner fixes it. `docs/build-log.md` untouched in both passes."
    - "`docs/build-log.md` NOT TOUCHED — it already carried 46 uncommitted insertions when this
      task started (integrator/earlier work), so `git status` shows it modified. Proof it was
      not mine: an mtime sort over `git ls-files -co` puts the twelve owned files as the twelve
      most recent, and build-log.md is not among them."
  verification:
    - "CORPUS (done_when #2). Built with:
      `{ ls CLAUDE.md README.md .env.example; find docs -name '*.md' -not -path 'docs/tasks/*'
      -not -name 'build-log.md'; find .claude/rules -type f -name '*.md'; } | sort`
      → 16 files. `docs/tasks/` and `docs/build-log.md` excluded as required."
    - "SWEEP RUN A (positive control, BEFORE any edit), pattern
      `grep -nEi 'six|sixteen|\\bten hits\\b|all six' <corpus>` — **20 hits**, and it fired on
      every site the pack named: data-pipeline.md `:28`,`:35` · rendering.md `:15`,`:20` ·
      .env.example `:101` · CLAUDE.md `:16` · README.md `:146`,`:196` ·
      engineer-onboarding.md `:227`,`:393` · project-map.md `:30` · auth.md
      `:154`,`:163`,`:165`,`:178`,`:344` · deployment.md `:295`,`:297` · user-guide.md
      `:63`,`:592`. Three of those (README:146, deployment:297, user-guide:592) were NOT on the
      pack's list and were genuine stale claims."
    - "SWEEP RUN B (AFTER, identical pattern and corpus) — **5 hits, every one intended**:
      `auth.md:154` (six data PAGES — pack says leave), `auth.md:165` and `auth.md:191` (the
      required 'six were measured' honesty statement), `auth.md:178` (historical measurement —
      pack says leave), `user-guide.md:63` (six SIDEBAR entries, re-measured correct).
      **Zero stale route counts remain.** One further iteration was needed: run B initially also
      fired on `.claude/rules/data-pipeline.md:36`, on prose THIS TASK had just written ('up from
      the six this line claimed') — the self-matching trap. Reworded to 'this line has
      under-counted twice now, so re-count it' and re-run clean."
    - "SWEEP for the REMOVED header copy: `grep -nEi 'listing rule|listing-rule|is a miss\"|subtitle'`
      over the corpus → 3 hits, none a live claim: `design-system.md:35` is a dialog's subtitle
      (unrelated) and `user-guide.md:249-250` is this task's own past-tense framing ('The header
      USED TO carry two sentences … Both are gone'), which is the point of the sentence."
    - "SWEEP for the terminology split: `grep -nEi '(^|[^_`/-])benched' docs/user-guide.md` →
      6 hits (`:339`, `:363`, `:372`, `:380`, `:399`, `:405`), **all six the new admin-control
      sense**, inspected one by one. The five pre-edit old-sense hits are gone. POSITIVE CONTROL,
      identical pattern against the two files known to retain the old sense:
      `grep -nEi '(^|[^_`/-])benched' lib/parse.ts lib/results.ts` → **4 hits**
      (`parse.ts:5`, `results.ts:20`,`:23`,`:53`) — confirms the pattern fires."
    - "CITATION RE-RESOLUTION (scratchpad `t5-check-citations.mjs`): every `file:line` in the
      16-file corpus pointing into `app/`/`components/`/`lib/`/`scripts/`/`supabase/` was parsed
      and range-checked — **286 citations, 0 out of range**. The single 'missing file' report is
      a false positive (`auth.md:99` cites a `node_modules/@supabase/auth-js/…` path fragment).
      Range-checking alone is weak, so a second pass printed the TARGET LINE CONTENT for every
      citation into the nine files this order changed; that is what caught items 4, 5, 6 and 9
      in the changelist above. All nine files' citations were then re-read and confirmed to land
      on the construct they claim."
    - "`npm run build` — exit 0, seventeen routes, table identical to the integrator's.
      `npm run lint` — **10 problems (9 errors, 1 warning)**, the stated baseline exactly, all
      in `components/ImportPanel.tsx` and the two `.claude/scripts/*.js`. No code was changed by
      this task, so neither number could move; both were run to confirm that."
    - "FOOTPRINT: an mtime sort over `git ls-files -co --exclude-standard` shows the twelve owned
      files as the twelve most recently modified files in the tree, and nothing else above the
      t3/t4 code files. No thirteenth file was written."
  assumptions:
    - "Every citation written here resolves against LANDED code, re-read this session — not
      against the pack's plan-time line numbers, several of which had drifted (the pack itself
      cites `lib/compute.ts:406` and `BlackListTable.tsx:77-101`, both pre-edit positions)."
    - "`docs/project-map.md` is byte-capped at 17 KB and the additions had to be trimmed twice to
      fit: it was 16.8 KB on arrival, hit **17228 B** after the first draft, and sits at
      **17123 B** now — inside the 17408 B cap but with only ~280 B of headroom. Two facts were
      added (seventh route + the roster exception) and both were compressed to one clause each,
      per the file's own 'one sentence and a pointer' rule. **The next order to touch this file
      will likely have to delete before it can add.**"
    - "The user guide's Bench section describes the toggle's BEHAVIOUR from the code, not from
      use: per t3, no agent holds the admin password, so nobody has rendered the button in its
      signed-in state or watched a bench write reach Postgres. Migration 0003 is also unapplied
      — which is why the section ends by telling the owner to run `npm run db:migrate` and
      quotes the exact refusal an unmigrated database produces."
    - "The old-sense word was renamed in `docs/user-guide.md` only. It is deliberately LEFT in
      `.claude/rules/data-pipeline.md:19`, `docs/project-map.md:50` and the ingest rows of
      `docs/reference/data-pipeline.md`, because those describe `lib/parse.ts`'s literal
      behaviour and that code still uses the word (follow-up 2). Renaming the docs there would
      have made them drift from the code they cite. The split is stated explicitly in both
      `docs/reference/data-pipeline.md:82-88` and the guide's blockquote instead."
  follow_ups_recorded:
    - "**Avatar route silent-write bug** (unowned by this order). `components/AvatarEditor.tsx:107`
      percent-encodes the member id; `app/api/members/[memberId]/avatar/route.ts` never decodes
      it. `slug()` (`lib/persist.ts:22-23`) preserves Unicode letters (`\\p{L}`), so for a
      clanmate with a non-ASCII in-game name `where id = …` matches zero rows, postgres.js
      raises nothing for a zero-row UPDATE, and the client is handed `{ ok: true }` for a write
      that never happened. `results/route.ts:25`, the member page and the new bench route all
      decode; avatar is the sole outlier. NOTE: this ledger is archived, so the durable copies
      are `docs/reference/data-pipeline.md` (the member-metadata section states the zero-row
      UPDATE is silent for BOTH writers) and this entry — the main session should carry it into
      `docs/build-log.md` at step 7."
    - "**Old-sense terminology still in code** (unowned): `lib/parse.ts:5` and
      `lib/results.ts:20`,`:23`,`:53` — 4 hits, confirmed with a positive control above.
      Recorded durably in `docs/reference/data-pipeline.md`'s Terminology paragraph and in the
      user guide's blockquote, both of which name the two files, so the split survives this
      ledger's archival."
  done_when:
    1. Every site in the pack's blast-radius list states seven routes and includes the bench route — cite each edit as file:line (positive assertions, one per site).
    2. Corpus check with a positive control. Corpus = `CLAUDE.md`, `README.md`, `.env.example`, `docs/**/*.md` and `.claude/rules/**`, **excluding `docs/tasks/` and `docs/build-log.md`**. Before your edits the stale-count pattern must fire on the pack's list (paste that as the control); after them it fires only on the lines the pack marks "leave". Paste both runs and the corpus-building command.
    3. `.claude/rules/rendering.md`'s route table is replaced with the **pasted output of a real `npm run build`** (seventeen routes) — state that it was pasted, not hand-edited.
    4. `docs/user-guide.md`: the Black List section describes a single static header line and states that week numbers are no longer printed in the header (the Missed Weeks column still prints them); the on-screen key-totals warning is described as removed while the guide keeps the explanation; a Bench section exists (toggle location, admin-only, shield meaning, full exclusion including the all-clear count); the older "benched row" usage is renamed so the word has one meaning in the guide.
    5. `docs/reference/auth.md` says seven routes carry the guard, **six measured** at Phase 3b, the seventh verified by construction — never that seven were measured.
    6. `docs/reference/design-system.md` gains the shield-icon entry (pinned markup, the native-`title` decision and why it was chosen over an accessible pattern, the MemberCell insertion point).
    7. `docs/reference/data-pipeline.md` checked for the member-metadata write path; bench added beside avatar if present, its absence stated if not.
    8. `docs/build-log.md` untouched — append-only; the main session appends at step 7.

## Ordering

```
wave 1 (parallel):   t1 ──┐   t2 ──┬──┐
                          │        │  │
wave 2 (parallel):        │   t3 ◄─┘  └─► t4
                          │    │           │
integrator ───────────────┴────┴───────────┘
                               │
wave 3:                        t5
                               │
                  flow-reviewer ∥ ux-specialist
```

t1 and t2 are disjoint and have no code dependency (t2 compiles without the column; the runtime need for 0003 is on the owner's machine, outside agent reach either way). t3 and t4 both depend only on t2's landed types and are disjoint — the detail page and its shield live wholly in t3, the MemberCell shield and header copy wholly in t4, with the byte-identical markup contract pinned so the integrator can diff the two spans. t5 runs last because `rendering.md`'s route table must be pasted from a build of the finished code.

## Integration (integrator, 2026-08-18)

**Nothing was changed.** t1–t4 landed disjointly in one working tree; every seam already
agreed, so integration was verification plus one authoritative build. Zero merge conflicts,
zero integrator edits to application code. t5 remains `pending` by design — it is wave 3.

**Authoritative numbers** (single run, after all four slices landed, no sibling writing):
- `npm run build` — **exit 0**, seventeen routes, `ƒ /api/members/[memberId]/bench` present
  between `/avatar` and `/results`. `ƒ /`, `ƒ /members`, `ƒ /members/[memberId]`, `○ /import`
  unchanged. **This is the table t5 must paste into `.claude/rules/rendering.md`.**
- `npm run lint` — **10 problems (9 errors, 1 warning)**: the baseline exactly. Per-file:
  `.claude/scripts/statusline-cache.js` 3e+1w, `.claude/scripts/token-report.js` 3e,
  `components/ImportPanel.tsx` 3e. **Zero hits in any of this order's twelve files.**
  t4's transient "9 errors 2 warnings" was a mid-flight artifact and did not reproduce.

**Footprint, established by mtime rather than by `git diff`** (the tree carries the previous
order's uncommitted work): exactly the twelve owned files + this ledger. Nothing else.
Confirms `lib/persist.ts` (0-byte diff), `lib/import.ts`, `lib/seed.ts`,
`components/Skeleton.tsx`, all five MemberCell call sites, and every CSV export untouched.

**Seams verified**
- *Shield markup* — the two `<span>` lines are **byte-identical after trim**; the icon lines
  differ only in `size` (14 / 18). Gate line `{member.isBenched && (` identical in both.
  `components/MemberCell.tsx:48` vs `app/members/[memberId]/page.tsx:222`.
- *`Member.isBenched` round-trip* — `MemberRow.is_benched` (`lib/data.ts:34`) → `toMember`
  (`:111`) → `Member.isBenched` (`lib/types.ts:18`) → the widened `Pick`
  (`components/MemberCell.tsx:20`) and the detail page. **No call site changed** — the
  design's central claim holds; the three modified call-site files carry zero `isBenched`
  hits and predate this order.
- *Blacklist exclusion* — re-measured independently (not t2's script): shipped demo → 6 rows,
  `membersJudged 29`, `m7` absent. Flag negated → `membersJudged 30`, **same 6 row ids**.
- *Guard* — `requireAdmin()` at `route.ts:16-17`, handler body opens `:15`: first statement,
  ahead of `await params` (`:19`), the body read (`:36`) and the `try` (`:35`). All seven
  `app/api/**/route.ts` files carry it.
- *Black List header* — exactly one `<p>` (`:86-88`), three derived gates remain. The whole
  file outside two header hunks is **byte-identical**: head `[1..60]` and tail `[105..EOF]`
  both match the pre-edit file, and the empty-state region `old[156..192] === new[143..179]`.
  The three hard-won branches are untouched.
- *Absent, not disabled* — `BenchToggle` contains zero read-only/auth tokens. One boolean
  (`page.tsx:111`) covers three of the four permission cells.

**Handed to t5** (beyond its existing list): `.claude/rules/data-pipeline.md:35` "Six local
mappers" → **seven**, and the seventh (`benchError`) is the only one mapping a code beyond
`42P01` — say so, so the queued consolidation order preserves it.

**Filed as follow-ups, deliberately not fixed here (unowned):**
1. **`/api/members/[memberId]/avatar` has a silent-write bug.** `AvatarEditor.tsx:107`
   encodes the id, the route never decodes it, and `slug()` (`lib/persist.ts:22-23`)
   preserves Unicode letters — so for a member whose in-game name is non-ASCII the UPDATE
   matches zero rows, postgres.js raises nothing, and the caller is handed `{ ok: true }`
   for a write that never happened. Same shape t3 closed on bench. Two of the three
   siblings already decode; avatar is the outlier.
2. `lib/parse.ts:5` and `lib/results.ts:20,23,53` still use "benched" in the pre-existing
   zero-key sense (4 hits, verified as a positive control). Unowned by this order.

## Integration — pass 2 (integrator, 2026-08-18, after the fix round)

**Nothing was changed.** The fix round touched t2 (2 files), t3 (4 files) and t4 (2 files) in
one tree; every seam still agrees and no slice contradicted another. Zero integrator edits to
application code. `status` stays `review`.

**Authoritative numbers** (single run, no sibling writing, fix round complete):
- `npm run build` — **exit 0**, compiled in 4.0s, TypeScript 4.6s. **Seventeen routes, table
  byte-identical to pass 1** and to the copy in `.claude/rules/rendering.md`:

  ```
  Route (app)
  ┌ ƒ /
  ├ ○ /_not-found
  ├ ƒ /api/backup
  ├ ƒ /api/import
  ├ ƒ /api/members/[memberId]/avatar
  ├ ƒ /api/members/[memberId]/bench
  ├ ƒ /api/members/[memberId]/results
  ├ ƒ /api/reset
  ├ ƒ /api/restore
  ├ ƒ /chimera
  ├ ƒ /hydra
  ├ ○ /import
  ├ ƒ /login
  ├ ƒ /members
  ├ ƒ /members/[memberId]
  ├ ƒ /settings
  └ ƒ /timeline


  ƒ Proxy (Middleware)

  ○  (Static)   prerendered as static content
  ƒ  (Dynamic)  server-rendered on demand
  ```
- `npm run lint` — **10 problems (9 errors, 1 warning)**, the baseline exactly. Per-file, parsed
  from the run rather than eyeballed: `.claude/scripts/statusline-cache.js` 3e+1w,
  `.claude/scripts/token-report.js` 3e, `components/ImportPanel.tsx` 3e. **Zero hits in any of
  this order's files**, including the four the fix round touched. t2's mid-flight "another
  next build process is already running" left no trace.

**Seams verified (pass 2)**
- *Shield span* — both re-shipped copies re-diffed from SOURCE, not from served HTML:
  `components/MemberCell.tsx:61` and `app/members/[memberId]/page.tsx:235` are **byte-identical
  after trim** (same SHA-256 over the trimmed line), both carry `role="img"`, and the gate line
  `{member.isBenched && (` is identical. Icon lines differ only in `size` — 14 / 18 — and both
  read `className="text-gold"`. Exactly one occurrence per file. Confirmed in served HTML too:
  demo `/members/m7` emits the pinned span around an 18×18 `lucide-shield-check` carrying
  `text-gold` and lucide's own `aria-hidden="true"` (the second `inline-flex shrink-0` in that
  document is the RSC flight payload, not a second rendered span). `/`, `/members` render one
  each; `/members/m1` renders zero.
- *`excusedCount` producer* — re-measured **independently** of t2's script
  (`int2-excused-check.mts`), four runs: shipped demo → rows 6, `membersJudged` 29,
  `excusedCount` **1** · flag negated → rows 6 (same six ids), `membersJudged` 30,
  `excusedCount` **0** · empty dataset → 0/0/0, no throw · **scoping control**, a second excused
  member added with no results in any week → `excusedCount` still **1**, not 2. Roster-scoped as
  claimed. Both exits return the field (`lib/compute.ts:404`, `:481`); type at `lib/types.ts:184`.
- *`excusedCount` consumers* — `components/BlackListTable.tsx:62` destructures it; both readers
  are gated `excusedCount > 0` (`:111`, `:222`) and both use the file's `plural()` helper.
  **Zero case proved on a LIVE render** (`next start`, real `.env.local`, nobody benched): the
  Black List header is `<p class="mt-1 text-sm text-muted">Last <!-- -->4<!-- --> weeks of
  participation.</p>` and nothing else — `excused from this list` occurs **0** times. Demo render
  (one excused) adds `<p class="mt-0.5 text-sm text-muted">1<!-- --> <!-- -->player is<!-- -->
  excused from this list.</p>` — the singular. Column header on both:
  `<th class="px-3 py-2 font-medium">Missed weeks (under <!-- -->3<!-- --> of <!-- -->5<!-- -->
  keys)</th>`.
- *All-clear clause* — unreachable from any page render (both datasets have 6 rows), so the
  branch's **verbatim source JSX was sliced out of the shipped file** and rendered at
  `excusedCount` 2 / 1 / 0 (`int2-allclear.mjs`). 2 → "…of the weeks they played, and 2 excused
  players were not measured." · 1 → "…and 1 excused player was not measured." · 0 → "…of the
  weeks they played." The terminating `.` sits correctly in all three; the newline-adjacent
  whitespace JSX strips is not a hazard here.
- *Three tbody empty-state branches* — the strongest check available: the current file diffed
  against **t4's own pre-fix-round snapshot** (`t4-BlackListTable.after.tsx`, the state pass 1
  verified). Five hunks, **59 insertions / 6 deletions**. The only hunk reaching the tbody is
  `@@ -168,10 +207,25 @@`, and inside it the *only* code change is the terminating `.` moving to
  its own line and the gated fragment appearing above it. The `noWeeks`/Inbox and
  `nobodyJudged`/Hourglass branches **do not appear in the diff at all** — byte-identical. The
  `rows.length === 0 &&` wrapper, the `<td colSpan={4}>` and the ternary are untouched. Purely
  additive, as reported.
- *`aria-disabled` on BenchToggle* — `if (pending) return;` is the first statement of `save()`
  (`components/BenchToggle.tsx:39`, body opens `:35`, comment above it); the button carries
  `aria-disabled={pending}` (`:80`) and **no native `disabled` anywhere in the file**. Checked in
  the **emitted stylesheet** (`.next/static/chunks/08pp-ayta50uv.css`), not the source: all three
  variants are real rules —
  `.disabled\:opacity-40:disabled,.aria-disabled\:opacity-40[aria-disabled=true]{opacity:.4}`,
  `@media (hover:hover){.aria-disabled\:hover\:border-border[aria-disabled=true]:hover{…}}` and
  `.aria-disabled\:hover\:text-muted[aria-disabled=true]:hover{…}`. `btn-ghost`'s own
  `.btn-ghost:disabled{opacity:.4}` is present but can no longer match, exactly as t3 argued.
  `.text-gold` and `.sr-only` also emit; no class in this round is a dead string.
- *Restore route is surgical* — `git diff --stat app/api/restore/route.ts` is
  **`1 file changed, 12 insertions(+)`**, zero deletions, one hunk `@@ -74,6 +74,18 @@`, entirely
  inside `databaseError()`. Re-read the whole file: the guard (`:11-12`, first statement), the
  split catch (`:35-41`) with both 400s, the `DatabaseFailure` provenance class (`:49-56`),
  `fromDatabase()` (`:58-64`), the `42P01` branch, the string-code branch and the no-`code`
  passthrough are all byte-identical. The new `42703` branch (`:86-88`) returns a **fixed
  sentence** and never interpolates `err.message` — it cannot echo a driver message.
- *`Member.isBenched` round-trip* — `MemberRow.is_benched` (`lib/data.ts:34`) → `toMember`
  (`:111`, `=== true`) → `Member.isBenched` (`lib/types.ts:18`) → the widened `Pick`
  (`components/MemberCell.tsx:20`). Still no call-site edits.
- *Guard* — re-verified structurally across **all seven** `app/api/**/route.ts`: in every one,
  the first non-blank non-comment line of the handler body is `const denied = await
  requireAdmin();` followed by `if (denied) return denied;`. Bench `:16-17` (body opens `:15`),
  restore `:11-12` (body opens `:10`).

**Ownership question — settled.** t3 touched **only** `app/api/restore/route.ts`;
`lib/backup.ts` is untouched by the fix round and still carries **only t2's original change**
(`git diff --stat lib/backup.ts` = `5 insertions(+), 2 deletions(-)`: the `bool(m.is_benched,
false)` normalizer line plus its two-line comment at `:106-108`, and the column added to both
the insert's column list `:142` and its values `:144`). No mapper, no `42703`, no error-handling
code in that file. Independent of the diff, mtimes agree: `lib/backup.ts` 09:31 local (t2's first
pass), `app/api/restore/route.ts` 12:44 (t3's fix round). t2's flag was a false alarm — "restore
mapper" meant the route's mapper, not the restore normalizer.

**t4's done_when #3, as superseded** — the header `<div>` (`:80-117`) holds `SectionTitle`, one
**unconditional** `<p>` (`:96-98`) reading `Last {rule.windowWeeks} weeks of participation.`, and
one gated `<p>` (`:111-116`). No ternary, no week-number list. At zero excused the rendered
header is exactly the owner's one line — proved on the live render, which is what ships today.

**Carry-forward, all re-confirmed:** `git diff lib/persist.ts` empty · `force-dynamic` at
`app/members/page.tsx:15` with its load-bearing comment · no CSV export mentions bench
(`app/page.tsx`, `components/ClashDetailView.tsx`, `app/members/page.tsx` all predate this order
by mtime and carry zero bench tokens) · `components/Skeleton.tsx` untouched (mtime 2026-08-13) ·
`lib/import.ts` and `lib/seed.ts` untouched. Feature footprint is eleven code files plus the
migration; `grep` for `isBenched|is_benched|excusedCount` hits nothing outside them.

**MEASURED, and it upgrades an assumption to a fact: migration 0003 is NOT applied.** Read-only
`information_schema.columns` against the live database in `.env.local` returns
`id, in_game_name, level, hero_level, avatar_url, is_active, created_at` — **no `is_benched`**.
Every task assumed this; it is now measured. Consequences that are therefore live, not
hypothetical, on the owner's current database: a restore hits t3's new `42703` branch, a bench
write hits `benchError`'s `42703`, and `loadDataset`'s `select *` returns rows with no
`is_benched` key, which `toMember`'s `=== true` turns into `false` — which is why every live page
renders correctly with zero shields today. **The owner must run `npm run db:migrate` before the
feature does anything.**

**Handed to t5** (its citations were resolved at ~10:00 local, *before* the fix round moved these
lines; every one below re-resolved by script, `int2-cites.mjs`, and printed with its target line):

1. **`docs/reference/design-system.md:78-124` is falsified in substance, not just position** —
   both t3 and t4 escalated it and both are right. `:80` calls the shield "a green
   `ShieldCheck`"; the fenced markup at `:83-89` has **no `role="img"`** and `className="text-up"`;
   `:119-120` records "an `aria-label` on a bare `<span>` with no role is weakly announced; that
   is known and accepted", which the fix round measured to be wrong (lucide hides the svg, ARIA
   in HTML drops the label on role `generic` — the marker did not exist for AT at all); `:123-124`
   says "the only token is `text-up`". **The entry currently prescribes the exact defect this
   round repaired.** It also has nothing on the new rule-in-the-column-header pattern or the two
   gated `excusedCount` lines.
2. **Stale `file:line` citations caused by the fix round** (current position on the right):
   - `design-system.md:77` → `BlackListTable.tsx:47` (`import type …`) → **`:56`** (`participationColor`)
   - `design-system.md:93` → `MemberCell.tsx:47-51` → **`:60-64`**; → `page.tsx:221-225` → **`:234-238`**
   - `design-system.md:94-95` → MemberCell Former pill `:52` → **`:65`** (`</Link>` at `:33` still correct)
   - `design-system.md:118` → `BlackListTable.tsx:130` (participation-cell `title`) → **`:169`**
   - `design-system.md:67` → `BlackListTable.tsx:188` (Pagination placement) → **`:242`**
   - `design-system.md:75` → `BlackListTable.tsx:70` (stretched card `<section>`) → **`:79`**
   - `user-guide.md:241` → `BlackListTable.tsx:86-88` (the header `<p>`) → **`:96-98`**
   - `user-guide.md:134` → `BlackListTable.tsx:132` → **`:150-152`**; → `lib/compute.ts:448` → **`:452`**
   - `user-guide.md:337/344/351` → the three empty states `:171-175`, `:160-166`, `:150-155` →
     **`:189-194`** (noWeeks), **`:199-205`** (nobodyJudged), **`:218-229`** (all-clear)
   - `user-guide.md:304` → `BlackListTable.tsx:132-138` now lands on the new `<th>`; re-resolve
   - `user-guide.md:667` → `page.tsx:248` (ExportButton) → **`:261`**
   - `user-guide.md:678` and `auth.md:260` → `page.tsx:247` (the BenchToggle gate) → **`:260`**
   - `project-map.md:35` and `user-guide.md:206` → `lib/compute.ts:378` (`getBlackList`) → **`:381`**
   - `project-map.md:36`'s bare relative cites: window `:382-384` → **`:385-387`**; roster gate
     `:405-408` → **`:411-414`**; bench exclusion `:426` → **`:443`**
   - Verified still correct and needing no edit: `lib/types.ts:167` (`membersJudged`), `:134`,
     `:158`; `lib/compute.ts:350` (`isWeekComplete`); bench route `:16-17`, `:41-46`, `:71-73`
     (`.claude/rules/data-pipeline.md` quotes `benchError`'s `42703` copy verbatim and correctly);
     restore route `:11`; `app/members/page.tsx:15`.
3. **`docs/project-map.md` has ~280 B of headroom under its 17 KB cap** (t5's own note) and these
   are position fixes, so they should be byte-neutral.
4. **New surfaces with no doc home yet:** the gated `excusedCount` header line and all-clear
   clause, and the rule-in-the-column-header. `docs/user-guide.md`'s Black List section describes
   a one-line header unconditionally; that is right for today's database and wrong the moment the
   owner benches someone.
5. **Migration 0003 measured unapplied** (above) — the guide's Bench section already tells the
   owner to run `npm run db:migrate`; that instruction is now backed by a measurement and can be
   stated as fact.
6. Unchanged and still correct: `.claude/rules/ux.md`'s anti-`disabled` paragraph names TopBar as
   the only remaining native-`disabled` focus defect — re-checked, `BenchToggle` uses
   `aria-disabled`, so the claim holds.

**Nothing bounced back to an implementer.** No seam needed a slice's internal logic changed.

## Open items / risks

1. **Terminology collision.** "Benched" already means a present-with-0-keys row in `docs/user-guide.md:269` and a `lib/compute.ts:406` comment. Mitigated inside t2 (comment) and t5 (guide), but the owner may prefer a different word for the new feature — flagged, not blocking.
2. **The demo member choice** is pinned as a criterion plus script proof rather than a name; computing the demo blacklist by hand at plan time would be guess-prone.
3. **Live+admin is unverifiable by agents** — only the owner holds the password. t3's changelist must say so rather than imply an end-to-end test.
4. ~~**`aria-label` on a bare span** is weakly announced without a role.~~ **CLOSED in the 2026-08-18 fix round, and the risk was under-stated.** Measured, not inferred: lucide-react puts `aria-hidden="true"` on the svg unless an a11y prop is passed, and `aria-label` on a `<span>` (role `generic`) is prohibited by ARIA in HTML and dropped by browsers and AT — so the marker was announced not weakly but *not at all*, and `title` is hover-only by the owner's accepted trade-off. Both spans now carry `role="img"`, which makes the existing label valid. The native-`title` decision is unchanged and still pinned. Lesson for the next pack: "weakly announced" is the phrasing that let this ship as accepted.
5. **t5 touches `CLAUDE.md`, `.env.example` and two `.claude/rules/` files** — config-adjacent edits, each a one-line count/enumeration fix, enumerated exactly in the pack. Covered by the gate approval.
