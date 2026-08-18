# Task ledger: benched-roster-table

order: "Add a separate Benched Roster table on the Members page, to the right of the Roster table."
status: done   # planning | approved | in-progress | integrating | review | done | blocked
created: 2026-08-18

<!-- SOLO ORDER — one ownership group, so the main session wrote this ledger rather than
     dispatching task-planner (recipe step 2, solo path). No integrate component: one
     implementer runs, and the main session advances status to `review` itself.

     Written BEFORE any dispatch, deliberately — see project memory
     "approved-plans-die-with-the-session". -->

## Owner decisions pinned at the gate — do not relitigate

1. **Benched players STAY in the main Roster.** The owner's words: benching is "not meant to eliminate as I do not remove it from the clan, I just state that is benched and this means he will not participate in events but still be part of the clan." The new table is an *additional* view, not a partition. A benched player appears in BOTH tables on this page, by design.
2. **Minimal columns — Player only** (plus the rank `#`). Not the Roster's eight columns, not a participation summary.
3. **The card is always present**, with empty-state copy when nobody is benched. It must not appear/disappear — that would shift the layout the moment the first player is benched, and an absent card teaches nobody the feature exists.
4. **The split engages at `2xl` (1536px)**, matching the overview's measured decision. Below it the two cards stack, Benched Roster underneath.

## Context pack

**Stack.** Next.js 16.2.9 (breaking changes vs. training data — read `node_modules/next/dist/docs/` before touching page-shaped code), Tailwind v4 tokens in `app/globals.css`, lucide-react. No test suite: verify with `npm run build` + `npm run lint`. **Lint's clean state is the existing 9-errors-1-warning baseline** (pre-existing hits in `components/ImportPanel.tsx` and two `.claude/scripts/*.js`), not zero.

**Survey provenance.** A read-only survey ran at plan time this session against the current working tree, which carries two uncommitted orders. Line numbers below are current as of 2026-08-18. Do not re-survey; read only where this pack is silent.

**No new data plumbing is needed — this is a pure UI order.**
- `app/members/page.tsx:23-45` already computes `summaries: RosterRow[]`, and each row's `member` carries `isBenched` (threaded through `lib/data.ts:111` into `lib/types.ts:16-18` last order).
- The benched subset is therefore `summaries.filter((s) => s.member.isBenched)`. **No `lib/compute.ts` change, no schema change, no API route, no env var.** `lib/compute.ts` reads `m.isBenched` in exactly two places, both inside `getBlackList` (`:422-424`, `:443`); nothing exported derives a benched subset, deliberately — this page already holds the data.

**Files in play**
- `app/members/page.tsx` (72 lines) — server component. `force-dynamic` at `:15` with its load-bearing comment `:7-14`. Root layout `:62` is `flex flex-col gap-6 p-6` with **no grid at all**; `TopBar` `:65`; `<RosterTable rows={summaries} />` at `:69` as a single full-width child. `exportData` `:47-59` (7 headers, no bench column). **`isBenched` is never read on this page today.**
- `components/RosterTable.tsx` (145 lines, untracked) — client directive `:1`. Exports `RosterRow` `:26-35` (`member`, `isActive`, `weeksPresent`, `hydraTotal`, `chimeraTotal`, `avgKeys`, `participationPct`). Section `:51` is bare `card-flush` — **it lacks the stretch classes**. Count line `:54-57`. Table `:60` `w-full min-w-[820px]`. Eight columns `:63-70`. `MemberCell` `:81` receives `{ ...s.member, isActive: s.isActive }`, so `isBenched` survives the spread. Status pill `:83-97`. Empty row `:106-135` (`colSpan={8}`, `Inbox` + `/settings` link). Pagination `:142`, **without** `xl:mt-auto`.
- `components/BenchedRosterTable.tsx` — new.

**The grid precedent (copy it).** `app/page.tsx:136` — `grid grid-cols-1 gap-5 2xl:grid-cols-3`; left wrapper `:137` `xl:h-full 2xl:col-span-2`; right wrapper `:142` `xl:h-full`. The reasoning for `2xl` over `xl` is at `app/page.tsx:127-135` and restated at `docs/reference/design-system.md:77`. **Width check for THIS page, done at plan time:** at 1536px the Roster's 2-of-3 share is ~944px against its `min-w-[820px]` — fits with slack; the right column gets ~465px, ample for a Player-only table.

**The stretched-card trap — this is why `RosterTable` must change.** `components/BlackListTable.tsx:79` carries `card-flush xl:flex xl:h-full xl:flex-col` and its pagination carries `className="xl:mt-auto"` (`:247`) **because grid stretch otherwise leaves the shorter card's pagination bar floating mid-card with its `border-t` in empty space** — a defect found and fixed two orders ago (`docs/reference/design-system.md:76`). Both cards here need the same treatment the moment they become grid items.

**Empty-state shapes to follow:** `components/RosterTable.tsx:106-135` (colSpan row, `Inbox size={18} className="shrink-0 text-gold"`, copy, `/settings` link) and `components/BlackListTable.tsx:182-233` (three branches; the ShieldCheck all-clear at `:206-229` is the good-news precedent).

**Pagination.** `usePagination` plus `<Pagination {...view} onPageChange={view.setPage} itemLabel="members" label="Benched Roster" className="xl:mt-auto" />`. Spread `{...view}` — never hand-pick props, or the `pageSize`-derived range end desyncs. **`label` is mandatory here:** `docs/reference/design-system.md:75` says pass it whenever two of these controls can be on screen at once, and this page will now have exactly that. At `pageCount === 1` the control renders only the range summary; at zero rows it returns `null` — so a typically-tiny table carries no dead chrome.

**The shield comes free and must not be duplicated.** `components/MemberCell.tsx:60-64` renders the gold `ShieldCheck` for any member with `isBenched`. Every row of the new table gets it automatically — which is the point; it reinforces what the table is. **Do not render a second shield**; the pinned markup belongs to `MemberCell` alone (`docs/reference/design-system.md:79-151`).

**The existing collision, and why this order does NOT fix it.** A benched member on the current roster today renders `avatar · name · gold shield · "Active" pill`, because benching does not touch `isActive` and `RosterTable` reads no bench state. Under owner decision 1 that is *correct*: they are an active clan member who is benched. Leave the Status column alone.

## Constraints

- **Style only with tokens and primitives** from `app/globals.css`. Never hardcode hex. The faintest text token (~3.05:1) is decorative-only — never for anything the reader needs.
- **Pages stay server components; client components stay leaf-level.** `app/members/page.tsx` must not gain a client directive.
- **`force-dynamic` at `app/members/page.tsx:15` is load-bearing** and its comment must survive. The page reads no `searchParams`; without that line it silently prerenders to static HTML (`.claude/rules/rendering.md`). No `?page=`, no `useSearchParams` — client `useState` pagination only.
- **Five data-source states.** The empty state here is *ordinary*, not an error and not a permission problem: nobody being benched is the normal shipping state. Copy must not read like missing data or like something is broken.
- **No write affordances.** The bench toggle stays on the member detail page (pinned last order). This table is read-only for everybody, so the 2×2 permission grid is untouched — assert that rather than assuming it.
- **`done_when` methodology** (project memory; six instances across four orders): enumerate the corpus and **exclude `docs/tasks/` and `docs/build-log.md`**; prefer a positive assertion at a `file:line` seam over a negative grep; **never spell a banned identifier in the criterion or in a comment** — three implementers hit this two orders ago by writing comments that matched their own greps; always run a positive control and paste it.
- Scratchpad filenames prefixed `t1-`.

## Non-goals

- No bench toggle in either table.
- No CSV change. `members.csv` already lists everyone; a Benched column was not asked for.
- No `lib/`, schema, migration, or API change.
- No change to who appears in the main Roster (decision 1).
- Not fixing: the shield-beside-Active-pill reading; `participationColor` hand-copied four times; the avatar route's silent-write bug; `lib/parse.ts` / `lib/results.ts` old-sense comments.

## Cost forecast

**Estimate: ~2.5M tokens nominal** (range 2M–4M) — 1 implementer, 1 reviewer, one bounce allowance.

**Meter caveat, unchanged and load-bearing.** `token-report.js` omits subagent transcripts entirely (measured ~15× under by the 2026-08-17 maintenance pass), so `docs/build-log.md`'s `Cost:` actuals are not a calibration basis. By dispatch count (~3–4 dispatches) true all-in cost is plausibly **$10–15**. The honest prior remains the old 8-of-8 over-run streak; the two "under-runs" since were meter artifacts.

## Plan cost

**Measured: ~2.0M nominal at the gate**, but the figure is not clean: `--solo` still anchored to the *previous* order's 6.8M forecast and attributed an 80.3k `task-planner` dispatch belonging to that order — this one used an `Explore` agent (66.6k) and no planner. Read it as "main session ~1.9M nominal plus one survey dispatch", on the same under-measuring meter as everything else.

## Tasks

- id: t1
  summary: Benched Roster table beside the Roster on /members, plus the grid and the stretch classes both cards now need
  agent: ui-design-specialist
  owns:
    - components/BenchedRosterTable.tsx   # new
    - components/RosterTable.tsx
    - app/members/page.tsx
    - docs/reference/design-system.md
    - docs/user-guide.md
    - docs/project-map.md
  depends_on: []
  claimed_by: "ui-design-specialist"
  state: done
  docs_touched:
    - docs/reference/design-system.md
    - docs/user-guide.md
    - docs/project-map.md
  done_when:
    1. `npm run build` exits 0 and the route table is **unchanged** — seventeen routes, `/members` still marked dynamic (a static marker there means the guard broke and the task is NOT done), `/import` still static. Paste the table. `npm run lint` at the 9-errors-1-warning baseline with zero hits in owned files.
    2. `grep -c "force-dynamic" app/members/page.tsx` is 1 and the load-bearing comment above it is intact — paste `:7-15`.
    3. `grep -nE "searchParams|useSearchParams" app/members/page.tsx components/BenchedRosterTable.tsx` matches only prose inside guard comments; paste every hit. Positive control: `grep -n "dynamic" app/members/page.tsx` exits 0.
    4. Line 1 of `components/BenchedRosterTable.tsx` is the client directive; the same directive does not appear in `app/members/page.tsx`. Paste both checks.
    5. Paste the grid container's className and both wrappers', showing the `2xl` breakpoint and the 2+1 col-span split.
    6. **Both** cards carry the stretch treatment: paste the `<section>` className from `RosterTable` and `BenchedRosterTable` (each with `xl:flex xl:h-full xl:flex-col`) and both `<Pagination` lines showing `xl:mt-auto`. This is the grid-stretch trap from `docs/reference/design-system.md:76`.
    7. Pagination sits **outside** `<table>` in both files: give the `file:line` of each `<Pagination` and of its enclosing `</table>`, showing the pagination line is greater. Both spread `{...view}`; both pass a distinct `label`.
    8. **Benched players still appear in the main Roster** (owner decision 1): state the `file:line` of the Roster's row source and confirm it is the unfiltered `rows`. Then demonstrate with a render or a script against the demo dataset (`NcRoughNeck` / `m7` is benched there) that m7 appears in BOTH tables.
    9. Paste the empty-state branch's copy verbatim with its `file:line`. It must read as an ordinary state, not as missing data or an error, and must not imply a benched player left the clan.
    10. `grep -nE "#[0-9a-fA-F]{3,8}" components/BenchedRosterTable.tsx` exits 1; positive control on `app/globals.css` exits 0. Same check for the faintest text token, with a positive control on a file that legitimately uses it.
    11. Exactly one shield renders per benched row: confirm `BenchedRosterTable` renders no icon of its own for that purpose and relies on `MemberCell`. Give the `file:line` of the `MemberCell` call.
    12. The count line reflects the benched total, not the current page. Paste the line and its source expression.
    13. Docs: `docs/reference/design-system.md`'s 2+1 grid entry names this second instance; `docs/user-guide.md`'s Members description and Bench section cover the new table (and its shield-carrying-tables list gains it); `docs/project-map.md`'s component count goes 27 → 28, re-measured with `ls components/*.tsx | wc -l`. **That file sits ~260 B under a 17 KB cap** — if you must add, trim elsewhere and say exactly what you cut. Re-resolve every `file:line` you touch.

## t1 changelist (ui-design-specialist, 2026-08-18)

**Code**
- `components/BenchedRosterTable.tsx` (**new**, 135 lines) — client leaf. `.card-flush xl:flex xl:h-full xl:flex-col` section (`:37`), `SectionTitle` "Benched Roster", an unconditional count line off `rows.length` (`:46-49`), a two-column table (`#`, `Player`) at `min-w-[220px]`, `MemberCell` at `:82`, an ordinary-state empty branch at `:87-113`, and `<Pagination {...view} … label="Benched Roster" className="xl:mt-auto" />` at `:126-132`, outside `</table>` (`:115`). Imports `RosterRow` from `./RosterTable` — no parallel type. Renders no icon of its own beside a name; the shield comes from `MemberCell`.
- `components/RosterTable.tsx` — **stretch treatment only** (plus one line-number re-resolve my own edit invalidated). Section `:57` gained `xl:flex xl:h-full xl:flex-col`; `<Pagination>` `:150-156` gained `className="xl:mt-auto"` (and moved to multi-line). Header comment `:9` re-pointed at `app/members/page.tsx:17`. Columns, count line and Status pill untouched.
- `app/members/page.tsx` — added the `BenchedRosterTable` import (`:5`), `const benched = summaries.filter((s) => s.member.isBenched)` (`:49-54`), and the 2+1 grid (`:86-93`) copied from `app/page.tsx:136-143`. `force-dynamic` and its comment survive (now `:8-17`, one line longer because it names both client leaves). `summaries` still reaches the Roster **unfiltered** (`:88`).

**Docs**
- `docs/reference/design-system.md` — new bullet "The 2+1 grid is now a pattern with two instances" (`:79`); Pagination entry now says six tables / six `usePagination` consumers / six labelled call sites; placement list gained `BenchedRosterTable.tsx:126`; the `xl:mt-auto` bullet now names all four gridded cards and states that the stretch treatment is part of gridding a card, not a follow-up.
- `docs/user-guide.md` — Members row in the pages table now describes two cards; the ten-rows list covers both `/members` cards; the shield list is "all six tables"; new Bench sub-paragraph "Where you can see the whole bench at once — the Benched Roster" (decisions 1/2/3 plus the read-only assertion); `RosterTable.tsx:102` → `:108`, `page.tsx:38` → `:39`.
- `docs/project-map.md` — component count **27 → 28** (re-measured `ls components/*.tsx | wc -l` = 28); Pagination "five tables" → "six"; the client-leaf fact now names both roster leaves and the subset relationship. **No trim was needed**: 17,149 B → 17,287 B, i.e. 121 B under the 17,408 B cap.

**Corrections to facts the context pack and other docs carried**
- The pack said the live database has zero benched players. It has **one** (`Why Try???`), and migration `0003` **is applied** — verified read-only: `information_schema` reports `members.is_benched` present, one row true. `docs/project-map.md:41` and `docs/user-guide.md:454-458` both said 0003 was NOT applied; corrected in both (they are `docs_touched` files).
- `.claude/rules/rendering.md:18` and `docs/reference/deployment.md:295` still cite `app/members/page.tsx:15` for the `force-dynamic` declaration; it is now `:17`. **Not owned by this task — left for the reviewer/doc-sync.**

**Assumptions**
- The header count line is **unconditional** (prints "0 players are sitting events out." at zero), matching the Roster's own unconditional count line rather than the Black List's conditional second line — a line that appears on first bench would shift the table down, which is the same argument decision 3 makes for the card.
- The empty state carries no link and no admin verb: the Bench control is hidden from non-admins, so pointing at it from a public card would advertise an action most readers cannot take.

## Flow

Solo path: one implementer → **skip integrator** (one diff is already coherent; the main session sets `status: review` itself) → `flow-reviewer` with doc-sync, briefed to carry the UX lens too. A separate `ux-specialist` dispatch is not warranted at this size: the surface is small, read-only, adds no write affordance, and every pattern it uses is already precedented and documented.
