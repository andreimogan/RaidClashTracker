---
paths:
  - "app/**"
---

<!-- Split out of `.claude/rules/database.md` in Phase 4. That file had gained
     `app/**` so this one rule would load for the files that can violate it — which
     worked, but dragged ~17 KB of pooler/RLS/migration rules (larger than ui.md +
     ux.md + data-pipeline.md combined) into every page edit for two bullets out of
     fifteen. The invariant is about rendering, not about the database; it lives
     here, and `database.md` keeps only the demo-fallback consequence. -->

Rendering rules for `app/**` — what makes a route dynamic, and what breaks if it stops being.

- **The five data pages are dynamic *only* because each one `await`s `searchParams`.** `/`, `/hydra`, `/chimera`, `/timeline` and `/members` each destructure `?week=` out of `searchParams: Promise<{ week?: string }>`, and that `await` is the entire reason a request-time database read happens on them. Measured in the build output (Next.js 16.2.9, Turbopack): **`ƒ` on `/`, `/hydra`, `/chimera`, `/timeline`, `/members`; `○` on `/import` and `/_not-found`.** **None of those five declares `export const dynamic = "force-dynamic"`** — **among pages** only `/settings`, `/login` and `/members/[memberId]` do (six `app/api/*/route.ts` files declare it as well, so a repo-wide grep for `force-dynamic` returns nine hits, not three; don't read that count as pages). `next.config.ts` is empty, so `cacheComponents` is **off** and there is no other mechanism holding these pages dynamic.
- **A page that stopped awaiting `searchParams` would silently become statically prerendered**, baking one build's rows into HTML served to every visitor — or baking the **demo dataset**, if the build environment had no connection string, which is the deployed-and-lying state this project has already hit once (`docs/reference/deployment.md`). There is no error and no warning: the only symptom is numbers that never change. Same class of accident Phase 3b caught on `app/members/[memberId]/page.tsx`.
- **If a data page must stop reading `searchParams`, it declares `force-dynamic` in the same change**, and the build's route table is re-checked (`ƒ`, not `○`) as the proof. "It looked fine in dev" is not evidence — `next dev` renders everything per request.
- **The mirror-image rule holds: `/import` is deliberately `○` and must stay that way.** That is why `isAdmin()` is never read in `app/layout.tsx` — a session read in the shared layout would opt every page, including that one, into dynamic rendering (`docs/reference/auth.md`).
- **Why this is a database rule too:** the thing that gets baked into static HTML is whatever `lib/data.ts` returned at build time, and in a build environment with no connection string that is `lib/mock-data.ts`. The demo-fallback invariant it would be laundering — two triggers, never widened — is in `.claude/rules/database.md`.
