# Raid Clash Tracker

A local web dashboard for tracking our RAID: Shadow Legends clan's **Hydra Clash**
and **Chimera Clash** performance — per-member keys used, damage dealt, averages,
participation, and week-over-week trends. Runs on your machine, only when you start it.

- **Framework:** Next.js (App Router, TypeScript) + Tailwind CSS + Recharts
- **Database:** local **SQLite** file (`data/clash.db`) via libSQL — no accounts, no hosting
- **Data in:** Google Sheet sync, JSON upload/paste, or CSV — via the in-app Import page or CLI
- **Run:** `npm run dev` whenever you want to see the stats

The app runs with **bundled demo data out of the box** — no database needed to see it.
Set up the local DB to track your real clan data.

## Quick start (demo mode)

```bash
npm install
npm run dev
# open http://localhost:3000
```

With no database yet, the dashboard shows the bundled sample dataset (Weeks 20–24).
The Clan Settings page shows whether you're in demo or live (local DB) mode.

## Use your real data (local database)

```bash
npm run db:init                     # create data/clash.db from db/schema.sql
npm run seed                        # optional: load the sample dataset into it
# ...or import your own data:
npm run import -- data/sample-import.csv
npm run dev                         # app now reads from data/clash.db
```

That's it — no env file required. The DB is a plain SQLite file you can open in any
SQLite browser. To override the location, copy `.env.example` → `.env.local` and set
`DATABASE_URL`.

## Pages

| Route | What it shows |
|-------|---------------|
| `/` | Overview: both clash summary cards, clan performance table, timeline, key-usage donut |
| `/hydra`, `/chimera` | Per-clash overview, weekly damage chart, player breakdown |
| `/timeline` | Weekly totals across all tracked weeks |
| `/members` | Roster with aggregate stats |
| `/settings` | Clan info + data-source status |

A week selector (top-right) drives the data; **Export** downloads the current view as CSV.

## Getting weekly data in

Three ways to load a week's numbers — all funnel through the same normalize +
persist pipeline. The in-app **Import** page (sidebar) hosts the first two.

### Option A — Google Sheet sync (source of truth)
Keep a Google Sheet as the canonical record and pull it in with a button.

1. Build a sheet (one tab) with these columns:
   `week_number, start_date, end_date, player, clash_type, keys_used, total_damage[, progress]`
2. Share it: **File → Share → Publish to web** (CSV), or set link sharing to
   "Anyone with the link can view".
3. In the app, open **Import → Google Sheet Sync**, paste the sheet URL, click **Sync**.
   (Or from the terminal: `npm run sync:sheet -- "<sheet-url>"`.)

Sync is a **mirror**: each `(week, clash)` present in the sheet *replaces* the app's
data for that pair, so edits and row deletions in the sheet propagate. The sheet is
the source of truth.

### Option B — JSON import (upload/paste)
Open **Import → JSON Import**. Paste/upload a single clash's standings as a **flat
array**, choose the **week** (defaults to the current clash week), the **clash**
(Hydra/Chimera) and optional **progress %**, preview, then **Import**. Each import
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
npm run import:json -- Database/test-week.json --clash hydra [--week 26 --progress 62.5]
```

> The older nested `{ week, clashes }` JSON is still accepted (upsert) by the same
> command/endpoint for back-compat.

### Option C — CSV file
Same columns as the Google Sheet (`week_number, …, clash_type, …`). Run
`npm run import -- data/import.csv` (see [`data/sample-import.csv`](data/sample-import.csv)).

## Sharing it later (optional)

Everything is local by default, but the storage layer is deployable without a
rewrite. To put it online for clanmates:

1. Create a free [Turso](https://turso.tech) database (hosted libSQL).
2. Apply the schema: `turso db shell <your-db> < db/schema.sql`, then load data
   (point `DATABASE_URL`/`DATABASE_AUTH_TOKEN` at Turso and run `npm run seed`/`import`).
3. Deploy the app on [Vercel](https://vercel.com/new) with `DATABASE_URL` and
   `DATABASE_AUTH_TOKEN` set as env vars.

No application code changes — only the connection string.

## Project layout

```
app/            routes (dashboard, hydra, chimera, timeline, members, import, settings)
app/api/        import (JSON) + sheet-sync (Google Sheet) write endpoints
components/     UI (Sidebar, ClashCard, PerformanceTable, TimelineStrip, DonutSummary, ...)
lib/            types, formatting, compute, db client, data loader, parse/import/persist, sheets, mock seed
db/             schema.sql (SQLite)
scripts/        db-init, seed, import (csv/json), sync:sheet
```
