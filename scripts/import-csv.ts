// CSV importer (upsert). Usage: npm run import -- data/import.csv
// Columns: week_number, start_date, end_date, player, clash_type, keys_used,
//          total_damage [, progress]. total_damage accepts 16.61B shorthand.
import "./lib/load-env";
import { readFileSync } from "node:fs";
import { parseCsv } from "../lib/parse";
import { normalizeCsvRecords } from "../lib/import";
import { persist } from "../lib/persist";
import { closeDb } from "../lib/db";

async function main() {
  const path = process.argv[2] || "data/import.csv";
  const payload = normalizeCsvRecords(parseCsv(readFileSync(path, "utf8")));
  const s = await persist(payload, "upsert");
  console.log(`CSV import complete: ${s.results} results across weeks ${s.weekNumbers.join(", ")}.`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err.message ?? err);
    process.exitCode = 1;
  })
  // Close the pool or the process keeps the pooler connection open and hangs.
  .finally(() => closeDb());
