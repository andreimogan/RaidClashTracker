# Project map — Raid Clash Tracker

<!-- The CURRENT architecture snapshot. Overwritten as the project changes
     (by bootstrap initially, by maintainer over time). For the "why is it
     like this" history, see docs/build-log.md. -->

## Overview

Web dashboard for a RAID: Shadow Legends clan's **Hydra Clash** and **Chimera Clash** performance — per-member keys used, damage, participation, and week-over-week trends. The app runs on the owner's machine (`npm run dev`); the database is hosted. No accounts yet.

Stack: **Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Recharts · lucide-react · Supabase Postgres 17 via `postgres` (postgres.js)**, reached over the pooled (`:6543`) `DATABASE_URL` with `prepare: false`. Deployable later to Vercel with `DATABASE_URL` as an env var, but only once the write API is gated.

> **Superseded decision — SQLite / libSQL / Turso.** The project's previously *locked* deploy path was **Turso**, a hosted drop-in for the local **SQLite** file (`data/clash.db`) that the app reached through **`@libsql/client`** — the appeal being a deploy with no code change at all. Phase 2's port to Supabase Postgres **supersedes** it: `@libsql/client` is uninstalled, no database file is read at runtime, and dual-engine SQL compatibility is no longer a constraint. The engine names stay written out here so a reader carrying the old vocabulary can grep for them and find this line; `docs/build-log.md` records both decisions and why the second replaced the first.

## Structure

- `app/` — routes: `/` (overview), `/hydra`, `/chimera` (per-clash detail), `/timeline` (weekly totals), `/members` + `/members/[memberId]` (roster/detail), `/settings` (clan info, data management, import tab), `/import`
- `app/api/` — the write surface: `import` (JSON, upsert/replace), `backup`, `restore`, `reset`, `members/[memberId]/results`, `members/[memberId]/avatar`. **Unauthenticated — local use only; must be gated before any public deploy.**
- `components/` — ~20 UI components in the gestal.gg aesthetic (dark panels, hairline borders, Hydra amber / Chimera steel-blue). All styling flows from tokens/primitives in `app/globals.css`.
- `lib/` — the seams:
  - **Read path:** `data.ts` `loadDataset()` reads members / weeks / clash_results / clash_meta from Postgres → `compute.ts` derives all metrics (data-source agnostic). It exposes `DataSource = "postgres" | "demo"`, and its four row mappers are the **single coercion boundary** (Postgres `bigint` reads back as a JS string; every numeric field is wrapped in `Number(...)`). It falls back to `mock-data.ts` (bundled demo, weeks 20–24) **only** when `DATABASE_URL` is unset or the error code is `42P01` (undefined table) — every other failure rethrows to `app/error.tsx`. A reachable but empty database renders genuinely empty.
  - **Write path (the only one):** `parse.ts` (parseCsv / parseDamage) → `import.ts` (normalizers — pure, client-safe) → `persist.ts` `persist(payload, "upsert" | "replace")`, which runs every statement in one transaction.
  - `db.ts` — exactly one database and exactly four exports: `type Db` (a re-export of postgres.js's client type, which is named **`Sql`**, so nothing else imports `postgres` directly), `databaseUrl(): string | null` (the **trimmed** `DATABASE_URL`, with a **blank value treated as unset** — a commented-out or emptied env line must land in demo mode, not on an error page; never logged, returned to a client, or rendered, because it contains the password), `getDb(): Db` (throws a clear error when the URL is null), and `closeDb(): Promise<void>` (`sql.end()`, so the CLI entries can exit). The pool is a **`globalThis` singleton** — a module `const` would open a pool per Next dev HMR reload and exhaust the pooler — configured with `prepare: false` (mandatory on the transaction pooler), `max: 3`, and an `idle_timeout`. No filesystem I/O. **`max` is a correctness bound:** exceeding it with concurrent queries deadlocks against the transaction pooler, so a multi-query read runs inside one `begin("read only", …)` — see `.claude/rules/database.md`. The in-transaction client is `TransactionSql`, which is **not** assignable to `Db`.
  - `week.ts` (UTC clash schedules), `types.ts`, `format.ts`, `constants.ts`, `backup.ts`, `members.ts`, `results.ts`, `seed.ts`.
- `supabase/migrations/` — numbered, forward-only SQL files, applied in filename order by `npm run db:migrate` (safe to re-run). An applied migration is never edited; a change means a new numbered file.
- `scripts/` — CLI entries (`db-migrate`, `seed`, `import-csv`, `import-json`); each imports `scripts/lib/load-env.ts` first and closes the pool so the process exits.
- `data/` — sample datasets (the owner's archived database file lives here untracked and is no longer read). `Assets UI/` — design references.

## Key entities / modules

- **Dataset** (from `loadDataset()`) is the architecture seam between storage and UI — pages consume it, `compute.ts` derives from it, and its shape is identical in every data state. No file outside `lib/data.ts` compares `getDataSource()` against a storage literal; call sites test `=== "demo"` / `!== "demo"`.
- **Clash semantics:** Hydra = 3 keys/member, Wed→Wed (UTC); Chimera = 2 keys/member, Fri→Thu (UTC); both clashes of week *N* share a calendar week. Dates are derived, never user-entered.
- **Ingest semantics:** three entry points, one pipeline. In-app JSON import = replace of its `(week, clash)`; legacy nested JSON = upsert (back-compat); CSV file (`npm run import`) = upsert; member week edit = upsert of that member's two clash rows. Damage accepts number, `"16.61B"` shorthand, or `null` (benched → 0).

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
- **db-migration-specialist** (write) — owns schema changes; every change ships as a new numbered, forward-only migration in `supabase/migrations/`.
- **ux-specialist** (read-only) — reviews experience of a change across four lenses (flow & interaction, accessibility, state coverage, content & clarity); reports findings for ui-design-specialist to implement. Design-focused counterpart to flow-reviewer. Added 2026-07-06.

## Open unknowns / blockers

- **No test suite** — verification is `npm run build` + manually exercising the affected page. A future order could add one.
- **Unauthenticated write API** — fine locally; hard blocker to resolve before any public Vercel deploy.
- **`Assets UI/` folder** — design references exist but their intended workflow (manual vs. Figma-driven) is not established.
