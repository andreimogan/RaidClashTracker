# Deployment and the environment matrix (living doc)

<!-- Kept current as code changes — updated, not appended. Written in Phase 4 against
     lib/db.ts as t1 left it and the measured results in
     docs/tasks/phase4-real-data-in-first-vercel-deploy.md. Code claims cite lib/db.ts by
     line; platform claims that no agent can reach are marked as the owner's report. -->

**The shape: one Supabase project, one production branch, and an app that is silently happy
with no database at all.** The dashboard is hosted on Vercel from the GitHub repo, and —
**the owner's report at the gate, not something any agent can check from the repo** — `main`
is the production branch and auto-deploys on push. Every environment (production, every
preview, and the owner's laptop) points at the *same* Supabase Postgres project (17.6, free
tier); there is no staging database. The hedge is repeated here rather than only in
"What is unverified" at the bottom, because this paragraph is where the claim is used: the
preview-writes-production section below is *derived* from it, and a reader who takes the
first sentence as measured fact inherits that derivation as fact too.

The last fact is the one that makes this doc necessary: **demo mode is the app's zero-config
state.** With no connection string `lib/data.ts` falls back to `lib/mock-data.ts` and renders
a complete, plausible dashboard. So a deployment that cannot reach the database looks
healthy.

## The failure this order fixed

The site went live on the owner's merge to `main` and **could not reach the database.** The
Supabase↔Vercel integration creates `POSTGRES_URL`; `lib/db.ts` read only `DATABASE_URL`.
`databaseUrl()` returned `null`, which is trigger one of the demo fallback, so a public URL
served `lib/mock-data.ts` sample stats — labelled on **1 of 7 pages**. Nothing errored,
nothing logged, and the numbers looked like clan numbers.

Two lessons are worth more than the fix:

- **"The deployed page renders" is not evidence the database is reachable.** It is evidence
  of nothing at all. Check the data source, not the HTTP status.
- **A missing variable was indistinguishable from a working app.** That is why the port is
  now checked and reported (below) instead of trusted.

## What the app reads: exactly four names

Measured by grepping `process.env` across `app/`, `lib/`, `components/`, `proxy.ts`,
`scripts/` — five sites, four names:

| Variable | Read at | Holds |
|---|---|---|
| `DATABASE_URL` **or** `POSTGRES_URL` | `lib/db.ts:70` | the pooled `postgresql://` URI. First non-blank wins |
| `SUPABASE_URL` | `lib/supabase/server.ts:19`, `proxy.ts:48`, `app/login/page.tsx:26` | the project's auth endpoint base |
| `SUPABASE_PUBLISHABLE_KEY` | `lib/supabase/server.ts:20`, `proxy.ts:49`, `app/login/page.tsx:26` | the `sb_publishable_*` key |
| `ADMIN_EMAIL` | `lib/auth.ts:40` | the single address allowed to write |

Everything else in the environment is unread. That is a property to preserve, not an
accident: each name the app reads is a name a deployment can get wrong.

**A grep for `process.env.POSTGRES_URL` returns nothing, and that proves nothing.**
`lib/db.ts` looks the connection names up through a dynamic index (`process.env[name]`), so a
literal grep is blind to *every* name in the chain, included and excluded alike. Verify the
resolution with a runtime assertion against the real exported `databaseUrl()`, the way t1's
scratchpad scripts did — a grep-shaped check here is vacuous (t1's note in the ledger).

## Connection resolution: `DATABASE_URL` → `POSTGRES_URL`

```ts
const CONNECTION_VARS = ["DATABASE_URL", "POSTGRES_URL"] as const;   // lib/db.ts:41
```

An internal `resolveConnection()` (`lib/db.ts:64`) walks that array in order and returns
`{ name, url }` for the first value that is **non-blank after `.trim()`**. `databaseUrl()` is
`resolveConnection()?.url ?? null` (`:107`) — same signature as before, same contract that a
blank value counts as unset. Neither set, or both blank, is demo mode exactly as before. The
`name` is kept only so the port warning can say which variable to go and fix; nothing outside
`lib/db.ts` ever sees the URI.

**Why this is a loop and not `process.env.DATABASE_URL ?? process.env.POSTGRES_URL`.** The
`??` version is shorter, reads better, and is wrong: **`""` is not nullish**, so a
`DATABASE_URL` that exists with an empty value wins the chain and silently drops the
integration's `POSTGRES_URL`. The deployment then lands in demo mode holding a variable that
*looks* set in the Vercel dashboard — the exact failure above, with the evidence pointing the
wrong way. An empty string is easy to create there: add the name, save without a value.
Recorded because the `??` form is the natural refactor and someone will propose it.

Consequences worth stating plainly:

- **A Vercel project needs no manual `DATABASE_URL`.** The integration's `POSTGRES_URL` is
  picked up as-is. Set `DATABASE_URL` on a deployment only to point it at a *different*
  database; explicit still beats inherited.
- **That inheritance is the fix and the new hazard, in one clause.** `POSTGRES_URL` is a
  **generic name**, not a Supabase-specific one. Any environment that already exports it for
  an unrelated reason — a second Postgres or Neon integration on the same Vercel project, a
  docker-compose Postgres image, a shell profile kept for `psql` work — now becomes *this
  app's* database, where before this order it fell harmlessly into demo mode. If that other
  database happens to be migrated the schema matches, so **writes go there silently**: no
  error, and nothing in the UI names which database it reached. **Set `DATABASE_URL`
  explicitly wherever you can** — it wins the chain and it is unambiguous — and treat an
  unexplained `POSTGRES_URL` in an environment as a question rather than as furniture. This
  failure mode is new as of this order; it is recorded because nothing else would have.
- **Local and CLI behaviour is unchanged.** `.env.local` and every script under `scripts/`
  set `DATABASE_URL`, which still wins.
- **Blank-is-unset now also means "does not shadow".** A commented-out or emptied
  `DATABASE_URL` falls through to the next name instead of forcing demo mode.

## The two connection strings that are never read

The integration creates both. Neither is read anywhere, on purpose — and both are named in
`lib/db.ts:32-40` and `.env.example` because they are the first thing a reader debugging a
connection problem will reach for.

- **`POSTGRES_URL_NON_POOLING`** — the **direct 5432** connection, bypassing the pooler. On
  serverless it opens one real Postgres connection per invocation and holds it, so a burst of
  page renders exhausts the project's connection limit and the site starts erroring. The
  failure arrives under load, which is the worst time to learn it.
- **`POSTGRES_PRISMA_URL`** — the same pooled endpoint with Prisma-specific query parameters
  (`connection_limit`, `pgbouncer=…`) bolted on. This app uses postgres.js; those parameters
  mean nothing to it.

## The pooled port is verified, not trusted

**Medium confidence, and it must stay that way.** Vercel's marketplace page for the Supabase
integration states that `POSTGRES_URL` is the pooled transaction-pooler (`6543`) connection
and `POSTGRES_URL_NON_POOLING` the direct `5432` one
(<https://vercel.com/marketplace/supabase>). **Supabase's own integration doc lists the
variable names and says nothing about ports**
(<https://supabase.com/docs/guides/integrations/vercel-marketplace>). Two sources, one of
which is silent on the load-bearing detail. **Do not upgrade this to a fact** — the guard
below exists precisely because of that gap, and deleting it on the strength of one vendor
page would be trading a check for a hope.

`warnIfNotPooledPort()` (`lib/db.ts:81`), called from `getDb()`:

- Logs **one `console.warn` per process** when the resolved URI's port is not `6543`, naming
  **only the port and the variable it came from**. The URI carries the password, so this is
  the same no-leak rule that governs everything else here — but state the property precisely,
  because half of it is absolute and half is not (see the next bullet).
- **The absolute half.** On *any* input, the logged line can contain **no host, no user name,
  no database name, no project ref, no password body and no `postgresql://`.** That is not a
  measurement, it is structural: the only two values interpolated into the string are
  `conn.name` — a literal from `CONNECTION_VARS` — and WHATWG `URL.port`, which is digits or
  the empty string by construction. Nothing else from the URI is in scope at that line.
- **The half that is not absolute, with its counter-example.** "No part of the password can
  reach the line" is false as stated. WHATWG `URL` terminates the authority at the first `/`,
  so a password whose leading digits are followed by an **unencoded** `/` has those digits
  parsed as the port (re-measured in Node 22.7):

  ```
  postgresql://postgres.abcdefghij:12345/MyRealPassword@aws-0.pooler.supabase.com:6543/postgres
  → "DATABASE_URL points at port 12345, not the pooled 6543 …"
  ```

  For that input `URL` sees no `@`-terminated userinfo at all and reads `postgres.abcdefghij`
  as the **host** — which is still never printed. The exposure is bounded, and tighter than
  "digits only, ≤5 characters": the run must parse as a *valid* port, so `…:99999/…` and
  `…:123456/…` both throw `ERR_INVALID_URL` and log **nothing**; leading zeros are normalised
  away (`…:0123/…` prints `123`), so the value is not even a faithful prefix of the password;
  and a percent-encoded `/` (`…:12345%2FPw@…`) parses correctly and prints `6543`. A
  conforming postgres URI **must** percent-encode `/` inside a password, and
  Supabase-generated passwords are alphanumeric.
- **Decision: `lib/db.ts` is left as it is and the claim is qualified instead.** The printed
  value is `URL.port` — digits, at most five of them, numerically ≤65535 — and it reaches a
  **server log the owner already controls**, not a client response or a rendered page.
  Sanitising further would add a branch to the one function on every render's path, in
  exchange for at most five digits of a password that is malformed in the first place. The
  counter-example is written down here so the absolute form is not re-asserted later.
- **It does not throw.** `prepare: false` is unconditional, so a session-pooler or direct URI
  still works — and a site that is up on the wrong port beats a site that is down. The
  warning is a report, not a gate.
- **No explicit port is reported as `5432 (implicit, no port in the URI)`.** An implicit
  direct connection is the worst case of the three, so it is not allowed through unwarned.
  (t1's call; the plan did not specify it.)
- **An unparseable URI logs nothing at all**, deliberately: anything printed there would risk
  echoing the string, and postgres.js will fail on its own terms anyway.
- Once-per-process is flagged on `globalThis` (`__raidClashPortChecked`), for the same reason
  the pool lives there — a module-level flag would reset on every Next dev HMR reload and the
  warning would repeat per reload.

**Where to look for that line, and why absence is not proof.** Locally it is on the dev/CLI
console; on Vercel it is in the function runtime logs. Once per *process* means once per warm
serverless instance, so expect it at most once per cold start — **not seeing it in a log tail
does not mean the port is right.**

## What the Supabase↔Vercel integration creates

Researched and confirmed present at the gate (the owner's report from the Vercel project;
no agent has access to that dashboard). Thirteen names:

| Variable | What it is | This app |
|---|---|---|
| `POSTGRES_URL` | pooled connection URI (see the port caveat) | **read** — second in the chain |
| `POSTGRES_PRISMA_URL` | pooled + Prisma query params | never read |
| `POSTGRES_URL_NON_POOLING` | direct 5432 | never read |
| `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE` | the URI's parts | never read — the app never assembles a URI from parts |
| `SUPABASE_URL` | auth endpoint base | **read**, under this exact name |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_*` key | **read**, under this exact name |
| `SUPABASE_SECRET_KEY` | `sb_secret_*` key | never read — see the standing risk below |
| `SUPABASE_JWT_SECRET` | legacy symmetric signing secret | never read; this project's JWTs are asymmetric ES256, verified locally from JWKS (`docs/reference/auth.md`) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser-exposed duplicates | never read — do not start |

**Only the connection string needed mapping.** `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` already match what the app reads, because Phase 3b dropped the
`NEXT_PUBLIC_` prefix when it named them — a decision taken for a different reason (a
server-only value should not be named as browser-exposed) that happened to land on the
integration's names. Do not reintroduce the prefix to "match" the two `NEXT_PUBLIC_`
duplicates: reading those would inline the value into the client bundle, and
`lib/supabase/client.ts` deliberately does not exist.

`ADMIN_EMAIL` is not an integration variable. The owner sets it by hand, per environment.

**This list ages.** It is one snapshot of a third-party integration; if a deployment cannot
connect, read the project's actual variable list before trusting this table.

## `SUPABASE_SECRET_KEY` is in the environment (standing risk)

The integration puts the secret key in the Vercel environment. **The app never reads it**, and
nothing here needs it: page reads go over postgres.js as `postgres`, which owns all five
objects and has `rolbypassrls`, and sign-in needs only the publishable key.

It matters because of what it defeats. The secret key is `service_role` — it **bypasses RLS
and every grant migration `0002` revoked**. Phase 3a measured `anon`/`authenticated` grants
in `public` going 35 each → 0 and `relacl` down to `{postgres, service_role}`; that
`service_role` entry is full DML on all five objects, left in place by design. The secret key
is the one credential that walks straight through the lockdown.

Standing rules:

- **Never read it from application code.** Not in a route handler, not as a shortcut around
  `requireAdmin()`, not "temporarily" to debug a permission error.
- **Never give it — or any copy of it — a `NEXT_PUBLIC_` prefix.** If it reaches a browser the
  entire Phase 3a lockdown is moot.
- If it is not needed, deleting it from the environment is strictly safer than leaving it. It
  is left in place today only because the integration manages the variable set.

## Preview deployments read and write production data

**This section is a derivation, and the derivation is shown because the conclusion is now
carrying a bold warning in `README.md` and `CLAUDE.md`.** Premise (the owner's report at the
gate): there is one Supabase project, shared by production, previews and local dev.
Inference: **every preview deployment therefore resolves the same `POSTGRES_URL` as
production**, so a PR preview's import, Restore or Reset hits the clan's real rows. **What
would falsify it:** Vercel integration variables *can* be scoped per environment
(Production / Preview / Development), so a project where `POSTGRES_URL` is set for Production
only — or set to a different value for Preview — behaves differently. Nobody has checked
which is the case here; no agent on this project can open that dashboard. Treat the warning as
the safe reading of an unverified premise, and if it matters, read the variable's environment
scopes in the Vercel project. This was harmless while the tables were empty — the gate measured `members 0 · weeks 0
· clash_results 0 · clash_meta 0` — and it is not harmless now that the owner's 416
`clash_results` across 30 members and 7 weeks are in there.

Scope it honestly: **writes still require the admin session**, so this is not an exposure to
strangers. The risk is the owner running a destructive action from a preview URL believing it
is a sandbox. Nothing in the UI distinguishes the two.

- Do destructive things (Reset, Restore) on the **production** URL, deliberately, and export a
  backup first.
- Not taken, and recorded so it reads as a decision rather than an oversight: a second
  Supabase project for previews (doubles the setup and the free-tier footprint), or turning
  preview deployments off (they are the only pre-merge check this project has).

## Free-tier reality

- **No automated backups.** `GET /api/backup` is the only backup — admin-only, and gated as an
  exfil route rather than a read. The owner's most recent export, validated at this order's
  gate: `version 1`, `exportedAt 2026-08-12T09:14:02.231Z`, **30 members · 7 weeks · 416
  clash_results · 0 clash_meta**. Kept outside the repo.
- **A project pauses after roughly a week of inactivity.** A paused project is **not** demo
  mode and must never become it: the connection fails with something other than `42P01`, so
  `lib/data.ts` rethrows and `app/error.tsx` takes the page. That is the correct behaviour —
  the fix is to unpause, and rendering mock data would hide the need. See the demo-fallback
  invariant in `.claude/rules/database.md`; a paused project is exactly the case that would
  tempt someone to widen the allowlist.

## Rendering: what is static, and why that matters here

Measured with `npm run build` (Next.js 16.2.9, Turbopack; exit 0). Re-measured 2026-08-18,
when the bench route took the count to **seventeen**; every marker below is unchanged.
**The block below is real build output re-flowed into three columns to fit this page** — the
route names and their `○`/`ƒ` markers are verbatim, the layout is not. Diffing it line-by-line
against a fresh `npm run build` will show differences that are pure formatting; compare the
set of routes and their markers instead.

```
┌ ƒ /                     ├ ƒ /api/reset            ├ ○ /import
├ ○ /_not-found           ├ ƒ /api/restore          ├ ƒ /login
├ ƒ /api/backup           ├ ƒ /chimera              ├ ƒ /members
├ ƒ /api/import           ├ ƒ /hydra                ├ ƒ /members/[memberId]
├ ƒ /api/members/[memberId]/avatar                  ├ ƒ /settings
├ ƒ /api/members/[memberId]/bench                   └ ƒ /timeline
├ ƒ /api/members/[memberId]/results

ƒ Proxy (Middleware)
○ (Static) prerendered as static content · ƒ (Dynamic) server-rendered on demand
```

**The four `searchParams` data pages — `/`, `/hydra`, `/chimera`, `/timeline` — are dynamic only
because each one `await`s `searchParams` for its `?week=`.** None of those four declares
`export const dynamic = "force-dynamic"`; **among pages**, only `/settings`, `/login`,
`/members/[memberId]` and `/members` do. The fifth data page, `/members`, reads no
`searchParams` at all since 2026-08-13 and is held dynamic by that explicit declaration
instead (`app/members/page.tsx:17`; the worked example in `.claude/rules/rendering.md` records
why, and why a vestigial `await` kept "just to stay dynamic" was rejected).
(Seven `app/api/*/route.ts` files declare it too — `backup`, `import`,
`reset`, `restore`, `members/[memberId]/avatar`, `members/[memberId]/bench`,
`members/[memberId]/results` — so a
repo-wide grep returns eleven hits, not four. `next.config.ts` is empty, so `cacheComponents`
is off and nothing else is holding these pages dynamic either.) On a deployment the
consequence is sharper than locally: a page
that lost its `searchParams` would become statically prerendered and **bake one build's rows
— or the demo dataset, if the build environment had no connection string — into HTML served
to every visitor**, with no request-time read to correct it. Same class of accident Phase 3b
caught on `app/members/[memberId]/page.tsx`. The rule lives in `.claude/rules/rendering.md`
(scoped to `app/**`, so it loads for the files that can violate it); only its demo-fallback
consequence is restated in `.claude/rules/database.md`.

`/import` is intentionally static and must stay that way, which is why `isAdmin()` is never
read in `app/layout.tsx` (`docs/reference/auth.md`).

## Checking that a deployment actually reads the database

In order of strength:

1. **Clan Settings** names the data source outright. It is the one surface that answers the
   question directly.
2. **The demo dataset is Weeks 20–24** (`lib/mock-data.ts`). Week numbers outside that range
   cannot be demo data.
3. The port warning in the function logs, if the URI is not on `6543` — see why absence proves
   nothing above.

An HTTP 200 on any data page is not on this list.

## What is unverified

- **`POSTGRES_URL`'s port** — medium confidence, one silent source. The code checks it.
- **The integration's variable list and the Vercel project settings** (production branch,
  which variables exist, preview behaviour) are the **owner's report at the gate**. No agent
  on this project has access to the Vercel dashboard, and nothing in this doc was measured
  against the deployed runtime.
- **`npm run lint` still exits 1** with **9 errors + 1 warning** (3 in
  `components/ImportPanel.tsx`, the rest in untracked `.claude/scripts/*.js`). That is the
  approved baseline, not a regression introduced by deployment work.
