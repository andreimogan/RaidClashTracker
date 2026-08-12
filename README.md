# Raid Clash Tracker

A local web dashboard for tracking our RAID: Shadow Legends clan's **Hydra Clash**
and **Chimera Clash** performance — per-member keys used, damage dealt, averages,
participation, and week-over-week trends. The app runs on your machine, only when you
start it; the data lives in your own Supabase project.

- **Framework:** Next.js (App Router, TypeScript) + Tailwind CSS + Recharts
- **Database:** **Supabase Postgres**, reached over the pooled connection URI in `DATABASE_URL`
- **Data in:** JSON upload/paste via **Clan Settings → Import data**, a CSV file from the CLI, or per-member week edits on a member's page
- **Run:** `npm run dev` whenever you want to see the stats

The app runs with **bundled demo data out of the box** — with no `DATABASE_URL` set you can
click through the whole dashboard. Point it at your Supabase database to track your real clan data.

## Quick start (demo mode)

```bash
npm install
npm run dev
# open http://localhost:3000
```

With no `DATABASE_URL` set, the dashboard shows the bundled sample dataset (Weeks 20–24).
Clan Settings shows whether you're reading the demo data or your own database.

## Use your real data (Supabase Postgres)

```bash
cp .env.example .env.local          # then set DATABASE_URL to your Supabase pooled URI
npm run db:migrate                  # apply supabase/migrations/*.sql in order
npm run seed                        # optional sample data — skip it if you're importing
                                    # real weeks; the samples occupy Weeks 20–24
# ...or import your own data:
npm run import -- data/sample-import.csv
npm run dev                         # app now reads from Supabase
```

`DATABASE_URL` is the only required setting — the **pooled** (`:6543`) `postgresql://` URI
from your Supabase project's connection settings. `npm run db:migrate` is safe to re-run.
`.env.local` is gitignored — keep it that way, it holds your database password.

## Which data you're looking at

The dashboard is honest about where its numbers come from. It has three states, and a
broken database is not one of them:

| State | What you see |
|-------|--------------|
| **Live data** — `DATABASE_URL` set, migrations applied, rows imported | your real clan numbers |
| **Connected but empty** — database reachable, tables there, no rows yet (e.g. straight after a reset) | a genuinely **empty** dashboard: zeros and empty tables, not sample data |
| **No `DATABASE_URL`** — or the tables don't exist yet because `npm run db:migrate` hasn't run | the bundled demo dataset (Weeks 20–24) |

Anything else — wrong password, wrong host, a paused Supabase project, no network — shows an
**error page**. The dashboard will never quietly show demo numbers dressed up as your clan's.

## Pages

| Route | What it shows |
|-------|---------------|
| `/` | Overview: both clash summary cards, clan performance table, timeline, key-usage donut |
| `/hydra`, `/chimera` | Per-clash overview, weekly damage chart, player breakdown |
| `/timeline` | Weekly totals across all tracked weeks |
| `/members` | Roster with aggregate stats |
| `/settings` | Clan info + data-source status |

A week selector (top-right) drives the data; **Export** downloads the current view as CSV.

**Metrics:** each clash card's **Progress** bar is clan **key usage** — keys used vs the
maximum possible (`roster × max keys`; **Hydra 3, Chimera 2** keys per member), so 100%
means everyone used all their keys. In the performance table, **Participation** is a
member's keys used ÷ that clash's max keys (e.g. 1 of 3 Hydra keys = 33%).

## Getting weekly data in

Three ways to load a week's numbers — all funnel through the same normalize +
persist pipeline. The in-app JSON path lives under **Clan Settings → Import data**.

### JSON import (upload/paste) — the everyday path
Open **Clan Settings → Import data → JSON Import**. Paste/upload a single clash's standings as a **flat
array**, choose the **week** (defaults to the current clash week) and the **clash**
(Hydra/Chimera), preview, then **Import**. Each import
**replaces** that (week, clash), so it's the week's complete standings. See
[`data/sample-week-flat.json`](data/sample-week-flat.json) — the same shape as the
in-game export.

Dates aren't entered by hand — they're derived from each clash's real schedule
(UTC) and shown read-only:

- **Hydra** runs **Wed → the following Wed** (starts Wed 14:00, ends Wed 08:00 UTC).
- **Chimera** runs **Fri → the following Thu** (starts Fri 11:30, ends Thu 11:30 UTC).

Both clashes in week _N_ belong to the same calendar week (Chimera's Friday is two
days after Hydra's Wednesday). The dashboard's clash cards/detail show each clash's
own date range.

```json
[
  { "rank": 1, "player_name": "[ΚΛΕΩ] Hell", "damage_dealt": "16.61B", "keys_used": 3 },
  { "rank": 5, "player_name": "Smash69",     "damage_dealt": null,     "keys_used": 0 }
]
```

`damage_dealt` accepts a number or `16.61B` shorthand, or `null` (benched → 0).
Terminal equivalent (week defaults to current):

```bash
npm run import:json -- Database/test-week.json --clash hydra [--week 26]
```

> The older nested `{ week, clashes }` JSON is still accepted (upsert) by the same
> command/endpoint for back-compat.

### CSV file (terminal)
Run `npm run import -- data/import.csv` (see
[`data/sample-import.csv`](data/sample-import.csv)). One row per member per clash,
with a header row using these column names:

`week_number, start_date, end_date, player, clash_type, keys_used, total_damage[, progress]`

`week_number`, `player`, `clash_type` (`hydra`/`chimera`), `keys_used` and
`total_damage` are required on every row; `start_date`/`end_date` (`YYYY-MM-DD`) must
appear at least once per week; `progress` is optional. `total_damage` takes the same
`16.61B` shorthand as the JSON path. A CSV import **upserts** — it adds and updates
rows without clearing the rest of the week.

### Editing one member's week (in the app)
On a member's page, the week history table lets you correct a single member's keys and
damage for a week that already exists — an upsert of just those two clash rows, for
fixing a typo without re-importing the whole week.

## Backup, restore & reset

In **Clan Settings → Overview → Data Management**:

- **Export backup** downloads all current data as `clash-backup-<date>.json`.
- **Restore from backup** uploads that file and **replaces** all current data.
- **Reset database** (danger zone, type `RESET` to confirm) wipes everything to an
  empty state. The dashboard then renders **genuinely empty** — that's the
  connected-but-empty state above, not the demo data.

## Sharing it later (optional)

The database already lives in Supabase, so putting the dashboard online is a hosting
step rather than a rewrite:

1. Deploy on [Vercel](https://vercel.com/new) with `DATABASE_URL` set to the same pooled
   Supabase URI — as an environment variable, never committed.
2. Gate the write endpoints first. Everything under `app/api/` (import, restore, reset,
   member edits) is **unauthenticated**, which is fine on your own machine and not fine
   on the internet.

The database connection itself needs nothing but that environment variable; the auth
gate is real work.

## Project layout

```
app/            routes (dashboard, hydra, chimera, timeline, members, settings[+import tab])
app/api/        write endpoints: import (JSON), backup, restore, reset, member results/avatar
components/     UI (Sidebar, ClashCard, PerformanceTable, TimelineStrip, DonutSummary, ...)
lib/            types, formatting, compute, db client, data loader, parse/import/persist, mock seed
supabase/       migrations/ — numbered, forward-only SQL applied by npm run db:migrate
scripts/        db-migrate, seed, import (csv/json)
```
