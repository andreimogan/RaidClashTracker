# Raid Clash Tracker

A web dashboard for tracking our RAID: Shadow Legends clan's **Hydra Clash** and
**Chimera Clash** performance — per-member keys used, damage dealt, averages,
participation, and week-over-week trends.

- **Framework:** Next.js (App Router, TypeScript) + Tailwind CSS + Recharts
- **Database:** Supabase (Postgres), read with the public anon key (RLS: read-only)
- **Data in:** local scripts (RaidToolkit account dump **or** CSV) → Supabase
- **Hosting:** Vercel (public read-only link to share with clanmates)

The app runs with **bundled demo data out of the box** — no Supabase needed to see
it. Configure Supabase to use live clan data.

## Quick start (demo mode)

```bash
npm install
npm run dev
# open http://localhost:3000
```

With no Supabase env vars set, the dashboard shows the bundled sample dataset
(Weeks 20–24). The Clan Settings page shows whether you're in demo or live mode.

## Pages

| Route | What it shows |
|-------|---------------|
| `/` | Overview: both clash summary cards, clan performance table, timeline, key-usage donut |
| `/hydra`, `/chimera` | Per-clash overview, weekly damage chart, player breakdown |
| `/timeline` | Weekly totals across all tracked weeks |
| `/members` | Roster with aggregate stats |
| `/settings` | Clan info + data-source status |

A week selector (top-right) drives the data; **Export** downloads the current view as CSV.

## Connect Supabase (live data)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   (creates tables, the read-only RLS policies, and a convenience view).
3. Copy `.env.example` → `.env.local` and fill in the values from
   **Supabase → Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (app, public)
   - `SUPABASE_SERVICE_ROLE_KEY` (local scripts only — never commit/expose)
4. Load data (pick one):
   - `npm run seed` — push the bundled sample dataset, or
   - `npm run import -- data/sample-import.csv` — import a CSV (see format below).
5. `npm run dev` — the app now reads from Supabase.

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
[`data/sample-import.csv`](data/sample-import.csv).

### Option B — RaidToolkit (automation, phase 5 — unverified)
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

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy and share the public URL with your clan. (Do **not** add the service-role
   key to Vercel — it's only for local data scripts.)

## Project layout

```
app/            routes (dashboard, hydra, chimera, timeline, members, settings)
components/     UI (Sidebar, ClashCard, PerformanceTable, TimelineStrip, DonutSummary, ...)
lib/            types, formatting, compute (derived metrics), data loader, mock seed
supabase/       SQL migration
scripts/        seed, CSV import, RaidToolkit extract/normalize/sync
```
