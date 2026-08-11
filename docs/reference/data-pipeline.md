# Data pipeline (living doc)

<!-- Kept current as code changes — updated, not appended. Owner: data-pipeline-specialist. -->

All three ingest paths funnel through one pipeline; nothing else writes clash data.

## The pipeline

```
source (Sheet CSV / JSON / CSV file)
  → lib/parse.ts      parseCsv, parseDamage        (tolerant input parsing)
  → lib/import.ts     normalizeWeekJson,           (pure, validating, client-safe —
                      normalizeCsvRecords           no Node/DB imports)
  → lib/persist.ts    persist(payload, mode)       (the only DB write; mode = "upsert" | "replace")
```

## Entry points

| Path | Surface | Mode | Notes |
|------|---------|------|-------|
| Google Sheet sync | Settings → Import → Sheet Sync, `app/api/sheet-sync`, `npm run sync:sheet` | **replace** (mirror) | Published-CSV URL, no Google creds (`lib/sheets.ts`). Each `(week, clash)` in the sheet replaces the app's data for that pair — deletions propagate. The sheet is the source of truth. |
| JSON import | Settings → Import → JSON, `app/api/import`, `npm run import:json` | **replace** of chosen `(week, clash)` | Flat array, same shape as the in-game export. Week defaults to the current clash week. Legacy nested `{ week, clashes }` shape is still accepted as **upsert** (back-compat). |
| CSV file | `npm run import -- <file>` | upsert | Same columns as the Sheet: `week_number, start_date, end_date, player, clash_type, keys_used, total_damage[, progress]`. |
| Member week edit | Member page history dialog, `POST app/api/members/[memberId]/results` | upsert | Single member, single week; always writes both clash rows (0/0 = benched) via `lib/results.ts` → `persist(payload, "upsert")` — same pipeline, no direct SQL. Validation is **stricter** than the import paths': member and week must already exist (week dates and the member's display name come from the stored records, never the client — a slug-equivalent `memberName` variant cannot rename the member), `slug(memberName)` must equal the member id, keys must be whole numbers within `MAX_KEYS` (hydra 3 / chimera 2), and unrecognized damage strings are rejected instead of coerced to 0 (`null`/empty still → 0, benched). Demo mode (no writable tables) → 400. |

Backup/restore (`app/api/backup`, `app/api/restore`) exports/replaces the whole dataset; reset (`app/api/reset`) wipes to a genuinely empty state (distinct from never-initialized, which shows demo data).

## Invariants

- `damage_dealt`: number, `"16.61B"`-style shorthand, or `null` (benched → 0). Parsing lives in `parse.ts` only.
- Clash dates are derived from the real UTC schedules (`lib/week.ts`), never user-entered: Hydra Wed 14:00 → Wed 08:00; Chimera Fri 11:30 → Thu 11:30; week *N*'s two clashes share a calendar week.
- Normalizers in `lib/import.ts` stay pure and client-safe — the import page previews with them in the browser.
- CLI scripts import `scripts/lib/load-env.ts` before touching the DB.
- The write API routes are unauthenticated — local use only; gate them before any public deploy.

## Read side (for contrast)

`lib/data.ts` `loadDataset()` reads members / weeks / clash_results / clash_meta and falls back to `lib/mock-data.ts` when empty; `lib/compute.ts` derives all metrics and is data-source agnostic. Pipeline changes must not leak into `compute.ts`.
