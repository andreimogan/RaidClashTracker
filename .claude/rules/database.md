---
paths:
  - "db/**"
  - "lib/db.ts"
  - "scripts/db-init.ts"
---

- Two local databases — Production (`data/clash.db`) and Test (`data/clash-test.db`) — switched from Clan Settings via the pointer file `data/active-db.json` (`lib/db.ts`). Setting `DATABASE_URL` pins a single DB (e.g. hosted Turso) and disables switching; `DATABASE_AUTH_TOKEN` is remote-only.
- Keep all SQL libSQL-compatible: it must run identically against a local `file:` SQLite and hosted Turso — that zero-code-change deploy path is a locked decision.
- `db/schema.sql` is the single schema source; `npm run db:init` applies it. There is **no migration framework** — any schema change must ship with a one-off migration script in `scripts/` (or explicit reset instructions) so existing local DBs survive.
- Never break the demo fallback: an empty or missing DB renders `lib/mock-data.ts`, and that must keep working after schema changes.
