# Project map — Raid Clash Tracker

<!-- The CURRENT architecture snapshot. Overwritten as the project changes
     (by bootstrap initially, by maintainer over time). For the "why is it
     like this" history, see docs/build-log.md. -->

## Overview

Local-first web dashboard for a RAID: Shadow Legends clan's **Hydra Clash** and **Chimera Clash** performance — per-member keys used, damage, participation, and week-over-week trends. Runs on the owner's machine (`npm run dev`); no accounts or hosting.

Stack: **Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Recharts · lucide-react · local SQLite via `@libsql/client` (libSQL)**. Deployable later to Turso + Vercel with env vars only (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`) — a locked decision; no code change allowed for that path.

## Structure

- `app/` — routes: `/` (overview), `/hydra`, `/chimera` (per-clash detail), `/timeline` (weekly totals), `/members` + `/members/[memberId]` (roster/detail), `/settings` (clan info, data management, import tab), `/import`
- `app/api/` — the write surface: `import` (JSON, upsert/replace), `sheet-sync` (Google Sheet mirror), `backup`, `restore`, `reset`, `database` (prod/test switch), `members/[memberId]/avatar`. **Unauthenticated — local use only; must be gated before any public deploy.**
- `components/` — ~20 UI components in the gestal.gg aesthetic (dark panels, hairline borders, Hydra amber / Chimera steel-blue). All styling flows from tokens/primitives in `app/globals.css`.
- `lib/` — the seams:
  - **Read path:** `data.ts` `loadDataset()` reads members / weeks / clash_results / clash_meta via libSQL, falling back to `mock-data.ts` (bundled demo, weeks 20–24) when the DB is empty/missing → `compute.ts` derives all metrics (data-source agnostic).
  - **Write path (the only one):** `parse.ts` (parseCsv / parseDamage) → `import.ts` (normalizers — pure, client-safe) → `persist.ts` `persist(payload, "upsert" | "replace")`.
  - `db.ts` — two local DBs (Production `data/clash.db`, Test `data/clash-test.db`), switchable via pointer file `data/active-db.json`; `DATABASE_URL` pins one DB and disables switching.
  - `sheets.ts` (published-CSV fetch), `week.ts` (UTC clash schedules), `types.ts`, `schema.ts`, `format.ts`, `constants.ts`, `backup.ts`, `members.ts`, `seed.ts`.
- `db/schema.sql` — single schema source, applied by `npm run db:init`. No migration framework.
- `scripts/` — CLI entries (`db-init`, `seed`, `import-csv`, `import-json`, `sync-sheet`); each imports `scripts/lib/load-env.ts` first.
- `data/` — the actual DBs, pointer file, and sample datasets. `Assets UI/` — design references.

## Key entities / modules

- **Dataset** (from `loadDataset()`) is the architecture seam between storage and UI — pages consume it, `compute.ts` derives from it, and it is identical in demo and live mode.
- **Clash semantics:** Hydra = 3 keys/member, Wed→Wed (UTC); Chimera = 2 keys/member, Fri→Thu (UTC); both clashes of week *N* share a calendar week. Dates are derived, never user-entered.
- **Ingest semantics:** Sheet sync = mirror (replace per `(week, clash)`, deletions propagate); in-app JSON import = replace of its `(week, clash)`; legacy nested JSON = upsert (back-compat). Damage accepts number, `"16.61B"` shorthand, or `null` (benched → 0).

## The team

Core (project-agnostic, committed with the scaffold):
- **task-planner** — decomposes an order into a ledger with disjoint file ownership.
- **flow-implementer** — generic implementer for slices no specialist covers.
- **integrator** — merges parallel slices, resolves shared seams (`lib/types.ts`, `lib/data.ts` are the usual ones).
- **flow-reviewer** — post-integration correctness + convention + doc-sync review.
- **maintainer** — periodic docs/memory/map reconciliation (cadence: every 5 orders).

Specialists (project-specific, generated 2026-07-06):
- **data-pipeline-specialist** (write) — owns ingest-pipeline slices; guards replace/upsert semantics.
- **ui-design-specialist** (write) — owns UI slices; enforces the token/primitive design system.
- **db-migration-specialist** (write) — owns schema changes; every change ships with a one-off migration script so existing local DBs survive.
- **ux-specialist** (read-only) — reviews experience of a change across four lenses (flow & interaction, accessibility, state coverage, content & clarity); reports findings for ui-design-specialist to implement. Design-focused counterpart to flow-reviewer. Added 2026-07-06.

## Open unknowns / blockers

- **No test suite** — verification is `npm run build` + manually exercising the affected page. A future order could add one.
- **Unauthenticated write API** — fine locally; hard blocker to resolve before any public Turso/Vercel deploy.
- **Uncommitted work in progress** — at bootstrap time the working tree had broad modifications (gestal restyle follow-ups, `app/api/members/`, `AvatarEditor.tsx`, `lib/members.ts`, `ONBOARDING.md`, `TUTORIAL.md`, `Assets UI/`) not yet committed.
- **`Assets UI/` folder** — design references exist but their intended workflow (manual vs. Figma-driven) is not established.
