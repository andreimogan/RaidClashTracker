@AGENTS.md

# Raid Clash Tracker

Local-first Next.js dashboard tracking a RAID: Shadow Legends clan's **Hydra Clash** and **Chimera Clash** performance — keys used, damage, participation, week-over-week trends. SQLite file via libSQL; no accounts, no hosting; deployable later to Turso/Vercel with env vars only.

## Commands
- dev: `npm run dev`
- build: `npm run build`
- lint: `npm run lint`
- test: **none** — no test suite; verify by building and exercising the affected page
- db setup: `npm run db:init` (schema) → `npm run seed` (optional sample data)
- data in: `npm run import -- <csv>` · `npm run import:json -- <file> --clash hydra|chimera [--week N]` · `npm run sync:sheet -- "<url>"`

## Layout
- `app/` — routes: `/` overview, `/hydra`, `/chimera`, `/timeline`, `/members[/[memberId]]`, `/settings`, `/import`; `app/api/` — write endpoints (import, sheet-sync, backup, restore, reset, database switch, member avatar)
- `components/` — UI (gestal.gg aesthetic; tokens/primitives live in `app/globals.css`)
- `lib/` — types · db client (`db.ts`) · read path (`data.ts` → `compute.ts`) · write pipeline (`parse.ts` → `import.ts` → `persist.ts`) · `sheets.ts` · formatting · `mock-data.ts` demo fallback
- `db/schema.sql` — the SQLite schema; `data/` — actual DBs (`clash.db` prod, `clash-test.db` test, `active-db.json` pointer)
- `scripts/` — CLI entries (db-init, seed, import csv/json, sync-sheet); each imports `scripts/lib/load-env.ts` first

## Conventions (always)
- Match existing patterns; read neighboring files before writing new ones.
- This Next.js version differs from training data — read the relevant guide in `node_modules/next/dist/docs/` before writing route/API code (see AGENTS.md).
- Style only with the tokens and primitives from `app/globals.css` (`card`, `inset`, `fill-hydra`, …) — never hardcode colors.
- All data writes funnel through one pipeline: parse → normalize (`lib/import.ts`, pure/client-safe) → `persist(payload, "upsert" | "replace")`. Never write SQL from routes or components.
- The zero-config demo fallback must keep working: empty/missing DB renders `lib/mock-data.ts`.

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
