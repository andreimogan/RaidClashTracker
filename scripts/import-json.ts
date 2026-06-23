// JSON importer (upsert). Usage: npm run import:json -- data/week25.json
// Accepts the nested per-week shape (single object or array). See lib/import.ts.
import "./lib/load-env";
import { readFileSync } from "node:fs";
import { normalizeWeekJson } from "../lib/import";
import { persist } from "../lib/persist";

async function main() {
  const path = process.argv[2] || "data/import.json";
  const payload = normalizeWeekJson(JSON.parse(readFileSync(path, "utf8")));
  const s = await persist(payload, "upsert");
  console.log(`JSON import complete: ${s.results} results across weeks ${s.weekNumbers.join(", ")}.`);
}

main().catch((err) => { console.error("Import failed:", err.message ?? err); process.exit(1); });
