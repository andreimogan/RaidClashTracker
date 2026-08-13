# Task ledger: docs-readme-hub-onboarding-user-guide

order: "I do however want to have an updated readme file that will outline every dependency, the current pipeline of local, git, branches, supabase, vercel, and everything that you consider is relevant. Also step by step guide for an onboarding engineer, but also a user guide for what is happening in the app, the import, backup, user actions."
status: done
created: 2026-08-13
base_commit: d13093b   # main, == origin/main

## Context pack

**Stack:** Next.js **16.2.9** (App Router, Turbopack by default — no `--turbopack` flag needed and `--webpack` is the opt-*out*) · React **19.2.4** · TypeScript **5.9.3** · postgres.js **3.4.9** · `@supabase/ssr` **0.12.4** · Tailwind **4.3.1** (CSS-first, **no `tailwind.config.*`** — theme lives in a `@theme` block in `app/globals.css`) · Supabase Postgres **17.6** over the transaction pooler (`:6543`, `prepare: false`). npm, `package-lock.json` v3, 517 packages.

**Why this order exists.** The app has three human audiences and serves one. There is **no user guide at all**, no dependency inventory, and no pipeline overview outside a 328-line reference doc. **README is NOT stale on the retired stack** — `grep -niE "sqlite|libsql|turso|clash\.db|sheet" README.md` → **0**; it was rewritten in Phase 2 and again in Phase 4 (`d13093b`). This is expansion and restructure, not rescue.

**Files in play**
- `docs/engineer-onboarding.md` *(new)* — **t1 owns.**
- `docs/user-guide.md` *(new)* — **t2 owns.**
- `README.md` · `docs/reference/data-pipeline.md` · `docs/project-map.md` — **t3 owns.**
- Read-only for everyone: `package.json`, `package-lock.json`, `.env.example` (unusually instructive — 6,794 bytes of prose; **link to it, do not restate it**), `docs/reference/{deployment,auth,design-system}.md`, `.claude/rules/*.md`, all of `lib/`, `app/`, `components/`, `scripts/`, `supabase/migrations/`.

**Established at the gate by three Explore agents — treat as given, but re-derive any claim you put in writing from the code, not from this pack**

- **Name collision, verified.** Root `ONBOARDING.md`, `TUTORIAL.md`, `SCAFFOLD-MANIFEST.md` document the **AI agent scaffold**, not this app. Their titles are literally *"Onboarding — the agent team scaffold"* and *"Tutorial — using the agent team day to day"*; `grep -inE "hydra|chimera|clan|clash|avatar|backup|sign.?in"` across both → **0 matches**. Never link to them as app docs; README gets one line saying what they are.
- **`docs/tasks/` is ~2,556 lines, ~half of all markdown here.** A runtime work queue. **Nothing links to it.**
- **Four env-var names, five read sites** (the fifth is easy to miss): `lib/db.ts:70` (dynamic index over `CONNECTION_VARS`), `lib/supabase/server.ts:19,20`, `proxy.ts:48,49`, **`app/login/page.tsx:26`**, `lib/auth.ts:40`. `scripts/` reads **zero** — it gets `DATABASE_URL` via `dotenv` in `scripts/lib/load-env.ts`. All four fail **closed**: a misconfiguration locks writing, never opens it.
- **Two metrics each mean two different things depending on the page** — the single highest-value correction available:
  - **Participation**: keys ÷ max keys on clash/performance tables (`lib/compute.ts:150-154`) · **weeks active ÷ weeks present** on `/members` (`app/members/page.tsx:39`).
  - **Trend**: damage-**per-key** vs the previous global week on clash tables (`lib/compute.ts:156-162`) · **total damage vs that member's most recent prior *present* week**, skipping gaps, on the member page (`lib/compute.ts:259-277`).
- **Import semantics, all four confirmed from code:** in-app JSON = **replace** of the chosen `(week, clash)` (`app/api/import/route.ts:25-38` → `persist(payload,"replace")`; the delete is scoped to pairs present in the payload, so importing Hydra never touches that week's Chimera) · CSV CLI = **upsert** (`scripts/import-csv.ts:14`) · member week edit = **upsert** of that member's **two** clash rows (`lib/results.ts:52-54`) · legacy nested `{week, clashes}` = **upsert** (`app/api/import/route.ts:41-42`).
- **`damage_dealt` accepts** a raw number, `B`/`M`/`K` shorthand (`"16.61B"`, `"250m"`, `"1,200K"` — commas stripped, case-insensitive), or `null`/`undefined`/`""` → 0 (benched). `lib/parse.ts:4-16`. **Unrecognized strings silently become 0 on the import paths** but are **rejected** on the member-edit path (`lib/results.ts:28-31`).
- **Restore has NO confirmation** — picking the file performs it (`components/DataManagement.tsx:189`), and `restoreBackup()` deletes all four tables before inserting (`lib/backup.ts:131-156`). Reset by contrast requires typing exactly `RESET` (`DataManagement.tsx:74-88`). Documenting this is the only mitigation this order ships.
- **Key caps:** Hydra **3**, Chimera **2**, combined 5 (`lib/constants.ts:7-12`). **Clash dates are derived, never entered** (`lib/week.ts:1-8`): Hydra Wed 14:00 UTC → following Wed 08:00 UTC; Chimera Fri 11:30 UTC → following Thu 11:30 UTC; both belong to the same calendar week, anchored on the Hydra Wednesday.
- **"Active" is derived, not stored** — members present in the latest week's data (`lib/compute.ts:43-50`). Absent from the newest imported week ⇒ shows as **Former**.
- **CLI flags are hand-parsed with `indexOf`** (`scripts/import-json.ts:16-19`), so **`--week=26` does not work** — flags are space-separated only. `scripts/import-csv.ts:12` takes one optional positional defaulting to `data/import.csv` and parses no flags. **`--progress` is silently dropped** (`FlatMeta` has no such field) — do not document it as working.
- **`npm run seed` occupies Weeks 20–24**, which is *also* the documented diagnostic for a broken deployment (`docs/reference/deployment.md:312`, `lib/mock-data.ts:19-25`). Seeding real weeks over that range destroys the signal. **No doc currently says this.**
- **Known non-zero baseline:** `npm run lint` exits **1** with **9 errors + 1 warning** (3 in `components/ImportPanel.tsx`, rest in untracked `.claude/scripts/*.js`). Approved, not a regression.
- **Node is pinned nowhere** — no `engines`, no `.nvmrc`, no `.node-version`, no `.github/`. Only floor is transitive: `node_modules/next/package.json` → `>=20.9.0`. Dev machine runs 22.x. `@types/node` is v20 while the runtime is 22.
- **`tsconfig.json` excludes `scripts/`** — the four CLI entries are not type-checked by the build.

**Constraints**
- **Documentation only.** No code, no schema, no migration, no dependency change, no data touched. If you find a code bug, **report it — do not fix it**.
- **No task lists `data/` in its `owns`.** `data/clash.db` must end byte-identical at md5 `8ee3eae9651cd860b90c0abff758d497`.
- **No credentials anywhere** — connection string, password, project ref, pooler host, keys, `ADMIN_EMAIL`'s value. Placeholders only.
- **Do not hardcode the live deployment URL.** The owner declined recording it this order; write "your Vercel deployment" and let `docs/reference/deployment.md` own deploy specifics.
- **Never restate `.env.example`** — it is 6,794 bytes of genuinely instructive prose about the pooler host trap, `prepare: false` and percent-encoding. Link to it.
- Every behavioural claim must be traced to **code**, not to another doc. Four reference docs have already drifted from shipped code.
- **Do not commit and do not push.** The main session handles git.
- The owner's dev server on **:3000 is untouchable.** Use 3007+ if you need one.

**Non-goals**
- Node pinning (`engines`/`.nvmrc`), a Restore confirmation, and recording the live URL — all three explicitly declined by the owner this order. Record them as follow-ups.
- Touching root `ONBOARDING.md` / `TUTORIAL.md` / `SCAFFOLD-MANIFEST.md` — a different product's docs.
- Editing `docs/build-log.md` (append-only; main session) or `docs/tasks/**` (runtime queue).
- `.claude/rules/*.md` — the `DATABASE_URL` contradiction is resolved in README's wording, not by weakening the rule.

## Cost forecast

**Estimate: 15M tokens** (range 12–18) · ~$12–18
- 4 dispatches (t1, t2, t3, `flow-reviewer`) × ~2.5M all-in — 10M
- Gate exploration (3 Explore agents, already spent) — ~4M
- Report + commit — ~2M
- Bounce allowance (1 review bounce) — ~2.5M

Basis: 5 prior orders in `docs/build-log.md`; Phase 4 ran 4 dispatches for ~14.8M at a comparable session size. Session at plan time **150.8M · ~$147.23 · cache 97%**; 5-hour window 24% used. Caveat recorded: this session has been compacted twice but never reset, so the per-dispatch rate is higher than a cold start would give.

## Plan cost

**Measured: gate exploration only** — 3 `Explore` dispatches (~341k subagent tokens) plus main-session analysis. No `task-planner` dispatch; the skip was flagged at the gate and approved.

## Tasks

- id: t1
  summary: Engineer onboarding — clone to running app to first deploy, with the trip hazards that actually bite.
  owns:
    - docs/engineer-onboarding.md
  depends_on: []
  done_when: |
    1. REFERENCE INTEGRITY, scripted and reported: every backticked file path in the
       doc exists on disk, and every `path:line` citation names a file with at least
       that many lines. Write the checker in the session scratchpad (NOT the repo),
       run it, and paste the output including how many references were checked.
       A checker that reports 0 references checked is a broken checker - print the
       count so "all clean" cannot be confused with "found nothing".
    2. Every npm script named in the doc exists in package.json's `scripts` block.
    3. CLI syntax is derived from the PARSING CODE, not from prose elsewhere, and the
       doc states explicitly that `--week=26` does NOT work (flags are space-separated
       because scripts/import-json.ts:16-19 uses indexOf). `--progress` is either
       omitted or documented as silently dropped.
    4. The doc states the Node floor (>=20.9.0, transitive from Next) AND that the repo
       pins nothing - verify those absences yourself (no `engines`, no .nvmrc, no
       .node-version, no .github/) and report what you checked.
    5. The trip-hazard section covers at least: the two-trigger demo fallback and why
       widening it is forbidden; `prepare: false`; one-`sql.begin()`-or-deadlock and
       that no `max` is safe; the `globalThis` pool singleton; why the file is
       `proxy.ts` and that a `middleware.ts` would be SILENTLY ignored; the `??`
       prohibition on the connection chain; `tsconfig` excluding `scripts/`; lint
       exiting 1 by design; and that `npm run seed` occupies Weeks 20-24, which is
       also the diagnostic for a broken deployment.
    6. Points at `.env.example` rather than restating it, and at
       `docs/reference/deployment.md` for deploy specifics.
    7. Contains NO how-to for the in-app import UI, backup/restore/reset flows, or
       metric definitions - those belong to docs/user-guide.md (t2). Link, don't cover.
    8. Every internal Markdown link resolves to a real file/anchor.
    9. Credential scan against `.env.local`, booleans only, WITH a positive control
       (something known present must be found). Never print a secret value.
    10. No live deployment URL hardcoded.
  docs_touched:
    - docs/engineer-onboarding.md
  claimed_by: "flow-implementer/t1"
  state: done
  changelist: |
    - docs/engineer-onboarding.md (NEW, 414 lines) — clone → running app → deploy,
      for a developer who has never seen the repo. Sections: what the app is ·
      toolchain (Turbopack default, Tailwind 4 CSS-first) · Node-is-not-pinned
      (audit table of what was checked) · 4 setup steps · CLI syntax read from the
      parsing code · read-path/write-path map · verify loop · shipping a change ·
      16 trip hazards · known gaps · where-to-go-next table.
      56 `path:line` citations, all re-derived from code, none from another doc.
      Links out to docs/user-guide.md, README.md, docs/reference/*.md, .env.example
      and .claude/rules/*.md; covers no t2/t3 material.
  verification: |
    - Reference integrity (scratchpad t1-check-refs.mjs, NOT in repo):
      210 references examined — 122 inline-code file paths (56 of them path:line
      citations), 1 glob, 45 markdown links, 17 anchors, 8 module specifiers and
      17 URL routes classified; 5 deliberately-absent paths asserted absent
      (tailwind.config.ts/js, .github/, data/import.csv, middleware.ts).
      PROBLEMS: 0. Positive control on a seeded file caught exactly its 5 planted
      faults (bad line, missing path, reversed range, dead anchor, dead link).
    - npm scripts: 8 named in the doc, 8 defined in package.json, 0 missing.
    - Credential scan vs .env.local: 8 secrets/derived fragments (incl. URI host,
      user, password), positive controls 8/8 found in .env.local, 0 present in the
      doc; negative control clean. No value printed. 7 credential-shape patterns
      (vercel.app, supabase.co, pooler host, sb_publishable_, sb_secret_, live
      postgres URI, bare email) all clean, with a synthetic positive control.
    - md5 data/clash.db unchanged: 8ee3eae9651cd860b90c0abff758d497.
    - npm run lint re-measured: exit 1, 10 problems (9 errors + 1 warning) —
      the approved baseline, quoted in the doc. `npm run build` NOT run: the change
      is a single new Markdown file, and a build writes .next/ while the owner's
      untouchable dev server is on :3000.
  findings: |
    - Ledger cited lib/mock-data.ts:19-25 for the demo WEEKS array; the array is
      actually at lines 18-24 (entries 19-23). Doc cites 18-24.
    - NEW, not in the pack: scripts/import-csv.ts:12 defaults to `data/import.csv`,
      a file this repo does not ship (samples are data/sample-*.csv/json). Bare
      `npm run import` therefore dies with an ENOENT from readFileSync. Documented
      as a rough edge; NOT fixed (docs-only order).
    - The session scratchpad is shared across parallel subagents: t2's run
      overwrote t1's checker filename mid-task. Prefix scratchpad files per task.

- id: t2
  summary: Admin user guide — what the app tracks, what every metric means, and every action that can lose data.
  owns:
    - docs/user-guide.md
  depends_on: []
  done_when: |
    1. REFERENCE INTEGRITY: same scripted check as t1 item 1, same reported count.
    2. Documents BOTH double-meanings explicitly, each with its two code citations:
       Participation (keys/max on clash tables vs weeks-active/weeks-present on
       /members) and Trend (damage-per-key vs previous global week on clash tables
       vs total damage vs that member's most recent prior PRESENT week on the member
       page). State plainly that the same column name means different things.
    3. All three ingest paths with correct semantics: in-app JSON = REPLACE of the
       chosen (week, clash); CSV CLI = UPSERT; member week edit = UPSERT of that
       member's TWO clash rows. Note the replace deletes only pairs present in the
       payload.
    4. Documents the member-edit side effects: both clash rows are always written, so
       editing a Hydra-only member creates a Chimera 0/0 row; and em-dash (absent)
       week rows are editable, so editing one adds that member to the week and can
       change who counts as "Active".
    5. Ranks the destructive actions honestly and states that RESTORE HAS NO
       CONFIRMATION - it runs the moment the file is chosen - whereas Reset requires
       typing RESET exactly. Do not soften this.
    6. States the recovery path: export a backup, keep the JSON, restore is the only
       undo for a bad import, a reset, or a mis-edit.
    7. Documents what an anonymous visitor sees and that write controls are HIDDEN
       (not disabled), and that the server refuses independently of the UI.
    8. Documents accepted damage formats including that an unrecognized string
       silently becomes 0 on the import paths but is rejected on member edit.
    9. Key caps (Hydra 3, Chimera 2) and that clash dates are derived from the real
       schedules in UTC, never entered.
    10. Written for the owner-admin, in plain language - no code walkthroughs, no
        setup instructions (t1 owns those). Every claim still traced to code.
    11. Every internal Markdown link resolves; credential scan with positive control;
        no live URL hardcoded.
  docs_touched:
    - docs/user-guide.md
  claimed_by: "flow-implementer/t2"
  state: done
  changelist: |
    - docs/user-guide.md (NEW, 479 lines) — admin-facing guide. Sections: read-this-first
      (4 hazards); what the app tracks (key caps + UTC-derived clash schedule); the six
      sidebar pages plus the two deliberate absences (no sign-in link, /import redirects);
      "the two words that mean two things" (Participation across 5 sites in 2 formulas,
      Trend across 3 sites in 2 formulas, plus Progress = clan key usage); the data model
      in clan terms (implicit member creation, name slug, derived Active, benched vs
      absent); the three ingest paths with replace/upsert semantics and the payload-scoped
      delete; member-edit side effects (forced Chimera 0/0 row, editable em-dash rows);
      damage formats and the silent-0-vs-rejected asymmetry; backups as the only undo;
      six destructive actions ranked (Restore first — no confirmation); what an anonymous
      visitor sees (hidden not disabled, server refuses independently); failure UX per
      action; a weekly routine; See-also links.
    - Ledger: t2 claimed then set done.
  verification: |
    Reference integrity (scratchpad checker, positive control passed): 136 references
    checked — 91 path:line citations, 12 backticked file paths, 23 URL routes resolved
    against app/, 10 internal Markdown links. Problems: 0. Control run with 4 seeded
    faults reported exactly 4 and exited 1.
    Credential scan: .env.local parsed (4 vars), 9 secret substrings hunted (values,
    password, host, user, project ref); positive control fired; doc clean; 6 independent
    shape checks (connection URI, supabase host, pooler host, JWT, sb_ key, email) all
    absent. No URL of any kind in the doc — no live deployment URL.
    md5 data/clash.db = 8ee3eae9651cd860b90c0abff758d497 (unchanged).
    Build not run: the change is markdown-only (git status shows no non-doc file
    touched) and `next build` shares .next/ with the owner's untouchable dev server
    on :3000.
  findings: |
    - Brief said "three ways data gets in". There are more: `npm run import:json` with a
      FLAT array is also a REPLACE (scripts/import-json.ts:44), while the nested
      {week,clashes} shape upserts (scripts/import-json.ts:50). Documented as a note
      under the CSV path.
    - Participation has 5 render sites, not 2, but only 2 formulas — the member page's
      Lifetime/per-clash cards use totalKeys/(weeksPresent*maxKeys) (lib/compute.ts:235),
      which is the same key-usage family. /members alone is attendance.
    - Trend has 3 render sites: the member page's per-clash card badge
      (app/members/[memberId]/page.tsx:57) reuses the CLASH-TABLE damage-per-key figure
      (lib/compute.ts:219-224), not the history column's total-damage figure.
    - Undocumented asymmetry found and written up: clash-table Trend coerces a missing
      baseline to 0% (lib/compute.ts:162 `?? 0`), so "0%" there can mean "no prior data",
      while the member page shows an em-dash for the same case.
    - Not a bug, but reported not fixed: lib/import.ts:107 references
      `Database/test-week.json`; a root `Database/` folder does exist. t3 owns that fix.
    - Not a bug, but reported not fixed: scripts/import-json.ts:43 passes a `progress`
      field in FlatMeta, which lib/import.ts:114-119 does not declare — invisible only
      because tsconfig excludes scripts/. Confirms `--progress` is silently dropped.

- id: t3
  summary: README becomes a scannable hub with the dependency table and two Mermaid diagrams; reconcile three drifted claims.
  owns:
    - README.md
    - docs/reference/data-pipeline.md
    - docs/project-map.md
  depends_on: [t1, t2]
  done_when: |
    1. README is a HUB, target 150-220 lines. It must NOT re-explain import semantics
       (t2 owns) or setup detail (t1 owns) - it links to them.
    2. Full dependency table: all 8 runtime + 10 dev packages with the version from
       package-lock.json (the installed one, not just the declared range) and a
       one-line "what it does HERE" citing a file. Note that
       `@supabase/supabase-js` and `react-dom` have no direct imports but are
       structurally required (peer dep / renderer) - not dead.
    3. TWO Mermaid diagrams that parse: (a) the deploy pipeline local -> commit ->
       GitHub -> Vercel (`main` -> production, other branches -> preview) -> ONE
       shared Supabase project, drawing the preview-writes-production edge; (b) the
       write pipeline - three entry points -> lib/parse.ts -> lib/import.ts ->
       persist(payload, "upsert"|"replace") -> Postgres, with requireAdmin() drawn
       as the gate every arrow crosses.
    4. The Pages table is COMPLETE - currently it omits `/login`,
       `/members/[memberId]` and `/import`. Verify against app/ yourself.
    5. Resolves the DATABASE_URL contradiction by stating BOTH truths: you do not
       NEED to set it on Vercel (the fallback chain works), and you SHOULD where you
       can, because a generic POSTGRES_URL from any unrelated integration silently
       becomes the app's database. Do not delete either half.
    6. Hedges the production-branch claim the way CLAUDE.md:5 and
       docs/project-map.md:9 already do - README is the last site asserting it flatly.
    7. Fixes the `Database/test-week.json` example, which points at a root folder the
       same file's layout block does not list. Check what actually exists.
    8. One line saying what root ONBOARDING.md / TUTORIAL.md / SCAFFOLD-MANIFEST.md
       are (agent-scaffold docs, not app docs), so a human is not lured into them.
    9. Adds a pointer to `SUPABASE_SECRET_KEY`'s standing risk (README is currently
       silent on it) - by link to docs/reference/deployment.md, not by duplication.
    10. `docs/reference/data-pipeline.md`'s demo-mode refusal row is corrected against
        the SHIPPED copy at lib/results.ts (Phase 4 changed it; the doc did not follow).
    11. `docs/project-map.md`'s `/import` description is corrected - it is a real route
        that 307-redirects to /settings; the import UI lives in the Settings tab.
    12. Links to docs/engineer-onboarding.md and docs/user-guide.md, and every
        internal link in all three owned files resolves. Nothing links to docs/tasks/.
    13. Credential scan across all three owned files with a positive control; no live
        URL hardcoded; `md5 data/clash.db` unchanged.
  docs_touched:
    - README.md
    - docs/reference/data-pipeline.md
    - docs/project-map.md
  claimed_by: "flow-implementer/t3"
  state: done
  changelist: |
    - README.md (REWRITTEN, 214 → 220 lines) — now a hub, not a manual. Sections:
      3-sentence what-it-is · a where-to-read table pointing at t1's and t2's new
      docs plus the four references · 5-command quick start · the three data states ·
      a COMPLETE 9-route Pages table (adds /login, /members/[memberId] and /import,
      the last documented as a verified 307 redirect) · deploy Mermaid diagram with
      the preview-writes-production edge drawn dotted, and the production-branch
      claim hedged as the owner's report · the DATABASE_URL synthesis (both halves
      kept) · a SUPABASE_SECRET_KEY pointer by deep link, no duplication · write-
      pipeline Mermaid diagram with requireAdmin() as the gate · the full 8+10
      dependency table at locked versions · a layout block re-derived from the real
      tree (adds Database/, data/, docs/, public/, Assets UI/, .claude/rules/) · one
      line naming ONBOARDING/TUTORIAL/SCAFFOLD-MANIFEST as agent-scaffold docs.
      REMOVED (now owned elsewhere): the import-semantics walkthrough, the JSON/CSV
      column reference, the sign-in setup block, backup/restore/reset how-to.
    - docs/reference/data-pipeline.md — member-edit row's demo-mode refusal corrected
      against the SHIPPED copy at lib/results.ts:61-72: it is a 400 before any other
      validation, and Phase 4's copy names both steps AND both environments (local
      .env.local + db:migrate; deployed POSTGRES_URL, where neither exists). Added
      "do not shorten it back". Citation made unambiguous
      (app/api/members/[memberId]/results/route.ts:38-39, not bare route.ts:38-39).
    - docs/project-map.md — /import corrected from a bare route listing to "not a
      page: a two-line redirect("/settings") answering 307"; components ~20 → 21;
      data/ entry now names the three tracked samples and adds Database/ (tracked,
      test-week.json, the shape lib/import.ts:107 cites); new docs/ structure entry
      covering the two new human docs and stating docs/tasks/ is not documentation;
      Ingest semantics corrected — npm run import:json picks mode by file SHAPE, so
      a flat array REPLACES (scripts/import-json.ts:44); two new Open unknowns (the
      TrendBadge ?? 0 bug and the data/import.csv ENOENT), both recorded not fixed.
    - Ledger: t3 claimed, then done.
  verification: |
    All checkers in the session scratchpad, prefixed t3-, none in the repo.
    - Reference integrity (t3-check-refs.mjs, all three owned files):
      204 REFERENCES CHECKED — 39 markdown link targets, 1 anchor, 27 path:line
      citations, 107 backticked file paths, 27 URL routes resolved against a tree
      walk of app/, 3 asserted-absent paths (tailwind.config.ts, middleware.ts,
      data/import.csv) confirmed still absent. PROBLEMS: 0. Nothing links to
      docs/tasks/ (checked as an explicit rule, not an absence).
      Control: an 8-fault fixture (dead link, dead anchor, line past EOF, reversed
      range, missing path, docs/tasks link, undefined route, asserted-absent-but-
      present) reported 9 problems covering all 8 classes and exited 1; a
      zero-reference file exits 2 with "the checker is broken".
      Two real defects were caught and fixed by this run: a dead deployment.md
      anchor (a CRLF bug in my own slugger, not the doc) and an ambiguous bare
      `route.ts:38-39` citation matching 6 files.
    - Mermaid (t3-check-mermaid.mjs, real mermaid 11.16.1 parser under jsdom):
      2 blocks parsed, 0 failures. Control: a 3-block fixture with an unquoted-paren
      label and a malformed edge reported exactly 2 failures and passed the valid
      one; a file with no blocks exits 2.
    - Dependency versions (t3-check-deps.mjs): 18 direct deps (8 runtime + 10 dev),
      18 rows parsed from README's tables, every version compared against
      package-lock.json's installed `version` field. PROBLEMS: 0. lockfileVersion 3,
      517 packages. Nothing eyeballed.
    - Credential scan (t3-check-secrets.mjs, booleans only, no value printed):
      9 fragments derived from .env.local (full values, db user, password both raw
      and percent-encoded, host, project ref) + 8 shape patterns (live postgres URI,
      *.supabase.co, pooler host, sb_publishable_, sb_secret_, JWT, *.vercel.app,
      bare email). Positive controls: 9/9 fragments found in .env.local, 8/8 shapes
      fired on a synthetic string. All three owned files: 0 hits. No live deployment
      URL anywhere.
    - md5 data/clash.db = 8ee3eae9651cd860b90c0abff758d497 (unchanged); git status
      shows only the three owned files modified.
    - npm run lint: exit 1, "✖ 10 problems (9 errors, 1 warning)" — the approved
      baseline, unchanged. `npm run build` NOT run: markdown-only change, and a build
      writes .next/ while the owner's untouchable dev server holds :3000 (same call
      t1 and t2 made).
    - README length: 220 lines, inside the 150-220 target.
  findings: |
    - done_when item 7 was based on a false premise and was overridden at dispatch:
      Database/test-week.json EXISTS and is tracked (29-entry flat array), so
      README's `npm run import:json -- Database/test-week.json --clash hydra`
      example was valid. The real defect was the layout block never listing
      Database/. Fixed that way in both README and project-map.
    - done_when item 3 asks for requireAdmin() as "the gate every arrow crosses".
      That is false for the two CLI entry points: scripts/ hold the connection
      string directly and never touch an HTTP handler. The diagram draws the guard
      on the HTTP arrows only and labels the CLI bypass explicitly, because drawing
      it as universal would be a security-shaped lie.
    - README's `/import` 307 was measured, not assumed: GET localhost:3000/import →
      307, Location /settings (a read-only request against the owner's running dev
      server; nothing restarted).
    - Confirming t2's correction: the terminal is NOT uniformly upsert. Recorded in
      README, project-map and (already) user-guide.
    - Recorded, not fixed (docs-only order): the TrendBadge null-vs-0 defeat at
      lib/compute.ts:162, and `npm run import` with no argument dying on ENOENT
      because scripts/import-csv.ts:12 defaults to an unshipped data/import.csv.
      Both are now in docs/project-map.md's Open unknowns.
    - t1/t2 cross-check while linking: no broken claims found in either doc. t1's
      mock-data.ts:18-24 correction is right (the ledger's 19-25 was wrong).
      One nit in t1, not mine to edit: docs/engineer-onboarding.md:39 says
      "the repo still contains data/clash.db" — true, but it is untracked and
      gitignored (.gitignore:40), alongside data/active-db.json and
      data/clash-test.db. README's layout block says "untracked" explicitly.

- id: t4
  summary: Review fix pass — clear the nine flow-reviewer findings, including the two
    doc-sync FAILs (a README example project-map still cites, and .claude/rules/ux.md
    pointing at README as the user-facing doc).
  owns:
    - README.md
    - docs/engineer-onboarding.md
    - docs/user-guide.md
    - docs/project-map.md
    - .claude/rules/ux.md
    - .claude/rules/data-pipeline.md
  depends_on: [t1, t2, t3]
  done_when: |
    1. docs/project-map.md:30 no longer cites a README `npm run import:json` example
       (deleted this order). The `lib/import.ts:107` half stays.
    2. .claude/rules/ux.md's terminology pointer names docs/user-guide.md, with the
       existing ONBOARDING/TUTORIAL parenthetical KEPT and extended to record that the
       pointer has now drifted twice. (`.claude/rules/` was an order non-goal; this
       edit and item 9 were explicitly authorised at dispatch.)
    3. Both pipeline diagrams stop routing the member-edit path through a bare
       lib/import.ts normalize node — verified from code: lib/results.ts:7 imports only
       TYPES from ./import, builds the ImportPayload itself at :120-132 and calls
       persist(payload,"upsert") at :133. Mermaid re-parsed with a real parser plus a
       control that proves it can fail.
    4. README's payload-scoped-delete restatement is cut back to the link that follows
       it (t3's scope said README must NOT re-explain import semantics). Diagram labels
       and the other four documents are left alone.
    5. docs/user-guide.md's em-dash-vs-0% bullet is qualified as column-vs-card, not
       member-page-vs-clash-table — the member page shows BOTH on the same page.
    6. docs/user-guide.md names all four /login render sites, keeping the (correct)
       claim that demo mode shows no /login link anywhere.
    7. docs/engineer-onboarding.md:39 says data/clash.db is untracked and gitignored,
       so a fresh clone does not have it.
    8. Four loose docs/user-guide.md statements corrected: the Members Participated
       citation, the "two decimals" claim about lib/format.ts, "Export button on every
       page", and Reset's table count.
    9. .claude/rules/data-pipeline.md carries the flat-array-CLI-replaces correction
       and the same member-edit pipeline correction as item 3.
    10. Reference integrity across all six owned files, with the count printed and a
        seeded-fault control; every internal Markdown link resolves; credential scan
        with a positive control; md5 data/clash.db unchanged; npm run lint at the
        approved 9-errors + 1-warning baseline.
  docs_touched:
    - README.md
    - docs/engineer-onboarding.md
    - docs/user-guide.md
    - docs/project-map.md
    - .claude/rules/ux.md
    - .claude/rules/data-pipeline.md
  claimed_by: "flow-implementer/t4"
  state: done
  changelist: |
    - docs/project-map.md — the Database/ entry no longer claims README uses
      test-week.json in an `npm run import:json` example; that example was deleted by
      t3's rewrite. The `lib/import.ts:107` half kept (re-verified: the comment at
      :107 does cite Database/test-week.json). [finding 1]
    - .claude/rules/ux.md — "Content & clarity" now points at docs/user-guide.md.
      The ONBOARDING/TUTORIAL history is kept and extended into a two-drift record,
      with the test a future reader can apply (whichever doc names the metrics,
      actions and states in the user's words). Authorised at dispatch. [finding 2]
    - README.md — the write-pipeline Mermaid diagram's normalize node relabelled
      "normalize / build the payload · lib/import.ts (import paths) · lib/results.ts
      (member edit)". Parens written as #40;/#41; to match the PERSIST node and
      because the control run proves an unquoted-paren label fails to parse.
      [finding 3]
    - README.md — the payload-scoped-delete restatement (2 lines) cut; the paragraph
      is now just the hand-off to docs/user-guide.md and docs/engineer-onboarding.md,
      as t3's scope required. 220 → 219 lines. [finding 4]
    - docs/engineer-onboarding.md — the write-path ASCII diagram redrawn as TWO lanes
      (import paths → lib/import.ts; member edit → lib/results.ts), plus a short
      paragraph naming what is and is not shared, cited to lib/results.ts:7, :120-132,
      :133 and :8. [finding 3]
    - docs/engineer-onboarding.md:39 — data/clash.db is now described as untracked and
      gitignored (`.gitignore:40`), so a fresh clone does not have it. [finding 7]
    - docs/user-guide.md — the "no baseline" bullet reframed as COLUMN vs CARD: a
      first-week member sees an em-dash in the history column and 0% in the Hydra/
      Chimera card badges on the same page (cards re-read the clash-table figure,
      lib/compute.ts:219-224 over :162). [finding 5]
    - docs/user-guide.md — all four /login link sites named (settings:245,
      ImportPanel:98, DataManagement:113, MemberHistoryTable:72); the demo-mode
      no-link claim kept and attributed to the demo branch each one takes. [finding 6]
    - docs/user-guide.md — four loose statements corrected: Members Participated cited
      as `lib/compute.ts:103` over `:106`; "rounded to two decimals" replaced with
      two for B/M and ONE for K (`lib/format.ts:4-6`); "Export button on every page"
      replaced with the six data pages (Settings and /login have none); Reset now
      says all four tables incl. clash_meta (`lib/backup.ts:10`, `:52-57`).
      [finding 8]
    - .claude/rules/data-pipeline.md — line 11 carries the same two-builder correction
      as the diagrams; the semantics list gains the `npm run import:json`-picks-by-
      shape rule (flat array REPLACES, scripts/import-json.ts:44; nested upserts, :50)
      and the payload-scoped delete. Authorised at dispatch. [findings 3, 9]
    - Ledger: t4 added, claimed, then done.
  verification: |
    All checkers in the session scratchpad, prefixed t4-, none in the repo.
    - Reference integrity (t4-check-refs.mjs, all six owned files):
      657 REFERENCES CHECKED — 94 markdown link targets, 18 anchors, 195 path:line
      citations, 234 backticked file paths, 85 URL routes resolved against a tree walk
      of app/, 11 asserted-absent paths, 3 node_modules references, 17 module
      specifiers (543 further code spans classified as non-paths). PROBLEMS: 0.
      Control: a 12-fault fixture (dead link, dead anchor, dead self-anchor,
      docs/tasks link, line past EOF, reversed range, missing path:line file,
      undefined route, asserted-absent-but-present, unresolvable path, missing
      node_modules ref) reported exactly 12 and exited 1, while four negative controls
      in the same file (em-dash heading anchor, valid route, valid path:line, module
      specifier) stayed silent. A zero-reference file exits 2 with "the checker is
      broken".
      FOUR CHECKER BUGS inherited from t3's copy were found and fixed before trusting
      it — the first is exactly the false-positive class the reviewer warned about:
      its slugger kept every char in A-￿, which INCLUDES the em dash, so all four
      "#step-N--..." links into its own headings read as dead. GitHub strips
      punctuation, so the class is \p{L}\p{N}_- plus space. The links were always
      right. Also fixed: node_modules/ references (real on disk, outside the indexed
      tree), bare module specifiers (`next/headers`, `react-hooks/rules-of-hooks`),
      and `/api` as a route PREFIX. 15 reported problems → 0 real ones.
    - Mermaid (t4-check-mermaid.mjs, real mermaid 11.16.1 under jsdom 30.0.1):
      README's 2 blocks parsed, 0 failures, after the relabel. Control: a 3-block
      fixture — the edited node verbatim, plus an unquoted-paren label and a malformed
      edge — reported exactly 2 failures and passed the edited node; a file with no
      blocks exits 2. The unquoted-paren failure is why the label uses #40;/#41;.
    - Credential scan (t4-check-secrets.mjs, booleans only, no value printed):
      9 fragments derived from .env.local (full values, db user, password raw and
      percent-encoded, host, project ref) + 8 shape patterns (live postgres URI,
      *.supabase.co, pooler host, sb_publishable_, sb_secret_, JWT, *.vercel.app,
      bare email). Positive controls 9/9 and 8/8 fired; all six owned files: 0 hits.
      No live deployment URL anywhere.
    - md5 data/clash.db = 8ee3eae9651cd860b90c0abff758d497 (unchanged).
    - npm run lint: exit 1, "✖ 10 problems (9 errors, 1 warning)" — the approved
      baseline, unchanged. `npm run build` NOT run, per the dispatch: markdown-only
      change, and a build writes .next/ while the owner's untouchable dev server
      holds :3000 (same call t1, t2 and t3 made).
  findings: |
    - NOT MINE TO FIX, reported: CLAUDE.md:27 still states the pipeline in the
      inaccurate three-stage form ("parse → normalize (lib/import.ts) → persist"),
      which is where all three new docs inherited it. .claude/rules/data-pipeline.md
      is fixed here; CLAUDE.md needs the main session.
    - Reviewer error in finding 8: the CSV Export control renders on SIX routes, not
      five. Besides TopBar on /, /timeline, /members and the two clash pages
      (components/ClashDetailView.tsx:66), app/members/[memberId]/page.tsx:233 renders
      ExportButton directly. Documented as "every data page … and each member page".
    - Reviewer imprecision in finding 8a: the Members Participated sentence describes
      a FRACTION whose two halves are at lib/compute.ts:103 (participants.length) and
      :106 (totalMembers = rows.length). Citing only :103 would have documented half
      the claim, so the doc now cites both.
    - Confirmed from code, not from the brief: lib/results.ts imports only types from
      ./import (`import type { ClashType, ImportPayload, NormalizedRow }`, :7), calls
      parseDamage from ./parse (:8, used at :32), builds the payload at :120-132 and
      persists at :133. No normalizer runs on the member-edit path. The brief was
      right on every point here.
    - Recorded, not fixed (docs-only order, and outside the authorised two edits):
      .claude/rules/data-pipeline.md:27 lists the six API routes as
      `members/[id]/results` / `members/[id]/avatar`, but the real segment is
      [memberId]. It reads as placeholder shorthand rather than a citation, and
      finding 9 authorised only lines 11 and 14 — flagged rather than edited.
    - The reviewer's "111 links resolve" figure is not directly comparable: it covered
      the five docs t1-t3 owned. This run covers six files (adding the two rules docs)
      and counts 94 link targets + 18 anchors = 112, 0 problems.
