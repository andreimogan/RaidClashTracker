# Task ledger: member-week-edit

order: "I want to implement the following experience especially for things that i may miss adding with a json. I want, from a player's page, to be able to edit their hydra/chimera stats (key used, damage) from the week by week history table."
status: done
created: 2026-07-06

integration (2026-07-06): Seam verified by reading both sides — no code
changes needed; npm run build passes on the merged tree. URL/body/response
shapes match the contract exactly; keys sent as numbers (Number(input) after
B's integer/range pre-check), damage sent as raw string (every dialog state —
empty, "0", "16.61B", comma-grouped, whitespace-padded — is accepted by A's
grammar or rejected with a clear per-clash message); memberName =
member.inGameName satisfies slug()===id by persist()'s own invariant (ids are
created as slug(name), Unicode-aware). Two benign notes for review, not seam
breaks: (1) an emptied keys field submits as 0 (Number("") === 0) without
warning; (2) A's newline-joined multi-error message renders whitespace-
collapsed (single line) in B's error div — shown and readable, but
whitespace-pre-line would render it as authored.

Shared seam (both tasks implement to this contract, no shared type import):
POST /api/members/{encodeURIComponent(memberId)}/results
Request { memberName, weekNumber, hydra: { keys, damage }, chimera: { keys, damage } }
(damage: string | number, parseDamage server-side; both clash rows always written)
Responses: 200 { ok: true } · 400/500 { ok: false, error }

## Tasks

- id: A
  summary: Single-member weekly results write endpoint via the sanctioned pipeline
  owns:
    - lib/results.ts
    - app/api/members/[memberId]/results/route.ts
    - docs/reference/data-pipeline.md
  depends_on: []
  done_when: >
    POST /api/members/[memberId]/results validates (slug(memberName)===memberId;
    weekNumber is an existing tracked week; keys integer 0..MAX_KEYS[clash];
    damage via parseDamage, finite >= 0), guards demo mode (getDataSource() !==
    "sqlite" -> 400), takes week dates from the stored week, and writes both
    clash rows through persist(payload, "upsert") — no direct SQL. Response
    shapes match the avatar route convention. data-pipeline.md documents the
    endpoint. npm run build passes.
  claimed_by: data-pipeline-specialist
  state: done
  docs_touched:
    - docs/reference/data-pipeline.md
  changelist: >
    NEW lib/results.ts: upsertMemberWeekResults(memberId, input) — demo guard
    (getDataSource() !== "sqlite" → ValidationError), validates memberName
    (slug === memberId), weekNumber (positive integer, must be a stored week;
    start/end dates taken from ds.weeks, never the client), keys (number,
    integer, 0..MAX_KEYS[clash]), damage (number | "16.61B" string via
    parseDamage; strict grammar \d+(\.\d+)? [BMK]?; null/"" → 0 benched;
    garbage/multi-dot/negative rejected); builds the NormalizedRows from the
    STORED member's inGameName (a slug-equivalent memberName variant cannot
    rename the member) and calls persist(payload, "upsert") — no direct SQL.
    Exports ValidationError for the route's 400-vs-500 split. Review bounce
    addressed: silent-rename fix (MEDIUM) + damage grammar tightened (LOW).
    NEW app/api/members/[memberId]/results/route.ts: POST per avatar-route
    conventions (nodejs runtime, force-dynamic, awaited params,
    decodeURIComponent malformed-URL guard, json().catch(() => ({}))); 200
    {ok:true}, 400 {ok:false,error} on ValidationError, 500 otherwise.
    UPDATED docs/reference/data-pipeline.md entry-points table with the new
    endpoint (upsert, stricter validation than imports; stored-name note).
    Verified: npm run build passes; 21-assertion smoke run against
    data/clash-test.db (upsert in place, both rows written, all rejection
    cases incl. multi-dot damage, no phantom weeks, no rename via
    slug-equivalent name; original rows restored).

- id: B
  summary: All-weeks history table with per-week edit dialog on the member page
  owns:
    - components/MemberHistoryTable.tsx
    - app/members/[memberId]/page.tsx
    - docs/reference/design-system.md
  depends_on: []
  done_when: >
    Member page history lists ALL tracked weeks (absent weeks show em-dashes,
    no TrendBadge); pencil column opens a dialog (fixed overlay + .card panel,
    Escape/backdrop close) with the four fields (keys number inputs capped
    3/2, damage text inputs accepting "16.61B" shorthand); save POSTs the
    contract body then router.refresh(); readOnly (demo mode) hides pencils
    and shows the read-only note; CSV export maps the same merged rows;
    header shows "{weeksPresent} of {totalWeeks} weeks". design-system.md
    documents the dialog pattern. npm run build passes.
  claimed_by: ui-design-specialist
  state: done
  docs_touched:
    - docs/reference/design-system.md
  changelist: >
    NEW components/MemberHistoryTable.tsx ("use client"): all-weeks history
    table (absent rows render em-dashes, no TrendBadge), header
    "{weeksPresent} of {totalWeeks} weeks", pencil column (hidden when
    readOnly; readOnly note shown instead), EditWeekDialog (fixed inset-0
    z-50 bg-black/60 overlay + .card max-w-sm panel, Escape/backdrop close,
    mount-only state, 4 fields with parseDamage live preview, light key
    pre-validation, POST contract body → router.refresh()).
    app/members/[memberId]/page.tsx: getDataSource() → readOnly flag; merged
    historyRows built from all ds.weeks (desc) x profile.history; inline
    history section replaced by <MemberHistoryTable/>; CSV export maps the
    same merged rows (absent weeks → empty stat columns); removed now-unused
    formatDateRange import. docs/reference/design-system.md: new "Patterns"
    section (dialog, form fields, ghost icon button). Review fixes (bounce 1),
    all in MemberHistoryTable.tsx: damage fields now prefill the exact stored
    digits (String(row.*.damage)) instead of lossy formatDamage shorthand, so
    an untouched field round-trips byte-exact; dialog error div got
    whitespace-pre-line for A's newline-joined multi-error messages; local
    MAX_KEYS const replaced with the client-safe import from lib/constants.ts;
    first dialog input (Hydra keys) gets autoFocus so keyboard focus enters
    the overlay. npm run build passes.
