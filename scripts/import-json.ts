// JSON importer. Usage:
//   Flat (one clash):   npm run import:json -- <file> --clash hydra
//                       [--week 26 --start 2026-06-17 --end 2026-06-23 --progress 62.5]
//                       (week defaults to the current clash week; dates auto-fill
//                        for an existing week, replaces that (week, clash))
//   Nested {week,clashes}:  npm run import:json -- <file>   (upsert, back-compat)
import "./lib/load-env";
import { readFileSync } from "node:fs";
import { normalizeFlatResults, normalizeWeekJson, type ClashType } from "../lib/import";
import { persist } from "../lib/persist";
import { loadDataset } from "../lib/data";
import { sortedWeeks } from "../lib/compute";
import { clashWindow, currentWeek, weekWednesday } from "../lib/week";
import { closeDb } from "../lib/db";

const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const file = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : undefined;
  if (!file) {
    throw new Error("Usage: npm run import:json -- <file> [--clash hydra --week N --start … --end … --progress …]");
  }
  const parsed = JSON.parse(readFileSync(file, "utf8"));

  if (Array.isArray(parsed)) {
    const clash = flag("clash")?.toLowerCase() as ClashType;
    if (clash !== "hydra" && clash !== "chimera") {
      throw new Error('A flat array needs --clash hydra|chimera.');
    }
    const weeks = sortedWeeks(await loadDataset());
    const current = currentWeek(weeks);
    const weekNumber = flag("week") ? Number(flag("week")) : current.weekNumber;
    // Canonical week dates (Hydra Wed→next-Wed) derived from the schedule.
    const wed = weekWednesday(current.weekNumber, current.startDate, weekNumber);
    const canonical = clashWindow(wed, "hydra");
    const startDate = flag("start") ?? canonical.startDate;
    const endDate = flag("end") ?? canonical.endDate;
    const progress = flag("progress") != null ? Number(flag("progress")) : null;

    const payload = normalizeFlatResults(parsed, { weekNumber, startDate, endDate, clashType: clash, progress });
    const s = await persist(payload, "replace");
    console.log(`Flat import complete (replace): ${s.results} ${clash} results into week ${weekNumber}.`);
    return;
  }

  // Nested {week, clashes} — back-compat, upsert.
  const s = await persist(normalizeWeekJson(parsed), "upsert");
  console.log(`JSON import complete: ${s.results} results across weeks ${s.weekNumbers.join(", ")}.`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err.message ?? err);
    process.exitCode = 1;
  })
  // Close the pool or the process keeps the pooler connection open and hangs.
  .finally(() => closeDb());
