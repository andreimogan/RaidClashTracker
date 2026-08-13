# Authentication and authorization (living doc)

<!-- Kept current as code changes — updated, not appended. Written in Phase 3b from the
     measured results in docs/tasks/phase3b-login-wall-public-reads-admin-writes.md; every
     claim here traces to that ledger's t1/t2/t3 changelists or to the code named inline. -->

**The shape: public reads, admin-only writes.** Every page and every number is readable by
anyone who can reach the app. Every write — and every route that can export the whole
dataset — requires the one admin account. There is exactly one account, signups are
disabled in Supabase, and authorization is a single case-insensitive comparison against
`ADMIN_EMAIL`.

Phase 3a closed the *database* to the publishable key (RLS + revoked grants — see
`.claude/rules/supabase-schema.md`). This layer closes the *application*.

## The four seams

| Seam | File | Does |
|---|---|---|
| A | `lib/supabase/server.ts` | `createServerSupabase()` — a `@supabase/ssr` server client wired to `await cookies()` via `getAll`/`setAll`. **Auth only**, never data. Returns `null` when the Supabase env vars are absent. |
| B | `lib/auth.ts` | `isAdmin()` and `requireAdmin()`. Exactly two exports; the whole authorization surface. |
| C | `app/settings/page.tsx`, `app/members/[memberId]/page.tsx` | The only two files that read `isAdmin()`. Each computes `readOnly` + `readOnlyReason` and threads them into the four components that render write affordances. |
| D | `proxy.ts` (repo root) | Token refresh, and nothing else. Never blocks a request. |

`lib/supabase/client.ts` **deliberately does not exist**. No Supabase client is ever created
in the browser, so the publishable key never enters the client bundle.

## Seam B: the guard

```ts
isAdmin(): Promise<boolean>                    // NEVER throws. false on any doubt.
requireAdmin(): Promise<NextResponse | null>   // null = admin; otherwise a 401 to return.
```

Called as the **first statement of every route handler body** — before `await params`,
before `request.json()`, before any `try`:

```ts
const denied = await requireAdmin();
if (denied) return denied;
```

The 401 body is frozen, and matches the `{ ok, error }` shape the client components already
render off `data.error`:

```json
{ "ok": false, "error": "Sign in as the clan admin to do that." }
```

**`requireAdmin()` returns; it never throws.** A throw inside a route handler becomes a 500
carrying a Next digest — not the JSON the four client components know how to display. The
guard's whole value is that a denied write looks like every other handled error.

**A signed-in non-admin gets a byte-identical response to an anonymous caller**, so no
response reveals whether an account exists. (Not exercised — see *What ships unexercised*.)

`isAdmin()` is wrapped in React `cache()`, so a page reading it twice costs one
verification. It carries `import "server-only"`.

### It is never called from the root layout

Two independent reasons, and the second is the durable one:

1. A throwing `isAdmin()` in `app/layout.tsx` would 500 the whole app — this one is moot,
   because `isAdmin()` cannot throw.
2. `cookies()` is a request-time API: *"Using it in a layout or page will opt a route into
   dynamic rendering"*
   (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`). In the
   root layout that opts in **every** route, including the statically prerendered `/import`.
   Measured after Phase 3b's UI work: `/import` is still `○ (Static)`.

So `isAdmin()` is read **per page**, in exactly the two pages that render write
affordances.

### Fail-closed states (measured, t1)

`isAdmin()` returned `false` and `requireAdmin()` returned a 401 with the frozen body in
every state below, and nothing threw:

| State | Result |
|---|---|
| all env set, **no session cookie** | `false` / 401 |
| `ADMIN_EMAIL` blank | `false` / 401 |
| `ADMIN_EMAIL` mismatched | `false` / 401 |
| `SUPABASE_URL` + key unset | `false` / 401 |
| `SUPABASE_URL` = an unroutable loopback (`http://127.0.0.1:6544`) | `false` / 401 |

*Unset* `ADMIN_EMAIL` is not a separate test from *blank*: `process.env.X?.trim()` yields
`undefined` for unset and `""` for blank — both falsy, both the same branch.

**A misconfiguration therefore locks writing, never opens it.** Reads are unaffected: the
dashboard stays fully public with no Supabase setup at all.

### Verification uses `getClaims()`, not `getSession()` or `getUser()`

With cookie storage the session's user object is attacker-controlled until the JWT is
verified — auth-js says so outright (*"If using an insecure storage medium, such as cookies
or request headers, the user object returned by this function must not be trusted"*,
`node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts:1413`). `getClaims()` verifies
the signature.

This project's Supabase issues **asymmetric ES256 signing keys**
(`/auth/v1/.well-known/jwks.json` publishes one EC key), so that verification is **local** —
no network round-trip per check.

The check requires `role === "authenticated"`, `is_anonymous !== true`, a **string** `email`
claim, and that email matching `ADMIN_EMAIL` trimmed and case-insensitively.

**Accepted tradeoff:** a token stays valid until it expires, so deleting or banning the
account in Supabase does **not** revoke an already-issued token. Acceptable for a
single-admin dashboard. `getUser()` is the swap if that stops being true — authoritative, at
the cost of a network call per check.

## Seam D: `proxy.ts`, not `middleware.ts`

**The file name is load-bearing.** In this Next version the convention is `proxy.ts`:
*"The `middleware` file convention is deprecated and has been renamed to `proxy`"*
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:11`;
version history at `:774` dates the rename to `v16.0.0`). A `middleware.ts` would be
**silently ignored** — no error, nothing in the build output, and sessions would simply stop
refreshing.

That is not reasoned, it is confirmed from the other side: `npm run build` emits
**`ƒ Proxy (Middleware)`**. A `middleware.ts` produces no such line *and no error*.

Also from that doc, and honoured here:

- **No `runtime` export.** *"The `runtime` config option is not available in Proxy files.
  Setting the `runtime` config option in Proxy will throw an error."* (Route files under
  `app/api/` are the opposite — `runtime`/`dynamic` are valid there.)
- The cookie contract is `request.cookies` / `NextResponse.cookies` — **not** `cookies()`
  from `next/headers`. So `proxy.ts` does **not** import `lib/supabase/server.ts`, which is
  also what the doc's *"you should not attempt relying on shared modules or globals"*
  (`:19`) asks for. It never touches `lib/db.ts`'s pool either.

### What the proxy is for, and what it cannot do

**It exists to refresh tokens, and it is the only place a refresh can be persisted
during a page render.** Be precise about that, because the shorter claim ("the only
thing that refreshes") is false and misleads in two directions: route handlers and
Server Actions *also* refresh — `getClaims()` → `getSession()` → `__loadSession` renews
inside `EXPIRY_MARGIN_MS` — and in those phases `cookies().set` succeeds, so the refresh
**persists**. Measured: `POST /api/reset` with a stale session cookie returns a
`Set-Cookie` even though the matcher excludes `api/`. What is unique to the proxy is the
*render* path, where `setAll` throws and the write is swallowed. So neither conclude that
write routes need proxy coverage, nor that all refreshing depends on this one file — what
depends on it is the session of a visitor who only reads pages. `@supabase/ssr`'s
server client is created with `autoRefreshToken: false`
(`node_modules/@supabase/ssr/dist/main/createServerClient.js:34`). Delete `proxy.ts` and
logins quietly stop lasting — nothing fails loudly.

**It never blocks.** No redirect, no rewrite, no 401, on any path. Its matcher excludes
`_next/static`, `_next/image`, `favicon.ico` and `/api`. With the Supabase env vars unset it
no-ops, and all six data pages still return 200 (measured, t1) — a missing configuration
cannot cost a page render.

**It cannot protect route handlers**, which is precisely why authorization lives in
per-route guards rather than a matcher. Next's own guidance: *"A matcher change or a
refactor that moves a Server Function to a different route can silently remove Proxy
coverage. Always verify authentication and authorization inside each Server Function rather
than relying on Proxy alone."*

## The guarded surface: six routes

All six carry the guard as the first statement, and all six were measured refusing an
anonymous caller over HTTP (t2), byte-identical bodies:

```
GET  /api/backup                    401   (JSON, and no Content-Disposition — not an attachment)
POST /api/import                    401
POST /api/restore                   401
POST /api/reset                     401
POST /api/members/<id>/avatar       401
POST /api/members/<id>/results      401
```

**No database query is issued on the 401 path** — proved with a TCP witness on the
loopback the overridden `DATABASE_URL` pointed at: silent through all six requests, while a
public read (`GET /hydra`) immediately logged a connection attempt as the positive control.

`/api/backup` matters as much as the writes: it exports the entire dataset, so it is an
exfil route, not a read.

There are **no Server Actions that write data**. The only `"use server"` file in the repo is
`app/login/actions.ts`, which touches auth cookies and nothing else. Server Functions are
reachable by direct POST, so a second write surface would be a second thing to guard;
keeping every mutation on the route handlers keeps `requireAdmin()` the single choke point.

## Sign-in

`app/login/` — `page.tsx`, `LoginForm.tsx`, `actions.ts`.

Sign-in is a **Server Action**, because a page render cannot write cookies: *"Setting
cookies is not supported during Server Component rendering. To modify cookies, invoke a
Server Function from the client or use a Route Handler"*
(`.../04-functions/cookies.md`), and *"HTTP does not allow setting cookies after streaming
starts"*. `@supabase/ssr`'s `createServerClient` writes the session cookies itself through
the `setAll` callback in `lib/supabase/server.ts` — which only succeeds inside an action.
That is also why `setAll` is wrapped in `try`/`catch` there: a refresh landing mid-render
cannot write, and swallowing it is correct because `proxy.ts` is what writes refreshed
tokens.

`redirect()` is called **outside** any `try` (`.../04-functions/redirect.md:50`), as its
last statement.

**Failures never enumerate accounts.** Wrong password, unknown address, unconfirmed account
and disabled signup all collapse into one message — *"That email and password didn't match.
Try again."* — rendered in place as `text-xs text-down`. Rate limiting (`429` /
`over_request_rate_limit`) is the one failure named separately, because it says nothing about
the credentials and a locked-out owner reading "didn't match" would keep retrying into the
limit.

Measured (t3): one submit with an obviously fake address stayed on `/login` and rendered
exactly that sentence, with zero occurrences of `invalid_credentials`,
`Invalid login credentials`, `user_not_found`, `email_not_confirmed`, `AuthApiError`, the
submitted address or the submitted password. Confirmed out of band that GoTrue was genuinely
reached and **does not enumerate accounts either**: a direct `POST /auth/v1/token?grant_type=password`
with fake credentials returned `400 invalid_credentials`.

**Nothing on `/login` names the auth provider or any env var.** It is a public page; the
misconfiguration card points at `.env.example` instead, which only whoever runs the server
reads. With the Supabase env vars blank, `/login` renders **200** with no password field and
that card — it explains the misconfiguration rather than 500ing.

Sign-out is a second Server Action (`signOut`, `scope: "local"`), reachable from `/settings`
when signed in.

## Seam C: hiding write affordances

Both pages that render write affordances compute the same pair:

```ts
const source = await getDataSource();
const signedIn = await isAdmin();
const readOnly = !signedIn || source === "demo";
const readOnlyReason = source === "demo" ? "demo" : signedIn ? null : "anonymous";
```

`readOnly: boolean` and `readOnlyReason: "anonymous" | "demo" | null` are props on all four
affordance-bearing components: `DataManagement`, `ImportPanel` (from `/settings`) and
`AvatarEditor`, `MemberHistoryTable` (from `/members/[memberId]`).
`components/ExportButton.tsx` needs no gate — it builds its CSV in the browser from props
already rendered on the page.

**The permission surface is a 2×2, and the fourth cell is the one that gets forgotten.**
`source` (live | demo) × `signedIn` (yes | no). `readOnlyReason` deliberately collapses two
of those cells into `"demo"`, which is correct for the *components* — the remedy is the same
whether or not a demo-mode reader is signed in — but it is **not** sufficient for a surface
that talks about the session itself. That is exactly how the Admin Access card on `/settings`
first shipped branching on `signedIn` alone and offered a "Sign in" link in demo mode,
pointing at a page that says sign-in isn't configured. The card is now four-way; the
components stay three-reason. **Demo + admin** is reachable whenever the auth env is set but
no connection string resolves — typo'd `DATABASE_URL`, unmigrated tables, a **paused
free-tier project**, or on the deployed site a missing/blank `POSTGRES_URL` because the
Supabase↔Vercel integration was disconnected (that last route is the one Phase 4 actually
shipped) — and such a reader must be told both facts (you are the admin; writes are still
locked) and never told to sign in.

**Known and deliberate:** on a member page, a demo + admin visitor sees the demo copy with no
hint that they are the admin. `AvatarEditor` and `MemberHistoryTable` receive only
`readOnlyReason`, and demo-wins is the right precedence there — the remedy really is
"connect the clan database", and naming the session would add words without changing what
the reader must do. Recorded so it reads as a decision rather than an oversight.

**Three read-only reasons need three distinct copies**, and they must not be swapped:

| Reason | Copy says | Because the fix is |
|---|---|---|
| `"anonymous"` (live database, not signed in) | **"sign in"**, linking to `/login` | signing in |
| `"demo"` (no connection string resolves, or `42P01`) | **"connect the clan database"** | connecting a database — locally `DATABASE_URL` + `npm run db:migrate`; on the deployed site, reconnecting the Supabase↔Vercel integration so `POSTGRES_URL` exists |
| `null` + connected-but-empty | nothing read-only at all — **writes work** | importing a first week |

**Why the "because" cell has two halves.** The rendered copy deliberately names
`DATABASE_URL` and `npm run db:migrate` — it is the local operator's runbook, and
`.claude/rules/ux.md` allows variable names and npm scripts in setup copy on purpose. But
`db:migrate` **cannot be run on Vercel**, so on a deployment those words are the wrong
instruction and the real fix is at the integration. Correct the *explanation* here, not the
in-app copy: it is aimed at whoever runs the server, and in demo mode there is no clan data to
protect. The durable sentence for any new copy is the state ("connect the clan database"), not
the variable.

**When both reasons apply, demo mode wins the copy.** Demo is the blocker that survives
signing in, so telling a demo-mode visitor to sign in would send them to a dead end. On a
live database `source !== "demo"`, so anonymous-on-live still gets the sign-in copy.

**Affordances are hidden, not disabled** (`.claude/rules/ux.md`). Measured on the rendered,
hydrated DOM for an anonymous visitor on a live database — **with one caveat that must not
be dropped again: only the `/settings` half was measured against the real live database.
The `/members/<id>` figures were taken with the page's data-source input stubbed to
`postgres` over demo rows, because the live tables are deliberately empty, so no member
page exists to render (t3 finding 1; `/members` renders 0 links and `/members/m1` 404s on
the live DB). `flow-reviewer` re-measured the `/settings` half independently and confirmed
it; the member-page half remains stub-derived until Phase 4 loads real data.** `/settings`
renders **0**
occurrences of "Reset database", "Restore from backup", "Export backup", "Danger zone",
"Type RESET", `textarea` and `Choose .json file`, and the `<a href="/api/backup">` exfil
link is **not rendered at all**. `/members/<id>` renders **0** `aria-label="Edit W…"`
pencils and **0** avatar controls. The Import tab renders a signed-out explanation linking
to `/login`; the Settings overview renders an **Admin Access** card ("Read-only — this
browser isn't the clan admin").

**Implementation detail worth keeping:** `DataManagement`, `ImportPanel` and `AvatarEditor`
were **split**, not branched internally — each keeps its whole existing body in an inner
component (`DataTools`, `ImportForm`, `AvatarUploader`) behind a thin wrapper that switches
on `readOnly`. An early `return` in front of `useState`/`useRef`/`useRouter` would be a
conditional hook call (`react-hooks/rules-of-hooks`). The split also means the file picker,
the POST helpers and the pending state **do not exist in the tree at all** for a reader who
could never save — the write machinery is absent, not merely invisible.

## Configuration

Three server-only variables, documented with placeholders in `.env.example`. **No
`NEXT_PUBLIC_` prefix on any of them** — sign-in runs entirely server-side, so a public
prefix would be a misleading name inviting a later mistake.

| Variable | Holds |
|---|---|
| `SUPABASE_URL` | the project's auth endpoint base |
| `SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_*` key. **Never** the secret key |
| `ADMIN_EMAIL` | the single address allowed to write — **a credential class of its own**; it is the owner's personal address and must never appear in a tracked file |

The publishable key is sufficient throughout: the platform mints short-lived JWTs from it,
and no legacy `eyJ…` anon key is needed. Signups must stay **disabled** in Supabase — that
is what makes `ADMIN_EMAIL` meaningful; otherwise anyone could register and only the email
comparison would stand between them and the data.

**Pinned versions** (resolved from `node_modules` after install, t1):
`@supabase/supabase-js` **2.112.3** · `@supabase/ssr` **0.12.4**, whose
`peerDependencies` requires `@supabase/supabase-js: ^2.111.0` — satisfied. Note `^0.7` was
a semver trap: a caret on a `0.x` version locks to that minor, so it can never reach
`0.12.x`. See `.claude/conventions/source-registry.md`.

## What ships unexercised

Stated plainly, because it is the honest state of this layer. Nobody on the implementing
side has the owner's password and none was sought, so **the success branch of sign-in was
never run.** Unexercised with it:

- the session-cookie write and its persistence across a page load,
- `redirect("/settings")` carrying `Set-Cookie`,
- the Admin Access card's signed-in branch and the Sign out form,
- every admin-visible affordance in its *rendered* state (pencils, avatar controls, import
  form, backup link),
- the signed-in branch of all six route handlers,
- **signed-in-non-admin → 401**, which is reasoned from code (a trimmed, case-insensitive
  compare returning the identical 401 body), not measured, by owner choice.

**The owner's acceptance test is the only path that closes this:** sign in → edit a member
week → export a backup → sign out. If the first login fails or the session does not persist,
the pre-approved fallback is Supabase's documented **browser-client** pattern for
`app/login/` (one client component plus `lib/supabase/client.ts`) — switch to it rather than
debugging undocumented territory.

## Recorded decisions

- **`/login` has no sidebar entry, and that is deliberate.** The routes in are the four
  in-page links from `/settings` and the member pages; `/`, `/hydra`, `/chimera`,
  `/timeline` and `/members` have none. There is exactly one account and signups are
  disabled, so a public dashboard advertising a login door only invites probing it. **Do not
  "fix" this by adding a sidebar link** — if the owner wants one, that is a deliberate
  change, not a repair.
- **Sign-in is assembled from documented parts, not a pattern Supabase publishes
  end-to-end.** Their shipped Next.js example is browser-side; the server-only Server Action
  here was verified from `@supabase/ssr` source (`createServerClient` registers an
  `onAuthStateChange` listener and writes session cookies itself on `SIGNED_IN`).
- **`createServerSupabase()` returns `ServerSupabase | null`** — `null` when the Supabase
  env vars are absent. That nullability is what lets `isAdmin()` honour "never throws"
  without wrapping a construction failure.
- **No Supabase HTTP data access anywhere.** The Supabase client is used for `auth.*` only —
  no `.from(`, no `/rest/v1`. Migration `0002` revoked `anon`/`authenticated` grants on
  `public` precisely so PostgREST is closed; reopening a path to it would undo that.
