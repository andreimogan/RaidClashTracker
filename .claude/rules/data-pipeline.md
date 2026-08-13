---
paths:
  - "lib/parse.ts"
  - "lib/import.ts"
  - "lib/persist.ts"
  - "lib/week.ts"
  - "app/api/**"
  - "scripts/**"
---

- Every ingest path (in-app JSON import, CSV file, member week edit) funnels through the one pipeline: `lib/parse.ts` (parseCsv/parseDamage) → an `ImportPayload` → `lib/persist.ts` `persist(payload, "upsert" | "replace")`. Never bypass it with direct SQL. **The middle stage has two payload builders, not one, and the three-stage shorthand hides it:** the two import paths call the `normalize*` functions in `lib/import.ts` (**pure and client-safe** — no Node/DB imports), while the **member week edit runs no normalizer at all** — `lib/results.ts:7` imports only *types* from `./import`, validates its own four fields, assembles the payload by hand (`lib/results.ts:120-132`) and calls `persist(payload, "upsert")` directly (`lib/results.ts:133`). `lib/parse.ts` and `persist()` are what all three genuinely share, and they are the two that must stay shared. A new ingest path picks one of the two builders; it does not add a third way to write.
- Semantics are load-bearing:
  - **In-app JSON import = replace** of the chosen `(week, clash)` — it's the week's complete standings. The delete is scoped to the `(week, clash)` pairs **present in the payload**, so importing Hydra never touches that week's Chimera.
  - **CSV file import (`npm run import`) = upsert** — it adds and updates rows without clearing the rest of the week (`scripts/import-csv.ts:14`).
  - **`npm run import:json` chooses its mode from the file's SHAPE, so the terminal is not uniformly the "safe" half:** a **flat array replaces** that `(week, clash)` exactly as the in-app path does (`scripts/import-json.ts:44`), and only the nested `{ week, clashes }` object upserts (`scripts/import-json.ts:50`). Anything that documents the CLI as "the upsert one" is wrong.
  - **Member week edit = upsert** of that member's two clash rows for one existing week; member and week must already exist, and its validation is stricter than the import paths' (see `docs/reference/data-pipeline.md`).
  - **Legacy nested `{ week, clashes }` JSON = upsert** (back-compat; keep it working).
- `damage_dealt` accepts a number, `"16.61B"`-style shorthand, or `null` (benched → 0).
- Clash dates are never user-entered — they derive from the real schedules in UTC (Hydra Wed→Wed, Chimera Fri→Thu; both belong to the same calendar week).
- CLI scripts must import `scripts/lib/load-env.ts` before anything that touches the DB.
- **Every route under `app/api/` is admin-only, and the guard is the first statement of the handler body** — before `await params`, before `request.json()`, before any `try`:

  ```ts
  const denied = await requireAdmin();
  if (denied) return denied;
  ```

  All six (`import`, `restore`, `reset`, `backup`, `members/[memberId]/results`, `members/[memberId]/avatar` — the segment is `[memberId]`, not `[id]`) return a frozen `401 {"ok":false,"error":"Sign in as the clan admin to do that."}` to anyone else, and issue **no database query** on that path. `backup` is gated as an **exfil** route, not a read — it exports the whole dataset. **A new route under `app/api/` is not finished until it carries that guard**; there is no matcher covering it, because a proxy cannot protect route handlers (`docs/reference/auth.md`).
- **No data mutation may move to a Server Action.** `requireAdmin()` is the single authorization choke point, and Server Functions are reachable by direct POST, so a second write surface would be a second thing to guard. The only `"use server"` file in the repo is `app/login/actions.ts` (sign-in/sign-out; auth cookies, no application data).
- **Split driver errors from validation errors by PROVENANCE, not by the error's shape.** Three patterns exist in the tree, and only the first two are safe:
  - **Provenance (best, and the one to copy):** wrap the calls that can reach Postgres so a database failure arrives as a distinct local type, and test that. Validation copy then survives **by construction** — see `app/api/import/route.ts` and `app/api/restore/route.ts` (`fromDatabase()` → `DatabaseFailure`).
  - **`instanceof ValidationError`:** fine where the class is exported — `lib/results.ts:13` exports it, so `app/api/members/[memberId]/results/route.ts` uses it. **Note `lib/import.ts:36` does *not* export its `ValidationError`**, which is why the import route cannot use this and had to reach for provenance.
  - **`typeof err.code === "string"` (fragile, still in `backup`/`avatar`/`reset`):** correct only while no validation error happens to carry a code. Giving one a machine-readable code would silently turn its message into "the database rejected it (code …)", destroying the only instruction the user gets, with nothing to catch it. **Do not add a `.code` to any validation error** while these three routes still discriminate this way.
  - **Known residual:** `/api/restore`'s own rejection copy ("Not a valid backup file …") arrives *with* database provenance, because `lib/backup.ts:96` validates and writes inside one call and throws a bare `Error`. It survives today only because that throw carries no `.code`. The fix is a typed, **exported** `ValidationError` in `lib/backup.ts` — queued with the `lib/http-errors.ts` consolidation, where one shared class belongs.
- **Sanitize driver-shaped errors; pass validation copy through untouched.** The split that keeps both true: an error with a **string `.code`** (every postgres.js error has one — server errors carry the PG code, connection errors carry `ECONNREFUSED` / `CONNECTION_CLOSED`) gets a fixed sentence naming only that code, **status unchanged**; everything else (`ValidationError` from `lib/import.ts` / `lib/results.ts`, `restoreBackup()`'s own copy, a `JSON.parse` failure) has its `err.message` passed through verbatim, because that copy is the user's only instruction. `42P01` still maps to "run `npm run db:migrate`". Follow `app/api/reset/route.ts`'s `resetError()` shape. Four near-identical local mappers exist today — consolidating them into a `lib/` helper is a queued `maintainer` item, not something to do inline while owning only route files.
- The living doc for this area is `docs/reference/data-pipeline.md` — update it when the pipeline changes. Authorization and sign-in live in `docs/reference/auth.md`.
