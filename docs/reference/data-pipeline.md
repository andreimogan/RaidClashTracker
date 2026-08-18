# Data pipeline (living doc)

<!-- Kept current as code changes — updated, not appended. Owner: data-pipeline-specialist. -->

All three ingest paths end at one writer; nothing else writes clash data.

## The pipeline

**Two payload builders reach one writer — not a single three-stage funnel.** The
three-stage shorthand is wrong, and it has already propagated into other docs
once: the member week edit runs **no normalizer** (`lib/results.ts:7` imports
only *types* from `./import`, validates its own four fields, assembles the
`ImportPayload` by hand at `lib/results.ts:120-132` and calls `persist` at
`:133`). What all three paths genuinely share is `lib/parse.ts` and `persist()`,
and those are the two that must stay shared.

```
BUILDER A — the import paths (JSON, CSV file)
  lib/parse.ts     parseCsv, parseDamage        tolerant input parsing
  lib/import.ts    normalizeFlatResults,        pure, validating, client-safe: no Node
                   normalizeWeekJson,           or DB imports, because the import page
                   normalizeCsvRecords          previews with them in the browser
                                                        │
BUILDER B — the member week edit                        │
  lib/parse.ts     parseDamage only             ────────┤
  lib/results.ts   its own validation, its own           │
                   hand-built ImportPayload,             │
                   NO normalizer                         │
                                                         ▼
THE WRITER — the only DB write, and there is exactly one
  lib/persist.ts   persist(payload, "upsert" | "replace")
```

A new ingest path picks one of the two builders. It does not add a third way to
write.

## Entry points

| Path | Surface | Mode | Notes |
|------|---------|------|-------|
| JSON import | Settings → Import → JSON, `app/api/import`, `npm run import:json` | **replace** of chosen `(week, clash)` | Flat array, same shape as the in-game export. Week defaults to the current clash week. Legacy nested `{ week, clashes }` shape is still accepted as **upsert** (back-compat). |
| CSV file | `npm run import -- <file>` | upsert | Header row, one row per member per clash: `week_number, start_date, end_date, player, clash_type, keys_used, total_damage[, progress]`. `week_number`, `player`, `clash_type`, `keys_used`, `total_damage` required per row (headers are lowercased, so case doesn't matter); `start_date`/`end_date` required at least once per week or the import fails; `progress` optional, per `(week, clash)`. Parsed by `parseCsv` → `normalizeCsvRecords`. |
| Member week edit | Member page history dialog, `POST app/api/members/[memberId]/results` | upsert | Single member, single week; always writes both clash rows (0/0 = benched) via `lib/results.ts` → `persist(payload, "upsert")` — same pipeline, no direct SQL. Validation is **stricter** than the import paths': member and week must already exist (week dates and the member's display name come from the stored records, never the client — a slug-equivalent `memberName` variant cannot rename the member), `slug(memberName)` must equal the member id, keys must be whole numbers within `MAX_KEYS` (hydra 3 / chimera 2), and unrecognized damage strings are rejected instead of coerced to 0 (`null`/empty still → 0, benched). Demo mode (nothing writable) → **400 before any other validation** (`lib/results.ts:61-72` → `app/api/members/[memberId]/results/route.ts:38-39`). Phase 4 rewrote that copy to cover deployments too, because the only reader is an admin who may be on the deployed site: it names **both** steps in order **and** both environments — locally, set `DATABASE_URL` in `.env.local` then run `npm run db:migrate`; on the deployed site the connection string comes from the Supabase integration as `POSTGRES_URL`, where `.env.local` does not exist and `db:migrate` cannot be run at all. Do not shorten it back to "run `npm run db:migrate`". |

Backup/restore (`app/api/backup`, `app/api/restore`) exports/replaces the whole dataset; reset (`app/api/reset`) wipes to a genuinely empty state — each runs in one transaction. A reset leaves the app **rendering empty**, which is a different state from demo mode: the demo fallback fires only when no connection string resolves (neither `DATABASE_URL` nor the integration's `POSTGRES_URL`) or the tables don't exist yet (see Invariants).

### Member metadata — the one sanctioned direct-SQL path, and it now has two writers

**This section did not exist before 2026-08-18: `setMemberAvatar` had never been written up
here, so the second writer arrived with nothing to sit beside.** Recorded now so the pair
reads as a bounded exception rather than as two independent violations of the rule above.

`lib/members.ts` writes **member metadata** and never touches `persist()`:

| Function | Column | Route |
|---|---|---|
| `setMemberAvatar(id, avatarUrl \| null)` (`lib/members.ts:5`) | `members.avatar_url` | `POST /api/members/[memberId]/avatar` |
| `setMemberBenched(id, benched)` (`lib/members.ts:17`) | `members.is_benched` (migration `0003_add_members_is_benched.sql`) | `POST /api/members/[memberId]/bench` |

Both are one `getDb()` plus one tagged-template `update … where id = ${id}` — no
transaction, no return value, no payload. **That is in-rule, and the test is ingest vs.
metadata, not "SQL vs. no SQL".** `.claude/rules/data-pipeline.md` forbids bypassing
`persist()` for **ingest** — weeks, clash results, clash meta, anything that creates a
member. These two write one column on one row that already exists; routing them through the
pipeline would mean inventing an ingest payload shape for a string and a boolean. The
reasoning lives in-code at `lib/members.ts:10-16` as well, so it survives a reader who never
opens this file. A third such writer is fine under the same test; a write carrying a week or
a clash result is ingest and picks one of the two builders.

Three consequences worth knowing, all shared by the pair:

- **An unknown id updates zero rows and resolves** — postgres.js raises nothing for a
  zero-row `UPDATE`. Nothing here creates a member.
- **A re-import cannot undo either value.** `persist()`'s member `on conflict do update set`
  touches only `in_game_name` (`lib/persist.ts:104-107`), so `avatar_url`, `is_active` and
  `is_benched` all survive every import. This is load-bearing for bench: adding the column
  there would make every import silently un-excuse the whole roster.
- **`npm run seed` therefore sets neither**, because seeding goes through `persist()`. A
  seeded database has nobody excused and no avatars; demo mode ships one excused member
  (`lib/mock-data.ts:64`). Same benign asymmetry avatars already had.

**Terminology.** In `members.is_benched` / `Member.isBenched` and the Bench/Unbench control,
"bench" means *an admin has excused this member from the Black List*. The older,
unrelated sense — a member present in a week with 0 keys, `damage_dealt: null` → 0 — still
appears in `lib/parse.ts` and `lib/results.ts` and in the ingest rows of this document;
`docs/user-guide.md` calls that one a **zero-key week** to keep the two apart. The
`lib/compute.ts` and `lib/types.ts` comments were reworded the same way; `lib/parse.ts:5`
and `lib/results.ts:20,23,53` were not, and are a filed follow-up.

### Backup file format

`exportBackup()` writes one JSON object: an envelope of `app: "raid-clash-tracker"`, `version: 1` and `exportedAt` (ISO), plus the `members`, `weeks`, `clash_results` and `clash_meta` arrays (`lib/backup.ts:12-19`). **`restoreBackup()` validates only the three arrays** it needs — `members`, `weeks`, `clash_results` — so the envelope fields are documentation for a human reading the file, not a format check. The Postgres port changed two field shapes and deliberately preserved a third:

- `created_at` now serialises as **ISO-8601** (`"2026-08-12T10:00:00.000Z"`) rather than `"2026-08-12 10:00:00"` — the column is `timestamptz`, which reads back as a JS `Date`.
- `is_active` is now a real `true`/`false` instead of `1`/`0`.
- `total_damage` is **still a JSON number.** The `bigint` column reads back as a JS *string*, so `exportBackup()` coerces it back — a faithful passthrough would have silently started writing `"58280000000"` into every backup and broken arithmetic for any consumer.

**`is_benched` joined the member rows on 2026-08-18** and round-trips like `is_active`: the export inherits it through `select *` (`lib/backup.ts:36`), and the restore normalizes it (`:108`) and names it in **both** the insert's column list and its values (`:142`, `:144`). **Its default is the opposite of `is_active`'s, deliberately** — `bool(m.is_benched, false)`, because a backup taken before that date has no such key and "nobody excused" is that file's truth, so an old backup restores without silently excusing the roster from the Black List.

**That "restores cleanly" claim is conditional on the receiving database, and right now the condition is unmet.** Because the column now appears in the restore INSERT's column list, **restore requires migration `0003`** — of *any* backup, old or new. Against a database without it, the insert raises `42703` on the first member row; the whole restore runs inside one `getDb().begin()`, so it rolls back and loses nothing, and `app/api/restore/route.ts:86-88` maps the code to *"This database is missing a column the backup needs. Run `npm run db:migrate` first."* rather than printing a bare code. **`0003_add_members_is_benched.sql` was measured unapplied on the live database on 2026-08-18** (a read-only `information_schema.columns` query returned `id, in_game_name, level, hero_level, avatar_url, is_active, created_at` — no `is_benched`), so this is the state that ships today, not a hypothetical. The read path is unaffected: `loadDataset()`'s `select *` simply returns rows with no such key and `toMember()`'s `=== true` (`lib/data.ts:111`) turns that into `false`, which is why every page renders correctly with nothing excused. Restore and the Bench are the two operations that actually need the column. (`.claude/rules/supabase-schema.md` still records only 0001 and 0002 as applied; it is not owned by the doc-sync pass that measured this.)

`restoreBackup()` accepts **both vintages**. `is_active` takes a real boolean, any number (`0` → false, anything else → true), or one of the strings `"1"`/`"true"`/`"t"`/`"yes"` → true and `"0"`/`"false"`/`"f"`/`"no"` → false (trimmed, case-insensitive). **`null`, `""` and any unrecognised value default to `true`**, not false — `lib/backup.ts`'s `bool(v, d = true)`, matching the column's `not null default true`, so a backup that omits the field restores an active roster rather than a silently inactive one. `is_benched` runs the same coercion with the flipped default. `created_at` goes through `coalesce($n::timestamptz, now())`, so a missing value becomes the restore time.

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
- Every write API route is admin-only — `requireAdmin()` is the first statement of each handler body, returning a frozen `401 {"ok":false,"error":"Sign in as the clan admin to do that."}` to anyone else with **no database query issued** on that path. `/api/backup` is gated too, as an **exfil** route rather than a read: it exports the whole dataset. Driver-shaped errors are sanitized to a bare PG code while validation copy passes through verbatim. See `docs/reference/auth.md`.
- **Three honest data states.** Live data · connected-but-empty (renders genuinely empty) · no connection string (renders the bundled demo). The demo fallback fires **only** when `databaseUrl()` is null or a caught error's code is `42P01` (undefined table — migrations not applied yet). Every other failure — wrong password (`28P01`), DNS, pooler exhaustion, a paused project — rethrows and reaches `app/error.tsx`. A connection outage must never render fake clan data as real.

## Read side (for contrast)

`lib/data.ts` `loadDataset()` reads members / weeks / clash_results / clash_meta from Postgres and falls back to `lib/mock-data.ts` under the two conditions above (never merely because the tables are empty). Its four row mappers are the single coercion boundary — Postgres `bigint` reads back as a JS string and `timestamptz` as a `Date`, so every numeric field is wrapped in `Number(...)` there. `lib/compute.ts` derives all metrics and is data-source agnostic. Pipeline changes must not leak into `compute.ts`.
