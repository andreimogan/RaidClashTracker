# Task ledger: phase3a-lock-down-public-postgrest-api

```yaml
order: "Phase 3a: close the anonymous PostgREST hole on the Supabase project — RLS, grant revocation, security_invoker, default privileges."
status: done   # flow-reviewer PASS with findings (no CRITICAL, no code defect); 2 HIGH + 3 MEDIUM + 2 LOW folded in, all documentation
created: 2026-08-12
branch: Dev
base_commit: 5c3948a
```

## Context pack

**Goal.** The owner's Supabase project currently accepts **anonymous reads and writes of every table** over PostgREST using the browser-visible publishable key. Close it at the database, before Phase 3b puts that key near a browser and before Phase 4 puts the owner's 416 real rows behind it. **One new migration file. No application code changes.**

### Measured at the gate (2026-08-12) — the reason this order exists

Against the live project, using `NEXT_PUBLIC_SUPABASE_ANON_KEY` (an `sb_publishable_*` key) as `apikey` + `Authorization: Bearer`:

```
GET    /rest/v1/members                 -> 200  []
GET    /rest/v1/weeks                   -> 200  []
GET    /rest/v1/clash_results           -> 200  []      <- the entire dataset
GET    /rest/v1/clash_meta              -> 200  []
GET    /rest/v1/member_clash_averages   -> 200  []
POST   /rest/v1/members                 -> 201  row created
DELETE /rest/v1/members?id=eq.<probe>   -> 204  (cleanup; members back to 0)
```

Catalog state: `pg_class.relrowsecurity = false` on all five objects · `pg_policies` in `public` = **0** · `anon` **and** `authenticated` each hold `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` on all five. Supabase grants this by default on `public` and expects RLS to be the gate; Phase 2's plain `create table` statements inherited it.

**Why the roadmap got this wrong:** its premise was correct — `lib/db.ts` is the only file importing `postgres`, every query goes through `getDb()`, and there is no `fetch` to `/rest/v1` anywhere in `app lib components scripts`. Its conclusion did not follow, because the threat model is not this app; it is **anyone holding the key**.

**Current exposure is nil in practice** — the key exists only in `.env.local`, nothing is deployed, and the tables are empty. That is the window this order uses.

### Other gate facts (verified, do not re-litigate)

- PostgreSQL **17.6**, pooler `:6543`, `prepare: false` required. DDL over the pooler works, including multi-statement via `sql.unsafe(text).simple()`.
- `npm run db:migrate` applies `supabase/migrations/*.sql` in filename order and is **idempotent by virtue of `if not exists` / `or replace` DDL** — there is no applied-migrations table, deliberately (Phase 2 divergence D5: a tracking table desynchronises the moment the owner runs SQL in the dashboard). **Any new migration must therefore be idempotent itself.**
- Live tables are **empty**: 0/0/0/0. `member_clash_averages` is **referenced nowhere in application code** (Phase 2 t1), so nothing in the app can break if the view changes.
- Auth is healthy and unrelated to PostgREST: exactly 1 confirmed user matching `ADMIN_EMAIL`, `disable_signup: true`, `email` provider only. Auth lives at `/auth/v1`, **not** `/rest/v1`.
- Phase 1 + Phase 2 are committed as **`5c3948a`**; the working tree was clean at the start of this order.

### SEAM — `supabase/migrations/0002_lock_down_public_api.sql` (owned by t1)

Four levers, belt-and-braces **because they fail in opposite directions**:

| Lever | Buys | Fails if… |
|---|---|---|
`enable row level security`, **zero policies**, on `members`/`weeks`/`clash_results`/`clash_meta` | PostgREST reads → `[]`, writes → `42501`. Clears the dashboard's "RLS disabled" warning, which is how the owner would notice a regression | someone later adds a permissive policy (`for select using (true)`) for a "public leaderboard" — realistic for a public dashboard |
`revoke all on table … from anon, authenticated` — **all four tables and the view** | permission denied *before* row filtering; even column names stop leaking. Survives a stray permissive policy | someone runs `grant select on all tables in schema public to anon` — a common copy-paste |
`alter view public.member_clash_averages set (security_invoker = on)` **+ revoke** | **RLS does not exist on views** (`alter view … enable row level security` is invalid syntax). Without `security_invoker`, the view runs with its owner's rights and **bypasses the tables' new RLS entirely** | — |
`alter default privileges in schema public revoke all on tables from anon, authenticated` | Phase 4/5's next `create table` cannot silently reopen the hole | run by the wrong role — `alter default privileges` is scoped to the *granting* role, so it must run as the role `DATABASE_URL` connects with. **Verify empirically.** |

**Deliberately excluded — record each reason in the file's header comment so nobody "hardens" it later:**
- **`force row level security`** — it applies RLS to the table *owner*, and the app connects as the owner. It would break every query.
- **`revoke usage on schema public`** — PostgREST introspection, Realtime, and the dashboard's API-docs generator may depend on it; unverified, so untouched.
- Dropping the view or the indexes; anything touching the `auth` schema.

### Binding constraints

1. **No task lists `data/` in its `owns`.** `data/clash.db` ends byte-identical at md5 `8ee3eae9651cd860b90c0abff758d497`. It is held open by the owner's dev server, so hash a **copy** if a direct hash fails.
2. **The live tables end empty** (0/0/0/0). Verification writes probe rows; clean them up and prove it.
3. **No credential in any tracked file** — read the key and URL from `.env.local` (untracked) and never write their values into the migration, the ledger, a changelist, or a log line. This includes the project ref and pooler hostname.
4. **No application code changes.** If the app breaks, that is a design defect to **report**, not to work around by editing app code.
5. **Teardown discipline.** Reach connection-error states via an **unroutable loopback** (`127.0.0.1:6544`) — **never a wrong password**: repeated auth failures trip Supabase's pooler circuit breaker (`XX000 ECIRCUITBREAKER`), refusing **all** new connections project-wide for ~75–100 s. Kill servers **by port, then confirm the port is free**; a `next start` behind a wrapper or `shell: true` orphans the real server when you kill the launcher. Kill a headless browser by PID or profile, **never** by image name. **The owner's dev server is on `:3000` — untouchable.** Use 3007+.
6. **Vocabulary sweep uses `-i`** (case-insensitive), never `-I` (which means "skip binary" and silently makes the sweep case-sensitive — three Phase 2 agents made exactly that mistake).
7. **Measure the `npm run lint` baseline before any edit.** Do not inherit a figure; the record contradicts itself (Phase 2's pack says 3 errors in `ImportPanel.tsx`, the build log says 4).

### Non-goals — do not re-litigate

`proxy.ts`, `lib/auth.ts`, the six route guards, the login page, UI gating, `docs/reference/auth.md` (all **Phase 3b**) · importing real data or deploying (**Phase 4**) · the four routes still echoing driver messages and `app/api/backup/route.ts`'s missing `try`/`catch` (**Phase 3b**) · creating any RLS **policy** (zero policies is the design) · `revoke usage on schema public` · renaming the `NEXT_PUBLIC_*` env vars (Phase 3b decision) · demo-labelling / empty-state UX (its own deferred order).

## Cost forecast

**Estimate 4.5M tokens** (range 3.5–6.5M) ≈ **$4–7**. Three dispatches (researcher already running, implementer, reviewer) × ~1.12M all-in = 3.4M, plus report/commit 1.1M. **Basis: Phase 2's method** — its measured `est 7.2M → 13.7M, $12.74` over 11 dispatches gives ~1.12M all-in per dispatch, with main-session re-processing ~90% of the total. The driver is dispatch count, not that this order writes one file; the estimate is nudged **up** because this session's accumulated context is larger than at Phase 2's start. Assumes zero cache breaks.

## Tasks

### t1 — Close the PostgREST hole with one idempotent migration
- **agent:** `db-migration-specialist`
- **state:** done · **claimed_by:** `db-migration-specialist` (Phase 3a run, 2026-08-12)
- **owns:** `supabase/migrations/0002_lock_down_public_api.sql` *(new)* — **nothing else**
- **depends_on:** none · **docs_touched:** none *(doc updates are Phase 3b's t4; see the doc-sync note)*
- **done_when:**
  1. **Before-state recorded and pasted into the changelist, before any DDL:** `pg_class.relrowsecurity` + `relforcerowsecurity` for all 5 objects · `select count(*) from pg_policies where schemaname='public'` · the `anon`/`authenticated` rows of `information_schema.role_table_grants` · **and** `select current_user, session_user`, `select rolbypassrls, rolsuper from pg_roles where rolname = current_user`, `select tablename, tableowner from pg_tables where schemaname='public'`. **State which role `DATABASE_URL` connects as and whether it bypasses RLS — measured, not reasoned.**
  2. The migration contains the four SEAM levers and **only** those, plus a header comment recording what each buys and **why `force row level security` and `revoke usage on schema public` are deliberately absent**. **Zero `create policy` statements.**
  3. **Idempotent:** `npm run db:migrate` **three times in a row**, exit 0 every time, with `0001` still re-applying cleanly alongside it. Paste the output of runs 2 and 3.
  4. **After-state re-measured and pasted:** `relrowsecurity = true` on all four tables · `pg_policies` still **0** · `anon` and `authenticated` hold **no privilege** on any of the five objects.
  5. **Durability lever proved, not assumed:** create a throwaway table as the migrate role, show `role_table_grants` gives `anon`/`authenticated` nothing on it, then drop it.
  6. **PostgREST refused with the public key, all five objects.** `GET` on each → **not 200**; `POST /rest/v1/members` → **not 201**. Paste before/after status codes side by side (before-values are in the context pack). Read the key from `.env.local`; **never write its value anywhere.**
  7. **The app still works — empirically, not by reasoning.** `npm run build` exit 0 · `next start` on **3007** · all six data pages (`/ /hydra /chimera /timeline /members /settings`) → 200 · `/settings` shows the connected card · **and a full write round-trip succeeds:** `npm run seed` → a `POST /api/import` → a `POST /api/members/<id>/results` edit → `POST /api/reset`. **If any of this fails, stop and report it as a design defect — do not edit application code.**
  8. **Auth still works after revocation:** a `signInWithPassword` round-trip with the owner's real credentials succeeds and `getUser()` returns the admin email. This is the empirical answer to "does anything need PostgREST". Use the credentials once — **do not loop failed sign-ins** (constraint 5).
  9. **Close:** `select count(*)` = 0 on all four tables · `md5 data/clash.db` == `8ee3eae9651cd860b90c0abff758d497` (hash a copy if the file is locked) · `npm run lint` no new errors vs the baseline you measured in step 1 · vocabulary sweep (`-i`) over the owned file · credential sweep across all git-visible files → 0 hits · every port you used verified free and `:3000` verified untouched.

<!-- doc-sync note for flow-reviewer: t1 carries empty docs_touched by design. The invariants
     below belong in .claude/rules/database.md, but they must be written from t1's MEASURED
     numbers, and the same rule file is rewritten by Phase 3b's t4 alongside the auth invariants.
     Splitting that file across two orders would mean writing it twice and risking contradiction,
     so the doc update is deliberately deferred to Phase 3b's t4, which is gated on it.
     This is a recorded deferral, not a doc-sync miss. -->

### Deferred to Phase 3b's t4 — required content of `.claude/rules/database.md`

Raised as **HIGH-1** by `flow-reviewer`: the original deferral note said "the RLS/grants invariant", which would have let t5 satisfy the gate with a single bullet while **three of the four measured invariants were lost.** All four are enumerated here so that cannot happen. t5's `done_when` must require each one, written from the measurements in t1's changelist:

1. **Lever 4 revokes grants, not RLS.** `alter default privileges … revoke all on tables` stops a future table inheriting anon grants, but **does not enable RLS on it**. *Every new table in `public` needs its own `enable row level security` line in the migration that creates it.* This must be a **rule, not a comment** — the author of a future `0003_*.sql` reads `.claude/rules/database.md` (whose `paths:` already covers `supabase/**`) and `0001` for schema shape, **not** `0002`'s header. Failure scenario from the review: a plain `create table` in Phase 4 looks fine (no anon grants), but RLS is off and `pg_policies` is 0, so the moment anyone runs the `grant select on all tables in schema public to anon` copy-paste that lever 2's own comment predicts, that table is fully readable with the publishable key.
2. **`create or replace view` resets `reloptions`.** Anything recreating `member_clash_averages` must re-assert `security_invoker = on`. Note `.claude/rules/database.md` currently holds `create or replace view` up as an idempotency mechanism alongside `create table if not exists` — true for the view *definition*, silently destructive to its *options*. That clause needs the caveat (review MEDIUM-3).
3. **`supabase_admin`'s default ACL still grants anon/authenticated**, and altering it needs superuser (measured: `42501 permission denied to change default privileges`). Our migrations create objects as `postgres`, so lever 4 holds for them — but **a table created through the Supabase dashboard's Table Editor can be born with the door open.** Operational rule: create tables via `supabase/migrations/` + `npm run db:migrate`, not the dashboard UI.
4. **`alter default privileges` is scoped to the granting role** and must run as the role that will create the objects. Here `postgres` is both the migrate role and the owner, so it lines up — a future change to the migrate role silently voids the lever.

Also carry across: **lever 4 is `ON TABLES` only** — the `postgres` default ACL still grants anon/authenticated `EXECUTE` on future *functions* and `rwU` on *sequences* in `public` (review HIGH-2, now recorded in `0002`'s header), and **`service_role` retains full DML** on all five objects (review MEDIUM-1).

**Ownership check:** 1 task, 1 path, no overlap possible. `data/` appears in no `owns`. Everything else in the repo is unowned and must not be edited — including `supabase/migrations/0001_init.sql` (applied; never edit an applied migration), all of `app/`, `lib/`, `components/`, `scripts/`, and every doc.

## Verification

Per the `done_when` above. The order's headline result is a **pair**: the hole closed *and* the app unbroken. Either alone is a failure — a locked-down database that breaks the dashboard is not a fix, and a working dashboard with an open API is the bug we started with.

## Changelist

### t1 — done (db-migration-specialist, 2026-08-12)

**Files.** One added, nothing else touched: `supabase/migrations/0002_lock_down_public_api.sql`
(4 executable statements + a header comment). `git status` at close: that file and this
ledger, untracked; **no modified files at all** — no application code, no docs,
`0001_init.sql` untouched. Command to apply: **`npm run db:migrate`**.

**The migrate role — measured, not reasoned.** `DATABASE_URL` connects as
`current_user` = `session_user` = **`postgres`**, on PostgreSQL **17.6**. It is the
**owner** of all four tables and the view, and `pg_roles` reports `rolsuper = false`
but **`rolbypassrls = true`**. So RLS cannot apply to the app on two independent
grounds. Confirmed by the round-trip below, not by inference.

**Before → after.**

| Measurement | Before | After |
|---|---|---|
| `relrowsecurity` (4 tables) | `false` ×4 | **`true` ×4** |
| `relforcerowsecurity` | `false` ×5 | `false` ×5 (unchanged, deliberate) |
| `pg_policies` in `public` | 0 | **0** |
| `anon`/`authenticated` grant rows in `public` | **35 each**, 7 privs × 5 objects | **0** (`role_table_grants` → `[]`) |
| `relacl` on all 5 | `{postgres,anon,authenticated,service_role}` | **`{postgres,service_role}`** |
| view `reloptions` | `null` (owner rights) | **`{security_invoker=on}`** |
| `pg_default_acl` (`postgres`, tables) | grants to anon+authenticated | **`{postgres,service_role}`** |
| row counts | 0/0/0/0 | **0/0/0/0** |

**PostgREST with the publishable key.** All five objects, before → after:

```
GET  /rest/v1/members                 200 []   ->  401  42501 permission denied for table members
GET  /rest/v1/weeks                   200 []   ->  401  42501 permission denied for table weeks
GET  /rest/v1/clash_results           200 []   ->  401  42501 permission denied for table clash_results
GET  /rest/v1/clash_meta              200 []   ->  401  42501 permission denied for table clash_meta
GET  /rest/v1/member_clash_averages   200 []   ->  401  42501 permission denied for view member_clash_averages
POST /rest/v1/members                 201 row created  ->  401  42501, nothing created
```

The before-state was **re-measured first-hand**, not taken from the pack: the anon
`POST` really did create a row (id `probe-phase3a-1786538120976`), which was then
deleted as `postgres` and the tables re-verified at 0. **Stronger result:** the
after-state `GET`s were repeated **while 2 real rows existed** (mid round-trip) —
still `401`, and the response bodies contained no row data.

**Idempotency — `npm run db:migrate` ×3, exit 0 each time.** Runs 2 and 3 were
byte-identical:

```
postgres NOTICE 42P07: relation "members" already exists, skipping
postgres NOTICE 42P07: relation "weeks" already exists, skipping
postgres NOTICE 42P07: relation "clash_results" already exists, skipping
postgres NOTICE 42P07: relation "clash_meta" already exists, skipping
postgres NOTICE 42P07: relation "idx_clash_results_week" already exists, skipping
postgres NOTICE 42P07: relation "idx_clash_results_member" already exists, skipping
  applied 0001_init.sql
  applied 0002_lock_down_public_api.sql
Migrations applied: 2 files. Anything already in place was skipped.
```

All four lever forms were also run **twice in a single file** in a throwaway schema
before going near live: no statement errors on a second pass.

**Durability lever proved.** A throwaway `public.zz_phase3a_default_privs_probe`
created **as `postgres`** inherited grantees `{postgres, service_role}` only —
**0 anon/authenticated grant rows** — then dropped (`public` back to the 5 expected
objects). Caveat recorded: lever 4 covers **grants, not RLS** (the probe table had
`relrowsecurity = false`), so a future migration must still `enable row level
security` on any table it adds.

**Rehearsal in a throwaway schema (never against live tables) isolated each lever:**

```
RLS off + grants (= the live hole):   anon select OK(1 row) · anon insert OK · anon view OK(2)
+ lever 1 (RLS, 0 policies):         anon select 0 rows   · anon insert 42501 · anon view STILL 2  <-- the trap
+ lever 3 (security_invoker=on):     anon view 0
+ lever 2 (revoke):                  42501 permission denied for table/view, incl. a single-column select
owner throughout:                    unaffected (2 rows)
```

**The app still works — measured.** `npm run build` exit 0 · `next start` on **3007**
(port 3000 never touched) · `/ /hydra /chimera /timeline /members /settings` → **200 ×6** ·
`/settings` renders the **connected-but-empty** card ("Connected to the clan database —
no clash data yet"), i.e. the demo fallback did **not** fire, and `/members` rendered
**0 member links** — genuinely empty. Full write round-trip, all through the sanctioned
pipeline: `POST /api/import` **200** (`replace`, 1 member/1 week/1 result) → `POST
/api/members/m-phase3a-probe/results` **200** (`upsert`; verified the UPDATE landed:
hydra `keys=3 damage=60000000000`, chimera `keys=2 damage=999000000`, both `bigint`
reading back as JS **string**) → `GET /api/backup` **200** → `POST /api/reset` **200**
→ counts back to **0/0/0/0**. `member_clash_averages` returned 2 rows to the app with
`security_invoker=on`. (`resetDatabase()` is `DELETE`-only, no DDL, so it cannot strip
the lockdown.)

**Auth (per the corrected criterion — see "Deviations").** `GET /auth/v1/settings`
**200 before → 200 after**, `disable_signup: true`, `email` the only provider, 1
confirmed user. Scoping shown from the grant matrices rather than asserted: grant rows
for `anon`/`authenticated` by schema went `public` **35 → 0** while **`auth` was 0 both
before and after** (it holds no anon/authenticated grants at all — GoTrue connects as
its own role) and `storage` stayed **25**. Nothing in this migration names anything
outside `public`.

**Close-out.** `md5 data/clash.db` = `8ee3eae9651cd860b90c0abff758d497` ✔ unchanged ·
`npm run lint` **10 problems (9 errors, 1 warning)** — **identical to the baseline I
measured before editing**, 0 new · vocabulary sweep with **`-i`** over the owned file:
`sqlite`/`libsql`/`turso`/`pragma`/`data/clash.db` → **0** each, and among
**executable** lines `create policy`/`force row level security`/`revoke usage`/`drop`
→ **0** each (each appears exactly once in the header comments, documenting its
deliberate absence, as required) · credential sweep for the key, project ref, DB
password and pooler host across **149 git-visible files** → **0 hits** · `:3007` has no
listener and refuses connections; owner's `:3000` still LISTENING on the original PID
and answering **200** · no leftover scratch schemas, probe tables or probe rows.

### Deviations and findings (three things the ledger got wrong)

1. **`done_when` 8 was unachievable and was corrected mid-task by the main session.**
   It asked for a `signInWithPassword` round-trip with the owner's real credentials;
   `.env.local` holds `ADMIN_EMAIL` but no password, by design. Satisfied the
   checkable equivalent instead (`/auth/v1/settings` 200 + the schema-scoping proof
   above). **No sign-in was attempted with any password.** End-to-end sign-in
   verification belongs to Phase 3b, performed by the owner.
2. **The ledger's stated reason for excluding `force row level security` is false
   here.** The SEAM says it "applies RLS to the table owner… It would break every
   query." Tested in the throwaway schema: with `force row level security` set,
   `postgres` still **SELECTed and INSERTed normally**, because `rolbypassrls = true`
   and BYPASSRLS wins over FORCE. The exclusion still stands, for the *accurate*
   reason now written into the file's header: it buys nothing (anon/authenticated are
   already refused at the grant layer with zero policies) and arms a landmine for the
   day the app connects as a role **without** bypassrls. Had this reasoning been
   trusted rather than measured, the file would carry a comment that misleads the next
   reader.
3. **New finding, not in the ledger: `0001` silently un-does lever 3 on every migrate
   run.** A bare `create or replace view` **resets `reloptions` to `null`**, wiping
   `security_invoker` (measured; `relacl` is *not* reset, so the revokes survive).
   Filename order saves the full run — `0002` re-sets it after `0001` — so
   `db:migrate` always ends correct. But applying **`0001` alone** (e.g. pasting it
   into the Supabase SQL editor, which the owner does) reopens the view to owner-rights
   execution, and only **lever 2's revoke** keeps that from being an exposure. This is
   a concrete instance of the belt-and-braces design paying off, and it is recorded in
   the migration's header. **Anything that later needs to edit that view must re-apply
   `security_invoker`.**

**Assumptions / residual risks for Phase 3b/4.**
- `service_role` retains full privileges on all five objects (untouched — out of SEAM
  scope). It is a secret key; if it ever reaches a browser the lockdown is moot.
- A second `pg_default_acl` entry, granting role **`supabase_admin`**, still grants
  anon/authenticated on future tables. It applies only to objects created *by
  supabase_admin*; our migrations create as `postgres`, and altering another role's
  default privileges needs superuser. Out of scope, worth knowing.
- Lever 4 does not enable RLS on future tables — every new table needs its own
  `enable row level security` line.
- `npm run seed` (named in `done_when` 7) was **blocked by the permission classifier**
  and was not run; I did not work around it. The write round-trip was proved through
  the app's HTTP endpoints instead, which exercises the same
  `normalize → persist` pipeline plus the routes themselves.
