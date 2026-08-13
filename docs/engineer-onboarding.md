# Engineer onboarding

From `git clone` to a running dashboard, to knowing which parts of this codebase will bite you.

**Who this is for:** a developer who is fluent in React and TypeScript and has never seen this repo. It assumes nothing about Supabase, about Postgres connection pooling, or about the decisions that got this project to where it is.

**What is not here:**

- **How to use the app** — the import screen, backups, restore, reset, and what every metric on a page actually means: [`docs/user-guide.md`](./user-guide.md).
- **What each dependency is for, and the pipeline diagrams:** [`README.md`](../README.md).
- **Deploy specifics** — the environment matrix, the Supabase↔Vercel integration, preview behaviour, free-tier limits: [`docs/reference/deployment.md`](./reference/deployment.md).
- **Environment variable setup** — [`.env.example`](../.env.example) is the setup document. It is ~6.8 KB of prose about the pooler-host trap, `prepare: false` and percent-encoding, and it is kept current. This page links to it and deliberately does not restate it.

Everything asserted below was read out of the code at the cited `file:line`. Where a claim is unverified, it says so.

## Contents

- [What the app is](#what-the-app-is)
- [Toolchain](#toolchain)
- [Node is not pinned anywhere](#node-is-not-pinned-anywhere)
- [Step 1 — clone and install](#step-1--clone-and-install)
- [Step 2 — run it with no configuration at all](#step-2--run-it-with-no-configuration-at-all)
- [Step 3 — connect a database](#step-3--connect-a-database)
- [Step 4 — sign in as the admin](#step-4--sign-in-as-the-admin)
- [The CLI, read from the parsing code](#the-cli-read-from-the-parsing-code)
- [How to read the codebase](#how-to-read-the-codebase)
- [The verify loop](#the-verify-loop)
- [Shipping a change](#shipping-a-change)
- [Trip hazards](#trip-hazards)
- [Known gaps and follow-ups](#known-gaps-and-follow-ups)

## What the app is

A Next.js App Router dashboard that tracks one RAID: Shadow Legends clan's weekly **Hydra Clash** and **Chimera Clash** results — keys used, damage dealt, participation, week-over-week trend.

Three properties shape almost every decision in the tree:

1. **Reads are public, writes are admin-only.** Anyone can open any page. Every mutation goes through one guard, `requireAdmin()` in [`lib/auth.ts:76`](../lib/auth.ts), called as the first statement of every route handler under `app/api/`.
2. **There is exactly one database and one pool.** Supabase Postgres over the transaction pooler, spoken to with postgres.js from [`lib/db.ts`](../lib/db.ts). No ORM, no second engine, no local file database. (A long-lived working tree may still hold `data/clash.db` from a retired SQLite era — it is **untracked and gitignored** (`.gitignore:40`), so a fresh clone does not have it, and nothing reads it at runtime either way.)
3. **With no configuration the app still renders.** No connection string means the bundled demo dataset, not a crash. That fallback is narrow on purpose, and widening it is the single most dangerous change you can make here — see [Trip hazards](#trip-hazards).

## Toolchain

Versions are the *installed* ones, read from `package-lock.json` (lockfileVersion 3, 517 packages):

| | |
|---|---|
| Next.js | **16.2.9**, App Router |
| React | 19.2.4 |
| TypeScript | 5.9.3, `"strict": true`, path alias `@/*` → repo root (`tsconfig.json:21-23`) |
| Tailwind CSS | **4.3.1** |
| postgres.js | 3.4.9 |
| `@supabase/ssr` | 0.12.4 (**auth only** — never used to read data) |
| Package manager | npm |

Two toolchain facts that will not match your instincts:

- **Turbopack is the default bundler.** The scripts are bare `next dev` / `next build` (`package.json:6-7`). Do not add `--turbopack` — it is unnecessary. `--webpack` is the *opt-out*: "Use Webpack instead of the default Turbopack bundler for development" (`node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md:69`, and `:99` for `build`).
- **Tailwind 4 is CSS-first: there is no `tailwind.config.ts` or `tailwind.config.js` in this repo, and you should not create one.** The theme is a `@theme` block in [`app/globals.css`](../app/globals.css) (`@import "tailwindcss"` at `:1`, `@theme {` at `:3`). Tokens and primitives (`card`, `inset`, `fill-hydra`, …) are defined there; style with them and never hardcode a colour. See [`docs/reference/design-system.md`](./reference/design-system.md).

**This Next.js version differs from what your model or your memory expects.** `AGENTS.md` is blunt about it, and it is right: the vendored docs in `node_modules/next/dist/docs/` are the source of truth for route, layout, proxy and API-route behaviour. Read the relevant guide before writing that kind of code. The `middleware` → `proxy` rename below is one example of what happens if you don't.

## Node is not pinned anywhere

**The repo pins no Node version.** I checked, in this working tree:

| Checked | Result |
|---|---|
| `engines` field in `package.json` | **absent** (`node -e "require('./package.json').engines"` → `null`) |
| `volta` / `packageManager` field | **absent** (both `null`) |
| `.nvmrc` | **absent** |
| `.node-version` | **absent** |
| `.tool-versions` | **absent** |
| `.github/` (any CI at all) | **absent** — there is no CI in this repo, so nothing enforces a version on push either |

**The only floor is transitive:** `node_modules/next/package.json` declares `"engines": {"node": ">=20.9.0"}` for Next 16.2.9. That is the real minimum.

Practical guidance: **use Node 22.x.** That is what the machine this project is developed on runs (`node -v` → `v22.23.2`, npm 10.9.8), so it is the only version with any real evidence behind it. Note the mismatch: `@types/node` resolves to **20.19.43** while the runtime is 22 — the types are a version behind the runtime they describe. Nothing has broken because of it, but if you hit a Node API that TypeScript claims does not exist, that is why.

Adding `engines` or an `.nvmrc` was explicitly declined this round — see [Known gaps and follow-ups](#known-gaps-and-follow-ups).

## Step 1 — clone and install

```bash
git clone https://github.com/andreimogan/RaidClashTracker.git
cd RaidClashTracker
npm install
```

Every script you will use is in `package.json:5-14`:

| Script | What it does |
|---|---|
| `npm run dev` | dev server (Turbopack) |
| `npm run build` | production build |
| `npm run start` | serve a build |
| `npm run lint` | ESLint — **exits 1 by design**, see [The verify loop](#the-verify-loop) |
| `npm run db:migrate` | apply `supabase/migrations/*.sql` in filename order |
| `npm run seed` | push the bundled sample dataset into the database (**Weeks 20–24** — read the hazard first) |
| `npm run import` | CSV importer (upsert) |
| `npm run import:json` | JSON importer (flat = replace, nested = upsert) |

There is **no test suite**, and no test script. Verification here means: build it, then exercise the affected page by hand.

## Step 2 — run it with no configuration at all

```bash
npm run dev
```

Open the dashboard. It works, with no `.env.local` and no database, because [`lib/data.ts:50`](../lib/data.ts) returns `null` when no connection string resolves and `loadDataset()` falls back to the bundled dataset in [`lib/mock-data.ts`](../lib/mock-data.ts). That is **demo mode**: sample clan data, read-only for everybody, Weeks 20–24.

This is the fastest way to see the UI, and it is also the state you must be able to recognise instantly, because "the page rendered" is not evidence that anything is connected. The `/settings` page names the data source outright; that is the reliable check.

> If port 3000 is taken (someone else's dev server), use another: `npm run dev -- -p 3007`.

## Step 3 — connect a database

You need a Supabase project. Then:

1. **Create `.env.local`** — copy [`.env.example`](../.env.example) and fill in your own values. `.gitignore:34-35` ignores `.env*` except `.env.example`, so `.env.local` can never be committed by accident. **Read that file rather than guessing:** it explains the pooler hostname trap (the host is *not* just your region — it carries a platform prefix), why the port must be `6543`, and which characters in a password must be percent-encoded. Those three are the cause of most first-day failures.
2. **Apply the schema:**
   ```bash
   npm run db:migrate
   ```
   It applies every `.sql` file in `supabase/migrations/` in filename order (`scripts/db-migrate.ts:21-23`) and is safe to re-run. There are two today: `supabase/migrations/0001_init.sql` and `supabase/migrations/0002_lock_down_public_api.sql`.
3. **Optionally seed sample rows** — but read the Weeks 20–24 hazard below before you do.
4. **Restart the dev server.** Environment variables are read at process start.

**Before the migrations run, the app is still in demo mode**, not broken: Postgres raises `42P01` (undefined table) and [`lib/data.ts:83`](../lib/data.ts) treats that one code as "not migrated yet". After `db:migrate` on an empty project, the dashboard renders **genuinely empty** — that is a *different state* from demo mode, and confusing the two is this project's most repeated UI bug (`.claude/rules/ux.md`).

The four environment variables the app reads, and the five places they are read — worth knowing, because "I set it and nothing changed" is usually a process that was not restarted:

| Variable | Read at |
|---|---|
| `DATABASE_URL`, then `POSTGRES_URL` (first non-blank wins) | [`lib/db.ts:70`](../lib/db.ts), indexing `CONNECTION_VARS` (`lib/db.ts:41`) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | [`lib/supabase/server.ts:19-20`](../lib/supabase/server.ts), [`proxy.ts:48-49`](../proxy.ts), and — easy to miss — [`app/login/page.tsx:26`](../app/login/page.tsx) |
| `ADMIN_EMAIL` | [`lib/auth.ts:40`](../lib/auth.ts) |

Nothing under `scripts/` reads an environment variable directly. Each CLI entry imports [`scripts/lib/load-env.ts`](../scripts/lib/load-env.ts) **first**, which calls `dotenv`'s `config({ path: ".env.local" })` at `:6`; `lib/db.ts` then resolves the same way it does in the app. Import that module before anything that touches the database, or the script will find no connection string and behave as if you had none.

**All four fail closed.** A missing or wrong auth variable means *nobody* is an admin: writes 401, and the UI renders no write controls. A misconfiguration here locks writing; it never opens it.

## Step 4 — sign in as the admin

There is exactly one account, and signups are meant to stay disabled in Supabase. Create the user in the Supabase dashboard, put that address in `ADMIN_EMAIL`, and sign in at `/login`.

`isAdmin()` ([`lib/auth.ts:38`](../lib/auth.ts)) verifies the JWT via `getClaims()` — not `getSession()`, because with cookie storage the session's user object is attacker-controlled until the signature is checked — and compares the verified email claim to `ADMIN_EMAIL`, case-insensitively. It **never throws**: every uncertainty resolves to `false`, because server pages call it to decide whether to render a button.

Two consequences worth internalising before you touch auth code:

- **A token stays valid until it expires.** Deleting or banning the account does not revoke an already-issued token. Accepted tradeoff, documented at `lib/auth.ts:20-25`.
- **Pages hide write affordances, they do not disable them** — with a reason (`readOnly` + `readOnlyReason`). The server refuses independently, so the UI is presentation, not enforcement.

Full detail: [`docs/reference/auth.md`](./reference/auth.md).

## The CLI, read from the parsing code

Both importers hand-roll their argument parsing. The syntax below comes from that code, not from a usage string, because the two do not entirely agree.

### `npm run import:json` — [`scripts/import-json.ts`](../scripts/import-json.ts)

```bash
npm run import:json -- data/sample-week-flat.json --clash hydra --week 26
npm run import:json -- data/sample-week.json
```

- **`--week=26` DOES NOT WORK.** The flag reader is `process.argv.indexOf("--" + name)` and then `argv[i + 1]` (`scripts/import-json.ts:16-19`). It matches the flag token *exactly*, so `--week=26` is never found and the value is silently ignored — you get the current clash week instead of week 26, with no error. **Flags are space-separated, always.**
- **The file is `argv[2]`, and only if it does not start with `--`** (`scripts/import-json.ts:22`). Put the path first; a flag before it means "no file" and the script throws its usage error.
- **The mode is chosen by the JSON's shape, not by a flag** (`scripts/import-json.ts:28`):
  - A **flat array** of results (`data/sample-week-flat.json`) requires `--clash hydra|chimera` (`scripts/import-json.ts:29-32`) and **replaces** that `(week, clash)` (`scripts/import-json.ts:44`). Optional `--week N`, `--start`, `--end`; week defaults to the current clash week and the dates auto-derive from the schedule (`scripts/import-json.ts:35-40`).
  - A **nested `{ week, clashes }` object** (`data/sample-week.json`) ignores every flag and **upserts** (`scripts/import-json.ts:50`).
- **`--progress` is parsed and then silently dropped.** It is read at `scripts/import-json.ts:41` and passed into `normalizeFlatResults`, but that function's `FlatMeta` has no `progress` field — `weekNumber`, `startDate`, `endDate`, `clashType` and nothing else (`lib/import.ts:114-119`). It cannot be a type error, because `tsconfig.json:33` excludes `scripts/` from type-checking. **Do not use it and do not document it as working**; set clash progress through the app instead.

### `npm run import` — [`scripts/import-csv.ts`](../scripts/import-csv.ts)

```bash
npm run import -- data/sample-import.csv
```

One optional positional, **no flags at all** (`scripts/import-csv.ts:12`). Always **upsert** (`scripts/import-csv.ts:14`): it adds and updates rows without clearing the rest of the week.

Two rough edges here, both real:

- The default when you pass no path is `data/import.csv` — **a file this repo does not ship.** `npm run import` with no argument fails with an `ENOENT` from `readFileSync`, not a friendly message. The sample that does exist is `data/sample-import.csv`.
- Columns are `week_number, start_date, end_date, player, clash_type, keys_used, total_damage[, progress]`, and `total_damage` accepts `16.61B`-style shorthand. **An unrecognised damage string becomes `0` silently on the import paths** — it is only rejected on the member-edit path. What each ingest path does to your data is [`docs/user-guide.md`](./user-guide.md)'s subject.

## How to read the codebase

Two paths through the code, and they never cross:

**Read path** — every page is a server component:

```
page.tsx  →  loadDataset()   lib/data.ts   (one read-only transaction, four tables)
          →  lib/compute.ts  (all derived metrics; pure)
          →  components/     (presentational, tokens from app/globals.css)
```

**Write path** — three entry points, one pipeline, one guard:

```
in-app JSON import ┐
                   ├→ lib/parse.ts → lib/import.ts   normalize*, pure/client-safe ┐
CSV CLI            ┘                                                              │
                                                                                  ├→ persist(payload,
member week edit ───→ lib/parse.ts → lib/results.ts  validates and builds the     │    "upsert"|"replace")
                                                     ImportPayload itself         ┘  lib/persist.ts → Postgres

every HTTP entry crosses requireAdmin() first
```

The middle stage is the one to read carefully. The two import paths call the `normalize*`
functions in `lib/import.ts`; **the member edit does not**. `lib/results.ts:7` imports only
*types* from `./import`, validates its own four fields, assembles the `ImportPayload` by hand
(`lib/results.ts:120-132`) and calls `persist(payload, "upsert")` directly
(`lib/results.ts:133`). It does share `lib/parse.ts` (`parseDamage`, `lib/results.ts:8`) and it
does share `persist()` — those two are the parts that actually have to be shared.

**Never write SQL from a route or a component.** The pipeline is the only way in (`.claude/rules/data-pipeline.md`).

Where things live:

| Path | What |
|---|---|
| [`app/`](../app) | routes: `/`, `/hydra`, `/chimera`, `/timeline`, `/members`, `/members/[memberId]`, `/settings`, `/login`, and `/import` — which is a two-line redirect to `/settings` (`app/import/page.tsx:5`), because the import UI moved into a Settings tab |
| [`app/api/`](../app/api) | the six write/exfil endpoints: `/api/import`, `/api/restore`, `/api/reset`, `/api/backup`, `/api/members/[memberId]/results`, `/api/members/[memberId]/avatar` |
| [`proxy.ts`](../proxy.ts) | Supabase token refresh only. Never blocks. **Not** `middleware.ts` — see the hazards |
| [`lib/`](../lib) | `lib/db.ts` (pool) · `lib/data.ts` → `lib/compute.ts` (read) · `lib/parse.ts` → `lib/import.ts` → `lib/persist.ts` (write) · `lib/auth.ts` + `lib/supabase/server.ts` · `lib/backup.ts` · `lib/results.ts` · `lib/week.ts` · `lib/constants.ts` · `lib/format.ts` · `lib/mock-data.ts` |
| [`components/`](../components) | UI; gestal.gg aesthetic, tokens in `app/globals.css` |
| [`supabase/migrations/`](../supabase/migrations) | numbered, forward-only SQL |
| [`scripts/`](../scripts) | four CLI entries; each imports `scripts/lib/load-env.ts` first and closes the pool so the process can exit |
| [`.claude/rules/`](../.claude/rules) | path-scoped engineering rules — `.claude/rules/database.md`, `.claude/rules/supabase-schema.md`, `.claude/rules/data-pipeline.md`, `.claude/rules/rendering.md`, `.claude/rules/ui.md`, `.claude/rules/ux.md`. **Read the one matching the files you are about to change.** They are where the measured invariants live |

Domain constants you will meet immediately: key caps are Hydra **3**, Chimera **2** (`lib/constants.ts:7`), clan cap 30 (`lib/constants.ts:4`), and clash dates are **derived from the real schedules in UTC, never entered** ([`lib/week.ts`](../lib/week.ts)).

## The verify loop

```bash
npm run build   # the real check — there is no test suite
npm run lint    # exits 1; read below before you "fix" it
```

**`npm run lint` exits 1 by design.** Measured in this working tree, right now:

```
✖ 10 problems (9 errors, 1 warning)
```

Three of them are React Compiler diagnostics in `components/ImportPanel.tsx` (a `setState` in an effect, and two "existing memoization could not be preserved"); the rest come from untracked helper scripts under `.claude/scripts/`, which are not application code. **This is the approved baseline, not a regression** (`docs/reference/deployment.md:326-328`). Do not "clean it up" as a side quest — compare against this count, and only care if *your* files appear.

`npm run build` must stay clean. If you change a data page, check the build's route table too: all five of `/`, `/hydra`, `/chimera`, `/timeline` and `/members` must show as dynamic (`ƒ`), not static (`○`) — the reason, and why `/members` gets there differently from the other four, is in the hazards.

## Shipping a change

Local → GitHub → Vercel, one shared Supabase project:

1. Branch off `main`. The remote is `origin` → `github.com/andreimogan/RaidClashTracker`; the long-lived branches at time of writing are `main` and `dev-supabase-vercel`.
2. Build and exercise the affected page locally.
3. Push, open a PR, merge to `main`.

Per the owner's report, `main` is the production branch on Vercel and auto-deploys on push; **no agent working on this repo can see the Vercel dashboard, so that is unverified from inside the repo** and is hedged the same way in `CLAUDE.md` and `docs/project-map.md`.

**The thing to know before your first push:** production, preview deployments and local development all point at **one** Supabase project. A preview deployment therefore reads and **writes production data**. There is no staging database. Treat any write you trigger from a preview URL as a write to the live clan's history.

You should not need to set `DATABASE_URL` on Vercel — the Supabase integration's `POSTGRES_URL` is picked up by the fallback chain — but see the `POSTGRES_URL` hazard for why setting it explicitly is still the safer habit. All deploy specifics, the environment matrix, `SUPABASE_SECRET_KEY`'s standing risk and free-tier reality: [`docs/reference/deployment.md`](./reference/deployment.md).

## Trip hazards

The part of this document that earns its keep. Each of these has already cost someone real time, and several are invisible until production.

### 1. The demo fallback has exactly two triggers, and widening it is the cardinal sin

It fires when **`databaseUrl()` returns `null`** ([`lib/data.ts:50`](../lib/data.ts)) or when a caught error's code is **`42P01`**, undefined table ([`lib/data.ts:14`](../lib/data.ts), checked at `:83`). Every other failure — wrong password, DNS, pooler exhaustion, a paused project — **rethrows** (`lib/data.ts:86`) and lands on `app/error.tsx`.

Why the allowlist must stay exactly this narrow: **Supabase's pooler reports authentication failures as `XX000 (ECIRCUITBREAKER) too many authentication failures, new conn` — not `28P01`.** So a rule shaped as "fall back to demo on known connection errors" would not merely be untidy; it would serve **fake clan numbers as real** during an actual outage, under an error code that has nothing to do with authentication. Allowlist the one code that means "not migrated yet". Rethrow everything else. (`.claude/rules/database.md`.)

Related and equally load-bearing: **a reachable-but-empty database renders genuinely empty**, and that is a *different state* from demo mode. Demo mode is read-only for everybody; connected-and-empty is fully writable by the admin and needs a first import, not a permission. Conflating them is described in `.claude/rules/ux.md` as this project's most repeated UX bug — it has shipped more than once.

### 2. `prepare: false` is mandatory

`lib/db.ts:128`. Supabase's transaction pooler multiplexes connections and has nowhere to keep a prepared statement between queries. postgres.js enables prepared statements by default; leave them on and queries fail **intermittently**, which is the worst possible failure shape. Never remove this option, and never add a second `postgres()` call anywhere else in the tree.

### 3. A multi-query read must run inside one `sql.begin()` — and no value of `max` is safe

Issuing more concurrent queries than the pool's `max` against the transaction pooler **deadlocks forever** once a connection is already established, which is the normal state of a running server. Measured deterministically at four combinations: 3/4, 4/8, 8/16, 10/12. **Raising `max` only moves the cliff.**

So a read that needs several queries takes **one** connection and pipelines on it:

```ts
await getDb().begin("read only", (sql) => [ /* queries */ ]);
```

That is what [`lib/data.ts:66-71`](../lib/data.ts) does for its four tables, and what `lib/backup.ts` does for its export. **Never `Promise.all` a set of queries straight off `getDb()`.** Queueing whole *transactions* past `max` is safe; it is loose queries that hang.

Type gotcha that will confuse you the first time: the client handed to the `begin()` callback is `TransactionSql`. Like `Sql` it extends `ISql`, but it does **not** extend `Sql` — so it is **not assignable to `Db`** (`lib/db.ts:52`). A helper that accepts either would need `ISql`, which `lib/db.ts` deliberately does not export. Add that re-export in the change that first needs it, not in advance.

### 4. The pool is a `globalThis` singleton, not a module `const`

`lib/db.ts:57-60`, assigned with `??=` at `:125`. Next's dev server re-evaluates modules on every HMR reload; a module-level pool would leak one pool per reload until Supabase's pooler refuses connections. The once-per-process port-warning flag rides on the same object for the same reason. If you find yourself writing `const sql = postgres(...)` at module scope, stop.

### 5. The file is `proxy.ts`. A `middleware.ts` here would be silently ignored

The `middleware` file convention was **renamed to `proxy` in Next 16.0.0** (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`). Create `middleware.ts` in this repo and you get **no error, nothing in the build output, and no hint at runtime** — sessions would simply stop being refreshed and logins would quietly stop lasting. The export must be named `proxy` or be the default export ([`proxy.ts:47`](../proxy.ts)).

Three more rules about that file:

- **No `runtime` export.** Unlike route files, setting `runtime` in a proxy file **throws**. It already defaults to Node.
- **It must not import `lib/supabase/server.ts` or `lib/db.ts`** (`proxy.ts:20-25`). That module reads cookies through `next/headers`, which is the wrong contract for a proxy, and Next's own docs warn against relying on shared modules there.
- **It never blocks.** No redirect, no 401, on any path. Authorization lives in `requireAdmin()`, because a proxy cannot reliably cover route handlers or Server Functions — a matcher change or a refactor can silently remove coverage. That is also why its matcher excludes every `/api` path (`proxy.ts:87-92`).

### 6. Never "simplify" the connection chain to `??`

The resolution walks `CONNECTION_VARS` and takes the **first non-blank after `trim()`** (`lib/db.ts:41`, `lib/db.ts:64-74`). The tidy-looking rewrite —

```ts
process.env.DATABASE_URL ?? process.env.POSTGRES_URL   // WRONG
```

— is a production outage waiting to happen: **`""` is not nullish**. A `DATABASE_URL` that exists with an empty value (trivially created by adding the name in a Vercel project and saving with no value) would win the chain, shadow the integration's `POSTGRES_URL`, and drop the deployment into **demo mode while holding a variable that looks set**. That is exactly the bug Phase 4 fixed — a public URL serving `lib/mock-data.ts` as if it were clan history. Someone will propose the `??` form because it reads better. Say no.

### 7. `POSTGRES_URL` is a generic name

Inheriting it is what makes the deployment work with no manual setup — and it is the hazard the chain introduced. It is not a Supabase-specific name. **Any environment that already exports `POSTGRES_URL` for an unrelated reason** — a second Postgres/Neon integration on the same Vercel project, a docker-compose database, a shell profile you keep for `psql` — silently becomes this app's database. If that database happens to be migrated, the schema matches and **writes land there with no error and nothing in the UI to say so.**

So: **set `DATABASE_URL` explicitly wherever you can** (it wins, and it is unambiguous), and treat an unexplained `POSTGRES_URL` in an environment as a question, not as furniture.

Neither `POSTGRES_URL_NON_POOLING` (the direct `5432` endpoint) nor `POSTGRES_PRISMA_URL` is ever read — see `lib/db.ts:28-40` for why each would be wrong here. They are *named* in the code on purpose, because they are the first thing you will reach for when a deployment cannot connect.

### 8. `tsconfig.json` excludes `scripts/`

`tsconfig.json:33`: `"exclude": ["node_modules", "scripts"]`. **The four CLI entries are not type-checked by the build.** A signature mismatch there compiles happily and fails — or worse, silently does nothing — only when you run it. The dropped `--progress` flag above is exactly this: an object property that no type accepts, with no error to show for it. When you edit anything under `scripts/`, run it.

### 9. `npm run lint` exits 1 by design

Covered in [The verify loop](#the-verify-loop). Repeated here because every newcomer's first instinct is to fix it: 9 errors + 1 warning is the approved baseline. Compare counts; do not chase zero.

### 10. `npm run seed` occupies Weeks 20–24 — which is also the diagnostic for a broken deployment

The sample dataset is Weeks 20–24 (`lib/mock-data.ts:18-24`), and `npm run seed` pushes **those same rows** into the real database (`scripts/seed.ts:1-5`).

Now read `docs/reference/deployment.md:312-313`: **"The demo dataset is Weeks 20–24. Week numbers outside that range cannot be demo data."** That is the second-strongest check that a deployment is actually reading the database rather than serving the fallback.

**Seeding a real database therefore destroys the signal.** Afterwards, Weeks 20–24 present in the data proves nothing at all — you can no longer tell "connected, seeded" from "not connected, showing demo data" by looking at week numbers. On a database that holds real clan history it is worse: seeding writes sample rows over that range.

Rule of thumb: seed a scratch project you are willing to reset; never seed the one the clan uses. If you already did, `/settings` naming the data source is the check that still works.

### 11. Migrations: forward-only, no tracking table, so every file must be idempotent

`npm run db:migrate` applies **every** `.sql` file in `supabase/migrations/` in filename order, on **every** run. **There is deliberately no applied-migrations table** (`scripts/db-migrate.ts:3-8`) — the owner also runs SQL by hand in the Supabase SQL editor, and a tracking table would desynchronise exactly when you need it to be right.

Consequences, all mandatory:

- **Every migration must be written idempotently:** `create table if not exists`, `create or replace view`, `add column if not exists`, and a data migration needs its own `on conflict do nothing`.
- **An applied migration is never edited.** A schema change is a new numbered file. There is no down path.
- **Filename order is load-bearing, not cosmetic.** `0001_init.sql`'s bare `create or replace view` resets the view's `reloptions` to `null`, wiping the `security_invoker=on` that `0002_lock_down_public_api.sql` sets — so `0001` un-does `0002` on every run and only the fact that `0002` is applied *afterwards* saves it. Anything that recreates `member_clash_averages` must re-assert `security_invoker` **in the same file**.
- **Every new table in `public` needs its own `enable row level security`.** The default-privileges lever in `0002` revokes *grants* on future tables; it does not enable RLS on them.
- **Create tables through migrations, never the dashboard's Table Editor.** A second default-ACL entry owned by `supabase_admin` still grants `anon`/`authenticated` on future tables, and it cannot be altered without superuser — so a table created through the UI can be born with the door open.

Full measured detail, including the four lockdown levers and how each fails: `.claude/rules/supabase-schema.md`.

### 12. "RLS enabled, no policies" is the intended end state — do not resolve the advisory

The Supabase dashboard flags the four tables because zero policies means nothing is readable through PostgREST. **That is the point.** The app reads as the owning role over postgres.js, never over `/rest/v1`, and `0002_lock_down_public_api.sql` revoked the `anon`/`authenticated` grants deliberately. A well-meaning `create policy ... for select using (true)` reopens exactly the hole that migration closed. If a genuinely public read is ever wanted, that is a deliberate decision with its own review — not a warning to silence.

### 13. `total_damage` is `bigint` and reads back as a JavaScript string

Real values reach ~5.8e10, about 27× the `int4` ceiling, so the column is `bigint` — and postgres.js hands `bigint` back as a **string**, not a number (`lib/data.ts:37-44` types the row that way). **Coercion belongs in `lib/data.ts`'s row mappers and nowhere else** (`lib/data.ts:121`). `lib/compute.ts` must be able to assume it is working with numbers. Do the same check before you choose any new column type: verify what it reads back as.

### 14. Four data pages are dynamic *only* because they `await searchParams` — `/members` is the exception

`/`, `/hydra`, `/chimera` and `/timeline` each destructure `?week=` out of `searchParams: Promise<{ week?: string }>`, and **that `await` is the entire reason a request-time database read happens.** None of those four declares `export const dynamic = "force-dynamic"`, and `next.config.ts` is empty, so nothing else is holding them dynamic.

**`/members` is the explicit-declaration case, and it is the one that looks deletable.** Its week selector changed nothing (the roster aggregates every week by design) and was removed on 2026-08-13, so the page reads no `searchParams` at all. It stays dynamic solely because of `export const dynamic = "force-dynamic"` at `app/members/page.tsx:15`, which carries a comment saying it is load-bearing. **Do not tidy it away** as cargo cult on a page that awaits nothing — deleting it flips `/members` from `ƒ` to `○` with no error and no warning. The worked example is in `.claude/rules/rendering.md`.

A page that stopped reading `searchParams` would **silently become statically prerendered** and bake one build's rows into HTML served to every visitor — or bake the **demo dataset**, if the build environment had no connection string. No error, no warning; the only symptom is numbers that never change. The fallback would not have widened, it would have been *published*.

If a data page must stop reading `searchParams`, it declares `force-dynamic` **in the same change**, and the build's route table is re-checked (`ƒ`, not `○`) as the proof. "It looked fine in dev" is not evidence — `next dev` renders everything per request. The mirror rule: `/import` is deliberately static and must stay that way, which is why `isAdmin()` is never read in `app/layout.tsx`. (`.claude/rules/rendering.md`.)

### 15. Every route under `app/api/` is admin-only, and the guard is the FIRST statement

```ts
const denied = await requireAdmin();
if (denied) return denied;
```

Before `await params`, before `request.json()`, before any `try`. All six carry it: `app/api/backup/route.ts:14`, `app/api/import/route.ts:19`, `app/api/reset/route.ts:15`, `app/api/restore/route.ts:11`, `app/api/members/[memberId]/results/route.ts:16`, `app/api/members/[memberId]/avatar/route.ts:18`.

**There is no matcher protecting these** — the proxy's matcher explicitly excludes every `/api` path, because a proxy cannot protect route handlers. `requireAdmin()` is the single choke point, which also means **no data mutation may move to a Server Action**: Server Functions are reachable by direct POST, so a second write surface would be a second thing to guard. The only `"use server"` file in the repo is `app/login/actions.ts` (sign-in/sign-out cookies, no application data).

`backup` is gated as an **exfiltration** route, not a read — it exports the entire dataset. **A new route under `app/api/` is not finished until it carries that guard.**

### 16. Never let the connection URI reach a log, a response, or an error message

It contains the database password. `databaseUrl()`'s value is never logged, rendered, or put in an error message, and every doc and example uses a placeholder.

**A raw driver error is a leak of the same class.** postgres.js builds connection errors as `write/connect <code> <host>:<port>`, so echoing one to a client publishes the pooler hostname — and a `28P01` message carries the connection's user name, which embeds the Supabase project ref. Every route that catches a database error maps it to its own sentence plus the bare PG code; **never pass `err.message` through when the error carries a string `.code`.**

One operational warning while you are debugging credentials: **do not sit there retrying a wrong password.** Supabase's pooler counts failed authentications per project and will refuse **all** new connections project-wide — including from the owner's own dashboard — for roughly 75–100 seconds. If you see `ECIRCUITBREAKER`, suspect a leftover process still retrying before you suspect your credentials or the code.

## Known gaps and follow-ups

Recorded honestly rather than papered over. The first three were explicitly declined this round:

- **No Node pinning.** No `engines`, no `.nvmrc`, no CI. Use 22.x; nothing enforces it.
- **Restore has no confirmation step.** Choosing the file performs the restore, and a restore deletes everything before inserting. See [`docs/user-guide.md`](./user-guide.md) for the full destructive-action ranking — this is the one to be careful with.
- **The live deployment URL is not recorded in the repo.** Deliberate; "your Vercel deployment" is the phrase used throughout.
- **No test suite.** `npm run build` plus manual exercise of the affected page is the whole verification story.
- **Deployment facts are the owner's report, not measured.** The production branch, the variable list, and preview behaviour are unverified from inside the repo — `docs/reference/deployment.md:319-325` says which parts.
- **`scripts/` is untyped** by the build, and `npm run import`'s default path (`data/import.csv`) points at a file the repo does not ship.

## Where to go next

| You want to | Read |
|---|---|
| Use the app — import, backup, restore, reset, what a metric means | [`docs/user-guide.md`](./user-guide.md) |
| See every dependency and the pipeline at a glance | [`README.md`](../README.md) |
| Change the connection, the pool, or the demo fallback | `.claude/rules/database.md` |
| Write a migration, or touch grants / RLS / a column type | `.claude/rules/supabase-schema.md` |
| Change an ingest path | `.claude/rules/data-pipeline.md` + [`docs/reference/data-pipeline.md`](./reference/data-pipeline.md) |
| Change a page's rendering | `.claude/rules/rendering.md` |
| Touch auth | [`docs/reference/auth.md`](./reference/auth.md) |
| Deploy, or debug a deployment | [`docs/reference/deployment.md`](./reference/deployment.md) |
| Style anything | `.claude/rules/ui.md` + [`docs/reference/design-system.md`](./reference/design-system.md) |
| Know why a decision was made | [`docs/build-log.md`](./build-log.md) |

Root `ONBOARDING.md`, `TUTORIAL.md` and `SCAFFOLD-MANIFEST.md` are **not** about this app — they document the AI agent scaffold this repo is developed with. Do not go looking for Hydra in them.
