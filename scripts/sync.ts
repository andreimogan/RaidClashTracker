// Phase 5 — one-command weekly sync: read a raw RaidToolkit dump, normalize the
// clash data, and upsert it into Supabase.
//
// Usage:
//   npm run sync -- --week 25 --start 2026-06-10 --end 2026-06-16 [--file data/raw/dump-XXXX.json]
//
// If --file is omitted, the most recent data/raw/dump-*.json is used. Run
// `npm run extract` first to produce one. If normalization can't find clash data,
// fall back to `npm run import` with a CSV.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { normalizeDump } from "./rtk/normalize";
import { persist, type WeekInfo } from "./lib/persist";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function latestDump(): string {
  const dir = "data/raw";
  const files = readdirSync(dir).filter((f) => f.startsWith("dump-") && f.endsWith(".json"));
  if (!files.length) throw new Error("No data/raw/dump-*.json found. Run `npm run extract` first.");
  files.sort();
  return join(dir, files[files.length - 1]);
}

async function main() {
  const weekNumber = Number(arg("week"));
  const startDate = arg("start");
  const endDate = arg("end");
  if (!weekNumber || !startDate || !endDate) {
    throw new Error("Required: --week <n> --start <YYYY-MM-DD> --end <YYYY-MM-DD>");
  }

  const file = arg("file") ?? latestDump();
  console.log(`Reading dump: ${file}`);
  const dump = JSON.parse(readFileSync(file, "utf8"));

  const rows = normalizeDump(dump, weekNumber);
  const week: WeekInfo = { weekNumber, startDate, endDate };
  await persist(rows, [week]);
  console.log(`Sync complete for week ${weekNumber} (${rows.length} rows).`);
}

main().catch((err) => { console.error("Sync failed:", err.message ?? err); process.exit(1); });
