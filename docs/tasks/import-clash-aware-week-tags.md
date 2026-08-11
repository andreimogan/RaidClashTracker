# Task ledger: import-clash-aware-week-tags

order: "let's improve the import data tab page, especially the json import. Currently, whenever i do not have uploaded data for a week, i get \"no data\" wording. If i upload data for hydra for example i see the wording \"has data\". If i stay on the same week and select chimera and i don't have data uploaded for chimera for that week, i still get \"has data\". I want that wording to be dependend on the hydra/chimera selection and if with that selection i have data added."
status: done
created: 2026-08-07

<!-- Backfilled: this order was planned in plan mode and dispatched as a single
     one-file slice, so no ledger was created up front. Recorded here after the
     fact, per the handoff contract (flagged by flow-reviewer). -->

## Tasks

- id: t1
  summary: Make the import week picker's has-data tag and date range follow the selected clash; refresh server data after a successful import/sync
  owns:
    - components/ImportPanel.tsx
  depends_on: []
  done_when: >
    In the Settings > Import week <select>, a week with only Hydra rows reads
    "has data" under Hydra and "no data" under Chimera (and vice versa); the
    listed date range follows the selected clash's window; after a successful
    JSON import or sheet sync the tags and overwrite warning update without a
    manual reload; the canonical Hydra week window still drives the write path;
    npm run build passes.
  claimed_by: ui-design-specialist
  state: done
  docs_touched: []
  changelist:
    - components/ImportPanel.tsx — weekNumber/clashType useState moved above the
      weekOptions memo so it can close over clashType; hasData changed from the
      hydra+chimera sum to (existingData[n]?.[clashType] ?? 0) > 0; per-week
      clashWindow(...) second arg "hydra" -> clashType for the listed range;
      clashType added to the memo deps
    - components/ImportPanel.tsx — router.refresh() (reusing the existing router)
      in the success branch of importJson() and syncSheet(); res.ok now checked
      alongside data.ok; setConfirmOverwrite(false) on import success
    - components/ImportPanel.tsx — clash toggle got role="group" aria-label="Clash"
      + aria-pressed per button; stale `window` comment renamed to `clashDates`
  notes: >
    Display-only fix — existingData was already per-clash from app/settings/page.tsx,
    and the whole write path (client body -> /api/import -> normalizeFlatResults ->
    persist) was already clash-correct. canonical = clashWindow(wed, "hydra") is
    deliberately left Hydra-anchored: it is the stored week row, not display.
    No living doc describes the week picker (grepped docs/, ONBOARDING.md,
    TUTORIAL.md), and no token or primitive changed, so docs_touched is empty.
    npm run build passes; the 4 npm run lint errors in this file are pre-existing
    (verified against HEAD by the reviewer).
