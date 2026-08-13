# Task ledger: phase1-retire-sheet-sync-and-db-switcher

order: "Phase 1 of the approved Supabase + Vercel + Admin Auth roadmap: retire the Google Sheet sync and the in-app Production/Test database switcher, staying entirely on local SQLite, so phases 2–5 (Postgres port, auth, deploy, hardening) have less surface to port. Parent brief: 'I want to use Supabase as my database … and i also want to put this on my hosting provider … i do not have a secured login system as well that i think i would need because i don't want anyone to be able to import stuff.'"
status: done   # flow-reviewer PASS (no CRITICAL/HIGH); 4 MEDIUM + 5 LOW findings folded in before commit
created: 2026-08-12T08:20:51Z

## Context pack

**Goal.** Delete two features from a working local-SQLite app so phases 2–5 have less surface to port: the Google Sheet sync, and the in-app Production/Test database switcher. No Postgres, no auth, no deploy work here. The app must build and run on local SQLite when this ships.

The switcher is the higher-value removal: `activeEnv()` does a synchronous `readFileSync` of `data/active-db.json` and `app/layout.tsx` calls it, so today **every page render of every route touches the filesystem** — precisely what breaks on Vercel.

**Stack (from package.json, pinned).** next 16.2.9 · react/react-dom 19.2.4 · @libsql/client ^0.17.4 · tailwindcss ^4 + @tailwindcss/postcss · recharts ^3.9.0 · lucide-react ^1.21.0 · typescript ^5 · eslint ^9 + eslint-config-next 16.2.9 · tsx ^4.22.4 · dotenv ^17.4.2. **No test suite.** Verify with `npm run build` + `npm run lint` + clicking through `/settings` (both tabs), `/`, `/members`.

### THE SEAM — `lib/db.ts`'s export list (owned by t2, frozen here)

- **Survives, signature unchanged:** `getDb()`, `activeDbUrl()`, `isRemoteDb()`
- **Deleted:** `DbEnv`, `DB_FILES`, `POINTER_PATH`, `isEnvOverride`, `dbUrlFor`, `activeEnv`, `setActiveEnv`, `getDbFor`, and both `node:fs` imports
- **New resolution:** one URL, `DATABASE_URL || "file:data/clash.db"`. Keep the module-level `clients` Map cache and `intMode: "number"`.
- `activeDbUrl()` must survive: `scripts/db-init.ts:5,9` uses it (that file needs **no** change). `isRemoteDb()` must survive: `app/settings/page.tsx:78` still distinguishes a `DATABASE_URL`-pinned remote DB from the local file.

### SECOND SEAM — `POST /api/reset` becomes a no-body endpoint

t1 stops sending `{ target }`; t2 stops reading it and uses `getDb()`. Safe in either landing order: the old route falls back to `activeEnv()` when `target` is absent, which resolves to the same DB `getDb()` returns.

### Files in play

- `lib/db.ts` (71 lines) — the only libSQL client construction in the app. `node:fs` :2 · `DbEnv` :12 · `DB_FILES` :14-17 · `POINTER_PATH` :19 · `isEnvOverride` :22 (module-level, evaluated at import) · `dbUrlFor` :24 · `activeEnv` :28 (**`readFileSync` per call**) · `setActiveEnv` :38 (the server's only filesystem writes) · `activeDbUrl` :43 · `isRemoteDb` :47 · `clients` :52 · `getDbFor` :54 · `getDb` :68.
- `app/layout.tsx` — `activeEnv` :7,21; gold TEST banner :26-34. `Link` and `FlaskConical` are used **only** in the banner — remove the imports or lint fails.
- `app/settings/page.tsx` — imports :6; `active`/`dbUrl`/`remote` :20-22; **raw DB URL printed :84** (info leak once hosted); sheet-sync step in the "Updating the Data" list :112 and `npm run sync:sheet` :114; `<DatabaseSwitcher>` :119; `<DataManagement active>` :121; `active`/`envOverride` passed to `<ImportPanel>` :134-135. `Database` icon at :64 stays (Weeks Tracked card).
- `components/DatabaseSwitcher.tsx` — whole file dies; POSTs `/api/database` :41.
- `components/ImportPanel.tsx` (448 lines) — type-only `DbEnv` :11 · `active`/`envOverride` props :61-62 · destination switch state + POST `/api/database` :66-82 · destination pill UI :225-229 and :233-268 · `NEXT_PUBLIC_GOOGLE_SHEET_URL` + `localStorage("clash:sheetUrl")` :193-196 · `syncSheet()` POST `/api/sheet-sync` :198-220 · sheet section UI :413-444. **Keeps:** the JSON import flow, week/clash pickers, `existingData` overwrite warning, `POST /api/import` :164, `router.refresh()` on success. `Sheet`, `RefreshCw`, `Database`, `FlaskConical` icons become unused — remove them.
- `components/DataManagement.tsx` — type-only `DbEnv` :6 · `ResetControl({target,isActive})` :26 · `active` prop :105 · `activeLabel` :137 · backup `<a href="/api/backup">` :149 (unchanged) · **two** `ResetControl`s, one per DB, :173-174 → collapse to one.
- `app/api/reset/route.ts` — **added to scope by the planner; it is not optional.** Imports `getDbFor`, `activeEnv`, `type DbEnv` :3 and branches on `body.target` :14-19. Left alone, `npm run build` fails. Rewrite: ignore the body, `getDb()`, `ensureSchema`, `resetDatabase`, `{ ok: true }`; fix the header comment (it currently promises per-database targeting).
- `app/api/database/**`, `app/api/sheet-sync/**`, `lib/sheets.ts`, `scripts/sync-sheet.ts` — deleted whole. `lib/sheets.ts` consumers are only those two files.
- `package.json:14` (`sync:sheet`) · `.env.example:11-15` (sheet vars) · `scripts/lib/load-env.ts:2` (comment names `GOOGLE_SHEET_URL`).
- **`README.md`** — missing from the original scope. 8 references: line 9 (data-in paths), the whole "Option A — Google Sheet sync" section 62–74, line 105, and the structure block 142/144/146.
- **`.claude/agents/db-migration-specialist.md:19`** — instructs future agents to "respect the two-DB switcher (`lib/db.ts`, pointer `data/active-db.json`)". **`.claude/agents/data-pipeline-specialist.md:3`** — its `description` names `lib/sheets.ts` and `sheet-sync`; that field is the orchestrator's dispatch-matching text, so strike only those two tokens. **`.claude/rules/data-pipeline.md:6`** — the **frontmatter `paths:`** globs `"lib/sheets.ts"`; easy to miss while editing prose.

### Untouched — do not edit

`getDb()`'s other consumers all keep working unchanged: `lib/data.ts:5`, `lib/persist.ts:3`, `lib/backup.ts:2`, `lib/members.ts:1`, `scripts/seed.ts:4`, `scripts/db-init.ts:5`, and the `api/import`, `api/backup`, `api/restore`, `api/members/*` routes. `lib/schema.ts` (`ensureSchema`) **stays** — Phase 2 deletes it. `lib/seed.ts` (`seedDemo`) **stays** for `scripts/seed.ts`. `lib/results.ts:59`'s hard-coded `getDataSource() !== "sqlite"` — leave it, Phase 2 owns it. Also untouched: `compute.ts`, `import.ts`, `types.ts`, `week.ts`, `mock-data.ts`, `persist.ts`, `backup.ts`, `members.ts`, `data.ts`, `app/import/page.tsx` (a bare redirect to `/settings`).

**Ledger amended mid-order (orchestrator, after t3 reported):** `lib/parse.ts` moved out of "untouched" and into **t2's `owns`**. Its header comment at `:1-2` names "the Google Sheet sync" as a consumer; t3 found it, no task owned it, and it would otherwise have survived the phase as a knowingly-stale reference. Comment text only — the parsing logic is out of scope.

### Binding constraints

- **Data safety: no task may list `data/` in its `owns`.** `data/clash.db` and `data/clash-test.db` are never modified or deleted. `data/active-db.json` becomes unread but is **not** deleted by code; leave `.gitignore:42` in place.
- The app builds and runs on local SQLite at the end of every wave — no broken window.
- Style only via `app/globals.css` tokens (`.claude/rules/ui.md`); never hardcode hex. Pages stay server components; client components stay leaf-level.
- **This Next.js differs from training data** — read the relevant guide in `node_modules/next/dist/docs/` before touching `app/layout.tsx` or any route (`AGENTS.md`).
- Removing a feature includes removing its docs *and* its `.claude/rules/` references, frontmatter `paths:` included.
- **Pre-existing lint state at HEAD: 4 errors, all in `components/ImportPanel.tsx`** — a file t1 edits. Capture `npm run lint` at HEAD **before** editing and diff against it; do not assume you caused them, and do not be surprised if the deletions incidentally fix some. (6 further errors + 1 warning come from untracked `.claude/scripts/*.js` — not ours.) This figure comes from the 2026-08-11 build-log entry, not from the planner's own run — verify it yourself.

### Relevant prior decisions (docs/build-log.md)

- 2026-08-07 + 2026-08-11: display-only changes left the write path untouched deliberately. Same posture here — this phase deletes surface; it does not change JSON/CSV import or `persist()` semantics.
- 2026-08-11: hold the cached prefix from step 1 to step 7 — no model or effort switch mid-order (`.claude/conventions/cache-discipline.md`). Two breaks cost +85% last time.

### Non-goals — do not re-litigate

Postgres/Supabase, auth, deploy, `lib/results.ts`'s data-source check, `lib/schema.ts` and `lib/seed.ts` removal, the README "Deploy to Turso" section and the Turso-compat rule bullet (all Phase 2+ — rewriting them now means rewriting them twice). Deleting `data/*.db` or `data/active-db.json`. Touching `.gitignore`. **`ONBOARDING.md` / `TUTORIAL.md` — grepped, zero references, deliberately excluded** (they document the agent scaffold, not the app).

### Open items

- `app/api/*` remains unauthenticated. Unchanged by this phase; Phase 3 gates it.
- After `/api/database` dies, nothing auto-creates-and-seeds a DB on first touch (`seedDemo` had exactly one server caller). Intended — note it in the build log.

## Cost forecast

**Estimate: 6.3M tokens** (range 5.3M–7.3M) · ~$12.40 at the one measured blended rate
- Everything else (analyze, plan, gate, integrate, review) — 2.4M
- Parallel build, 3 tasks (t1 UI incl. a 448-line component · t2 server · t3 docs) — 1.6M
- Report + commit — 1.3M
- Bounce allowance (1 review bounce) — 1.0M

Basis: **not calibrated.** `docs/build-log.md` holds exactly one `Cost:` line (2026-08-11, est 4.6M → actual 8.5M, +85%) and the log flags it as an outlier — 2 mid-order cache breaks from model switches plus 1.8M of gate iteration, both non-recurring. So the shipped baselines in `.claude/conventions/cost-forecast.md` are the spine (overhead 1.4M · 3 × 430K · integrate 450K · review 460K · report 1.3M ≈ 4.9M before bounce), uplifted ~15% for Opus rates and a repo larger than a handful of files. Three `Cost:` lines are needed before history replaces baselines. $/M derived from that single order ($16.78 / 8.5M ≈ $1.97/M at 91% cache). Range low = no bounce; high = two.
Deflators: the survey is largely sunk (a full exploration ran earlier this session), and deletion work writes far less than it reads. Inflator: 3 tasks means the integrator runs.
**`ux-specialist` declined by the user** (would have been +~0.4M); its copy-coherence check is folded into `flow-reviewer`'s brief instead, at no extra dispatch.
Window at plan time: **unknown** — sensor reading 12h51m stale (24% used, 76% left); `/usage` is the authority.

## Plan cost

**Measured: 2.1M tokens** (main 2.0M + task-planner 90.1k) · ~33% of the forecast above — high because this session also produced the whole 5-phase roadmap, not just this phase.

## Tasks

- id: t1
  summary: Remove every UI consumer of the sheet sync and the DB switcher; delete DatabaseSwitcher.
  owns:
    - app/layout.tsx
    - app/settings/page.tsx
    - components/ImportPanel.tsx
    - components/DataManagement.tsx
    - components/DatabaseSwitcher.tsx
  depends_on: []
  done_when: >
    `components/DatabaseSwitcher.tsx` is deleted and nothing imports it. `app/layout.tsx`
    imports nothing from `@/lib/db`, renders no TEST banner, and no longer imports `Link`
    or `FlaskConical`. `app/settings/page.tsx` imports only `isRemoteDb` from `@/lib/db`,
    prints no DB URL anywhere, renders no switcher, passes no `active`/`envOverride` to
    `ImportPanel` or `DataManagement`, and its "Updating the Data" list mentions neither
    the Sheet nor `npm run sync:sheet` while still reading correctly as an ordered
    procedure. `ImportPanel` has no destination pill group, no `/api/database` or
    `/api/sheet-sync` fetch, no `NEXT_PUBLIC_GOOGLE_SHEET_URL`, no
    `localStorage("clash:sheetUrl")`, no `DbEnv`, and no unused icon imports; the JSON
    import flow, week/clash pickers, overwrite warning and `router.refresh()` all still
    work. `DataManagement` takes no props, renders exactly one reset control, and its
    `/api/reset` POST sends no `target`. `npm run build` passes; `npm run lint` shows no
    NEW errors vs HEAD (capture HEAD's output first). `/settings` renders both tabs, and a
    JSON import into the current week still succeeds.
  docs_touched: []
  claimed_by: "ui-design-specialist"
  state: done
  changelist:
    - app/layout.tsx — dropped `activeEnv` import + the gold TEST banner; removed the now-unused
      `Link` and `FlaskConical` imports. Imports nothing from `@/lib/db`. Root layout is no longer
      `async` (it had no `await` left and layouts don't re-render — `next/dist/docs/01-app/
      03-api-reference/03-file-conventions/layout.md`). -16 lines.
    - app/settings/page.tsx — imports only `isRemoteDb` from `@/lib/db`; dropped `active`/`dbUrl`.
      Data Source card no longer prints the DB URL (info leak) or a Production/Test label; it now
      reads remote-vs-local off `isRemoteDb()` alone. "Updating the Data" lost the Sheet step and
      `npm run sync:sheet`, and was resequenced into UI order (open tab → pick week/clash → paste
      JSON + Import) so it still reads as an ordered procedure at 5 steps. `<DatabaseSwitcher>`
      removed; `<DataManagement />` and `<ImportPanel>` take no `active`/`envOverride`.
    - components/DatabaseSwitcher.tsx — deleted (`git rm`); no importers remain.
    - components/ImportPanel.tsx — deleted the destination-database pill group, `switchTo()` +
      `/api/database` POST, the whole Google Sheet Sync section, `syncSheet()` + `/api/sheet-sync`
      POST, `NEXT_PUBLIC_GOOGLE_SHEET_URL`, `localStorage("clash:sheetUrl")`, the `DbEnv` type
      import and the `Sheet`/`RefreshCw`/`Database`/`FlaskConical` icons. -138 lines. JSON import
      flow, week/clash pickers, derived dates, preview, overwrite warning, `POST /api/import` and
      `router.refresh()` all untouched.
    - components/ImportPanel.tsx (bug fix) — `ResultBanner` branched on
      `summary.mode === "replace" ? "Synced" : "Imported"`, but `/api/import` persists the flat
      payload the panel always sends with mode `"replace"`, so every panel import already read
      "Synced N results". Verified live: `{"ok":true,...,"mode":"replace"}`. Now always "Imported" —
      the last piece of sync vocabulary in the UI.
    - components/DataManagement.tsx — `DataManagement` takes no props; `ResetControl` takes none
      either (was `{target, isActive}`); `/api/reset` POST sends no body and no
      `Content-Type`/`JSON.stringify`. One control instead of two, so the box's duplicate
      `Trash2` + "Reset X database" heading was dropped (the "Danger zone" header above it already
      titles it) and the copy gained an export-a-backup-first nudge. Type-`RESET` confirmation and
      the `<a href="/api/backup">` export link are unchanged.
  verification:
    - Lint HEAD vs now — HEAD: 10 errors + 1 warning (4 errors in ImportPanel at 130:19, 151:36,
      151:57, 195:5; 6 errors + 1 warning in untracked `.claude/scripts/*.js`). Now: 9 errors + 1
      warning. ImportPanel 4 → 3: deleting the sheet-URL effect removed the `set-state-in-effect`
      error at old 195:5. The other 3 are the same pre-existing errors on the same JSON-flow code
      (line numbers shifted 130→107, 151→128). **Zero new errors.**
    - `npm run build` passes (Next 16.2.9, TypeScript clean).
    - Exercised against an isolated DB (`DATABASE_URL=file:<scratchpad>/verify.db`, `npm run
      db:init`, `next start -p 3002`) so `data/` was never written: `POST /api/import` with the
      exact body shape the panel sends → `{"ok":true,"summary":{"members":2,"weeks":1,"results":2,
      "weekNumbers":[7],"mode":"replace"}}`; `POST /api/reset` with **no body** →
      `{"ok":true,"target":"production"}`, confirming the pack's second-seam claim that the old
      route falls back to `activeEnv()`. `/settings`, `/`, `/members`, `/hydra`, `/chimera`,
      `/timeline` all 200 before and after. `data/` mtimes unchanged; scratch DB deleted.
  notes:
    - docs_touched is empty by design (all docs sit in t3). Checked `docs/reference/design-system.md`
      anyway: zero references to the switcher, the sheet section or the destination pills, and this
      task added no token or primitive — no doc-sync gap.
    - Only the active settings tab is server-rendered (`SettingsTabs` is a client toggle) and
      `ImportPanel` is a client component, so the Import tab's markup is absent from the HTML/RSC
      payload — it cannot be asserted by curl. Its props contract is compile-checked and its write
      path was exercised directly via `/api/import`.

- id: t2
  summary: Collapse lib/db.ts to one DATABASE_URL, delete the sheet-sync and database routes/lib/script, fix /api/reset.
  owns:
    - lib/db.ts
    - lib/sheets.ts
    - app/api/database/**
    - app/api/sheet-sync/**
    - app/api/reset/route.ts
    - scripts/sync-sheet.ts
    - scripts/lib/load-env.ts
    - lib/parse.ts
    - package.json
    - .env.example
  depends_on: [t1]
  done_when: >
    `lib/db.ts` exports exactly `getDb`, `activeDbUrl`, `isRemoteDb` (signatures
    unchanged), resolves `DATABASE_URL || "file:data/clash.db"`, keeps the module-level
    `clients` Map and `intMode: "number"`, and imports nothing from `node:fs`.
    `lib/sheets.ts`, `app/api/sheet-sync/`, `app/api/database/` and `scripts/sync-sheet.ts`
    no longer exist and nothing references them. `app/api/reset/route.ts` ignores the
    request body, uses `getDb()`, still calls `ensureSchema` then `resetDatabase`, and its
    header comment no longer describes per-database targeting. `package.json` has no
    `sync:sheet`; `.env.example` has no sheet vars; `scripts/lib/load-env.ts`'s comment no
    longer names `GOOGLE_SHEET_URL`. `grep -rn "node:fs" lib/` returns nothing.
    `npm run build` and `npm run lint` pass. `npm run db:init` still works and needs no
    edit (it uses `activeDbUrl()`) — if it does need one, that is a finding to report.
    Reset from Settings still wipes the DB and the page reflects it.
  docs_touched: []
  claimed_by: "flow-implementer"
  state: done
  changelist:
    - lib/db.ts — 71 → 32 lines. Both `node:fs` imports gone, and with them `DbEnv`,
      `DB_FILES`, `POINTER_PATH`, `isEnvOverride`, `dbUrlFor`, `activeEnv`, `setActiveEnv`,
      `getDbFor`. Exports are now exactly `activeDbUrl()`, `isRemoteDb()`, `getDb()` with
      unchanged signatures. `activeDbUrl()` became the resolver itself
      (`process.env.DATABASE_URL || "file:data/clash.db"`) rather than delegating to a
      private helper; `getDb()` absorbed `getDbFor`'s body and calls `activeDbUrl()`.
      Module-level `clients` Map, `authToken`, `intMode: "number"` and the lazy-create
      comment all unchanged. Header comment rewritten to one DB + an explicit
      no-filesystem-I/O note (the `readFileSync`-per-render cost this phase removes).
    - app/api/reset/route.ts — `POST(request: Request)` → `POST()`; no body is read at all,
      so `target` can't be spoofed. Imports `getDb` only. `ensureSchema` → `resetDatabase`
      order unchanged; response is `{ ok: true }` (the echoed `target` is gone — t1's client
      reads only `data.ok`). Header comment no longer promises per-database targeting.
      `runtime`/`dynamic` exports untouched.
    - app/api/database/route.ts — deleted (`git rm`). Was the only server-side `seedDemo`
      caller and the only `setActiveEnv` caller.
    - app/api/sheet-sync/route.ts — deleted (`git rm`).
    - lib/sheets.ts — deleted (`git rm`); both consumers died with it.
    - scripts/sync-sheet.ts — deleted (`git rm`).
    - package.json — dropped the `sync:sheet` script. No dependency changes (`dotenv` and
      `tsx` are still used by the surviving CLI entries).
    - .env.example — dropped the 5-line Google Sheet block; the Turso lines stay (Phase 2+).
    - scripts/lib/load-env.ts — comment no longer names `GOOGLE_SHEET_URL`.
    - lib/parse.ts — header comment only (ledger amendment): "shared by the file CSV importer
      and the JSON importer". Parsing logic byte-unchanged.
  verification:
    - Lint: baseline captured before editing = 9 errors + 1 warning (3 errors in
      `components/ImportPanel.tsx` at 107:19, 128:36, 128:57; 6 errors + 1 warning in
      untracked `.claude/scripts/*.js`). After: **identical** 9 errors + 1 warning, same
      files, same line:col. Zero new. This slice adds no lintable client code.
    - `npm run build` passes (Next 16.2.9, TypeScript clean). The route manifest now lists
      `/api/backup /api/import /api/members/[memberId]/{avatar,results} /api/reset
      /api/restore` — `/api/database` and `/api/sheet-sync` are gone from the build output.
    - `grep -rniE "sheets|sync-sheet|sync:sheet|sheet-sync|GOOGLE_SHEET|api/database|getDbFor|
      activeEnv|setActiveEnv|isEnvOverride|DbEnv|DB_FILES|dbUrlFor"` across `app lib
      components scripts package.json .env.example` → no matches.
    - `npm run db:init` works **untouched**: run with `DATABASE_URL` pointed at a scratch DB
      it printed `Initialized database at file:<scratch>/t2-verify.db (7 statements)`, i.e.
      `activeDbUrl()` still resolves correctly for it. No edit needed — the seam held.
    - Reset seam exercised live on `next start -p 3005` (3000 left alone) against the scratch
      DB: seeded → `/api/backup` reported 30 members / 5 weeks and `/settings` rendered
      "Weeks Tracked 5"; `POST /api/reset` with **no body and no Content-Type** (exactly what
      t1's client sends) → `{"ok":true}`; then backup reported 0 members / 0 weeks and
      `/settings` rendered "Weeks Tracked 0". Repeated a second time after a re-seed — same
      result. `/ /hydra /chimera /timeline /members /settings` all 200; `/import` 307
      (its redirect); `/api/database` and `/api/sheet-sync` return 404 for GET and POST.
    - Data safety: no `replace`-mode import was ever fired at `data/`. All exercise ran
      against `DATABASE_URL=file:<scratchpad>/t2-verify.db`, outside the repo, deleted after.
      md5 of `data/clash.db`, `data/clash-test.db` and `data/active-db.json` identical before
      and after the whole task (8ee3eae9…, afc141db…, a5c8eb16…). `data/active-db.json` is
      now unread by code but still present, per the binding constraint.
    - Line endings: every file I wrote is LF, matching untouched neighbours (`lib/persist.ts`,
      `app/api/restore/route.ts`). Git's "LF will be replaced by CRLF" warning is a
      pre-existing repo-wide autocrlf condition, not something this slice introduced.
  notes: >
    Findings against the pack. (a) **`done_when`'s "`grep -rn "node:fs" lib/` returns nothing"
    is unachievable and contradicts the pack itself**: `lib/schema.ts:3` imports `readFileSync`
    to read `db/schema.sql`, and the pack lists `lib/schema.ts` as untouched (Phase 2 deletes
    it). `lib/db.ts` — the actual intent, and what the frozen seam says — imports nothing from
    `node:fs`. Read that criterion as satisfied at the seam, not repo-wide. (b) **Stale comment
    left behind, outside my `owns`:** `lib/schema.ts:1-2` still says it is "Shared by the
    db:init script and the in-app database switch (to initialize the Test DB on demand)" —
    the switch no longer exists, so `ensureSchema`'s only remaining callers are `scripts/
    db-init.ts` and `/api/reset`. Phase 2 deletes the file, so this can ride along, but it is
    a knowingly-stale reference in the meantime (same class of miss as the `lib/parse.ts` one
    t3 caught). (c) Confirmed the pack's open item: with `/api/database` gone, `seedDemo`'s
    only caller is `scripts/seed.ts`. Nothing auto-creates-and-seeds a DB on first touch any
    more — `/api/reset` still calls `ensureSchema`, so it creates tables but leaves them
    empty. Intended; belongs in the build log. Judgment calls the ledger didn't cover:
    collapsing `activeDbUrl()` into the resolver instead of keeping a private `dbUrl()`
    helper it merely wrapped (one function, not two, for one URL); dropping `request` from
    the reset handler's signature entirely rather than accepting and ignoring it (Next 16
    route handlers may take zero args — `next/dist/docs/01-app/03-api-reference/
    03-file-conventions/route.md`); and leaving `.env.example`'s Turso block alone, since
    the non-goals reserve Turso wording for Phase 2+.

- id: t3
  summary: Strip sheet-sync and DB-switcher references from every doc, rule and agent brief.
  owns:
    - CLAUDE.md
    - README.md
    - docs/project-map.md
    - docs/reference/data-pipeline.md
    - .claude/rules/database.md
    - .claude/rules/data-pipeline.md
    - .claude/agents/db-migration-specialist.md
    - .claude/agents/data-pipeline-specialist.md
  depends_on: []
  done_when: >
    A case-insensitive grep for sheet-sync / sync:sheet / lib/sheets / GOOGLE_SHEET /
    active-db / clash-test / "Test database" / switcher across the owned files returns
    nothing (build-log and docs/tasks/ entries are historical and stay). Specifically:
    `CLAUDE.md` :13 :16 :18 :19 :20 updated; `README.md` line 9, the whole "Option A —
    Google Sheet sync" section (62–74), and the structure block (142/144/146) updated, with
    the surviving CSV path documenting its own columns rather than "same as the Sheet";
    `docs/project-map.md` :16 :21 :22 :24 updated (`db.ts` now = one DB via
    `DATABASE_URL || file:data/clash.db`); `docs/reference/data-pipeline.md` loses the
    Google Sheet row and the "Sheet CSV" pipeline source at :10, keeps three entry points
    (JSON import, CSV file, member week edit) and rewords :23; `.claude/rules/database.md`
    :8 rewritten to one database; `.claude/rules/data-pipeline.md` loses `"lib/sheets.ts"`
    from its **`paths:` frontmatter (:6)** and drops the "Sheet sync = mirror" bullet and
    the "(Sheet sync, …)" phrasing; `.claude/agents/db-migration-specialist.md` :19 no
    longer instructs agents to respect a two-DB switcher or the pointer file;
    `.claude/agents/data-pipeline-specialist.md` :3 loses `lib/sheets.ts` and `sheet-sync`
    from its `description` **and nothing else in that field changes**. Deliberately NOT
    touched: ONBOARDING.md, TUTORIAL.md, the README Turso-deploy section, the Turso-compat
    rule bullet, and `.gitignore`.
  docs_touched:
    - docs/reference/data-pipeline.md
  claimed_by: "flow-implementer"
  state: done
  changelist:
    - CLAUDE.md — dropped `sync:sheet` from Commands; api list now import/backup/restore/reset/avatar; `lib/` list loses `sheets.ts`; `data/` = one DB file (`clash.db` or `DATABASE_URL`); `scripts/` loses sync-sheet. No behavioural/operating-directive text touched.
    - README.md — "Data in" = JSON / CSV CLI / member week edit; deleted the whole "Option A — Google Sheet sync" section; Options B/C relabelled "JSON import (upload/paste)" and "CSV file (terminal)"; CSV now documents its own columns + required/optional rules + upsert semantics (verified against `normalizeCsvRecords` and `data/sample-import.csv`); added a 3-line "Editing one member's week" section so the "three ways" intro stays true; structure block updated.
    - docs/project-map.md — :16 write surface (added the pre-existing `members/[memberId]/results`); :21 `db.ts` = one DB via `DATABASE_URL || "file:data/clash.db"` + client cache; :22 dropped `sheets.ts`, added `results.ts`; :24 dropped `sync-sheet`; :25 dropped the pointer file; :31 ingest semantics rewritten to the three upsert/replace paths (not in done_when — extra reference found).
    - docs/reference/data-pipeline.md — pipeline source line = "JSON / CSV file / member week edit"; deleted the Google Sheet entry-point row (three rows remain); CSV row now documents its own columns, required-vs-optional fields and the parse path.
    - .claude/rules/database.md — :8 rewritten to the one-database rule, plus a forward-looking prohibition on a second DB / pointer file / runtime switch and on filesystem I/O in `lib/db.ts`. Turso-compat bullet (:9) untouched per non-goals.
    - .claude/rules/data-pipeline.md — removed `"lib/sheets.ts"` from the `paths:` frontmatter; ingest-path list and semantics bullets rewritten (CSV = upsert, member week edit = upsert added, Sheet-mirror bullet gone); "Import/sync/reset API routes" → "import/restore/reset".
    - .claude/agents/db-migration-specialist.md — :3 description drops `data/clash-test.db`; Purpose no longer says "both Production and Test"; :19 replaced with the one-database instruction (use `getDb()`/`activeDbUrl()`, never a second DB or switch); verify step targets a copy of `data/clash.db`.
    - .claude/agents/data-pipeline-specialist.md — :3 `description` loses `lib/sheets.ts`, `sheet-sync/` and the now-dead `/sync` in "CLI import/sync scripts"; nothing else in that field changed. Body: Purpose + invariants list rewritten (Sheet-mirror bullet replaced by CSV/member-edit upsert bullet); "test DB" → "a copy of the local DB".
  notes: >
    Judgment calls: (a) added a short README section for the member week edit — the intro
    promises three ways and the living doc lists three entry points, so documenting two
    would have been newly wrong; (b) struck a third token from
    data-pipeline-specialist's `description` ("CLI import/sync scripts" → "CLI import
    scripts") since the sync script ceases to exist — a narrowing deletion, no rewrite;
    (c) added `results.ts` / `members/[memberId]/results` to project-map lines I was
    already editing (pre-existing omissions, not new facts). Verification: the
    case-insensitive grep across all eight files returns nothing; second sweep for
    pointer/two-DB/Production/mirror/sync is clean too. `npm run build` passes and
    `npm run lint` shows 9 errors + 1 warning — the pre-existing HEAD state (ImportPanel +
    untracked `.claude/scripts/*.js`), none from this slice, which is markdown-only.
    NOT fixed (outside my `owns`, code files): `lib/parse.ts:1-2`'s header comment still
    says "shared by the file CSV importer, the Google Sheet sync, and the JSON importer" —
    `lib/parse.ts` is in the pack's "do not edit" list and in no task's `owns`, so it will
    survive this phase as a stale reference. Needs a follow-up or a scope note.

## Integration (integrator, all three slices)

All three slices landed in one working tree, so integration was reconciliation, not a branch
merge. No file was written by two tasks — `git status` shows 18 modified + 5 deleted, each
inside exactly one task's `owns`.

**Seams verified — all four held.**

- **Seam 1, `lib/db.ts`'s export list.** Repo-wide sweep for `DbEnv|DB_FILES|POINTER_PATH|
  isEnvOverride|dbUrlFor|activeEnv|setActiveEnv|getDbFor`: the only hits are inside this
  ledger (historical). No live importer anywhere — including `scripts/` and unowned files —
  references a deleted export. `lib/db.ts` exports exactly `activeDbUrl`, `isRemoteDb`,
  `getDb` and contains zero `node:fs`. **`scripts/db-init.ts` needed no edit**, as predicted:
  it uses `activeDbUrl()`, `getDb()` and `schemaStatements()`, all of which survive.
- **Seam 2, `POST /api/reset`.** Client (`components/DataManagement.tsx`) sends
  `fetch("/api/reset", { method: "POST" })` — no body, no `Content-Type` — and reads only
  `data.ok` and `data.error`. Handler is `POST()` with zero args returning `{ ok: true }` /
  `{ ok: false, error }`. The dropped `target` echo was never read. Lines up exactly.
- **Seam 3, docs vs final code.** t3's claims are true of the merged result:
  `docs/project-map.md`'s `db.ts` line (one DB, `DATABASE_URL || "file:data/clash.db"`,
  module-level `clients` Map, remote-only auth token) matches `lib/db.ts` verbatim; its
  write-surface list is exactly the six route files on disk and in the build manifest
  (`import`, `backup`, `restore`, `reset`, `members/[memberId]/results`,
  `members/[memberId]/avatar`) with `/api/database` and `/api/sheet-sync` absent from both;
  `docs/reference/data-pipeline.md` carries exactly three entry-point rows (JSON import,
  CSV file, member week edit). Its `lib/` inventory also matches all 16 surviving files.
- **Seam 4, deleted-file references.** `lib/sheets.ts`, `scripts/sync-sheet.ts`,
  `app/api/database/`, `app/api/sheet-sync/` and `components/DatabaseSwitcher.tsx` are gone
  from disk with no referrers. `ImportPanel`'s props (`weeks`, `currentWeek`, `existingData`)
  match the settings call site with no `active`/`envOverride`.

**Reconciled by the integrator (comment text only, no logic touched):**

- `lib/schema.ts:1-2` — the mandated fix. Header no longer claims it is shared with "the
  in-app database switch (to initialize the Test DB on demand)"; it now names its two real
  callers, the `db:init` script and `/api/reset`. `ensureSchema`/`schemaStatements` logic
  byte-unchanged; file not deleted (Phase 2 owns that).
- `lib/seed.ts:2` — **same class of miss, found by the integrator's sweep, not in any
  `owns` and not reported by any slice.** Said "Shared by the seed CLI script and the in-app
  Test DB setup"; that setup was `/api/database`, now deleted, so `seedDemo`'s only caller is
  `scripts/seed.ts`. Comment now says so. `seedDemo` logic untouched, file not deleted.

**Residual stale references NOT fixed — escalated for a decision, not bounced.** All are
comment/prose text about the removed features, all outside every task's `owns`, none affect
build, lint or behaviour:

- `lib/import.ts:1` ("CSV/Sheet records") and `:162` ("---- CSV / Google Sheet records ----").
- `lib/persist.ts:52` ("In replace mode, the sheet is the source of truth: …") — the most
  misleading of the four, since replace mode is now driven by the JSON import.
- `.claude/rules/ux.md:9` — cites "DB-switch disabled under `envOverride`" as a state-coverage
  precedent, which no longer exists and could mislead a future implementer.

`lib/import.ts` and `lib/persist.ts` are named in the pack's **"Untouched — do not edit"**
list, so the integrator did not edit them; `.claude/rules/ux.md` is agent configuration and
outside an integrator's remit. These need a scope decision (fold into a Phase 1 amendment, or
carry to Phase 2 alongside the `lib/schema.ts` / `lib/seed.ts` deletions).

**Build + lint on the merged whole:** `npm run build` passes (Next 16.2.9, TypeScript clean,
9 routes prerendered). `npm run lint` = **9 errors + 1 warning — identical to the baseline**:
3 in `components/ImportPanel.tsx` at 107:19, 128:36, 128:57 and 6 + 1 in the untracked
`.claude/scripts/{statusline-cache,token-report}.js`. No other file appears in the output.
**Zero new.**

**Data safety:** `data/` md5s byte-identical to t2's record, before and after integration —
`clash.db` 8ee3eae9651cd860b90c0abff758d497, `clash-test.db` afc141dbfa457e0d0f5805b68e4f582f,
`active-db.json` a5c8eb16f84cd6750c2fd8ceffca98b2. No import was fired at `data/` and no dev
server was started during integration (build and lint only), so no scratch DB was needed.

<!-- doc-sync note for flow-reviewer: CLAUDE.md, docs/project-map.md and
     docs/reference/data-pipeline.md each carry BOTH sheet-sync and switcher references, so
     splitting them between t1 and t2 would require co-ownership (forbidden). All docs sit
     in t3; t1 and t2 carry empty docs_touched by design. Verify doc-sync for the whole
     order against t3 — two empty lists are not a doc-sync miss. -->
