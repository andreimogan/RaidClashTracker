@AGENTS.md

# Raid Clash Tracker

Next.js dashboard tracking a RAID: Shadow Legends clan's **Hydra Clash** and **Chimera Clash** performance — keys used, damage, participation, week-over-week trends. **Supabase Postgres** via postgres.js over a pooled (`:6543`) connection URI, plus **Supabase Auth** (`@supabase/ssr`) for sign-in only. **Reads are public; every write is admin-only** (one account, `ADMIN_EMAIL`). Runs locally **and is deployed on Vercel**: per the owner's report (no agent can see the Vercel dashboard, so this is unverified from the repo) `main` is the production branch and auto-deploys on push, with one Supabase project shared by production, previews and local dev — **so a preview deployment writes production data** unless the environment is scoped per-environment. See `docs/reference/deployment.md`.

## Commands
- dev: `npm run dev`
- build: `npm run build`
- lint: `npm run lint`
- test: **none** — no test suite; verify by building and exercising the affected page
- db setup: `npm run db:migrate` (apply migrations) → `npm run seed` (optional sample data)
- data in: `npm run import -- <csv>` · `npm run import:json -- <file> --clash hydra|chimera [--week N]`

## Layout
- `app/` — routes: `/` overview, `/hydra`, `/chimera`, `/timeline`, `/members[/[memberId]]`, `/settings`, `/import`, `/login`; `app/api/` — write endpoints (import, backup, restore, reset, member results, member avatar), **all six admin-only**
- `proxy.ts` (repo root) — Supabase token refresh only, never blocks. **The file convention here is `proxy`, not `middleware`** — a `middleware.ts` is silently ignored in this Next version
- `components/` — UI (gestal.gg aesthetic; tokens/primitives live in `app/globals.css`)
- `lib/` — types · db client (`db.ts`) · read path (`data.ts` → `compute.ts`) · write path (`parse.ts` → `import.ts` *or* `results.ts` → `persist.ts`) · auth (`supabase/server.ts` → `auth.ts`) · formatting · `mock-data.ts` demo fallback
- `supabase/migrations/` — numbered, forward-only SQL; applied in order by `npm run db:migrate`, never edited once applied. `data/` — sample datasets only (no database file is read at runtime)
- `scripts/` — CLI entries (db-migrate, seed, import csv/json); each imports `scripts/lib/load-env.ts` first and closes the pool so the process exits

## Conventions (always)
- Match existing patterns; read neighboring files before writing new ones.
- This Next.js version differs from training data — read the relevant guide in `node_modules/next/dist/docs/` before writing route/API code (see AGENTS.md).
- Style only with the tokens and primitives from `app/globals.css` (`card`, `inset`, `fill-hydra`, …) — never hardcode colors.
- All data writes end at one writer: `persist(payload, "upsert" | "replace")`. Never write SQL from routes or components. **Two builders reach it, not one** — the import paths go parse → normalize (`lib/import.ts`, pure/client-safe) → `persist`; the member week edit goes through `lib/results.ts`, which uses `parseDamage` but builds its `ImportPayload` itself and runs **no** normalizer (it imports only *types* from `lib/import.ts`). Writing this as a single three-stage funnel is inaccurate and has already propagated into three docs.
- **Writes are admin-only, guarded per route.** Every handler under `app/api/` opens with `const denied = await requireAdmin(); if (denied) return denied;` as the **first statement of its body** — a proxy cannot protect route handlers, so there is no matcher to rely on. No data mutation may move to a Server Action; `requireAdmin()` stays the single choke point. Pages hide (never disable) affordances a visitor can't use, via `readOnly` + `readOnlyReason`. See `docs/reference/auth.md`.
- The demo fallback has exactly two triggers and must keep working for both: no connection string, or tables that don't exist yet (Postgres `42P01`) → `lib/mock-data.ts`. Every other database failure must surface an error page — a reachable-but-empty database renders genuinely empty, and an outage must never render fake clan data as real.
- **The app reads exactly four env vars:** the connection URI (`DATABASE_URL`, else the integration's `POSTGRES_URL` — first non-blank wins, so **Vercel needs no manual `DATABASE_URL`**), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ADMIN_EMAIL`. `POSTGRES_URL_NON_POOLING` (direct 5432) and `POSTGRES_PRISMA_URL` are never read; `SUPABASE_SECRET_KEY` exists in the Vercel environment and **must never be read from application code or given a `NEXT_PUBLIC_` prefix** — it bypasses RLS and every grant Phase 3a revoked. Adding a fifth variable is a decision, not a detail. See `docs/reference/deployment.md`.

## Deeper rules
See `.claude/rules/` — path-scoped, they load only when relevant.

---

## Operating directive (standing)

This project runs an agent team. As the main session, you are the orchestrator (no orchestrator subagent exists — subagents can't spawn subagents).

**On every substantive prompt:** follow `.claude/recipes/operating-recipe.md` — analyze the prompt, select suitable agents from `.claude/agents/` by their descriptions, have `task-planner` plan first with disjoint file ownership, present the plan for approval in **plan mode** (the one gate), then dispatch parallel implementers → `integrator` → `flow-reviewer` (with doc-sync) → report and append to `docs/build-log.md`.

For implementation slices, prefer the matching specialist over the generic `flow-implementer`: `data-pipeline-specialist` (ingest pipeline), `ui-design-specialist` (components/pages), `db-migration-specialist` (schema changes).

- Quick questions / one-off edits: answer directly or the user uses `/direct`.
- Keep the human at the plan gate; never skip it.
- Never invent APIs, contracts, or facts — flag unknowns.

## Maintenance cadence
Run `maintainer` every 5 completed orders, or after any architecture change.
