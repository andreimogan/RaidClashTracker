# Build log — Raid Clash Tracker

<!-- APPEND-ONLY. One entry per completed order (and per maintenance pass).
     Never rewrite past entries. This is the durable "why" trail. -->

---

## 2026-07-06 — Setup

- **Decision:** Bootstrapped the agent team for this project.
- **Team:** core five (task-planner, flow-implementer, integrator, flow-reviewer, maintainer — pre-existing scaffold, untouched) **plus three specialists added at the user's request:** data-pipeline-specialist (write; the ingest pipeline's replace/upsert semantics are the riskiest area), ui-design-specialist (write; keeps all UI on the gestal.gg token system), db-migration-specialist (write; no migration framework exists, so schema changes need paired one-off migration scripts).
- **Context:** brownfield — all facts derived from code, README, and project memory; no questionnaire needed. Key facts: Next.js 16 App Router + Tailwind v4 + Recharts; local SQLite via libSQL (`data/clash.db` prod / `clash-test.db` test, pointer-file switcher); single write pipeline parse → normalize → persist; Sheet-sync mirror / JSON replace / legacy upsert semantics; zero-code-change Turso deploy path is locked.
- **Rejected:** initially proposed core-only with path rules instead of specialists; the user opted all three specialists in (rules were generated anyway — agents and rules reinforce each other). Hook runtime: the settings template's `python3` doesn't exist on this machine (Store stub only), so the gate hook was ported to Node (`orchestrate-gate.mjs`) and `settings.json` points there; the original `.py` was kept untouched.

---

## 2026-07-06 — Member links in every member table

- **Built:** New shared `components/MemberCell.tsx` (avatar + name linked to `/members/[id]` + former-state handling); replaced the duplicated avatar+name block in `PerformanceTable`, `TotalPerformanceTable`, `ClashTable`, and the members page. Every table showing a member now links to that member's page.
- **Decisions:** Extracted one shared cell instead of three inline `<Link>` edits — makes "member name is always a link" structural and deletes three copies of the block. Link only the name (matches the existing members-page pattern; keeps real anchor semantics) rather than whole-row `onClick`. `formerStyle` prop reconciles the two former-member visuals ("badge" pill in tables, "muted" name on the roster).
- **Rejected:** Row-level `router.push` navigation (breaks middle-click/text selection); leaving the members page on its hand-rolled link (would keep a fourth divergent copy).
- **Notes:** Review caught that the members page must pass the *derived* active flag (`s.isActive`) into the cell — the raw member row carries the DB `is_active` column, which is never written to 0 on a live DB. Fixed and re-verified. Side effect accepted: all four cells now pass `avatarUrl` to `Avatar`, so uploaded avatars render everywhere consistently. Ledger: `docs/tasks/member-links.md` (done).

---

## 2026-07-06 — Edit a member's weekly clash stats from their history table

- **Built:** Per-week edit dialog on the member detail page. The Week-by-Week History table now lists **all** tracked weeks (weeks the member missed show as "—" and can be filled in); a pencil per row opens the app's first modal with four fields (Hydra/Chimera keys and damage, `"16.61B"` shorthand accepted with live preview). New `POST /api/members/[memberId]/results` + `lib/results.ts` writes both clash rows through `persist(payload, "upsert")` — the sanctioned pipeline, no direct SQL. New shared component `components/MemberHistoryTable.tsx`; CSV export follows the merged rows.
- **Decisions:** All-weeks merge done in the page, not `lib/compute.ts` (its present-weeks semantics feed lifetime stats). Endpoint validation stricter than imports: member and week must pre-exist, dates and display name come from **stored** records (client values are validation-only), keys integer-capped at `MAX_KEYS`, garbage damage strings rejected instead of coerced to 0. Demo mode guarded on both sides (pencils hidden + endpoint 400). Dialog is a hand-rolled fixed overlay + `.card` panel — now the documented modal pattern.
- **Rejected:** Inline cell editing (user chose dialog); extending `lib/import.ts` validation (would change sheet/JSON import behavior); native `<dialog>` (more plumbing, no gain).
- **Notes:** Review caught and fixed pre-finalize: lossy damage prefill (`formatDamage` rounding would have written rounded values back on save — now prefills exact digits), a member-rename side channel via slug-equivalent `memberName`, and a damage grammar accepting multiple dots. Endpoint smoke-tested against the test DB (21/21). Known-acceptable LOWs: emptied keys field means 0 (benched semantic), autofocus without a full focus trap, double dataset query per page render. Ledger: `docs/tasks/member-week-edit.md` (done).

---

## 2026-07-06 — Added ux-specialist role

- **Decision:** Added a read-only `ux-specialist` agent (via `/add-role`) — a design-focused counterpart to `flow-reviewer` that reviews a change across four lenses: flow & interaction, accessibility (keyboard/focus/ARIA/contrast), state coverage (empty/loading/error/demo), and content & clarity. It reports findings; `ui-design-specialist` (or the owning implementer) applies them.
- **Why:** Verification so far is `npm run build` + manual clicking; interaction/accessibility/state defects (e.g. the edit dialog's missing focus trap, surfaced during the member-week-edit review) have no dedicated owner. This closes that gap without touching correctness review.
- **Fit check:** No ownership overlap with `ui-design-specialist` — that agent *writes* to the visual system; `ux-specialist` is read-only and hands off findings. Considered folding UX into ui-design-specialist or making it a writing agent (shared `components/**`); chose the read-only reviewer split for the cleanest separation and no per-order file-ownership contention.
- **Generated:** `.claude/agents/ux-specialist.md` (tools: Read, Grep, Glob, Bash — inspection only), `.claude/rules/ux.md` (UX checklist scoped to `components/**`, `app/**`), plus this note and a project-map roster entry. Existing agents untouched.

---

## 2026-08-07 — Import week picker: "has data" now follows the selected clash

- **Built:** In the Settings → Import panel, each week's `has data` / `no data` tag is now computed for the *selected* clash (`existingData[n]?.[clashType]`) instead of the Hydra+Chimera sum, so a week with only Hydra rows correctly reads "no data" under Chimera. The `weekNumber`/`clashType` state moved above the `weekOptions` memo so it can close over `clashType` (the memo previously couldn't see it, so labels wouldn't have recomputed on toggle even with the right formula). The dropdown's listed date range likewise follows the selected clash's window. `importJson()` and `syncSheet()` now `router.refresh()` on success, so the tags and overwrite warning stop showing pre-import state.
- **Decisions:** Display-only fix — no DB, API, or pipeline change. The data was already per-clash (`app/settings/page.tsx` builds `{ hydra, chimera }` per week) and the component already used it correctly for the overwrite warning; only the dropdown derivation was wrong. `canonical = clashWindow(wed, "hydra")` deliberately stays Hydra-anchored: it is the canonical stored week row and part of the write path, and the server re-derives it anyway (`app/api/import/route.ts`) — only dates *displayed* became clash-relative.
- **Rejected:** Adding a weeks-status API endpoint or a clash-aware DB query — the server-rendered `existingData` prop already carries the split, and Settings is `force-dynamic`, so `router.refresh()` suffices. Also rejected making the tag mean "results were imported": `lib/results.ts` writes both clash rows (0/0 when benched), so "has data" means "rows exist and a replace would delete them" — which is exactly what the adjacent overwrite warning promises.
- **Notes:** Review (`flow-reviewer`) confirmed the write path is untouched and the 4 `npm run lint` errors in this file are pre-existing (verified against HEAD). Fixed post-review: the confirm-overwrite row stayed armed after a successful replace (newly adjacent to the success banner because of the refresh), `res.ok` wasn't checked alongside `data.ok` per `.claude/rules/ux.md`, and the clash toggle lacked `aria-pressed`/group labelling — now load-bearing since toggling silently rewrites the `<select>`'s option text. Accepted as-is: sheet sync can re-anchor `currentWeek` mid-session (latent before, now visible without a reload). Ledger `docs/tasks/import-clash-aware-week-tags.md` was backfilled — the order was dispatched as a single one-file slice without one. `npm run build` passes.

---

<!-- Template for each subsequent entry:

## <ISO date> — <order summary>
- **Built:** <what shipped>
- **Decisions:** <choices made>
- **Rejected:** <alternatives not taken and why>
- **Notes:** <follow-ups, unknowns>

-->
