// Initializes (or upgrades) the local SQLite database by applying db/schema.sql.
// Safe to re-run — all statements use IF NOT EXISTS. Run: `npm run db:init`.
import "./lib/load-env";
import { readFileSync, mkdirSync } from "node:fs";
import { getDb, DATABASE_URL } from "../lib/db";

async function main() {
  // Ensure the parent dir exists for the default local file path.
  if (DATABASE_URL.startsWith("file:")) {
    mkdirSync("data", { recursive: true });
  }
  const db = getDb();

  const schema = readFileSync("db/schema.sql", "utf8");
  // Strip comment lines first, then split into individual statements. PRAGMA is
  // dropped — it's a no-op inside libSQL's batch transaction and FK ordering is
  // handled explicitly by the writers (members/weeks before results).
  const statements = schema
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !/^pragma/i.test(s));

  await db.batch(statements, "write");
  console.log(`Initialized database at ${DATABASE_URL} (${statements.length} statements).`);
}

main().catch((err) => {
  console.error("db:init failed:", err.message ?? err);
  process.exit(1);
});
