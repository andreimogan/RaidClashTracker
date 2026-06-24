// Initializes (or upgrades) the local SQLite database by applying db/schema.sql.
// Safe to re-run — all statements use IF NOT EXISTS. Run: `npm run db:init`.
import "./lib/load-env";
import { mkdirSync } from "node:fs";
import { getDb, activeDbUrl } from "../lib/db";
import { ensureSchema, schemaStatements } from "../lib/schema";

async function main() {
  const url = activeDbUrl();
  // Ensure the parent dir exists for the default local file path.
  if (url.startsWith("file:")) {
    mkdirSync("data", { recursive: true });
  }
  await ensureSchema(getDb());
  console.log(`Initialized database at ${url} (${schemaStatements().length} statements).`);
}

main().catch((err) => {
  console.error("db:init failed:", err.message ?? err);
  process.exit(1);
});
