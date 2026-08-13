# Convention: Source registry

The curated sources `capability-researcher` consults **before** open web search. Registry-first exists because open search returns tutorial blogspam and SEO reprints, and because a page you did not choose is a page that can carry instructions into a file you keep (see `capability-research.md`, "Untrusted evidence").

## How to use it

1. Match the agent's domain to a section below and use those sources.
2. Prefer, in order: the project's own pinned-version docs → the vendor's `llms.txt` / `llms-full.txt` → release notes and changelogs → the vendor's blog.
3. If the registry has no entry for a domain, open `WebSearch` is allowed — but every finding from it is recorded `confidence: search`, and the source you used should be added below if it proved worth keeping.
4. **Always resolve the version first.** Most of these roots serve current-major docs; a project pinned to an older major needs that major's URL, taken from the manifest, not the default.

Entries carry a `verified-on` date. Roots rot too — a 404 or a redirect to a marketing page means the entry needs fixing, not working around.

## Cross-cutting

| Source | Use for | verified-on |
|---|---|---|
| https://code.claude.com/docs/llms.txt | Claude Code itself: subagents, skills, hooks, settings. Read this before generating or editing any agent or skill so the scaffold never emits a deprecated frontmatter shape. | 2026-08-08 |
| https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices | Skill authoring: size, description, progressive disclosure | 2026-08-08 |
| https://developer.mozilla.org/ | Web platform behaviour, HTML/CSS/JS semantics, browser support | 2026-08-08 |
| https://owasp.org/www-project-top-ten/ · https://cheatsheetseries.owasp.org/ | Security review practice | 2026-08-08 |
| https://www.w3.org/WAI/WCAG22/quickref/ | Accessibility criteria | 2026-08-08 |

## Frontend

| Source | Use for | verified-on |
|---|---|---|
| https://react.dev/reference/react · https://react.dev/blog | React APIs, current patterns, deprecations | 2026-08-08 |
| https://nextjs.org/docs · https://nextjs.org/blog | Next.js routing, rendering, caching | 2026-08-08 |
| https://vuejs.org/guide/ · https://blog.vuejs.org/ | Vue | 2026-08-08 |
| https://svelte.dev/docs | Svelte / SvelteKit | 2026-08-08 |
| https://angular.dev/overview | Angular | 2026-08-08 |
| https://www.typescriptlang.org/docs/ · https://devblogs.microsoft.com/typescript/ | TypeScript language and release notes | 2026-08-08 |
| https://vite.dev/guide/ | Vite build/dev config | 2026-08-08 |
| https://tailwindcss.com/docs | Tailwind | 2026-08-08 |
| https://testing-library.com/docs/ · https://playwright.dev/docs/intro | Component and end-to-end testing practice | 2026-08-08 |

## Backend and data

| Source | Use for | verified-on |
|---|---|---|
| https://nodejs.org/docs/latest/api/ · https://nodejs.org/en/blog | Node.js APIs, LTS changes | 2026-08-08 |
| https://docs.python.org/3/ | Python standard library | 2026-08-08 |
| https://fastapi.tiangolo.com/ · https://docs.djangoproject.com/ | Python web frameworks | 2026-08-08 |
| https://www.postgresql.org/docs/current/ | PostgreSQL | 2026-08-08 |
| https://orm.drizzle.team/docs · https://www.prisma.io/docs | TypeScript ORMs | 2026-08-08 |
| https://spec.openapis.org/ | API contract shape | 2026-08-08 |

## Infrastructure

| Source | Use for | verified-on |
|---|---|---|
| https://docs.docker.com/reference/ | Containers | 2026-08-08 |
| https://docs.github.com/en/actions | CI | 2026-08-08 |
| https://developer.hashicorp.com/terraform/docs | IaC | 2026-08-08 |

## Project-specific

<!--
Append sources that matter to THIS project and are not covered above: an internal
design-system doc site, a vendor API reference, an RFC the architecture depends on.
Same three columns. `/bootstrap`, `/add-role` and `/improve-agent` may append here.
-->

### Supabase — the project's database *and* auth platform

Added 2026-08-12 because its absence forced Phase 3b's research to `confidence: search`, the
lowest tier, on questions that had exact vendor answers.

| Source | Use for | verified-on |
|---|---|---|
| https://supabase.com/docs/guides/api/api-keys | **API-key formats and deprecation.** Which key is which (`sb_publishable_*` vs `sb_secret_*`), that the publishable key is safe in a browser and the secret key never is, and the end-of-2026 retirement of the legacy `eyJ…` anon/service keys. Read this before writing any env-var doc or `.env.example` line. | 2026-08-12 |
| https://supabase.com/docs/guides/auth/server-side/creating-a-client | **The `@supabase/ssr` server-client contract**: `createServerClient` with the `getAll`/`setAll` cookie pair (implementing only one causes random logouts), and why `getClaims()` is the prescribed check. | 2026-08-12 |
| https://supabase.com/docs/guides/auth/server-side/nextjs | The Next.js integration walkthrough. **Read it for the cookie contract, not as a blueprint** — the shipped example is browser-side, so a server-only sign-in has to be assembled from documented parts. | 2026-08-12 |
| https://supabase.com/docs/guides/auth/jwts · https://supabase.com/docs/guides/auth/signing-keys | **JWT verification and signing-key algorithms.** Whether `getClaims()` can verify **locally** depends entirely on the project having asymmetric (ES256) keys rather than a shared HS256 secret — check the project's `/auth/v1/.well-known/jwks.json` before claiming either. | 2026-08-12 |
| https://supabase.com/docs/reference/javascript/auth-getclaims | `getClaims()`'s exact return shape (`{ data: { claims, header, … }, error }`). | 2026-08-12 |
| https://supabase.com/llms.txt | Entry point when you don't yet know which guide answers the question. | 2026-08-12 |
| https://github.com/supabase/ssr/blob/main/CHANGELOG.md · https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/CHANGELOG.md | **Version-sensitive behaviour, and the only place it is recorded** — the guides describe the current version without saying when it changed. Both were needed in Phase 3b: `ssr`'s `getAll`/`setAll` rewrite, its server-cookie-write dedup and PKCE fixes, and `supabase-js`'s 2.110.4/.5 window where `assertSupportedApiKey()` **threw** on `sb_` keys. `@supabase/ssr` also ships its own `CHANGELOG.md` **inside the installed package** — prefer that copy, it is pinned to the version actually installed. | 2026-08-12 |
| https://registry.npmjs.org/@supabase/ssr (`/<package>`, or `npm view <pkg> peerDependencies`) | **The peer-dependency floor**, which no doc page states. `@supabase/ssr@0.12.4` requires `@supabase/supabase-js: ^2.111.0`, so pinning the two independently can produce an unsatisfiable pair. | 2026-08-12 |

**Two hard-won facts, both of which cost time in Phase 3b:**

- **`@supabase/ssr@^0.7` is a semver trap.** A caret on a `0.x` version locks to *that minor*,
  so `^0.7` can never install `0.12.x` — it would strand the project eleven minors behind the
  cookie rewrite while looking like an ordinary permissive range. **Resolve any `0.x` pin
  against the registry and record the version actually installed from
  `node_modules/<pkg>/package.json`, not the range you wrote.**
- **Supabase docs *source* is not fetchable from raw GitHub.**
  `raw.githubusercontent.com/supabase/supabase/master/apps/docs/content/guides/**` returns
  **404** (re-confirmed 2026-08-12). Use the rendered `supabase.com/docs/guides/...` URLs
  above; don't burn attempts reconstructing repo paths.
