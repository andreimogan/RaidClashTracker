// Server-only: apply db/schema.sql to a libSQL client. Shared by the db:init
// script and the in-app database switch (to initialize the Test DB on demand).
import { readFileSync } from "node:fs";
import type { Client } from "@libsql/client";

// Parse db/schema.sql into individual statements. Comment lines are stripped
// first, then PRAGMA is dropped — it's a no-op inside libSQL's batch
// transaction and FK ordering is handled explicitly by the writers.
export function schemaStatements(): string[] {
  const schema = readFileSync("db/schema.sql", "utf8");
  return schema
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !/^pragma/i.test(s));
}

// Idempotent — every statement uses IF NOT EXISTS, so this is safe to re-run.
export async function ensureSchema(db: Client): Promise<void> {
  await db.batch(schemaStatements(), "write");
}
