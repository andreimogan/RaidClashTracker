# Task ledger: phase3b-login-wall-public-reads-admin-writes

```yaml
order: "Phase 3b: the login wall — public reads, admin-only writes. Guard all six write/exfil routes, add a login page, hide write affordances from anonymous visitors."
status: done   # flow-reviewer PASS (0 CRITICAL, no security defect; forged-cookie attack failed in 10 states) + ux-specialist needs-work; both HIGHs and the accepted MEDIUMs folded in
created: 2026-08-12
branch: Dev
base_commit: 54a69f4
```

## Context pack

**Goal.** Six write/exfil routes are open to anyone who can reach the app. Phase 3a closed the *database* to the public key; this order closes the *application*. When it ships: an anonymous visitor sees every stat and **zero** write affordances, and all six routes return 401. **Nothing is deployed** (Phase 4) and **no real data enters Supabase** (Phase 4) — the live tables stay empty.

### Gate facts (verified 2026-08-12 — do not re-litigate)

- **Phase 3a holds:** all five `public` objects refuse the publishable key over PostgREST (401 / `42501`), RLS `true` on the four tables, `pg_policies` = 0, `anon`/`authenticated` grant rows = 0, view `reloptions` = `{security_invoker=on}`, tables 0/0/0/0.
- **Auth is ready:** exactly **1** confirmed user matching `ADMIN_EMAIL`, `disable_signup: true`, `email` the only provider, `mailer_autoconfirm: true`. **No owner dashboard action is required.**
- **The project uses asymmetric ES256 JWT signing keys** (`/auth/v1/.well-known/jwks.json` publishes one EC key), so `getClaims()` **local** verification is available — the pattern Supabase now prescribes over `getSession()`.
- **The `sb_publishable_*` key is sufficient throughout.** No legacy `eyJ…` anon key is needed (the platform mints short-lived JWTs from it); legacy keys are deprecated end-of-2026.
- **Pins, researched and cited: `@supabase/supabase-js ^2.112.3` and `@supabase/ssr ^0.12.4`.** The roadmap's `^0.7` was a **semver trap** — caret on a `0.x` version locks to that minor, so `^0.7` can never install `0.12.x` and would strand us eleven minors behind the full `getAll`/`setAll` cookie rewrite, the server-cookie-write dedup, and the PKCE verifier fixes. `^2.112.3` also clears the 2.110.4/.5 window where `assertSupportedApiKey()` **threw** on `sb_` keys. **Record the resolved versions from `node_modules` after install; do not trust these strings blindly.**
- **`middleware.ts` does not exist in Next 16.2.9 — the file is `proxy.ts`.** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`: *"The `middleware` file convention is deprecated and has been renamed to `proxy`"* (`v16.0.0`). A `middleware.ts` would be **silently ignored** — token refresh would never run and nothing would fail loudly. Same doc: a `runtime` export **throws** in a proxy file, the cookie contract is `request.cookies` / `NextResponse.cookies` (**not** `cookies()` from `next/headers`), and a proxy must not rely on shared modules.
- **Six gated surfaces, not seven** — six `route.ts` files, and `grep "use server"` across the repo returns **zero**, so there are no existing Server Actions to guard.
- **Token refresh is ours to run:** `createServerClient` sets `autoRefreshToken: false`. The proxy *is* the refresh mechanism; drop it and sessions expire silently.
- **The proxy cannot protect route handlers or Server Actions.** Next's docs: *"Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."* This is why authorization lives in per-route guards, not a matcher.
- **Env vars renamed by the orchestrator before dispatch** (values untouched): `NEXT_PUBLIC_SUPABASE_URL` → **`SUPABASE_URL`**, `NEXT_PUBLIC_SUPABASE_ANON_KEY` → **`SUPABASE_PUBLISHABLE_KEY`**. Free to do because nothing in the app read them yet, and a `NEXT_PUBLIC_` prefix on a server-only value is a misleading name that would invite a later mistake. `ADMIN_EMAIL` and `DATABASE_URL` unchanged.

### Owner decisions binding on this order

1. **Sign-in is a server-only Server Action.** No Supabase client in the browser; the publishable key never enters the bundle. Verified from `@supabase/ssr` source that `createServerClient` registers an `onAuthStateChange` listener and writes session cookies itself on `SIGNED_IN`. **This is assembled from documented parts, not a pattern Supabase publishes end-to-end** — their own shipped Next.js block is browser-side.
2. **The owner verifies the signed-in paths; the team verifies everything else.** Nobody has the owner's password and **no task may seek it**. Consequence, stated plainly: **the success branch of login — cookie write and session persistence — ships unexercised.**
3. **Pre-approved fallback, no new gate needed:** if the owner's first login fails or the session does not persist across a page load, switch `app/login/` to Supabase's documented **browser-client** pattern (one client component plus `lib/supabase/client.ts`). Do not debug undocumented territory.
4. **Signed-in-non-admin → 401 is not exercised**, by owner choice. It is reasoned from code: a trimmed, case-insensitive compare against `ADMIN_EMAIL` returning the identical 401 body.

### SEAM A — `lib/supabase/server.ts` (t1)

`export async function createServerSupabase()` — `createServerClient` from `@supabase/ssr`, cookies wired via `getAll`/`setAll` from `await cookies()`, `setAll` wrapped in `try`/`catch` because cookie writes throw during a Server Component render. **`lib/supabase/client.ts` is deliberately NOT created.** `proxy.ts` does **not** import this file.

### SEAM B — `lib/auth.ts` (t1 defines; t2 and t3 consume). Exactly two exports.

```
isAdmin(): Promise<boolean>                    // NEVER throws. false on any doubt.
requireAdmin(): Promise<NextResponse | null>   // null = admin; otherwise a 401 to return.
```

Guard call, **verbatim, as the first statement of every handler body** — before `await params`, before `request.json()`, before any `try`:

```
const denied = await requireAdmin();
if (denied) return denied;
```

Frozen 401 body — matches the `{ ok, error }` shape all four client components already render off `data.error`:

```
{ ok: false, error: "Sign in as the clan admin to do that." }
```

- **`requireAdmin` RETURNS, never throws.** A throw becomes a 500 with a Next digest, not the 401 JSON this order promises.
- **Fail closed in all six states:** `ADMIN_EMAIL` unset · blank · mismatched · Supabase env unset · auth network error · `user.email` null or unconfirmed.
- Email compare **trimmed and case-insensitive**. A **signed-in non-admin gets the identical 401 body**, so the response never reveals whether an account exists.
- Wrapped in React `cache()` so a page reading it twice makes one auth call. `import "server-only"` at the top.
- **A non-throwing `isAdmin()` makes the root-layout hazard moot — but it still stays out of `app/layout.tsx`**, for a second independent reason: `cookies()` is a request-time API, so reading it there would opt **every** route into dynamic rendering and undo Phase 1's static `/import`.

### SEAM C — how `isAdmin` reaches components (t3)

Read **per page, in exactly the two server pages that render write affordances**: `app/settings/page.tsx` and `app/members/[memberId]/page.tsx`. Verified exhaustively — `DataManagement` and `ImportPanel` are used only by the former; `AvatarEditor` and `MemberHistoryTable` only by the latter. Frozen computation and prop in both:

```
const readOnly = !(await isAdmin()) || source === "demo";
```

Prop name is **`readOnly: boolean`** on all four components (existing precedent — do not invent a second name). **The two reasons must be distinguishable in the copy**: *"sign in"* when the cause is anonymity, *"connect the clan database"* when it is demo mode. `components/ExportButton.tsx` needs no gate — it builds CSV client-side from props already on the page.

### SEAM D — `proxy.ts` (t1)

Root-level `proxy.ts`, exports `proxy`, **no `runtime` export**. Uses `request.cookies` / `NextResponse.cookies`. **Refreshes tokens and never blocks** — no redirect, no 401, no rewrite on any path. Matcher excludes `_next/static`, `_next/image`, favicon and `/api`. **No-ops when the Supabase env vars are absent.** Does not touch `lib/db.ts`'s pool or import `lib/supabase/server.ts`.

### Binding constraints

1. **No task lists `data/` in its `owns`.** `data/clash.db` ends byte-identical at md5 `8ee3eae9651cd860b90c0abff758d497` (it is held open by the owner's dev server — hash a **copy** if a direct hash fails).
2. **Live Supabase tables end empty** (0/0/0/0). Verification may seed/write; clean up and prove it.
3. **No credential in any tracked file** — connection string, password, project ref, pooler host, the publishable key value, **and `ADMIN_EMAIL`'s value** (a new secret class this phase introduces: the owner's personal address). Placeholders everywhere; sweep all git-visible files.
4. **`AGENTS.md`:** this Next version differs from training data. Any task touching a route, layout, file convention or request-time API **must** read the relevant guide under `node_modules/next/dist/docs/` first and name the file in its changelist. This is not a formality — it is how `proxy.ts` and `unstable_retry` were caught.
5. **No test suite** — `npm run build` is the verification. Build green at every wave boundary.
6. **Measure the `npm run lint` baseline before any edit.** Last measured `10 problems (9 errors, 1 warning)` — 3 in `components/ImportPanel.tsx`, the rest in untracked `.claude/scripts/*.js` — but measure, don't inherit.
7. **Vocabulary sweep uses `-i`, never `-I`** (capital I means "skip binary" and silently makes the sweep case-sensitive; three Phase 2 agents made exactly that mistake). Exclude `node_modules/**`, which legitimately contains `middleware`. Carve-outs: lines marking a decision superseded, and lines *citing* Next's deprecation of `middleware`.
8. **Teardown discipline.** Reach connection-error states via an **unroutable loopback** (`127.0.0.1:6544`) — **never a wrong DB password**, which trips Supabase's pooler circuit breaker (`XX000 ECIRCUITBREAKER`) and refuses **all** new connections project-wide for ~75–100 s. Reach auth-failure states via a **bogus `ADMIN_EMAIL`** (a pure string compare, zero network) rather than repeated bad sign-ins. Kill servers **by port, then verify the port is free**. Kill a headless browser **by PID or profile, never by image name**. **The owner's dev server is on `:3000` — untouchable.** Use 3007+, one port per task.

### Non-goals — do not re-litigate

Deploying anything, Vercel, merging `Dev`→`main` (**Phase 4**) · importing the owner's real 416 rows (**Phase 4**) · rate limiting, avatars→Storage, `/settings`'s duplicate query pass, `keys_used`→`smallint`, lightening `--color-faint` (**Phase 5**) · demo-labelling on the other six pages and the connected-but-empty empty states (**its own deferred order**; binding constraint there: do **not** add `getDataSource()` to `app/layout.tsx`) · creating any RLS policy · editing `supabase/migrations/0001_init.sql` or `0002_lock_down_public_api.sql` (applied) · the post-Reset calendar week default (**accepted debt by owner decision — do not "fix" without asking**).

## Cost forecast

**Estimate 30M tokens** (range 22–40M) ≈ **$22–32** run in the current session. ~9 dispatches × ~3.5M all-in + report/commit. **Basis: measured trend** — all-in cost per dispatch rose from ~1.1M in Phase 2 (session ~50M) to ~3.5M in Phase 3a (session ~75M), because main-session re-processing scales with accumulated context; subagents themselves are ~3% of the total. **The same work in a fresh session costs roughly 12M ≈ $9–13** — this ledger is written to be read cold precisely so that option stays open at any wave boundary. Assumes zero cache breaks (hold one model).

## Tasks

### t1 — The auth seam: Supabase server client, `lib/auth.ts`, `proxy.ts`, dependencies
- **agent:** `flow-implementer` · **wave 1** · **depends_on:** none · **docs_touched:** none *(all docs are t4's)*
- **owns:** `lib/supabase/server.ts` *(new)* · `lib/auth.ts` *(new)* · `proxy.ts` *(new)* · `package.json` · `package-lock.json` · `.env.example`
- **done_when:**
  1. **Before writing any pin:** `npm install` the two packages, then record the **resolved** versions from `node_modules/@supabase/*/package.json` in the changelist. State whether `@supabase/ssr`'s `peerDependencies` are satisfied.
  2. **Read `proxy.md` and `04-functions/cookies.md` under `node_modules/next/dist/docs/` before writing, and name both in the changelist.** The file is `proxy.ts` at the repo root exporting `proxy`; it exports **no** `runtime`; it uses `request.cookies` / `NextResponse.cookies`.
  3. SEAM A implemented; **`lib/supabase/client.ts` does not exist.**
  4. SEAM B implemented with **exactly two exports**, `import "server-only"`, and `cache()`. `grep -rn "@/lib/auth" components/` → nothing.
  5. **`isAdmin()` never throws — prove all six fail-closed states return `false`** and paste the results: `ADMIN_EMAIL` unset · blank · mismatched · Supabase env unset · **`SUPABASE_URL` pointed at `http://127.0.0.1:6544`** · no session cookie. **Do not test by repeating bad sign-ins.**
  6. `requireAdmin()` returns a `NextResponse` with status **401** and the frozen body in all six states, and `null` for the admin case. Never throws.
  7. SEAM D implemented. `grep -nE "401|redirect|rewrite|runtime" proxy.ts` → nothing. **Verify it no-ops with the Supabase env vars unset**: start the server and confirm all six data pages still return 200.
  8. **No Supabase HTTP data access anywhere:** `grep -rnE "\.from\(|/rest/v1" lib/ proxy.ts` → nothing. The Supabase client is used for `auth.*` only.
  9. `.env.example` documents `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `ADMIN_EMAIL` with **placeholders**, one line each on what happens when unset (fail closed → every write 401s). No `NEXT_PUBLIC_` prefix, no real values.
  10. `npm run build` exit 0 **with no other task landed** (t1 adds only new modules plus a passive proxy) · `npm run lint` no new errors vs the baseline measured in step 1 · `md5 data/clash.db` unchanged · credential sweep across all git-visible files → 0 hits.

### t2 — Guard all six handlers and stop the four driver-message leaks
- **agent:** `data-pipeline-specialist` · **wave 2** · **depends_on:** t1 · **docs_touched:** none
- **claimed_by:** `data-pipeline-specialist` (wave-2 run, 2026-08-12) · **state:** done
- **owns:** `app/api/import/route.ts` · `app/api/restore/route.ts` · `app/api/reset/route.ts` · `app/api/backup/route.ts` · `app/api/members/[memberId]/avatar/route.ts` · `app/api/members/[memberId]/results/route.ts`
- **done_when:**
  1. All six handlers open with SEAM B's two-liner as the **first statement of the body**. `grep -rl "requireAdmin" app/api` → **6 files**. *(This grep is satisfiable at your seam: t2 owns every file under `app/api/`.)*
  2. **Anonymous refused on all six, measured over HTTP** and pasted: `POST` to `import`, `restore`, `reset`, member `avatar`, member `results`, and **`GET /api/backup`** → **401** with the frozen JSON body, and **no database query issued** (confirm from the server log). `/api/backup` must return 401, **not** a JSON attachment.
  3. **The four leak sites sanitized** — `restore`, `import`, member `results`, member `avatar` — following `app/api/reset/route.ts`'s existing `resetError()` pattern. Proved with an **unroutable-loopback `DATABASE_URL`**: each response body contains **0** occurrences of `postgresql://`, `pooler`, `supabase`, the project ref, the host or the password, while still naming an actionable PG code where one exists.
  4. **`/api/import`'s and member `results`' validation messages survive verbatim.** Send a deliberately invalid payload to each and paste the 400 body — the normalizer / `ValidationError` copy must be unchanged, and a duplicate-key CSV must still behave as `docs/reference/data-pipeline.md` documents. **State explicitly that this reopens a declared Phase 5 non-goal and how the catch was split** (driver-shaped errors sanitized, validation preserved).
  5. `app/api/backup/route.ts` gains a `try`/`catch` returning a sanitized error rather than throwing unhandled.
  6. **The admin path is not verifiable here** (no credentials — see owner decision 2). Verify instead that the guard is the **only** added early return, and that with `requireAdmin` stubbed to `null` in a scratch copy **outside the repo** every handler still behaves exactly as at `54a69f4`. Report what you could and could not exercise.
  7. `npm run build` exit 0 · `npm run lint` no new errors · `md5 data/clash.db` unchanged · live tables end **empty** · vocabulary sweep (`-i`) over the six owned files.

### t3 — Login page, admin-gated write affordances, and a third read-only reason
- **agent:** `ui-design-specialist` · **wave 2** · **depends_on:** t1 · **docs_touched:** `docs/reference/design-system.md` **only if** a new token or primitive is introduced (criterion 9)
- **owns:** `app/login/**` *(new)* · `app/settings/page.tsx` · `app/members/[memberId]/page.tsx` · `components/DataManagement.tsx` · `components/ImportPanel.tsx` · `components/AvatarEditor.tsx` · `components/MemberHistoryTable.tsx`
- **done_when:**
  1. **`isAdmin()` is read in exactly two files** — the two pages in SEAM C — and nowhere else. `grep -rn "isAdmin" app/ components/` returns hits only inside this `owns` set. **`app/layout.tsx` is in no `owns` set and must not be touched**; confirm `git diff --stat app/layout.tsx` is empty.
  2. `readOnly` computed per SEAM C in both pages and threaded to **all four** components. `grep -n "readOnly" components/{DataManagement,ImportPanel,AvatarEditor,MemberHistoryTable}.tsx` → each file has it. **`AvatarEditor` has no read-only prop today** and its caller already computes `readOnly` ~96 lines above the call site — a one-prop omission.
  3. **Anonymous on a live database, verified in the rendered DOM** (headless, `next start` on 3008): `/settings` renders **0** occurrences of "Reset database", "Restore from backup" and "Export backup", and the Import tab shows a signed-out explanation linking to `/login` instead of the panel. `/members/<id>` renders **0** `aria-label="Edit W…"` pencils and **0** avatar camera/remove controls. The `<a href="/api/backup">` exfil link is **hidden, not disabled** (`.claude/rules/ux.md`).
  4. **Three distinct read-only reasons, three distinct copies.** `MemberHistoryTable`'s note (and `AvatarEditor`'s new equivalent) must say **"sign in"** when the cause is anonymity and **"connect the clan database"** when it is demo mode — never the demo sentence on a live database. Render both states and grep the DOM to prove it.
  5. `app/login/**`: sign-in runs through a **Server Action** (`"use server"`), because `cookies().set` is unavailable during a page render — **cite `cookies.md`**. A wrong password shows an in-place `text-xs text-down` error and **never reveals whether the address exists**. Sign-out is reachable from `/settings` when signed in.
  6. **No data write may go through a Server Action** — every mutation stays on the existing routes so `requireAdmin()` remains the single choke point. `grep -rn '"use server"' app/ | grep -v app/login/` → nothing.
  7. **The wrong-password path is exercised** (at most 2–3 attempts with an obviously fake address, **never looped**): the action runs, GoTrue is reached, the in-place error renders, and the DOM contains no credential and no account-existence signal. **The success branch cannot be verified — say so plainly** (owner decision 2) and note the pre-approved fallback.
  8. `/login` renders when the Supabase env vars are **unset** — explaining the misconfiguration rather than 500ing.
  9. Existing tokens/primitives only; `grep -rnE "#[0-9a-fA-F]{3,8}"` over the owned set → nothing. State whether any new token or primitive was introduced; if none, say so and leave `design-system.md` unowned. **Note `text-faint` measures ~3.05:1 and cannot pass WCAG AA at any size used here** — never use it for anything the reader needs.
  10. `npm run build` exit 0 · `npm run lint` no new errors · `md5 data/clash.db` unchanged · **leak check on every rendered DOM**: 0 hits for `postgresql://`, `pooler`, `supabase`, the key value, the project ref, and `ADMIN_EMAIL`'s value.

### t4 — Reconcile the knowledge layer against what was actually built
- **agent:** `flow-implementer` · **wave 3** · **depends_on:** t1, t2, t3 · **docs_touched:** `docs/reference/auth.md`, `docs/project-map.md`, `CLAUDE.md`, `README.md`, `.claude/rules/database.md`, `.claude/rules/data-pipeline.md`, `.claude/rules/ux.md`, `.claude/conventions/source-registry.md` *(corrected mid-order — I originally declared 2 of the 8 files my own criteria 1–5 require, so a doc-sync verdict keyed to this field would have under-counted the wave. Raised by t4.)*
- **claimed_by:** `flow-implementer` (wave-3 run, 2026-08-12) · **state:** done
- **owns:** `docs/reference/auth.md` *(new)* · `docs/project-map.md` · `CLAUDE.md` · `README.md` · `.claude/rules/database.md` · `.claude/rules/data-pipeline.md` · `.claude/rules/ux.md` · `.claude/conventions/source-registry.md`
- **done_when:**
  1. **Every "unauthenticated" / "local use only" / "gate before any public deploy" claim is corrected** — the write routes are now guarded. Sweep `docs/project-map.md`, `CLAUDE.md`, `README.md` and `.claude/rules/data-pipeline.md`; a case-insensitive grep for `unauthenticated|must be gated|local use only|no accounts` across the owned files returns nothing.
  2. `docs/reference/auth.md` records SEAMs A–D **as built**, including the `proxy.ts`-not-`middleware.ts` fact **with its doc citation**, that `requireAdmin` returns rather than throws and why, the six fail-closed states, and that the proxy cannot protect route handlers (Next's own guidance).
  3. **`.claude/rules/database.md` gains the four RLS invariants Phase 3a measured**, written from that order's changelist numbers — *not* paraphrased from a plan. Enumerated because the Phase 3a reviewer raised their loss as HIGH-1: (a) **lever 4 revokes grants but not RLS**, so every future table needs its own `enable row level security`; (b) **`create or replace view` resets `reloptions`**, wiping `security_invoker`, so anything recreating `member_clash_averages` must re-assert it — and the file's existing clause holding `create or replace view` up as an idempotency mechanism needs that caveat; (c) **`supabase_admin`'s default ACL still grants `anon`/`authenticated` and needs superuser to change**, so **a table created through the dashboard Table Editor can be born open** — create tables via `supabase/migrations/` + `npm run db:migrate`; (d) **`alter default privileges` is scoped to the granting role.** Plus: **lever 4 is `ON TABLES` only** (functions and sequences still grant `anon`), **`service_role` retains full DML**, and the dashboard's **"RLS enabled, no policies"** advisory is the intended end state — resolving it with a policy is lever 1's documented failure mode.
  4. `.claude/rules/ux.md`'s state checklist covers **anonymous-on-live vs admin-on-live vs demo**, and records that the three read-only reasons need three distinct copies.
  5. **`.claude/conventions/source-registry.md` gains a Supabase section** — its absence forced this phase's research to lowest confidence. Include the vendor-primary pages actually used (API-key formats and deprecation, the SSR client contract, JWTs/`getClaims`), both packages' CHANGELOGs (the only place version-sensitive behaviour is recorded), and the npm registry endpoint for the peer-dependency floor. Record one dead path: Supabase docs source under `apps/docs/content/guides/**` on raw GitHub returns 404.
  6. **Every claim traceable to a t1–t3 changelist.** Anything you cannot verify from them is a finding to report, not prose to write.
  7. Markdown only: `npm run build` exit 0 and `npm run lint` **exactly** the recorded baseline · `md5 data/clash.db` unchanged · vocabulary sweep (`-i`) clean except the approved carve-outs.

### fA — Fix pass, slice A: demo-mode Admin Access card, login failure copy, login form focus/state, member-page cacheability
- **agent:** `ui-design-specialist` · **wave 4 (fix pass)** · **depends_on:** t1, t2, t3, t4 · **docs_touched:** none *(no new token or primitive; `.claude/rules/ux.md` is t4's file and already carries the demo-never-says-sign-in rule this slice enforces)*
- **claimed_by:** `ui-design-specialist` (fix-pass slice A, 2026-08-12) · **state:** done
- **owns:** `app/login/**` · `app/settings/page.tsx` · `app/members/[memberId]/page.tsx`
- **done_when:** the six accepted review findings land — (1) the Admin Access card becomes three-state off `source`/`signedIn` so demo mode never offers a `/login` link; (2) `app/login/actions.ts` names an unreachable sign-in service separately from rejected credentials, credentials copy unchanged; (3) the email field survives a failed attempt; (4) initial focus on email, `aria-busy` on the form, focus restored on error; (5) `export const dynamic = "force-dynamic"` on the member page with the reason; (6) the connected-but-empty instruction gated on `signedIn`. Existing tokens only, zero hex literals, no `text-faint` for needed text · build exit 0 · lint no new errors vs baseline · `md5 data/clash.db` unchanged · leak check on every rendered DOM.

### fC — Fix pass, slice C: the split catch discriminates on shape, not type
- **agent:** `data-pipeline-specialist` · **wave 4 (fix pass)** · **depends_on:** t2 · **docs_touched:** none *(the pipeline living doc and `.claude/rules/data-pipeline.md` are t4's / unowned — see the escalation in my changelist)*
- **claimed_by:** `data-pipeline-specialist` (fix-pass slice C, 2026-08-12) · **state:** done
- **owns:** `app/api/import/route.ts` · `app/api/restore/route.ts`
- **done_when:** one accepted `flow-reviewer` MEDIUM finding lands — the two catches stop deciding "driver vs validation" from `typeof err.code === "string"` and use a **type/provenance** test first, the way `app/api/members/[memberId]/results/route.ts` already does with `instanceof ValidationError`. Validation copy byte-identical (re-run t2's payloads) · driver errors still sanitized under an **unroutable loopback** (never a wrong password) · status codes unchanged (t2's D1) · `42P01` still maps to the `npm run db:migrate` hint · the `requireAdmin()` two-liner untouched as the first statement of each body · build exit 0 · lint no new errors vs a freshly measured baseline · `md5 data/clash.db` unchanged · live tables left empty.

<!-- doc-sync note for flow-reviewer: t1-t3 carry empty docs_touched BY DESIGN. Every doc sits in
     t4, which runs in its own wave AFTER the code specifically so it is written against measured
     reality — this is the deliberate fix for Phase 2's largest integration cost, where t3's prose
     was written a wave before t4's code and diverged. Verify doc-sync for the whole order against
     t4, and specifically that t4's claims match what t1-t3 actually shipped.
     docs/reference/design-system.md is unowned unless t3 introduces a new token or primitive —
     its criterion 9 requires stating either way. Verify that; don't assume it. -->

**Ownership check:** 4 tasks, 24 path entries, **zero overlap**. `data/` appears in no `owns`. Unowned and not to be edited: **`app/layout.tsx`** (binding — see SEAM B), `components/Sidebar.tsx`, `components/ExportButton.tsx`, `lib/db.ts`, `lib/data.ts`, `lib/persist.ts`, `lib/backup.ts`, `lib/results.ts`, `lib/members.ts`, `lib/compute.ts`, `lib/types.ts`, `supabase/migrations/**` (applied), `scripts/**`, `docs/reference/data-pipeline.md`, the five other pages, and the remaining components.

## Waves

**Wave 1: t1.** Green in isolation — only new modules plus a passive `proxy.ts`, nothing existing imports them.

**Wave 2: t2 + t3 in parallel.** The boundary is **structural, not stylistic**: both consume `lib/auth.ts`, and unlike Phase 2 there is no old `requireAdmin` for a new call site to type-check against, so the forward-compatible trick does not apply. t2 (6 route files) and t3 (7 UI files) are disjoint.

**Wave 3: t4.** Markdown only, deliberately last.

## Verification

**Proven by the team, required in `done_when`:** all six routes 401 to anonymous with no DB query · every fail-closed state denies · the wrong-password path renders an in-place error with no leak and no account enumeration · anonymous DOM has zero write affordances · `/login` renders with env unset · the proxy no-ops without env and all six pages still 200 · Phase 3a's PostgREST refusals still hold (regression) · build, lint, md5, credential sweep, tables empty.

**The owner's acceptance test — the only path neither side can prove first:** log in as admin → edit a member week → export a backup → log out. **A failed login triggers the pre-approved browser-client fallback** (owner decision 3).

**Not exercised, by owner choice:** signed-in-non-admin → 401.

## Orchestrator decisions during the order

**`/login` has no sidebar entry, and that is accepted as designed** (raised by t3 as a scoping gap — `components/Sidebar.tsx` is in no task's `owns`). Routes in exist from `/settings` and the member pages via the four in-page links t3 added; what is missing is a link from `/`, `/hydra`, `/chimera`, `/timeline` and `/members`. Keeping it that way on purpose: there is exactly **one** account, signups are disabled, and a public dashboard that advertises a login door invites probing it. The owner reaches `/login` directly or from Settings. **Recorded so a later slice does not "fix" it by adding a sidebar link without asking** — if the owner ever wants one, that is a deliberate change, not a repair.

**t2's D2 copy regression is accepted**, conditional on t3's gating, which landed: in demo mode the avatar route no longer surfaces `getDb()`'s "DATABASE_URL is not set…" sentence (that error carries no `.code`, so the no-echo branch takes it). t3 removed the avatar control from the tree entirely when `readOnly`, so the path is unreachable from the UI. `restore` still carries the actionable message. Verify the unreachability rather than assuming it.

**t2's D3 duplication is a `maintainer` item, not a defect:** four near-identical local error mappers exist because t2 owns no file in `lib/`. Correct ownership discipline producing mild duplication — extracting `lib/http-errors.ts` belongs to a later sweep.

**t3's SEAM C deviation is accepted:** `await isAdmin()` is hoisted to a `signedIn` const because the reason-copy needs the same boolean, so the frozen expression is present semantically (`!signedIn || source === "demo"`) but **a literal grep for SEAM C's string will not match** — reviewers should check the semantics, not the text. Its precedence call is also accepted and worth keeping: **when both reasons apply, demo mode wins the copy**, because it is the blocker that survives signing in.

## Changelist

### t1 — `state: done`

**Implemented by the orchestrator in the main session, not by a subagent.** Three consecutive `flow-implementer` dispatches died on transient `API Error: 529 Overloaded` — twice as a resume, once as a fresh agent with a deliberately leaner brief, so it was capacity rather than request size. The tree was verified clean after each failure (no files written, no packages installed, `package.json`/`package-lock.json` untouched), so there was no partial state to unwind. Recorded because it departs from the operating recipe's agent flow; the ledger, seams and `done_when` were followed unchanged.

**Files:** `lib/supabase/server.ts` *(new)* · `lib/auth.ts` *(new)* · `proxy.ts` *(new)* · `.env.example` · `package.json` + `package-lock.json` (dependencies only).

**Resolved versions, from `node_modules` after install:** `@supabase/supabase-js` **2.112.3**, `@supabase/ssr` **0.12.4**. `ssr`'s `peerDependencies` declares `@supabase/supabase-js: ^2.111.0` — satisfied.

**Next docs read and cited (`AGENTS.md` requirement):**
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — `:11` and version history `:774` confirm the `middleware` → `proxy` rename in `v16.0.0`; `:58` "must export a single function, either as a default export or named `proxy`"; the **"## Runtime"** section: *"The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error"*; `:19` *"you should not attempt relying on shared modules or globals"*. Also found, and it independently justifies the per-route guard design over a matcher: *"A matcher change or a refactor that moves a Server Function to a different route can silently remove Proxy coverage. Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."*
- `.../04-functions/cookies.md` — *"`cookies` is a Request-time API … Using it in a layout or page will opt a route into dynamic rendering"* (SEAM B's second, independent reason for keeping `isAdmin` out of `app/layout.tsx`), and *"Setting cookies is not supported during Server Component rendering"* (why `setAll` is wrapped in `try`/`catch`, and why sign-in must be a Server Action).

**Proof the file name matters:** `npm run build` reports **`ƒ Proxy (Middleware)`**. A `middleware.ts` would produce no such line **and no error** — the silent-ignore failure mode the ledger warns about, now positively confirmed rather than assumed.

**`getClaims()` over `getUser()`, `getSession()` rejected.** auth-js is explicit that with cookie storage the session's user object *"must not be trusted"* and must be verified via `getClaims()` (`GoTrueClient.d.ts:1413`). The project's ES256 keys make that verification **local** — no network call per check. Types confirmed before use: `getClaims()` returns `{ data: { claims: JwtPayload, header, … }, error }`, and `JwtPayload` (`auth-js/.../lib/types.d.ts:1660-1694`) carries a **required** `role` plus optional `email` and `is_anonymous`. The check therefore requires `role === "authenticated"`, `is_anonymous !== true`, and a string `email` matching `ADMIN_EMAIL` trimmed and case-insensitively. **Accepted tradeoff, documented in the file:** a token stays valid until it expires, so deleting or banning the account does not revoke an already-issued one. Acceptable for a single-admin dashboard; `getUser()` is the swap if that ever changes.

**Fail-closed states — measured through a real request context**, since `isAdmin()` uses `next/headers` and cannot be called from a script. Every state returned `isAdmin: false` and a `401` with the frozen body `{"ok":false,"error":"Sign in as the clan admin to do that."}`, and **nothing threw**:

| State | Result |
|---|---|
| all env set, **no session cookie** | false / 401 |
| `ADMIN_EMAIL` blank | false / 401 |
| `ADMIN_EMAIL` mismatched | false / 401 |
| `SUPABASE_URL` + key unset | false / 401 |
| `SUPABASE_URL` = `http://127.0.0.1:6544` (unroutable) | false / 401 |

**Honest note on the sixth state:** *unset* was not exercised separately from *blank* because they are the **same code path** — `process.env.X?.trim()` yields `undefined` for unset and `""` for blank, both falsy, both taking the identical branch. Claiming two tests where the code has one branch would be padding.

**Verification method, and its cleanup:** a temporary probe route was needed to reach a request context. First attempt was placed at `app/api/__t1probe/` and **404'd** — folders beginning with `_` are Next **private folders**, excluded from routing. Renamed to `app/api/t1probe/`, used, then deleted; `git status --porcelain app/` is **empty** and the probe no longer appears in the build output, so nothing of it survives in `app/`, which t1 does not own.

**Proxy behaviour:** with the Supabase env vars unset it no-ops and **all six data pages still return 200** — reads stay public and a missing configuration cannot cost a page render. `grep` confirms no `NextResponse.redirect`, no `rewrite`, no `401` and **no `runtime` export**. Its only imports are `@supabase/ssr` and `next/server`; it does not import `lib/supabase/server.ts` or touch `lib/db.ts`'s pool.

**SEAM conformance:** `lib/auth.ts` exports exactly `isAdmin` and `requireAdmin`. `lib/supabase/client.ts` and `middleware.ts` **do not exist**. No `.from(` or `/rest/v1` anywhere in code, and no `NEXT_PUBLIC_` in any non-comment line — each of those three greps initially returned a hit, and each was confirmed to be explanatory comment text by re-running against comment-stripped sources rather than eyeballing it.

**One contract detail added, not varied:** `createServerSupabase()` returns `ServerSupabase | null`, `null` when the Supabase env vars are absent. SEAM A named the export but not its nullability; returning `null` is what lets `isAdmin()` honour "never throws" without wrapping a construction failure. Flagged for the reviewer.

**Close-out:** `tsc --noEmit` clean · `npm run build` exit 0 · `npm run lint` **`10 problems (9 errors, 1 warning)`**, identical to the baseline measured before editing · `md5 data/clash.db` = `8EE3EAE9651CD860B90C0ABFF758D497` unchanged · credential sweep over **149** git-visible files against 6 tokens read from `.env.local` → **0 hits** · every test port torn down by port and confirmed free · owner's `:3000` untouched.

**`.env.example`** documents `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `ADMIN_EMAIL` with placeholders, states that the secret key must never be used, spells out that **every missing-config case fails closed** (writes locked, reads unaffected), and records that signups must stay disabled in Supabase for `ADMIN_EMAIL` to mean anything.

### t3 — `state: done`

**Files:** `app/login/page.tsx`, `app/login/actions.ts`, `app/login/LoginForm.tsx` *(all new)* · `app/settings/page.tsx` · `app/members/[memberId]/page.tsx` · `components/DataManagement.tsx` · `components/ImportPanel.tsx` · `components/AvatarEditor.tsx` · `components/MemberHistoryTable.tsx`. **No doc touched** — no new token or primitive was introduced (criterion 9), so `docs/reference/design-system.md` stays unowned. `app/layout.tsx`: `git diff --stat` **empty**.

**Next docs read and cited (`AGENTS.md` requirement).** `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`, quoted in `app/login/actions.ts` and in both pages:
- `:80` — *"**Setting cookies** is not supported during Server Component rendering. To modify cookies, invoke a Server Function from the client or use a Route Handler."* Also `:73` — *"HTTP does not allow setting cookies after streaming starts, so you must use `.set` in a Server Function or Route Handler."* This is why sign-in is a Server Action and cannot be a page render.
- `:69` — *"`cookies` is a Request-time API whose returned values cannot be known ahead of time. Using it in a layout or page will opt a route into dynamic rendering."* Quoted at both `isAdmin()` call sites as the reason it is not in the root layout. Confirmed against the build: **`/import` is still `○` (Static)** after this task, byte-for-byte the same route classification as the pre-task baseline; only `/login` is added, as `ƒ`.
- `01-app/01-getting-started/07-mutating-data.md` — the `useActionState` pending pattern, and the warning that *"Server Functions are reachable via direct POST requests, not just through your application's UI"*, which is the argument recorded in `actions.ts` for keeping every data write on the route handlers.
- `01-app/03-api-reference/04-functions/redirect.md:50` — *"redirect should be called **outside** the `try` block"*; the sign-in action has no `try`, and `redirect` is its last statement.

**SEAM C, as built — one deviation, stated plainly.** SEAM C froze `const readOnly = !(await isAdmin()) || source === "demo";`. Once the copy has to distinguish the two causes, the boolean is needed twice, so `await isAdmin()` is hoisted:

```ts
const source = await getDataSource();
const signedIn = await isAdmin();
const readOnly = !signedIn || source === "demo";              // SEAM C, expanded
const readOnlyReason = source === "demo" ? "demo" : signedIn ? null : "anonymous";
```

`!signedIn || source === "demo"` is the frozen expression with one sub-expression named; a **literal grep for SEAM C's string will not match**. (The alternative — calling `await isAdmin()` twice on adjacent lines and relying on `cache()` — reads like a bug.) `readOnlyReason: "anonymous" | "demo" | null` is a **second** prop on all four components; the frozen `readOnly: boolean` name is unchanged. **Precedence decision, mine, not the ledger's: demo wins when both apply**, because it is the blocker that survives signing in — telling a demo-mode visitor to sign in would send them to a dead end, since writes would then fail on the missing database. On a live database `source !== "demo"`, so the case the ledger cares about (anonymous + live) still gets the sign-in copy.

**Three read-only reasons, three copies, measured in the rendered DOM** (production `next start` on **3008**, headless Chrome over CDP in a scratch profile, DOM read after hydration — so these greps cover the SSR HTML, the flight payload and the client render):

| DOM | pencils `aria-label="Edit W…"` | avatar controls | demo copy | anonymous copy |
|---|---|---|---|---|
| `/members/m1` demo mode | 0 | 0 | 1 ("…demo data is read-only" + "Sample-data photo — connect the clan database…") | 0 |
| `/members/m1` anonymous, `source="postgres"` | 0 | 0 | 0 | 1 ("Editing a week needs the clan admin account" + `href="/login"` + "Sign in as the clan admin to change this photo") |

**Anonymous on the live database, `/settings` (both tabs, hydrated):** `Reset database` **0** · `Restore from backup` **0** · `Export backup` **0** · `/api/backup` **0** (the link is **not rendered at all** — hidden, not disabled, per `.claude/rules/ux.md`) · `Danger zone` **0** · `Type RESET` **0** · `textarea` **0** · `Choose .json file` **0**. The Import tab renders the signed-out explanation with `href="/login"`; the Overview tab renders the new **Admin Access** card ("Read-only — this browser isn't the clan admin") plus the same link. Demo mode renders the *other* copy in all three places and never the sign-in one.

**Wrong-password path — exercised once through the UI, not looped.** One submit of `nobody.definitely-not-a-real-account@example.com` / an obviously fake password. Result: stayed on `/login` (`location.pathname === "/login"`), and the DOM contains exactly `<p role="alert" class="whitespace-pre-line text-xs text-down">That email and password didn't match. Try again.</p>`. Zero occurrences of `invalid_credentials`, `Invalid login credentials`, `user_not_found`, `email_not_confirmed`, `AuthApiError`, the submitted address or the submitted password — **nothing distinguishes "wrong password" from "no such account"**.

**Honest limit on that test, and how it was closed.** The action collapses *every* `signInWithPassword` error into one message, so the DOM alone cannot prove GoTrue was actually reached — a network failure would look identical. Proven out of band with **one** direct request (second and last auth attempt of this task): `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` with the publishable key and the same fake credentials → **HTTP 400 in 0.15 s, body `{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}`**. So the auth server is reachable with this key, and **GoTrue itself does not enumerate accounts** either. Two attempts total, both hand-run.

**Not verifiable, per owner decision 2 — stated plainly:** the **success branch of sign-in ships unexercised**. Nobody here has the password and none was sought. Unexercised with it: the cookie write, session persistence across a page load, `redirect("/settings")` carrying `Set-Cookie`, the **Admin Access card's signed-in branch**, the **Sign out** form, and every admin-visible affordance (pencils, avatar buttons, import form, backup link) in its *rendered* state. If the owner's first login fails or the session does not persist, the pre-approved fallback is owner decision 3 (Supabase's documented browser-client pattern; do not debug).

**`/login` with the Supabase env vars blank:** renders **200**, no form (`name="password"` count **0**), and a gold misconfiguration card. All six data pages still 200 in that state (`/` `/hydra` `/chimera` `/timeline` `/members` `/settings`), `/import` still 307 → `/settings`.

**One copy change made for the leak check, worth a decision record.** The first version of that card named `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; the DOM then contained **4** case-insensitive hits for `supabase`, which criterion 10 forbids. Rather than argue the exception, the copy now points at `.env.example` (which carries the real variable names and is only read by whoever runs the server) and says so. `/login` is a **public** page, so it should not advertise which service handles sign-in. `NOT_CONFIGURED` in `actions.ts` was reworded the same way.

**Structural note — three components were split, not rewritten.** `DataManagement`, `ImportPanel` and `AvatarEditor` each keep their whole existing body in an inner component (`DataTools`, `ImportForm`, `AvatarUploader`) and gain a thin wrapper that switches on `readOnly`. Reason: an early `return` in front of `useState`/`useRef`/`useRouter` is a conditional hook call and would have added `react-hooks/rules-of-hooks` errors to the lint baseline. The split also means the file picker, the POST helpers and the pending state **do not exist in the tree at all** for a reader who could never save.

**Close-out:** `tsc --noEmit` clean · `npm run build` **exit 0** · `npm run lint` **`10 problems (9 errors, 1 warning)`**, identical to the baseline measured before editing, and the same three files (3 in `components/ImportPanel.tsx` — unchanged by the split — plus the two untracked `.claude/scripts/*.js`) · `md5 data/clash.db` (hashed via a copy) `8ee3eae9651cd860b90c0abff758d497` **before and after** · hex-literal grep over the owned set → **none** · **no new `text-faint`** in any existing file (the one occurrence in new code is `placeholder:text-faint` inside the shared input class, on inputs that set **no** placeholder, so nothing renders in it) · leak check on **all seven** captured DOMs → **0** hits for `postgresql://`, `pooler`, `supabase`, the publishable key, the project ref, `ADMIN_EMAIL`'s value, the DB password, the DB host and the whole `DATABASE_URL` · `grep -rn '"use server"' app/ | grep -v app/login/` → **nothing** (the only such file in the repo is `app/login/actions.ts`) · `isAdmin` imported and called in **exactly two files**; the two other `grep` hits in `app/login/` are prose in comments, zero calls · **live Supabase tables untouched — this task issued no write and no seed** · every test server killed **by PID, port then verified free**; headless Chrome killed by **PID tree** from its own scratch profile, never by image name; owner's `:3000` never touched.

**Findings on this ledger's scoping of t3 — three real, one minor.**

1. **Criterion 3 is unsatisfiable as written, and the ledger's own constraints are why.** It requires the *rendered DOM* of `/members/<id>` "anonymous on a live database", but binding constraint 2 keeps the live tables **empty**, and an empty dataset means `getMemberProfile` misses and the route `notFound()`s — measured: `/members/m-does-not-exist` → **404**, and `/members` renders **zero** member links against the live database. There is no member page to render. Seeding was rejected: it writes to the tables t2 is concurrently asserting empty, `/api/reset` is now guarded so I had **no cleanup path**, and a first read-only probe of the pooler from a script already hung for 3 minutes — the rule file's own warning against poking that connection. **What was done instead** (disclosed as a stub, not passed off as the real thing): the page's *input* was stubbed for one build — `const source: string = "postgres"; // TEMP-T3-STUB` — with the demo rows loaded, so the rendering is real (production build, real HTTP, hydrated DOM) while the data-source input is forced. The stub was reverted; `grep -rn "TEMP-T3-STUB" app/ components/` → nothing, and the final build carries `await getDataSource()`.
2. **`/login` has no navigation entry point.** `components/Sidebar.tsx` is unowned by every task in this order, so the only routes to the sign-in page are the four in-page links added here (Admin Access card, Data Management note, locked Import tab, member history note). A signed-out visitor on `/`, `/hydra`, `/chimera`, `/timeline` or `/members` has **no visible way** to sign in — they must know to go to `/settings` or type `/login`. That is a real gap for the owner's own daily use and needs a Sidebar slice in a later order.
3. **Criterion 1's grep is looser than the invariant it is protecting.** `grep -rn "isAdmin" app/ components/` cannot distinguish a call from a comment. The checkable version is `grep -rn 'from "@/lib/auth"\|await isAdmin()' app/ components/`, which returns t2's six route imports plus exactly two page imports and two calls.
4. Minor: criterion 10's blanket ban on the string `supabase` collides with criterion 8's "explain the misconfiguration" whenever the explanation names the env vars. Resolved in favour of criterion 10 (see above), which is also the better security posture — but the two criteria should not be read as independent.

**Handoff notes for t4 / the reviewer.** (a) The `"anonymous" | "demo" | null` union is declared **four times**, once per component, because no shared types file was in this task's `owns`; `lib/types.ts` is the obvious home the day someone owns it. (b) The locked-state composition `rounded-xl border border-border bg-panel-2/40 p-4` + `Lock` icon + `text-sm text-muted` now appears **three** times and is a *pattern* (not a token or primitive) — a candidate for `design-system.md`'s Patterns section, deliberately not written by me because criterion 9 scoped that doc to new tokens/primitives only. (c) `components/ExportButton.tsx` was confirmed to need no gate: it builds its CSV in the browser from props already rendered on the page.

### t2 — `state: done`

**Files (all six, nothing else):** `app/api/backup/route.ts` · `app/api/import/route.ts` · `app/api/reset/route.ts` · `app/api/restore/route.ts` · `app/api/members/[memberId]/avatar/route.ts` · `app/api/members/[memberId]/results/route.ts`. `git diff --stat 54a69f4 -- app/api` = 6 files, +164/−24. `lib/persist.ts`, `lib/import.ts`, `lib/parse.ts`, `lib/results.ts`, `lib/backup.ts`, `lib/members.ts` and `app/layout.tsx` are untouched (empty diff, verified).

**Next doc read and cited (`AGENTS.md` requirement):** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — `:82` and `:319` confirm `params` is a **promise** (`Promise<{ memberId: string }>`, so `await params` stays), the **Segment Config Options** section confirms `export const runtime` / `dynamic` are valid in a route file (unlike `proxy.ts`, where `runtime` throws), and the version history confirms `GET` handlers default to **dynamic** since `v15.0.0-RC` — so `/api/backup`'s guard runs per request and can never be baked into a static response.

**The guard.** SEAM B's two-liner is the first statement of all six handler bodies — before `await params`, before `request.json()`, before any `try`. `grep -rl "requireAdmin" app/api` → **6 files**. Counting added early returns in `git diff 54a69f4 -- app/api` gives exactly **6** `if (denied) return denied;` lines; every other added `return` is inside a sanitizer helper or `/api/backup`'s new `try`. No `"use server"`, no `getDb()` and no raw SQL template anywhere under `app/api` — the pipeline is still the only writer.

**1. Anonymous refused on all six, measured over HTTP** (`next start -p 3009`, production build of the repo, full env from `.env.local` except `DATABASE_URL` overridden to the unroutable loopback):

```
GET  /api/backup                    401  application/json  content-disposition: null   52ms
POST /api/import                    401  application/json                              17ms
POST /api/restore                   401  application/json                               8ms
POST /api/reset                     401  application/json                               5ms
POST /api/members/m-cleon/avatar    401  application/json                               9ms
POST /api/members/m-cleon/results   401  application/json                               7ms
body (all six, byte-identical): {"ok":false,"error":"Sign in as the clan admin to do that."}
```

`/api/backup` returns the 401 JSON with **no `Content-Disposition`** — not an attachment.

**No database query issued, proved positively rather than by absence of a log line.** postgres.js logs nothing per query and `next start` logs no queries, so a TCP **witness** was run on `127.0.0.1:6544` (the loopback the overridden `DATABASE_URL` points at) that appends a timestamped line for every connection attempt. After the six anonymous requests its log held **only** its own startup line. Then the **positive control**: `GET /hydra` (a public read) immediately produced `DB-CONNECT-ATTEMPT from 127.0.0.1:50747` — so the witness does record attempts, and its silence during the six requests is evidence rather than a broken instrument. Response times (5–52 ms against a 15 s `connect_timeout`) corroborate it.

**2. The four leak sites sanitized, and the leak demonstrated first.** Reached through an **unroutable loopback** (`postgresql://nobody:nopass@127.0.0.1:6544/postgres`, nothing listening) — never a wrong password. At `54a69f4`, **11 of 21** probe responses contained `127.0.0.1:6544`, e.g. `{"ok":false,"error":"connect ECONNREFUSED 127.0.0.1:6544"}` from `import`, `restore`, member `results` and member `avatar`. That string is `host:port` because postgres.js builds connection errors as `write/connect <code> <host>:<port>` and attaches `code` / `errno` / `address` (`node_modules/postgres/src/errors.js:16-28`) — against the real database that is the pooler hostname, and a `28P01` message would carry the connection's user name, which embeds the project ref. After the change, the same 21 probes:

```
Backup failed — the database rejected it (code ECONNREFUSED).
Reset failed — the database rejected it (code ECONNREFUSED).
Import failed — the database rejected it (code ECONNREFUSED).
Restore failed — the database rejected it (code ECONNREFUSED).
Saving results failed — the database rejected it (code ECONNREFUSED).
Avatar update failed — the database rejected it (code ECONNREFUSED).
```

Leak scan over every response body, case-insensitive: `postgresql://` 0 · `pooler` 0 · `supabase` 0 · `6544` 0 · `127.0.0.1` 0 · the user `nobody` 0 · the password `nopass` 0. The actionable PG code survives, and `42P01` still maps to "run `npm run db:migrate`" in all four new mappers, exactly as `resetError()` does.

**3. Validation copy survives verbatim — and yes, this reopens a declared Phase 5 non-goal.** Phase 2's ledger deferred "**`/api/import`'s 400-with-`err.message` behaviour (Phase 5, deliberately deferred)**". Sanitizing that route's catch necessarily touches it, so instead of replacing the behaviour it was **split**:

- **driver-shaped error** = an object with a **string `.code`** (every postgres.js error has one — server errors carry the PG code, connection errors carry `ECONNREFUSED` / `CONNECTION_CLOSED`) → sanitized message, **status unchanged**.
- **everything else** (`ValidationError` from `lib/import.ts` / `lib/results.ts`, `restoreBackup()`'s own rejection copy, a `JSON.parse` failure) → `err.message` passed through **untouched**, status unchanged.

Measured over HTTP (same scratch server, `DATABASE_URL` empty so the normalizers are reachable):

```
POST /api/import   {"clashes":{}}                     400 {"ok":false,"error":"Missing or invalid \"week\" (need number, startDate, endDate)."}
POST /api/import   {week:{…},clashes:{dragon:[]}}     400 {"ok":false,"error":"Week 1: no clashes found (expected \"hydra\" and/or \"chimera\")."}
POST /api/import   {results:[{nope:1},{player:""…}]}  400 {"ok":false,"error":"Row 1: missing \"player_name\".\nRow 2: missing \"player_name\"."}
POST /api/import   "{not json"                        400 {"ok":false,"error":"Expected property name or '}' in JSON at position 1 (line 1 column 2)"}
POST /api/import   ""                                 400 {"ok":false,"error":"Unexpected end of JSON input"}
POST results       {memberName:"",weekNumber:"x",…}   400 {"ok":false,"error":"Demo data is read-only. Connect the clan database first: set DATABASE_URL in .env.local, then run npm run db:migrate."}
POST /api/restore  {"nope":true}                      400 {"ok":false,"error":"Not a valid backup file (expected members, weeks, clash_results arrays)."}
POST avatar        {avatarUrl:"http://evil/x.png"}    400 {"ok":false,"error":"Avatar must be an image data URL."}
POST avatar        2MB+1 data URL                     413 {"ok":false,"error":"Image is too large."}
```

All byte-identical to `54a69f4`. **Honest limit:** member `results`' four *field* validators (`memberName` / `weekNumber` / `keys` / `damage`) could **not** be reached from here — `upsertMemberWeekResults()` refuses on `getDataSource() === "demo"` before validating, and with a live-but-unreachable URL the same call throws a driver error first. No local Postgres exists (no `psql`, Docker daemon down) and the live tables must stay empty, so the reachable proof is: the `ValidationError` branch is **byte-identical to `54a69f4`** and it demonstrably passes a real `ValidationError` message through unaltered (the demo-mode row above). **Duplicate-key behaviour:** `lib/persist.ts`'s `lastWins()` is what preserves it and is **untouched** (empty diff); the CSV path (`npm run import` → `parseCsv` → `normalizeCsvRecords` → `persist`) passes through **no file t2 owns**. A duplicate-member payload was sent to `/api/import` and produced no new failure mode. One consequence worth recording: if `lastWins()` were ever removed, the `21000` it exists to prevent is driver-shaped, so it would now read `Import failed — the database rejected it (code 21000)` instead of the driver's sentence — same code, less prose.

**4. `/api/backup` gained a `try` / `catch`.** At `54a69f4` a database outage threw out of the handler unhandled: measured **`500` with an empty body**, which the browser shows as a blank page because the client opens this route as a plain link. It now returns `{"ok":false,"error":"Backup failed — …"}`.

**5. The admin path is not verifiable here — what was and was not exercised.** Nobody has the owner's credentials and none were sought. The signed-in branch of all six handlers ships **unexercised**. What was done instead: a **scratch copy of the tree outside the repo** (in the session scratchpad, `node_modules` junctioned, no `.env` copied) with `lib/auth.ts` replaced by a stub returning `null` / `true`, built with `next build --webpack` — note that **Turbopack refuses a `node_modules` symlink leaving the project root** (`TurbopackInternalError: Symlink … points out of the filesystem root`) and `--webpack` is the documented escape hatch (`01-getting-started/01-installation.md:156`). A 21-case matrix was then run twice in each of two configurations — once with the six routes as written, once with the six restored from `54a69f4`:

- **`DATABASE_URL` empty (demo):** the diff is exactly `/api/backup` (empty body → sanitized JSON) and **three avatar rows** — see D2 below. Everything else identical.
- **unroutable loopback:** the diff is exactly the intended sanitization on the four leak sites plus `/api/backup`. Every validation row identical.

So the guard plus the sanitizers are the only behavioural deltas, and no status code changed on any path.

**Deliberate divergences, each reported rather than assumed:**

- **D1 — status codes left exactly as they were.** A driver failure in `import` / `restore` still answers **400** (not 500), because criterion 3 asks for a sanitized body, not a new contract, and the 400-vs-500 question (client fault vs outage) belongs with the Phase 5 item this task only partly reopened. `results` / `avatar` / `backup` sanitize inside the 500 they already had. `components/DataManagement.tsx:108` reads `data.error` without checking `res.ok`, so no client depends on the distinction today.
- **D2 — accepted copy regression in one unreachable state.** In demo mode, `avatar` used to surface `getDb()`'s actionable "DATABASE_URL is not set. Copy .env.example to .env.local…" (a plain `Error`, no `.code`); it now reads "Avatar update failed — couldn't reach the database." Following `resetError()`'s pattern means the no-code branch never echoes a message, and echoing an arbitrary `Error.message` is exactly the leak class this task closes. The state is unreachable through the UI (avatar controls are hidden in demo mode, and the route now 401s to anonymous). `restore` keeps that message, because its non-driver branch is the same branch that carries "Not a valid backup file".
- **D3 — four local sanitizers, not one shared helper.** The obvious refactor is a `lib/http-errors.ts`, but t2 owns only the six route files and adding a `lib/` module would be an ownership violation. Each route therefore carries a mapper shaped exactly like `resetError()`, with its own verb in the copy. **Flagged for `maintainer`:** five near-identical mappers is real duplication, and a one-file consolidation once an owner exists for it.

**Close-out:** `tsc --noEmit` clean · `npm run build` exit **0** (`ƒ Proxy (Middleware)` still emitted, `/import` still `○ Static`) · `npm run lint` **`10 problems (9 errors, 1 warning)`**, identical to the baseline measured before the first edit · `md5 data/clash.db` (hashed via a copy — the owner's dev server holds it open) = **`8EE3EAE9651CD860B90C0ABFF758D497`**, unchanged · vocabulary sweep with **`-i`** over the six owned files: `middleware` 0 · `sqlite` 0 · `turso` 0 · `libsql` 0 · `unauthenticated` 0 · `clash.db` 0 · `NEXT_PUBLIC` 0 · `local use only` 0 · `gate before` 0 · `postgresql://` 0 · `pooler` 0 (each route's stale "unauthenticated — gate before any public deploy" header comment is now the accurate admin-only sentence) · credential sweep of the six files against 7 tokens read from `.env.local` (values, pooler host, project ref) → **0 hits** · ports `3009` and the witness's `6544` killed **by port** and both confirmed `FREE`, no stray `node` process referencing the scratch app, owner's **`:3000` still listening and untouched** · the scratch `node_modules` junction removed as a reparse point only, repo `node_modules` intact.

**Live tables: not written, not queryable from here.** Every server t2 started ran with `DATABASE_URL` either **empty** or the **loopback**; the real pooler was never dialled, so no clan table could have changed. Counting 0/0/0/0 to *prove* it is beyond this seam: Phase 3a's lockdown makes PostgREST refuse the publishable key, and there is no `psql`, no Docker daemon and no throwaway Postgres on this machine. Reported rather than papered over.

**Ledger scoping notes — four criteria that are not achievable as written at this seam:**

1. `done_when 2`'s "no database query issued (**confirm from the server log**)" is **not confirmable from the server log**: postgres.js logs only notices and `next start` logs no queries. Satisfied in its checkable form with the TCP witness plus a positive control, above.
2. `done_when 4`'s member-`results` half is **partly unachievable**: its field validators sit behind a live-database check, and t2 has no live database it is permitted to write. Covered as far as the seam allows.
3. `done_when 7`'s "live tables end **empty**" is **assertable but not measurable** at this seam, for the reasons just given.
4. `done_when 6`'s "behaves exactly as at `54a69f4`" holds only **modulo the two changes the order itself mandates** (the guard, and the sanitized driver bodies) plus **D2**; the four-way matrix diff is the evidence, and the criterion reads as if the sanitization were free of behavioural change.

**`docs_touched: none` was followed, and it leaves two false lines standing:** `docs/reference/data-pipeline.md:51` ("The write API routes are unauthenticated — local use only") and `.claude/rules/data-pipeline.md:20` (same claim). Both are **t4's** files. Note that the `data-pipeline-specialist` brief instructs this agent to update the pipeline living doc as part of its task; the ledger overrides it here by design (the doc-sync note above the ownership check). Recorded so t4 does not miss those two lines and so the brief-vs-ledger conflict is on the record.

### t4 — `state: done`

**Files (8, all owned, markdown only):** `docs/reference/auth.md` *(new)* · `docs/project-map.md` · `CLAUDE.md` · `README.md` · `.claude/rules/database.md` · `.claude/rules/data-pipeline.md` · `.claude/rules/ux.md` · `.claude/conventions/source-registry.md`. `git diff --stat` over the seven modified files: **+121/−32**; nothing outside the `owns` set was touched (`git status` shows the other modified paths are t1/t2/t3's).

| File | What changed |
|---|---|
| `docs/reference/auth.md` *(new)* | The living doc for this layer: the four seams as built, the guard two-liner and frozen 401 body, why `requireAdmin` **returns** rather than throws, t1's fail-closed table, `getClaims()`/ES256 local verification and the revocation-window tradeoff, `proxy.ts`-not-`middleware.ts` with the doc citation and the silent-ignore failure mode, the proxy as the **only** token refresh (`autoRefreshToken: false`) and its inability to protect route handlers, the six-route 401 measurements, sign-in as a Server Action, Seam C's `readOnly`/`readOnlyReason` with the three-copy table and demo-wins precedence, the split-component rule, config with placeholders only, **What ships unexercised**, and the recorded decisions. |
| `docs/project-map.md` | Overview and stack lines now state public-reads/admin-writes and name `@supabase/ssr` as auth-only; `app/api/` bullet rewritten from "Unauthenticated — local use only" to the guard contract incl. `backup` as an **exfil** route; added `proxy.ts` and `app/login/` structure bullets; added the **auth path** to the `lib/` seam list; "Open unknowns" swapped the closed write-API blocker for the two real ones (unexercised signed-in half, `/login` has no nav entry). |
| `CLAUDE.md` | Header line rewritten (was "no accounts yet; deployable later to Vercel once the write API is gated"); `/login`, `proxy.ts` and `lib/auth.ts` added to Layout; new **always** convention: the guard is the first statement of every `app/api/` handler, no mutation may move to a Server Action, affordances are hidden not disabled. |
| `README.md` | New **"Signing in (who can change data)"** section (the three env vars with placeholders, create-one-user + keep-signups-disabled, `/login` reachable from Settings and why there's no sidebar link, sign-out location, fail-closed behaviour); "the only required setting" corrected to "the only setting needed to **read**"; a paragraph separating the signed-in axis from the three data-source states; "Sharing it later" step 2 rewritten from *"Gate the write endpoints first… the auth gate is real work"* to a deploy checklist; layout block gained `proxy.ts`, `/login`, `auth`. |
| `.claude/rules/database.md` | Two new bullets carrying **all four Phase 3a invariants plus the two extras**, written from that order's measured numbers (grant rows 35→0, `relacl` → `{postgres,service_role}`, `relrowsecurity` false×4→true×4, `pg_policies` 0→0, `reloptions` → `{security_invoker=on}`, PostgREST 200→401 `42501`, migrate role `postgres` with `rolbypassrls = true`, probe-table 0 anon grant rows, `42501 permission denied to change default privileges`) — lever 4 ≠ RLS, `create or replace view` resets `reloptions`, dashboard-Table-Editor tables can be born open so **create tables via `supabase/migrations/` + `npm run db:migrate`**, `alter default privileges` scoped to the granting role, **`ON TABLES` only** (functions/sequences still grant `anon`), **`service_role` retains full DML**; plus a bullet recording **"RLS enabled, no policies" as the intended end state** and `create policy` as lever 1's documented failure mode (with the accurate reasons `force row level security` and `revoke usage` are absent). The existing idempotency clause gained the `create or replace view` caveat, and the leak bullet gained raw driver errors as the same leak class. |
| `.claude/rules/data-pipeline.md` | **Line 20's false claim replaced** by the guard rule (first statement of the body, the six routes, frozen 401, no DB query, `backup` as exfil, "a new route isn't finished until it carries the guard"); plus the no-mutation-in-a-Server-Action rule and the sanitize-driver-errors / preserve-validation-copy split, with the four-mappers duplication named as a `maintainer` item. |
| `.claude/rules/ux.md` | State coverage restructured into **two axes**: the five data-source states (unchanged, with "writes work" qualified to "for the admin"), and three **permission** states — **anonymous-on-live / admin-on-live / demo** — each with its required copy, plus the note that admin-on-live is the hardest to verify and must be declared if unrendered. Records that the **three read-only reasons need three distinct copies**, the `readOnly`/`readOnlyReason` prop names, demo-wins precedence, hide-don't-disable, and the **split-the-component** rule (early return in front of hooks = conditional hook call). New **"Copy on a public surface must not leak"** bullet (no provider/env-var/driver names; one message for every credential failure; rate-limit the sole exception). |
| `.claude/conventions/source-registry.md` | New **Supabase** subsection under Project-specific, replacing the empty placeholder row: API-key formats/deprecation, the SSR client contract, the Next.js guide (read for the cookie contract, *not* as a blueprint, since the shipped example is browser-side), JWTs + signing keys, the `getClaims()` reference, `llms.txt`, **both packages' CHANGELOGs** as the only record of version-sensitive behaviour (noting `@supabase/ssr` ships its own inside the installed package — prefer that copy), and the **npm registry endpoint** for the peer-dependency floor. Both hard-won facts recorded: **`^0.7` is a semver trap** on a `0.x` version, and Supabase docs source under `apps/docs/content/guides/**` on raw GitHub **404s**. |

**Source URLs verified first-hand, not copied from a plan.** No research record survived from this phase (see finding 2), so all 11 candidate URLs were checked by HTTP status today — **10 × 200**, and the raw-GitHub docs-source path **404**, confirming the dead path rather than repeating it. Three were also content-checked so the "Use for" column isn't an assumption: `api-keys` contains `sb_publishable`/`sb_secret`/`Legacy API Keys`/`Deprecated`/`2026`; `auth/jwts` contains `getClaims`/`asymmetric`/`ES256`; `auth/server-side/creating-a-client` contains `createServerClient`/`getClaims`/`getAll`/`setAll`.

**Facts re-verified against the code rather than trusted from a changelist** (this slice's whole point): `lib/auth.ts` exports exactly `isAdmin`/`requireAdmin` with `import "server-only"` + `cache()` and a returned 401 · `lib/supabase/server.ts` returns `null` on absent env and wraps `setAll` in `try`/`catch` · `proxy.ts` has no `runtime` export, no redirect/rewrite/401, matcher excluding `api/`, and imports neither `lib/supabase/server.ts` nor `lib/db.ts` · `lib/supabase/client.ts` and `middleware.ts` **do not exist** · `requireAdmin` imported in exactly the **6** route files, `isAdmin` in exactly the **2** pages (`grep 'from "@/lib/auth"\|await isAdmin()'`) · `readOnly` **and** `readOnlyReason` present in all four components · resolved versions `2.112.3` / `0.12.4` with `ssr` peer `^2.111.0` satisfied (read from `node_modules`, and cross-checked against the registry with `npm view`) · **`autoRefreshToken: false` confirmed at `node_modules/@supabase/ssr/dist/main/createServerClient.js:34`**, so auth.md cites the line rather than the ledger.

**Close-out:** `npm run build` exit **0** (`ƒ Proxy (Middleware)` still emitted, `/import` still `○ Static`) · `npm run lint` **`10 problems (9 errors, 1 warning)`** — **exactly** the baseline measured before any edit · `md5 data/clash.db` (hashed via a copy) `8ee3eae9651cd860b90c0abff758d497` **before and after** · criterion 1's grep (`unauthenticated|must be gated|local use only|no accounts`, `-i`) over the 8 owned files → **0** · vocabulary sweep with **`-i`**: `pragma` 0, `gate before` 0, `gate the write` 0, and every hit for `middleware` (6), `sqlite`/`libsql`/`turso`/`clash.db` (2 each) and `NEXT_PUBLIC` (1) inspected line by line — all are approved carve-outs (see finding 6) · old env-var names `NEXT_PUBLIC_SUPABASE*` across all git-visible docs → **0** · credential sweep over the 8 owned files against **11** tokens derived from `.env.local` (every value, plus the DB host, password, username, project ref, and `ADMIN_EMAIL` and its local part) → **0 hits** · no server started, no port used, no Supabase or database connection opened by this task.

**Findings — six, in the order they'd bite someone.**

1. **`docs/reference/data-pipeline.md:51` is still false and is not mine to fix.** It reads *"The write API routes are unauthenticated — local use only; gate them before any public deploy."* It is excluded from every `owns` set in this order (the ownership check lists it as explicitly unowned), so **the orchestrator must land it.** Suggested replacement, consistent with what I wrote into `.claude/rules/data-pipeline.md`: *"Every write API route is admin-only — `requireAdmin()` is the first statement of each handler body, returning a frozen 401 to anyone else with no database query issued; `/api/backup` is gated as an exfil route. See `docs/reference/auth.md`."* Until it lands, the pipeline living doc contradicts its own rule file — the exact divergence class this wave exists to prevent.

2. **Criterion 5 asks for "the vendor-primary pages actually used", and that is unverifiable at this seam.** The research ran in the main session and **no record was persisted** — not a sources file, not a build-log entry; t1–t3's changelists cite only `node_modules` paths and never a URL. So I could not reconstruct what was opened. What the registry now contains is *sources verified today that answer the questions this phase asked*, which is the useful artifact but **not the same claim**. Stated rather than papered over. Structural fix for next time: `capability-researcher` should write its URLs into `.claude/conventions/source-registry.md` (or a `sources.md`) **in the dispatch that used them**, since that is the only moment the information exists.

3. **Criterion 1's grep is looser than the claim class it protects — it would have passed while a stale claim survived.** `docs/project-map.md:11` said *"Deployable later to Vercel with `DATABASE_URL` as an env var, but only once the write API is gated"*, and `README.md`'s deploy step said *"Gate the write endpoints first"* with the closing line *"the auth gate is real work"*. **None of those four patterns matches "only once the write API is gated".** I found and fixed them by sweeping for `gate|gated|auth gate` as well. The checkable version of criterion 1 is `-iE "unauthenticated|must be gated|local use only|no accounts|gate(d)? (the|before|them|it)|auth gate"`. This is the fourth criterion in this order found looser than its own invariant (cf. t3's finding 3, t2's findings 1 and 3).

4. **Criterion 3's "written from that order's changelist numbers" is only partly satisfiable, and I did not fake the rest.** Phase 3a's changelist carries real measurements for the grant matrix, `relacl`, `relrowsecurity`, `pg_policies`, `reloptions`, the PostgREST before/after, the migrate role's `rolbypassrls`, the throwaway-probe grant rows, and `42501 permission denied to change default privileges`. It carries **no measurement** for invariant (d) (`alter default privileges` scoped to the granting role) or for the two extras (`ON TABLES` only; `service_role` retains full DML) — those appear only as prose in its "Assumptions / residual risks" and as its reviewer's HIGH-2/MEDIUM-1. I wrote them as **rules with no numbers attached**, because attaching a measurement that nobody took is precisely the failure this slice exists to prevent. If the orchestrator wants them measured, that is a `db-migration-specialist` probe, not a doc edit.

5. **Phase 3a's ledger points at a task that does not exist.** Its deferral note and its `database.md` requirements are addressed to **"Phase 3b's t5"** ("t5's `done_when` must require each one"); this order has no t5 — the work is **t4**. All of Phase 3a's enumerated requirements are satisfied here, so nothing is lost, but a reader following that pointer finds silence. Worth a one-line correction in the Phase 3a ledger. Related deliberate deviation: that note said the rule file would be *"rewritten"* alongside the auth invariants — I **appended** instead. Rewriting `.claude/rules/database.md` would have destroyed its measured pooler/`max`/`sql.begin()` content, which has nothing to do with auth and is the most expensive knowledge in the file.

6. **t4's `docs_touched` under-declares its own slice by six files, and one carve-out needs recording.** `docs_touched` lists only `docs/reference/auth.md` and `docs/project-map.md`, while criteria 1–5 require updating `CLAUDE.md`, `README.md`, three rules files and the source registry — all in `owns`. A doc-sync verdict keyed to `docs_touched` would therefore under-count this wave. Separately: the vocabulary sweep's carve-outs are defined as *superseded-decision lines* and *lines citing Next's deprecation of `middleware`*, and my one `NEXT_PUBLIC` hit (`auth.md`: **"No `NEXT_PUBLIC_` prefix on any of them"**) is neither by the letter — it is a line recording the **env-var rename decision**, the same construction t1 already shipped in `.env.example`, and it names no old variable (`NEXT_PUBLIC_SUPABASE*` is 0 repo-wide). **Claiming it as a third carve-out** rather than deleting a line whose whole job is to stop a later agent re-adding the prefix.

**Not claimed anywhere in the docs I wrote, because I could not verify it:** the live Supabase tables being empty (t2 itself records this as "assertable but not measurable at this seam", and my slice opened no connection), and anything about the signed-in branch beyond t3's and t2's explicit statements that it is unexercised. t3's DOM counts are cited **as t3's measurements** ("measured (t3)"), not re-run — I verified the code that produces them instead.

### fC — `state: done`

**Files (2, nothing else):** `app/api/import/route.ts` · `app/api/restore/route.ts`. `git diff --stat` for this slice alone: **2 files, +75/−31**. No `lib/` file, no other route, no doc touched. `requireAdmin()`'s two-liner is untouched and still the first statement of both handler bodies (`grep -A2 "export async function POST"` confirms lines 19–20 and 11–12); each file contains exactly **1** `if (denied) return denied;`.

**The finding, and why the prescribed fix was not literally available.** The reviewer asked for `instanceof ValidationError` first, as at `app/api/members/[memberId]/results/route.ts:36`. Neither of my two routes can do that:

- **`lib/import.ts:36` is `class ValidationError extends Error {}` with no `export`** — the class is module-private, so `/api/import` has no type to test. (The finding quotes that line but not its missing keyword.)
- **`lib/backup.ts:96` throws a bare `new Error("Not a valid backup file …")`** — restore's validation failure is not a distinct class at all.

Both files are outside this slice's `owns` (and the order's ownership check lists them as explicitly unowned), so the fix had to be type-based *without* a new export. **What landed instead is provenance:** the calls that can reach Postgres — `loadDataset()` and `persist()` in import, `restoreBackup()` in restore — are wrapped in a local `fromDatabase(work)` that rethrows as a local `class DatabaseFailure` carrying the original error. The catch then tests `err instanceof DatabaseFailure` (a real type check on an identity the route itself controls) and only that branch consults the PG code. Everything else — the normalizers' `ValidationError`, a `JSON.parse` failure — keeps `err.message` verbatim **by construction**, not because it happens to carry no `.code`. `databaseError()` keeps `resetError()`'s shape, keeps the `42P01` → "`npm run db:migrate`" hint, and keeps the no-`.code` passthrough t2 established.

This is strictly stronger than `instanceof ValidationError` for import: it also covers a hypothetical non-`ValidationError` throw out of the pure normalizer, and it can never be voided by a field being added to an error.

**How I exercised it — stated plainly, including what it does not prove.** The guard makes both routes unreachable over HTTP without the owner's credentials, so I did **not** test through a live request. I built a **direct-module harness in the session scratchpad, outside the repo**: byte-identical copies of the two route files (`diff` against the repo files → identical) in `probe/after/`, hand-reconstructed pre-fix copies in `probe/before/`, with module resolution redirected by a scratch `tsconfig.json` `paths` map — **the route sources themselves were not edited, not one character**. `requireAdmin()` → a stub returning `null`; `persist`/`loadDataset`/`restoreBackup` → stubs that inject a chosen error. The **real** `lib/import.ts` normalizers and the **real** `lib/backup.ts` `restoreBackup()` ran (repo `lib/` and `node_modules` reached by directory junction, both removed afterwards as reparse points only), so every validation string below is the real copy, not a fixture. The connection error is a **real postgres.js error object**, captured by actually dialling the unroutable loopback `postgresql://nobody:nopass@127.0.0.1:6544/postgres` (nothing listening; **never a wrong password**): `message "connect ECONNREFUSED 127.0.0.1:6544"`, `code "ECONNREFUSED"`, `address "127.0.0.1"`, `port 6544`.

**What this proves:** the handler bodies, both sanitizers, the split, and the exact response bodies and status codes. **What it does not prove:** the `requireAdmin()` guard (stubbed), Next's HTTP/routing layer, and behaviour against a reachable Postgres — `42P01` and `28P01` are **simulated** `PostgresError`-shaped objects built to `node_modules/postgres/src/errors.js`'s shape (no local Postgres: no `psql`, Docker daemon down, and the live tables must stay empty). The signed-in branch therefore still ships unexercised over HTTP, exactly as t2 recorded.

**24 cases, before → after. 20 SAME, 4 DIFF — and all four are the fix.**

Validation and parse copy, **byte-identical** (compare against t2's pasted set):

```
I1  400 {"ok":false,"error":"Missing or invalid \"week\" (need number, startDate, endDate)."}
I2  400 {"ok":false,"error":"Week 1: no clashes found (expected \"hydra\" and/or \"chimera\")."}
I3  400 {"ok":false,"error":"Row 1: missing \"player_name\".\nRow 2: missing \"player_name\"."}
I4  400 {"ok":false,"error":"Expected property name or '}' in JSON at position 1 (line 1 column 2)"}
I5  400 {"ok":false,"error":"Unexpected end of JSON input"}
R1  400 {"ok":false,"error":"Not a valid backup file (expected members, weeks, clash_results arrays)."}
R2  400 {"ok":false,"error":"Expected property name or '}' in JSON at position 1 (line 1 column 2)"}
I11 400 {"ok":false,"error":"DATABASE_URL is not set. Copy .env.example to .env.local, point DATABASE_URL at your Supabase pooled connection, then run `npm run db:migrate`."}
R5  400 (same sentence, from the REAL restoreBackup with DATABASE_URL unset)
```

Driver errors, **still sanitized, same status**:

```
I6/I7  real ECONNREFUSED via persist   400 Import failed — the database rejected it (code ECONNREFUSED).
I8     real ECONNREFUSED via loadDataset 400 Import failed — the database rejected it (code ECONNREFUSED).
I9     42P01                           400 The clan tables don't exist yet. Run `npm run db:migrate` first.
I10    28P01 (message names the pooler user) 400 Import failed — the database rejected it (code 28P01).
R3     real ECONNREFUSED               400 Restore failed — the database rejected it (code ECONNREFUSED).
R4     42P01                           400 The clan tables don't exist yet. Run `npm run db:migrate` first.
S1/S2  success                         200 summary.mode "replace" (flat) / "upsert" (nested) — unchanged
S3     success                         200 {"ok":true,"summary":{…}}
```

`I8` is worth naming: `loadDataset()` runs *before* the normalizer on the flat path, so leaving it outside the wrapper would have echoed a driver message. It is inside.

The four DIFFs — the finding's own failure scenario, simulated by attaching a `.code` to the real `ValidationError` the real normalizer throws:

```
F1  ValidationError.code = "MISSING_WEEK"
    before 400 "Import failed — the database rejected it (code MISSING_WEEK)."     <- copy lost
    after  400 "Missing or invalid \"week\" (need number, startDate, endDate)."     <- copy kept
F2  ValidationError.code = "MISSING_PLAYER_NAME"
    before 400 "Import failed — the database rejected it (code MISSING_PLAYER_NAME)."
    after  400 "Row 1: missing \"player_name\".\nRow 2: missing \"player_name\"."
M1  request.json() throws undici-shaped {code:"UND_ERR_SOCKET"}   (the mirror case)
    before 400 "Import failed — the database rejected it (code UND_ERR_SOCKET)."
    after  400 "terminated"
M2  same on /api/restore
    before 400 "Restore failed — the database rejected it (code UND_ERR_SOCKET)."
    after  400 "terminated"
```

**Leak scan over all 24 post-fix bodies** (case-insensitive): `postgresql://` **0** · `pooler` **0** · `127.0.0.1` **0** · `6544` **0** · user `nobody` **0** · password `nopass` **0** · the simulated project ref in the `28P01` message **0** · `supabase` **2**. Those two are `lib/db.ts`'s unchanged instruction *"point DATABASE_URL at your **Supabase** pooled connection"* (cases I11/R5) — a vendor name in setup copy for the admin, with no host, key, ref or value, byte-identical to `54a69f4`, and allowed by the "what is deliberately allowed" clause in `.claude/rules/ux.md`. t2's scan reported `supabase` 0 because its probes always had `DATABASE_URL` **set**, so `getDb()` never threw that sentence — a difference in scan scope, not a new leak. Reported rather than quietly filtered.

**One residual, and it needs an owner — `/api/restore` is only partly fixed (F3 above stays SAME).** `restoreBackup()` validates the file **and** writes it in one call, so its own rejection copy reaches the route with database provenance; provenance cannot separate them. It survives today only because that throw is a bare `Error` with no `.code`, which `databaseError()` passes through — so the reviewer's scenario applied to `lib/backup.ts:96` (give that throw a code) still rewrites the copy: `F3` measured `"Restore failed — the database rejected it (code NOT_A_BACKUP)."` both before and after. **The fix is one line outside my slice:** `lib/backup.ts:96` throws a typed, exported `ValidationError` instead of `new Error`, and this route tests it with `instanceof` — the same shape as `results/route.ts`. It pairs naturally with the queued `lib/http-errors.ts` consolidation (t2's D3), which is where a single shared `ValidationError` belongs. **Escalated, not silently absorbed**, and the limitation is written into the route's comment so the next reader does not have to rediscover it. What *is* fixed for restore: the JSON-parse / body-read copy is now protected by construction (M2).

**Disagreements and judgement calls, all deliberate:**

1. **I rejected the tempting "narrower driver test" (a SQLSTATE regex, or an allowlist of postgres.js codes).** It would have closed F3 in-slice, but it inverts the failure direction: an *unrecognised* driver code would then be echoed verbatim, publishing `host:port`. `.claude/rules/database.md` already records why allowlisting driver codes is the wrong shape ("the pooler can report an authentication failure under a code that has nothing to do with authentication"). Deny-by-default — sanitize unless the error is *proven* non-database — is the only safe direction, so restore keeps a known copy risk rather than gaining an unknown leak risk.
2. **The no-`.code` passthrough is kept, not "fixed".** A database-provenance error with no `code` is not a postgres.js error at all; the reachable case is `getDb()`'s own actionable instruction, which `lib/db.ts` deliberately builds without the URL. Turning it into a fixed sentence would repeat t2's D2 regression on two more routes for no security gain. Zero behaviour change was the goal.
3. **D1 untouched:** a driver failure on these two routes still answers **400**, not 500. Out of scope, still a Phase 5 item.
4. **D3 gets slightly worse before it gets better:** two of the local mappers now also carry a ~12-line `DatabaseFailure` / `fromDatabase` pair. That is duplication the `maintainer` sweep should collapse into `lib/http-errors.ts` together with the shared `ValidationError` — the two changes are one change.
5. **Doc drift I cannot land:** `.claude/rules/data-pipeline.md:29` still describes the split as *"an error with a string `.code` … gets a fixed sentence; everything else … passed through verbatim"*. That is now the description of the other four routes (`reset`, `results`, `avatar`, `backup`), not of `import` / `restore`, which discriminate by provenance. The rule file is t4's, so **it needs one paragraph from whoever owns it next**. Checked, and *not* a problem: `docs/reference/data-pipeline.md:51` (landed since t4 — its finding 1 is fixed) states only the **effect** — *"Driver-shaped errors are sanitized to a bare PG code while validation copy passes through verbatim"* — which is still exactly true, so the living doc needs no edit from this slice. Suggested wording for the rule file: *"Sanitize by provenance where the route can (wrap the DB-touching calls in one helper and test the wrapper's type); by `instanceof ValidationError` where a validation type exists; the bare `.code` test is the fallback, and it is only sound while validation errors carry no code."*

**Close-out:** `npx tsc --noEmit` exit **0** · `npm run build` exit **0** (`ƒ Proxy (Middleware)` still emitted, `/import` still `○ Static`, all six API routes still `ƒ`) · `npm run lint` **`10 problems (9 errors, 1 warning)`** — identical to the baseline I measured **before** editing (same files: 3 in `components/ImportPanel.tsx`, the rest in untracked `.claude/scripts/*.js`) · `md5` of a **copy** of `data/clash.db` (the owner's dev server holds it open) `8ee3eae9651cd860b90c0abff758d497` **before and after** · vocabulary sweep (`-i`) over the two owned files: `middleware` 0 · `sqlite` 0 · `turso` 0 · `libsql` 0 · `unauthenticated` 0 · `clash.db` 0 · `NEXT_PUBLIC` 0 · `local use only` 0 · `gate before` 0 · `postgresql://` 0 · `pooler` 0 · credential sweep of the two files against **9** tokens read from `.env.local` (every value plus DB user, password, host, project ref and the admin address's local part) → **0 hits** · **no server started** (no port bound; 6544 and 3016 verified FREE, owner's `:3000` never touched) · **no connection to the live project**: the only socket this slice opened was the outbound attempt to `127.0.0.1:6544`, so the clan tables were neither read nor written and end **empty**, on the same "assertable, not measurable at this seam" footing t2 recorded · scratch junctions removed as reparse points only (`rmdir`, not a recursive delete), repo `lib/` (17 entries) and `node_modules/` (327 entries) intact · `git status` shows no stray file — the only paths this slice changed are its two routes plus this ledger.

### fA — `state: done` (fix pass, slice A)

**Files (5, all owned):** `app/settings/page.tsx` · `app/members/[memberId]/page.tsx` · `app/login/page.tsx` · `app/login/actions.ts` · `app/login/LoginForm.tsx`. **No doc touched** — no new token or primitive was introduced, and `.claude/rules/ux.md` (t4's) already carries the demo-never-says-sign-in rule and the three-copy requirement this slice enforces, so the rules file needs no edit. `components/**` and `app/api/**` untouched (other slices own them); `app/layout.tsx` `git diff --stat` **empty**.

**1 — HIGH: demo mode no longer offers a button to nowhere.** `app/settings/page.tsx`'s Admin Access card branched on `signedIn` alone; it is now **four-way** off the same `source`/`signedIn` pair `readOnly` is computed from nine lines above (the three states briefed, plus the pre-existing green one they split out of):

| `signedIn` | `source` | Renders | `/login` link |
|---|---|---|---|
| true | live | green "Signed in as the clan admin" + Sign out — **unchanged** | no (as before) |
| true | demo | **new:** locked composition, "Signed in — but the numbers are sample data", + Sign out | no |
| false | demo | **new:** locked composition, "Read-only — there is no clan database yet", no CTA | **no** |
| false | live | "Read-only — this browser isn't the clan admin" + Sign in — **unchanged** | yes |

The demo+anonymous copy mirrors `components/DataManagement.tsx`'s `LockedNote` demo branch ("nothing to import into, nowhere to restore and nothing to reset. Connect the clan database first"), points at the **Data Source** box on the same page for the steps, and closes with *"An admin account only starts to matter once real data is in place"* — which explains why there is no sign-in button rather than leaving the reader hunting for one. No "sign in" sentence and no link, per `.claude/rules/ux.md`. **Consequence, and it is the intended answer, not a regression: demo mode now has no `/login` link anywhere in the app** — measured below across `/settings` (both tabs) and a member page.

The signed-in-in-demo state uses the **locked** composition (`rounded-xl border border-border bg-panel-2/40 p-4` + `Lock` + `text-sm text-muted`), not the green one, because writes are still refused; it keeps the **Sign out** form, since `/settings` is the only place it lives; and its copy says the tools *"unlock without signing in again"*, so the reader is not sent back through the door they already came in.

**2 — HIGH: an unreachable sign-in service is no longer reported as a wrong password.** `app/login/actions.ts` gains `SERVICE_UNREACHABLE` and a branch **before** the credentials one, after the 429 branch: `if (!error.status || error.status >= 500)`. Grounded in the installed source, not from memory: `node_modules/@supabase/auth-js/dist/main/lib/fetch.js` throws `AuthRetryableFetchError(_getErrorMessage(e), 0)` from the `catch` around `fetcher(...)` **and** from `handleError`'s `!looksLikeFetchResponse` branch, and again for every code in its `NETWORK_ERROR_CODES` list — read there as `[500, 501, 502, 503, 504, 520…530]`, so the briefing's range is confirmed against this installed version. `!error.status` also catches `AuthUnknownError`, which carries no status at all (an unparseable response body outside that list). The copy names no provider and says nothing about the credentials or the account. **`CREDENTIALS_REJECTED` is byte-identical to t3's** — the fix was that a different failure was wearing its clothes.

**3 — MEDIUM: the email field survives a failed attempt.** `app/login/LoginForm.tsx`'s email input is now **controlled** (`useState`); the password deliberately is not. Verified the cause in the installed React rather than assuming it: `node_modules/react-dom/cjs/react-dom-client.development.js`, `startHostTransition` wraps the action as `function () { requestFormReset$1(formFiber); return action(formData); }` — **unconditional**, so every action transition resets uncontrolled inputs whether it succeeded or not.

**4 — MEDIUM: focus.** `autoFocus` on the email input (precedent `components/MemberHistoryTable.tsx:360`), `aria-busy={pending}` on the `<form>`, and focus restored to email when an attempt fails. The restore is keyed on the **pending edge** (a `wasPending` ref), not on `state.error`: keying on the message would silently fail on a *second identical* failure, since the dep would not change — the exact case the owner hits while retrying. `role="alert"` untouched.

**5 — MEDIUM: the member page no longer relies on an accident.** `export const dynamic = "force-dynamic";` added to `app/members/[memberId]/page.tsx` with a comment that says it is **not** redundant and why (the route is dynamic today only because `isAdmin()` reads `cookies()`; hoisting, conditioning or wrapping that call would make it cacheable while the output still varies per visitor). Build output confirms `ƒ /members/[memberId]` and, unchanged, `○ /import`.

**6 — small: the connected-but-empty instruction is gated on `signedIn`.** "Open the Import data tab and upload a finished clash" only renders for the admin; an anonymous visitor now reads *"The clan admin fills them in from the Import data tab after each clash"* — the Import tab is the locked note for them, so the original was an instruction that could not succeed. Both variants keep "Nothing on this dashboard is sample data." The `DATABASE_URL` / `.env.local` mentions in the **Updating the Data** runbook were left alone, as briefed.

**6b — the optional `/login` copy fix was made, but NOT by reading `getDataSource()`, and that is a deliberate call.** The sentence was false in demo mode; it is now true in every state without a data read: *"Signing in is what lets the clan admin change data … Those tools also need the clan database connected — while the dashboard is showing sample data, nothing can be changed by anyone, signed in or not."* **Why not the suggested read:** `getDataSource()` → `queryDb()` **rethrows every database failure except `42P01`** (`.claude/rules/database.md`'s allowlist), so calling it from `/login` would take the sign-in page down with the root error boundary exactly when the database is unreachable — the paused-project case fix 2 exists to handle — and would leave the owner unable to reach the form during an outage. It would also add a pooled query to the one page that currently needs no database. `/login` stays database-free.

**Measured in the rendered DOM** — production `npm run build` + `next start`, headless Chrome over CDP (Node 22's global `WebSocket`, no new dependency), DOM read **after hydration** via `document.documentElement.outerHTML`, so every count covers SSR HTML, the flight payload and the client render. Ports **3015–3019** (CDP 9222–9231); owner's `:3000` never touched.

*Zero-config first run — no `DATABASE_URL`, no sign-in settings (the state finding 1 is about):* `/settings` → `href="/login"` **0**, the string `Sign in` **0** (case-insensitively `sign in` **0** too), new demo Admin Access heading present. `/login` → **200**, `name="password"` **0**, misconfiguration card **1**. All six data pages **200**, `/import` still **307 → /settings**.

*Demo mode with sign-in settings present:* `/settings` **Overview** → `/login` 0 · `Sign in` 0 · `Reset database` 0 · `Export backup` 0 · `Restore from backup` 0 · `Danger zone` 0 · `/api/backup` 0 · new demo card present · old anonymous heading 0. `/settings` **Import data** tab (clicked, client tab switch) → `/login` 0, `<textarea` 0, demo import copy present. `/members/m1` → `/login` **0**, `aria-label="Edit W…"` **0**, demo read-only note present. So "no `/login` link anywhere in demo mode" is measured, not asserted.

*Anonymous on a live database (`source="postgres"`), both data sub-states:* the anonymous Admin Access heading present **with** its `/login` link (the state the review re-measured as correct — unchanged), demo card 0, signed-in-in-demo card 0, green card 0; with **no weeks** the connected-but-empty card renders the **anonymous** variant and **0** occurrences of the admin instruction; with weeks, the connected-with-data card. `Reset database` / `Export backup` / `Restore from backup` / `/api/backup` all **0**. The data-source input was **stubbed** for these builds (`TEMP-FA-STUB`, same disclosure as t3's finding 1) because binding constraint 2 keeps the live tables empty; the rendering is real, the input forced.

*Both signed-in branches — rendered, and disclosed as a stub.* `signedIn` was forced with a one-build `process.env.FA_STUB_SIGNEDIN` stub **inside the page I own**. `signedIn + demo` → the new locked card **2**, green card **0**, `Sign out` present, `/login` **0**, `Export backup`/`Reset database` **0**. `signedIn + live` → green card **2**, new locked card **0**, `Export backup` **1**, `Reset database` **1**. **This is the first time in this order the admin-on-live write affordances have been rendered at all** (t3 recorded them as unexercised) — but only with the auth input forced, so it proves the **branch selection and copy**, not the cookie/session path. No sign-out form was ever submitted.

**Stub revert proved.** `grep -rn "TEMP-FA-STUB\|FA_STUB" app components lib scripts proxy.ts docs` → **nothing** (exit 1). The three stubbed lines are back to `const ds = await loadDataset();` / `const source = await getDataSource();` / `const signedIn = await isAdmin();`, and the final build was made **after** the revert.

**Fix 2 exercised on both halves, without touching the real service:**

```
SUPABASE_URL = http://127.0.0.1:6544 (nothing listening)  -> "Couldn't reach the sign-in service. Check your connection and try again in a moment."
SUPABASE_URL = http://127.0.0.1:6545 (stub returning 503)  -> same message; stub log confirms POST /auth/v1/token?grant_type=password arrived
real service, obviously fake address (ONE submit)          -> "That email and password didn't match. Try again."   <- unchanged
```

The third row is the **discrimination control**: the new branch does not swallow a genuine 400. Total auth attempts against the real service in this slice: **one**, hand-run, never looped, with `nobody.definitely-not-a-real-account@example.com`. No `ADMIN_EMAIL` value and no real password was used or sought. Never a wrong DB password — the pooler was never dialled at all.

**Fixes 3 and 4 measured on that one real failed submit** (focus deliberately placed on the submit button first, so the `disabled={pending}` blur actually happened): still on `/login` · error text exactly `That email and password didn't match. Try again.` · **email retained** · **password empty** · `document.activeElement` back to `name="email"` · form `aria-busy` `false` → (pending) → `false` · `autofocus` attribute present and the initial `activeElement` is the email input on load. Zero occurrences of `invalid_credentials`, `Invalid login credentials`, `user_not_found`, `email_not_confirmed`, `AuthApiError`, `AuthRetryableFetchError`, or the submitted password. The submitted **address** now appears **once** — in the email field it was deliberately kept in — and **not** in the error text; that is fix 3 working, and it is client-side state the server never echoed.

**What I could NOT exercise, plainly:** the **success branch of sign-in** still ships unverified — cookie write, session persistence across a page load, `redirect("/settings")` carrying `Set-Cookie` — exactly as owner decision 2 requires and as t3 recorded. Everything I rendered for a "signed-in" visitor came from a **forced boolean**, not a real session. The pre-approved fallback remains owner decision 3. Also unexercised: the 429 branch (I refused to generate real rate-limit pressure) and `requireAdmin()`'s server-side half, which is t2's seam.

**Close-out:** `npx tsc --noEmit` exit **0** · `npm run build` exit **0** (`ƒ Proxy (Middleware)` emitted, `/import` still `○ Static`, `/members/[memberId]` `ƒ`) · `npm run lint` **`10 problems (9 errors, 1 warning)`** — identical to the baseline measured **before** any edit · `md5` of a **copy** of `data/clash.db` `8ee3eae9651cd860b90c0abff758d497` **before and after** · hex-literal sweep (`#[0-9a-fA-F]{3,8}`) over the five owned files → **none** · **no new `text-faint`**: the two remaining hits are pre-existing (the shared input class's `placeholder:text-faint`, on inputs that set no placeholder, and the member page's "Former" badge, untouched by this slice) · **leak check on all nine captured DOMs** → **0** hits for the whole `DATABASE_URL`, the whole `SUPABASE_URL`, the publishable key, `ADMIN_EMAIL` and its local part, the DB host / user / password, the project ref, and the literals `postgresql://`, `pooler`, `supabase` · credential sweep of the five owned files against **10** tokens read from `.env.local` → **0 hits** · vocabulary sweep (`-i`) over the five owned files: `middleware` 0 · `sqlite`/`libsql`/`turso`/`clash.db` 0 · `NEXT_PUBLIC` 0 · `unauthenticated` 0 · `local use only` 0 · `gate before` 0 · `postgresql://` 0 · `pooler` 0; `supabase` **11**, every one a code identifier, a server-side env-var name, or the `node_modules/@supabase/auth-js/…` doc citation `AGENTS.md` requires — **0** in every rendered DOM, which is what criterion 10 protects · **no live-project connection**: every server ran with `DATABASE_URL` empty and, where auth was probed, `SUPABASE_URL` on an unroutable loopback or a local stub; the one real request went to the **auth** endpoint only, never the pooler, so the clan tables end **empty** on the same "assertable, not measurable at this seam" footing t2 recorded · ports 3015–3019, 6545 and CDP 9222–9231 killed **by port / by PID, then verified FREE**; every headless Chrome killed by its own **PID** from a scratch profile, never by image name, and `tasklist` shows none left · owner's `:3000` still listening, untouched.

**Disagreements and notes — three.**

1. **I did not implement 6b as suggested**, and the reason is a hard constraint rather than a preference: `getDataSource()` is not a safe read on `/login`. See 6b above. If a future slice wants the data source on that page it needs a non-throwing probe (a `databaseUrl() == null` check, or a `try`/`catch` around `getDataSource()`), which is a `lib/` change and not mine.
2. **The signed-in-in-demo state's reachability deserves one line in the runbook.** It is only reachable with auth configured and the database not — a typo'd `DATABASE_URL`, unmigrated tables, or a paused project. In that state the owner is signed in and *everything* is still locked, which reads like a broken login unless the card says otherwise. It now does on `/settings`, but the same trap exists on the member page: `AvatarEditor` / `MemberHistoryTable` show the **demo** copy there (correct — demo wins) with no hint that the visitor is in fact the admin. Not mine to change (`components/**`), and I do **not** think it should change: demo-wins is the right precedence. Flagged as a documentation item for whoever owns `docs/reference/auth.md` next.
3. **`.claude/rules/ux.md`'s permission-state list is now slightly under-specified**, and I could not fix it (t4's file). It enumerates three permission states, but there are **four** cells in the `signedIn` × `source` grid, and the fourth — **admin on demo** — is the one this slice had to write copy for. The rule's "demo mode: nobody can write, signed in or not" covers it semantically; the checklist shape does not, which is how the Admin Access card shipped two-state in the first place. Suggested one-line addition for its owner: *"Demo mode has two sub-states worth rendering, anonymous and signed-in; the signed-in one must say the visitor IS the admin and is still locked, or it reads as a broken login."*
