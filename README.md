# Raid Clash Tracker

A local web dashboard for tracking our RAID: Shadow Legends clan's **Hydra Clash**
and **Chimera Clash** performance — per-member keys used, damage dealt, averages,
participation, and week-over-week trends. Runs on your machine, only when you start it.

- **Framework:** Next.js (App Router, TypeScript) + Tailwind CSS + Recharts
- **Database:** local **SQLite** file (`data/clash.db`) via libSQL — no accounts, no hosting
- **Data in:** local scripts (RaidToolkit account dump **or** CSV)
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

### Option A — CSV (reliable, works today)
After a clash ends, copy each member's keys + damage from the in-game clash screen
into a CSV and run:

```bash
npm run import -- data/import.csv
```

Columns (header required): `week_number, start_date, end_date, player, clash_type,
keys_used, total_damage[, progress]`. `total_damage` accepts raw numbers or
`16.61B` / `250M` shorthand. `clash_type` is `hydra` or `chimera`. See
[`data/sample-import.csv`](data/sample-import.csv). Re-running is idempotent
(upserts on week + member + clash).

### Option B — RaidToolkit (automation, unverified)
[RaidToolkit](https://raidtoolkit.com/pages/installation/) runs locally and exposes
a WebSocket API at `wss://localhost:9090`. The pipeline:

```bash
npm install @raid-toolkit/webclient   # one-time
npm run extract                       # saves data/raw/dump-*.json + prints its keys
npm run sync -- --week 25 --start 2026-06-10 --end 2026-06-16
```

> ⚠️ It is **not yet confirmed** that the account dump contains per-member Hydra/
> Chimera clash damage history. `npm run extract` saves the raw dump so you can
> inspect it; if the clash data is there, finish the field mapping in
> [`scripts/rtk/normalize.ts`](scripts/rtk/normalize.ts). If it isn't, use the CSV
> path above — the dashboard works the same either way.

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
app/            routes (dashboard, hydra, chimera, timeline, members, settings)
components/     UI (Sidebar, ClashCard, PerformanceTable, TimelineStrip, DonutSummary, ...)
lib/            types, formatting, compute (derived metrics), db client, data loader, mock seed
db/             schema.sql (SQLite)
scripts/        db-init, seed, CSV import, RaidToolkit extract/normalize/sync
```
