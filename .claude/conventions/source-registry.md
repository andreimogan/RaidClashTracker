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

| Source | Use for | verified-on |
|---|---|---|
| — | — | — |
