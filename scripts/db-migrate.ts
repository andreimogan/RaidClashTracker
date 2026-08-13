// Applies supabase/migrations/*.sql in filename order. Usage: npm run db:migrate
//
// There is deliberately NO applied-migrations table. Every migration is required
// to be written idempotently (`create table if not exists`, `create or replace
// view`, `add column if not exists`), so re-applying the whole set is a no-op —
// re-runnability is a property of the SQL, not of bookkeeping. A tracking table
// would also drift the moment a statement is run by hand in Supabase's SQL
// editor, which is exactly when you least want the runner to lie to you.
//
// The whole file goes over the wire as one simple (multi-statement) query, which
// is how the transaction pooler accepts DDL. Postgres wraps a simple query in an
// implicit transaction, so a file either applies completely or not at all.
import "./lib/load-env";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { closeDb, getDb } from "../lib/db";

const DIR = "supabase/migrations";

async function main() {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (!files.length) throw new Error(`No .sql migrations found in ${DIR}.`);

  const sql = getDb();
  for (const file of files) {
    const text = readFileSync(join(DIR, file), "utf8");
    // .unsafe(text) sends the file verbatim (no bind parameters, which a simple
    // query cannot carry); .simple() allows the multiple statements in it.
    await sql.unsafe(text).simple();
    console.log(`  applied ${file}`);
  }
  console.log(
    `Migrations applied: ${files.length} file${files.length === 1 ? "" : "s"}. ` +
      "Anything already in place was skipped.",
  );
}

main()
  .catch((err) => {
    console.error("Migration failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
