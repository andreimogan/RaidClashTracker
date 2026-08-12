# Data pipeline (living doc)

<!-- Kept current as code changes — updated, not appended. Owner: data-pipeline-specialist. -->

All three ingest paths funnel through one pipeline; nothing else writes clash data.

## The pipeline

```
source (JSON / CSV file / member week edit)
  → lib/parse.ts      parseCsv, parseDamage        (tolerant input parsing)
  → lib/import.ts     normalizeFlatResults,        (pure, validating, client-safe —
                      normalizeWeekJson,
                      normalizeCsvRecords           no Node/DB imports)
  → lib/persist.ts    persist(payload, mode)       (the only DB write; mode = "upsert" | "replace")
```

## Entry points

| Path | Surface | Mode | Notes |
|------|---------|------|-------|
| JSON import | Settings → Import → JSON, `app/api/import`, `npm run import:json` | **replace** of chosen `(week, clash)` | Flat array, same shape as the in-game export. Week defaults to the current clash week. Legacy nested `{ week, clashes }` shape is still accepted as **upsert** (back-compat). |
| CSV file | `npm run import -- <file>` | upsert | Header row, one row per member per clash: `week_number, start_date, end_date, player, clash_type, keys_used, total_damage[, progress]`. `week_number`, `player`, `clash_type`, `keys_used`, `total_damage` required per row (headers are lowercased, so case doesn't matter); `start_date`/`end_date` required at least once per week or the import fails; `progress` optional, per `(week, clash)`. Parsed by `parseCsv` → `normalizeCsvRecords`. |
| Member week edit | Member page history dialog, `POST app/api/members/[memberId]/results` | upsert | Single member, single week; always writes both clash rows (0/0 = benched) via `lib/results.ts` → `persist(payload, "upsert")` — same pipeline, no direct SQL. Validation is **stricter** than the import paths': member and week must already exist (week dates and the member's display name come from the stored records, never the client — a slug-equivalent `memberName` variant cannot rename the member), `slug(memberName)` must equal the member id, keys must be whole numbers within `MAX_KEYS` (hydra 3 / chimera 2), and unrecognized damage strings are rejected instead of coerced to 0 (`null`/empty still → 0, benched). Demo mode (nothing writable) → 400, telling the user to run `npm run db:migrate`. |

Backup/restore (`app/api/backup`, `app/api/restore`) exports/replaces the whole dataset; reset (`app/api/reset`) wipes to a genuinely empty state — each runs in one transaction. A reset leaves the app **rendering empty**, which is a different state from demo mode: the demo fallback fires only when there is no `DATABASE_URL` or the tables don't exist yet (see Invariants).

### Backup file format

`exportBackup()` writes one JSON object with `members`, `weeks`, `clash_results` and `clash_meta` arrays. The Postgres port changed two field shapes and deliberately preserved a third:

- `created_at` now serialises as **ISO-8601** (`"2026-08-12T10:00:00.000Z"`) rather than `"2026-08-12 10:00:00"` — the column is `timestamptz`, which reads back as a JS `Date`.
- `is_active` is now a real `true`/`false` instead of `1`/`0`.
- `total_damage` is **still a JSON number.** The `bigint` column reads back as a JS *string*, so `exportBackup()` coerces it back — a faithful passthrough would have silently started writing `"58280000000"` into every backup and broken arithmetic for any consumer.

`restoreBackup()` accepts **both vintages**. `is_active` takes a real boolean, any number (`0` → false, anything else → true), or one of the strings `"1"`/`"true"`/`"t"`/`"yes"` → true and `"0"`/`"false"`/`"f"`/`"no"` → false (trimmed, case-insensitive). **`null`, `""` and any unrecognised value default to `true`**, not false — `lib/backup.ts`'s `bool(v, d = true)`, matching the column's `not null default true`, so a backup that omits the field restores an active roster rather than a silently benched one. `created_at` goes through `coalesce($n::timestamptz, now())`, so a missing value becomes the restore time.

**A timestamp with no zone marker is interpreted as UTC.** This is load-bearing, not a detail: postgres.js serialises a `timestamptz` parameter by routing the value through `new Date(value)`, and V8 reads a naive string as the *machine's local* time — so on a UTC+3 machine a restored `"2026-08-12 10:00:00"` landed as `07:00Z`. `lib/backup.ts`'s `ts()` normalises a zone-less value to UTC before binding (the previous writer emitted UTC), passes ISO values through untouched, and maps an unparseable value to `null` so the `coalesce` supplies `now()` instead of throwing `22007`. **Phase 4's import of the owner's archived data depends on this rule.**

`ts()`'s "already has a zone" test accepts `Z`, a full `+HH:MM` / `+HHMM` offset, **and the bare-hours `+HH` form that Postgres' own `timestamptz` text output uses** (`2026-08-12 10:00:00+00`). The bare-hours case matters: while that guard required minutes, a `+00` value failed it, got a `Z` appended, parsed as `NaN`, and fell through to `now()` — a wrong timestamp with no error, for a value produced by any Postgres tool. Checked across naive, ISO-with-`Z`, `+00`, `+00:00`, `+0530`, `null`, `""` and unparseable input; only the `+HH` shape changed behaviour.

## Invariants

- `damage_dealt`: number, `"16.61B"`-style shorthand, or `null` (benched → 0). Parsing lives in `parse.ts` only.
- Clash dates are derived from the real UTC schedules (`lib/week.ts`), never user-entered: Hydra Wed 14:00 → Wed 08:00; Chimera Fri 11:30 → Thu 11:30; week *N*'s two clashes share a calendar week.
- Normalizers in `lib/import.ts` stay pure and client-safe — the import page previews with them in the browser.
- `persist()` writes every statement — member and week upserts, replace-mode deletes, result and meta upserts — inside **one transaction**. A half-applied import is not a state the app can reach.
- **`persist()`'s `lastWins()` dedupe is what keeps a duplicated row an ordinary import instead of a 400.** A payload may legitimately list the same `(week, member, clash)` twice — a hand-edited CSV or an in-game JSON export does, and the normalizers in `lib/import.ts` deliberately do not dedupe. The pre-Postgres write applied both statements and let the last one win. A single bulk `insert … on conflict do update` cannot: Postgres refuses to let one statement touch the same row twice and raises `21000`, which surfaces as a hard 400 from `/api/import`. So `lib/persist.ts`'s `lastWins()` — applied to weeks (by id), results (by the id derived from the `(week, member, clash)` unique tuple), clash_meta (by `week_id|clash_type`) and the replace-mode pair list; members dedupe through a `Set` — is not tidying, it is the compatibility shim that preserves last-wins. Remove it in a refactor and a CSV that imports cleanly today starts failing.
- **A multi-query read runs inside one `sql.begin()`, or it can hang.** More concurrent queries than the pool's `max` deadlock against Supabase's transaction pooler, so `loadDataset()` and `exportBackup()` each take a single connection and pipeline on it (`begin("read only", …)`) rather than `Promise.all`-ing four queries off `getDb()`. `max` is a correctness bound, not politeness — full measurement in `.claude/rules/database.md`.
- CLI scripts import `scripts/lib/load-env.ts` before touching the DB, and close the pool (`closeDb()`) or exit explicitly — otherwise the process hangs on the open connection pool.
- The write API routes are unauthenticated — local use only; gate them before any public deploy.
- **Three honest data states.** Live data · connected-but-empty (renders genuinely empty) · no `DATABASE_URL` (renders the bundled demo). The demo fallback fires **only** when `databaseUrl()` is null or a caught error's code is `42P01` (undefined table — migrations not applied yet). Every other failure — wrong password (`28P01`), DNS, pooler exhaustion, a paused project — rethrows and reaches `app/error.tsx`. A connection outage must never render fake clan data as real.

## Read side (for contrast)

`lib/data.ts` `loadDataset()` reads members / weeks / clash_results / clash_meta from Postgres and falls back to `lib/mock-data.ts` under the two conditions above (never merely because the tables are empty). Its four row mappers are the single coercion boundary — Postgres `bigint` reads back as a JS string and `timestamptz` as a `Date`, so every numeric field is wrapped in `Number(...)` there. `lib/compute.ts` derives all metrics and is data-source agnostic. Pipeline changes must not leak into `compute.ts`.
