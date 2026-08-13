# Task ledger: phase4-real-data-in-first-vercel-deploy

order: "I am ready for Phase 4 to start. Prior to Phase 4, i have prepared and done the following: Step 3 — Vercel account + repo + integration (needed before Phase 4 starts) … Done when: the Vercel project exists, the integration shows \"connected\", and ADMIN_EMAIL is set. Ready to start phase 4"
status: done   # t1/t2 shipped, flow-reviewer PASS with findings, t3 cleared all 9.
               # Restore verified lossless (453/453 rows). Still open, tracked in
               # docs/build-log.md: the rest of Phase 3b's acceptance test (edit /
               # export / log out) and the anonymous live smoke test (needs the URL).
created: 2026-08-13
base_commit: b8817ad   # local dev-supabase-vercel; == origin/main content (merged a5a8043)

## Context pack

**Stack:** Next.js 16.2.9 (Turbopack, App Router) · React 19 · TypeScript · postgres.js 3.4.9 · `@supabase/supabase-js` ^2.112.3 · `@supabase/ssr` ^0.12.4 · Supabase Postgres 17.6 over the transaction pooler (`:6543`, `prepare: false`).

**Why this order exists.** The site is **already deployed** (Vercel↔GitHub auto-deploy fired on the owner's PR #2 merge to `main`), but the deployed app **cannot reach the database**: the Supabase↔Vercel integration creates `POSTGRES_URL`, and `lib/db.ts` reads only `DATABASE_URL`. With no `DATABASE_URL`, `lib/data.ts` takes its demo fallback — so a public URL is serving `lib/mock-data.ts` sample stats, labelled on only 1 of 7 pages. This order closes that and lands the owner's 416 real rows.

**Files in play**
- `lib/db.ts` — the only file that resolves a connection string; `databaseUrl()` at :26 reads `process.env.DATABASE_URL`. Exactly four exports (`Db`, `databaseUrl`, `getDb`, `closeDb`). **t1 owns.**
- `.env.example` — the placeholder env doc a fresh clone copies. **t1 owns.**
- `lib/data.ts` — `loadDataset()`; demo fallback fires on `databaseUrl() === null` or PG `42P01` only. **Read-only reference; nobody owns it this order.**
- `docs/reference/deployment.md` *(new)* · `docs/project-map.md` · `.claude/rules/database.md` · `README.md` · `CLAUDE.md` — **t2 owns.**
- `C:\Users\Andrei\Documents\RaidClashTracker-backups\clash-backup-2026-08-12.json` — **read-only input, outside the repo.** Validated at the gate: `version 1`, `exportedAt 2026-08-12T09:14:02.231Z`, 30 members · 7 weeks · 416 clash_results · 0 clash_meta. Never moved, rewritten or deleted.

**Seams**
- `lib/db.ts` `databaseUrl(): string | null` — the resolution order and the contract that blank counts as unset · owned by **t1**. t2 documents it but must not change it.

**Measured at the gate — treat as given, do not re-verify**
- Live Supabase tables: `members 0 · weeks 0 · clash_results 0 · clash_meta 0`, connecting as `postgres` on PostgreSQL 17.6. **No Reset is needed and none may be run.**
- `data/clash.db` md5 `8ee3eae9651cd860b90c0abff758d497`, 286,720 bytes.
- Build exit 0. Route table: `○ /_not-found`, `○ /import`; everything else `ƒ`; `ƒ Proxy (Middleware)` present.
- Lint baseline **9 errors + 1 warning** (3 in `components/ImportPanel.tsx`; the rest in untracked `.claude/scripts/*.js`).
- Vercel integration variable names (researched, cited in `docs/reference/deployment.md` by t2): `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_{USER,HOST,PASSWORD,DATABASE}`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  **`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` already match what the app reads — the auth half needs no mapping.**
  **Confidence note that must survive into the docs:** Vercel's marketplace page states `POSTGRES_URL` is the pooled transaction-pooler (6543) connection and `POSTGRES_URL_NON_POOLING` the direct 5432 one; **Supabase's own integration doc lists the names and says nothing about ports.** So the code verifies the port rather than trusting it.

**Constraints**
- **No task lists `data/` in its `owns`.** `data/clash.db` must end byte-identical.
- **Nothing destructive.** No `resetDatabase()`, no `TRUNCATE`, no `npm run seed`. The tables are empty; the owner's restore is the only write this order causes.
- **Never test with a wrong DB password.** It trips Supabase's pooler circuit breaker (`XX000 ECIRCUITBREAKER`) and refuses *all* new project connections for ~75–100 s. Reach connection-failure states with an unroutable loopback instead. Note `postgres()` does **not** dial until a query is issued, so `getDb()` alone is safe with any URI.
- **Never leak the URI.** It carries the password. Not logged, rendered, returned, or put in an error message — and a raw driver error is the same leak class (`.claude/rules/database.md`).
- `lib/db.ts` keeps **exactly four exports** and stays free of filesystem I/O — every page render goes through it.
- The owner's dev server on **:3000 is untouchable.** Any server a task starts uses **3007+**, one port each, killed by port with the port then confirmed free.
- **Do not commit and do not push.** The main session handles git.

**Prior decisions that bind this order**
- Demo fallback has exactly two triggers (`databaseUrl()` null · PG `42P01`) and must not widen. A connection outage must reach `app/error.tsx`, never render mock data as real.
- `max` is a correctness bound, not politeness: a multi-query read runs inside one `sql.begin()`. Unchanged here, but don't disturb it.
- The pool is a `globalThis` singleton, never a module `const` (Next dev HMR would leak one pool per reload).
- Phase 3b dropped the `NEXT_PUBLIC_` prefix from the two Supabase auth vars deliberately, so a server-only value is not named as browser-exposed. Do not reintroduce it.

**Non-goals**
- No CLI restore script. The owner chose the browser-upload path (it doubles as Phase 3b's outstanding acceptance test).
- No UI changes; no demo-labelling work (that is the separately deferred order).
- No schema change, no new migration.
- No `lib/http-errors.ts` consolidation (Phase 5).
- Not reading `SUPABASE_SECRET_KEY` from application code, ever.

## Cost forecast

**Estimate: 11M tokens** (range 8–14) · ~$7–12
- 3 dispatches (t1, t2, `flow-reviewer`) × ~1.5M all-in — 4.5M
- Gate verification (already spent) — ~3M
- Live smoke test + report + commit — ~3M
- Bounce allowance (1 review bounce) — ~1.5M

Basis: 4 prior orders in `docs/build-log.md`. Per-dispatch all-in scales with accumulated session size (~1.1M at ~50M, ~3.5M at ~75M); this session was started cold on purpose.

## Plan cost

**Measured: gate verification only** (main session; no planner dispatch — `task-planner` was deliberately skipped and the skip was flagged at the gate and approved).

## Tasks

- id: t1
  summary: Resolve the connection string from DATABASE_URL then POSTGRES_URL, and verify the port rather than assuming it.
  owns:
    - lib/db.ts
    - .env.example
  depends_on: []
  done_when: |
    1. `databaseUrl()` resolution matrix holds, proven by a script in the session
       scratchpad (NOT in the repo) that mutates `process.env` and calls the real
       exported function via `npx tsx`. Five asserted cases:
         only DATABASE_URL set        -> that value
         only POSTGRES_URL set        -> that value
         both set                     -> the DATABASE_URL value (explicit wins)
         both set but blank/whitespace-> null
         neither set                  -> null
       Report the actual output, not a claim.
    2. `POSTGRES_URL_NON_POOLING` and `POSTGRES_PRISMA_URL` are NOT read:
       `grep -c "POSTGRES_URL_NON_POOLING\|POSTGRES_PRISMA_URL" lib/db.ts` counts
       only comment lines that name them as deliberately excluded, and
       `process.env.POSTGRES_URL_NON_POOLING` / `process.env.POSTGRES_PRISMA_URL`
       appear ZERO times.
    3. Port guard: with a resolved URI whose port is 5432, exactly one line is
       logged naming the port and which variable it came from; with 6543 nothing
       is logged. Build the test URI from dummy parts you choose (e.g. user
       `nobody`, password `nopass`, host `127.0.0.1`) and assert the logged line
       contains NONE of them and no `postgresql://`. `getDb()` never dials, so no
       connection is attempted — do not issue a query, and never use a real
       password.
    4. The guard does not throw and does not change `databaseUrl()`'s return type:
       a 5432 URI still yields a working client object.
    5. `grep -c "^export" lib/db.ts` == 4, and `grep -c "from \"node:fs\"\|from \"fs\"\|require(\"fs\")" lib/db.ts` == 0.
    6. The `"DATABASE_URL is not set"` throw in `getDb()` names `POSTGRES_URL` too,
       so a reader debugging Vercel is not told to edit `.env.local`. It still
       contains no URI value.
    7. `.env.example` documents the resolution order and names the two excluded
       variables with the reason, and contains NO real host, user, password,
       project ref or key — verify by comparing against `.env.local` and reporting
       `present in .env.example? false` for each.
    8. `npm run build` exits 0 and the route table is IDENTICAL to the gate's
       (`○ /_not-found`, `○ /import`, everything else `ƒ`, `ƒ Proxy (Middleware)`).
       Paste it. `npm run lint` is still 9 errors + 1 warning.
    9. `md5 data/clash.db` == 8ee3eae9651cd860b90c0abff758d497.
  docs_touched: []
  changelist:
    - lib/db.ts: added an internal `resolveConnection()` returning `{name, url}` --
      first non-blank of CONNECTION_VARS = ["DATABASE_URL", "POSTGRES_URL"].
      `databaseUrl()` is now `resolveConnection()?.url ?? null`: same signature,
      same blank-is-unset contract, DATABASE_URL still wins.
    - lib/db.ts: added `warnIfNotPooledPort()` -- one `console.warn` per process
      when the resolved URI's port is not 6543, naming the port and the variable
      only. Never throws, never prints host/user/password/ref/scheme. Guarded by
      `globalThis.__raidClashPortChecked` (same reason the pool is on globalThis:
      it must survive HMR). Also covers the implicit-port case (no `:port` -> 5432).
    - lib/db.ts: the `getDb()` throw now reads "DATABASE_URL is not set, and
      neither is POSTGRES_URL ..." and gives both the local and the deployed fix.
    - lib/db.ts: header comment documents the resolution order and names
      POSTGRES_URL_NON_POOLING / POSTGRES_PRISMA_URL as deliberately excluded,
      with reasons (direct 5432 exhausts connections on serverless; Prisma-only
      query params). Exactly 4 exports, no fs I/O, pool still a globalThis
      singleton, `prepare: false` / `max: 3` untouched.
    - .env.example: new "How the connection string is resolved" block -- the
      two-name order, that Vercel needs no manual DATABASE_URL, the two
      exclusions with reasons, and that the port is verified not assumed.
      Placeholders only; verified against .env.local (9 secrets, all false).
  notes:
    - done_when 2's second grep (`process.env.POSTGRES_URL_NON_POOLING` == 0)
      passes but is vacuous: the lookup is a dynamic index `process.env[name]`,
      so a literal grep returns 0 for the INCLUDED names too. Replaced with a
      runtime assertion (scratchpad/exclusions.mts): with both excluded vars set
      and neither included var set, `databaseUrl()` returns null.
    - done_when 3 as written ("with 6543 nothing is logged") is only meaningful
      in a fresh process, since the guard is once-per-process by design. Each
      port case was therefore run in its own `npx tsx` process.
  claimed_by: "flow-implementer/t1"
  state: done

- id: t2
  summary: Record the deployment contract and the env-name mapping in the knowledge layer, written against t1's measured reality.
  owns:
    - docs/reference/deployment.md
    - docs/project-map.md
    - .claude/rules/database.md
    - README.md
    - CLAUDE.md
  depends_on: [t1]
  done_when: |
    1. `docs/reference/deployment.md` exists and records, with the gate's numbers
       and t1's measured output (not paraphrased from this ledger):
       - the full list of variables the Supabase<->Vercel integration creates;
       - that `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` match the app already,
         and only `DATABASE_URL` needed mapping;
       - the resolution order `DATABASE_URL -> POSTGRES_URL`, and **why
         `POSTGRES_URL_NON_POOLING` and `POSTGRES_PRISMA_URL` are excluded**
         (5432 direct exhausts connections on serverless; Prisma-specific params);
       - the **medium-confidence caveat on POSTGRES_URL's port**, attributed:
         Vercel's marketplace page states 6543, Supabase's integration doc is
         silent on ports. Do not upgrade this to a fact.
       - that `SUPABASE_SECRET_KEY` now exists in the Vercel environment, that the
         app never reads it, and that it bypasses RLS and every grant Phase 3a
         revoked;
       - that `main` is the production branch (auto-deploy on push) and **preview
         deployments read and write production data** — one shared project;
       - free-tier reality: no automated backups, ~1 week idle -> paused project.
    2. `.claude/rules/database.md` gains the resolution order and the two
       exclusions, plus the finding that **the five data pages are dynamic only
       because they await `searchParams`** (nothing declares `force-dynamic`;
       measured `ƒ` on `/`, `/hydra`, `/chimera`, `/timeline`, `/members`, `○` on
       `/import` and `/_not-found`) — so dropping a page's `searchParams` would
       silently make it static and bake one build's data into public HTML.
    3. `docs/project-map.md` and `CLAUDE.md` describe the env matrix accurately —
       no claim that Vercel supplies `DATABASE_URL`. Verify by grepping every
       occurrence of `DATABASE_URL` in both files and reporting each line's truth.
    4. `README.md` states that deploying needs no manual `DATABASE_URL`, and warns
       that a preview branch writes production data.
    5. No credential anywhere: run the `.env.local` comparison across all five
       owned files and report `false` for host, user, password, project ref, key
       and ADMIN_EMAIL's value.
    6. Report any claim in an existing doc that this order FALSIFIED, rather than
       silently editing around it.
  docs_touched:
    - docs/reference/deployment.md
    - docs/project-map.md
    - .claude/rules/database.md
    - README.md
    - CLAUDE.md
  changelist:
    - docs/reference/deployment.md (NEW, 267 lines): the living doc for this area.
      Sections: the shape (one Supabase project, `main` = production, auto-deploy) ·
      the Phase 4 failure and its two lessons ("a rendering page is not evidence
      the DB is reachable") · the four env vars the app reads, each with the file
      and line it is read at (measured by grepping process.env across app/ lib/
      components/ proxy.ts scripts/ -- 5 sites, 4 names) · resolution order and
      WHY it is a loop and not `??` · the two excluded connection strings · the
      port guard with the attributed medium-confidence caveat (Vercel marketplace
      page vs Supabase integration doc, both URLs cited) · the 13 integration
      variables in a table with what the app does with each · SUPABASE_SECRET_KEY
      as a standing risk · preview-writes-production · free-tier reality (no
      backups, ~1wk idle -> paused, and why a paused project must stay an error
      page) · the measured route table + the searchParams finding · how to check a
      deployment really reads the DB · what is unverified.
    - .claude/rules/database.md: two new rules after "One database, one pool" --
      (a) the two-name resolution order, the exclusions, and the `??` refactor
      named as forbidden with the failure it would cause; (b) the port guard as a
      warning-not-a-throw, with the implicit-5432 and unparseable-URI cases and why
      absence of the log line proves nothing. One new rule at the end: the five
      data pages are dynamic ONLY because they await searchParams. Corrected the
      no-leak rule, which said the URI "lives in `.env.local` only" -- it now also
      lives in the deployment's environment as POSTGRES_URL. `paths:` gained
      "app/**" (with the reason in the header comment) so the searchParams rule
      loads for the files that can violate it.
    - docs/project-map.md: overview no longer says "nothing is deployed yet" ·
      stack line now lists the four env vars and states Vercel needs no manual
      DATABASE_URL · read-path bullet's demo trigger corrected to `databaseUrl()`
      is null (both names) · db.ts bullet rewritten for the resolution order, the
      not-`??` reason and the port warning · new "Deployment + environment matrix"
      entity bullet · three new open unknowns (preview writes production, free-tier
      reality, the deployed runtime is unmeasured from this side).
    - README.md: intro no longer claims the app only runs locally · database bullet
      names both connection variables · data-state table row generalised from "No
      DATABASE_URL" to "No connection string" · "Sharing it later (optional)"
      replaced by "It's also online (Vercel)": no manual DATABASE_URL needed, a
      bold warning that a preview deployment writes real data, no free-tier
      backups, pausing shows the error page not demo data.
    - CLAUDE.md: header line replaced ("not yet deployed" was false) with the
      deployed reality incl. the preview-writes-production warning · demo-fallback
      convention reworded to "no connection string" · new always-convention listing
      the exactly-four env vars, the two never-read connection strings, and
      SUPABASE_SECRET_KEY's two prohibitions.
  notes:
    - done_when 1's "not paraphrased from this ledger" is only partly checkable
      from here: t1's raw script output is not in the repo (its scratchpad was
      session-local and deliberately not committed). Every CODE claim in
      deployment.md was therefore re-derived from lib/db.ts by line, and the route
      table was RE-MEASURED this session (`npm run build`, exit 0, identical to the
      gate's). t1's numbers that only it observed (the leak assertions on the
      warning line) are attributed as measured, not re-proven.
    - No agent has Vercel access, so the deploy-side facts (production branch,
      auto-deploy, which variables the project holds, SUPABASE_SECRET_KEY's
      presence) are the owner's report at the gate. deployment.md says so in a
      "What is unverified" section rather than presenting them as measured.
    - done_when 5's `.env.local` comparison skipped one needle as meaningless: the
      database NAME is the generic word `postgres`, which appears in these docs as
      a role/product name. Every other needle -- db user, password, host, project
      ref, whole DATABASE_URL, supabase host, publishable key (and its body),
      ADMIN_EMAIL and its local-part -- returned false across all five files.
  claimed_by: "flow-implementer/t2"
  state: done

- id: t3
  summary: Clear the nine non-blocking review findings from t1/t2 — split the rendering rule out of database.md, correct the remaining "no DATABASE_URL" trigger phrasing, name the inherited-POSTGRES_URL hazard, qualify the port-warning no-leak claim, and move the deploy-side hedges to the point of claim.
  owns:
    - .claude/rules/rendering.md
    - .claude/rules/database.md
    - .claude/rules/ux.md
    - .claude/agents/db-migration-specialist.md
    - docs/reference/deployment.md
    - docs/reference/auth.md
    - docs/reference/data-pipeline.md
    - README.md
    - CLAUDE.md
    - .env.example
  depends_on: [t1, t2]
  done_when: |
    1. `.claude/rules/rendering.md` exists with `paths: ["app/**"]` and carries the
       searchParams/force-dynamic invariant with its measured evidence (`ƒ` on `/`,
       `/hydra`, `/chimera`, `/timeline`, `/members`; `○` on `/import` and
       `/_not-found`; `next.config.ts` empty so `cacheComponents` is off), plus a
       one-line pointer to `database.md` for the demo-fallback consequence.
       `.claude/rules/database.md`'s `paths:` no longer contains `"app/**"` and its
       header comment no longer explains the removed widening.
    2. `.claude/agents/db-migration-specialist.md` no longer states the demo
       fallback fires only when `DATABASE_URL` is unset.
    3. The inherited-`POSTGRES_URL` hazard is named in BOTH
       `docs/reference/deployment.md` and `database.md`'s resolution bullet: it is
       what makes the deploy work AND what lets an unrelated `POSTGRES_URL` become
       the app's database; set `DATABASE_URL` explicitly where possible.
    4. `README.md`'s data-state table is internally consistent — the Live-data row
       no longer says `DATABASE_URL` where the row below says "connection string".
       `README.md`'s local quick-start still says `DATABASE_URL` (correct there).
    5. `.claude/rules/ux.md`'s demo-mode trigger and its demo+admin route list are
       deployment-accurate. The five data-source states and the 2x2 permission
       cells are NOT restructured.
    6. The port-warning no-leak claim is qualified where it appears (`database.md`,
       `deployment.md`) with the WHATWG `URL` counter-example written out, the
       reasoning for leaving `lib/db.ts` unchanged, and the half that IS absolute
       still stated as absolute. `lib/db.ts` is not modified (verify: no diff).
    7. No "no `DATABASE_URL`" trigger phrasing remains in
       `docs/reference/auth.md` or `docs/reference/data-pipeline.md`; `auth.md`'s
       read-only-reason table no longer prescribes `db:migrate` as the deployment
       fix while still describing the local-operator-facing in-app copy accurately.
    8. The `main`-is-production claim is hedged at its point of claim in
       `CLAUDE.md` and `deployment.md`; `deployment.md`'s preview-inherits-
       `POSTGRES_URL` claim reads as a derivation, not an observation.
    9. `.env.example` records that an unparseable URI logs nothing and that the
       check is once per PROCESS; `database.md` records that `closeDb()` does not
       re-arm `__raidClashPortChecked` (measured: 6543 -> closeDb -> 5432 warns
       zero times) and that this is the spec; the force-dynamic page list is
       qualified "among pages" (six `app/api/*/route.ts` files declare it too);
       `deployment.md`'s route table is marked as re-flowed build output.
    10. `npm run build` exits 0 with the gate's route table unchanged; `npm run
        lint` is still 9 errors + 1 warning (exit 1, the approved baseline).
    11. Credential scan against `.env.local` across every touched file — booleans
        only, no values printed. `md5 data/clash.db` ==
        8ee3eae9651cd860b90c0abff758d497.
  docs_touched:
    - docs/reference/deployment.md
    - docs/reference/auth.md
    - docs/reference/data-pipeline.md
  changelist:
    - .claude/rules/rendering.md (NEW, 2.9 KB, `paths: ["app/**"]`): the
      searchParams/force-dynamic invariant moved here whole, with its measured
      evidence (`ƒ` on the five data pages, `○` on /import and /_not-found;
      next.config.ts empty so cacheComponents is off), the "among pages"
      qualifier and the nine-vs-three grep count, the /import-stays-static
      mirror rule, and a closing line pointing at database.md for the
      demo-fallback consequence. Header comment records WHY the split happened so
      nobody re-merges it.
    - .claude/rules/database.md: `paths:` no longer contains "app/**" and the
      header comment now says so, with the reason (~17 KB for two of fifteen
      bullets) and "do not re-add it". The long searchParams bullet is replaced by
      a 4-line cross-reference that keeps only the database half (static
      prerendering PUBLISHES the demo dataset rather than widening the fallback).
      Resolution bullet gained the inherited-POSTGRES_URL hazard (generic name ->
      an unrelated exporter silently becomes the app's DB, and writes land there
      if it happens to be migrated; set DATABASE_URL explicitly). Port-guard
      bullet now splits the no-leak claim into the absolute half (no host, user,
      db name, project ref, password body or `postgresql://`, structurally, on any
      input) and the qualified half, with the WHATWG URL counter-example written
      out, the tighter real bound, and the reasoning for leaving lib/db.ts alone.
      Added: closeDb() does not re-arm __raidClashPortChecked -- spec, not defect,
      and why each port case needs its own process.
    - .claude/rules/ux.md: demo-mode state trigger is now "no connection string
      resolves (neither DATABASE_URL nor, on a deployment, POSTGRES_URL)" plus a
      note that copy should name the STATE, not the variable, because the deployed
      fix is usually reconnecting the integration. Demo+admin's route list gained
      the missing/blank POSTGRES_URL route (the one Phase 4 shipped). The five
      states and the 2x2 cells are structurally untouched.
    - .claude/agents/db-migration-specialist.md: the falsified demo-fallback
      instruction now reads "no connection string resolves -- neither DATABASE_URL
      nor POSTGRES_URL holds a non-blank value (`databaseUrl()` is null) -- or a
      query hits 42P01".
    - docs/reference/deployment.md: opening paragraph hedges `main`-is-production
      AT the point of claim and says why the hedge is repeated there. New bullet
      naming the inherited-POSTGRES_URL hazard. The port section's no-leak claim
      split into absolute / qualified / decision, with the counter-example, the
      measured bounds (99999 and 123456 throw and log nothing; 0123 -> 123; %2F
      parses correctly) and why the code stays. Preview-writes-production now
      shows its derivation (premise = owner's report; inference; what would
      falsify it = per-environment variable scopes). Route table labelled as real
      output RE-FLOWED into three columns. force-dynamic page list qualified
      "among pages" with the six API routes named and cacheComponents noted.
      searchParams pointer redirected to .claude/rules/rendering.md.
    - docs/reference/auth.md: demo+admin's reachability list corrected (adds
      missing/blank POSTGRES_URL on a deployment). The read-only-reason table's
      `"demo"` row now says "no connection string resolves" and splits the fix
      into local vs deployed, followed by a short paragraph explaining that the
      IN-APP copy deliberately names DATABASE_URL/db:migrate for the local
      operator while db:migrate cannot run on Vercel -- correct the explanation,
      not the copy.
    - docs/reference/data-pipeline.md: two trigger phrasings corrected -- the
      reset-vs-demo contrast (:26) and the three-honest-states line (:52, a
      one-word swap to "no connection string", as the brief hoped).
    - README.md: the Live-data row of the data-state table now says "connection
      string set", removing the contradiction with the row below it. The local
      quick-start's DATABASE_URL mentions (:15, :26, :41) left alone -- correct
      there.
    - CLAUDE.md: line 5's `main`-is-production/auto-deploy claim is now attributed
      to the owner's report and marked unverifiable from the repo, and the
      preview-writes-production warning carries "unless the environment is scoped
      per-environment".
    - .env.example: the port-warning block gained three caveats (an unparseable
      URI logs NOTHING; the check is once per PROCESS, not per resolution; on
      serverless that means once per warm instance, so absence is not proof) and a
      POSTGRES_URL-is-a-generic-name warning.
  notes:
    - VERIFIED LIVE, not asserted: reading app/hydra/page.tsx in this run caused
      `.claude/rules/ui.md` (`paths: ["components/**", "app/**"]`) to be injected
      into this agent's context. That is the identical glob form rendering.md uses,
      so the app/** scope does fire. Note no InstructionsLoaded hook is configured
      in .claude/settings.json, so a `load_reason` could not be read directly --
      the evidence is the injection itself plus cache-discipline.md:29-36's
      recorded `path_glob_match` measurement.
    - Item 1's premise re-measured and holds: database.md was 17,197 B vs
      ui+ux+data-pipeline 15,040 B combined. BUT the split moved scope, not bytes:
      database.md is now 20,324 B (the item-6 counter-example and items 3/9 land
      in it). Per-edit effect: an app/** edit loads 2,887 B instead of 17,197
      (-83%); a lib/db.ts edit loads +18%. A further split (RLS + migrations ->
      a `supabase/**`-scoped rule) is the obvious next cut; not done here, out of
      scope.
    - Item 6's bound is TIGHTER than the brief's "digits only, <=5 characters".
      Re-measured in Node 22.7: the digit run must parse as a valid port, so
      `…:99999/…` and `…:123456/…` both throw ERR_INVALID_URL and log NOTHING;
      leading zeros are normalised away (`…:0123/…` prints `123`), so the value is
      not even a faithful prefix; `…:12345%2FPw@…` parses correctly and prints
      6543. Also, in the counter-example WHATWG URL sees no userinfo at all and
      reads `postgres.<ref>` as the HOST -- which is still never printed, so the
      absolute half of the claim survives that input too.
    - Item 9's "absence of the warning is not proof" clause already existed in
      deployment.md (t2 wrote it at the end of the port section). No change was
      needed there; the clause was added to .env.example, which lacked it.
    - Item 8: README.md:180-181 was NOT hedged. The brief named only CLAUDE.md and
      the deployment.md site, and README is user-facing copy addressed to the
      owner -- who is the source of the claim, so "per the owner's report" reads
      absurd there. Flagged for the main session rather than decided here.
    - docs/project-map.md:9 is the fourth unhedged site and is not in this task's
      owns set. Reported to the main session with the exact string; not edited.
    - RESIDUAL, reviewer missed it, outside this task's owns: lib/results.ts:62
      carries a falsified CODE comment -- "Demo mode's trigger is a missing
      DATABASE_URL" -- immediately above the user-facing 400 at :66 ("set
      DATABASE_URL in .env.local, then run npm run db:migrate"), which is a wrong
      instruction on a deployment in exactly the auth.md:268 class. Also
      lib/mock-data.ts:2's header comment. Neither was owned by any task this
      order.
    - lib/db.ts and data/ were not touched (mtimes predate this run's first write;
      md5 data/clash.db == 8ee3eae9651cd860b90c0abff758d497). Build exit 0 with
      the gate's route table unchanged; lint 9 errors + 1 warning, exit 1
      (baseline). Credential scan: 11 needles from .env.local across all 11
      touched files -> 0 present, every file CLEAN. The database NAME needle was
      skipped by design (the generic word `postgres`, which legitimately appears
      in these docs as a role/product name).
  claimed_by: "flow-implementer/t3"
  state: done
