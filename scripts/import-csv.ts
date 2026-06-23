// CSV importer — the reliable data path (and the fallback if the RaidToolkit
// dump turns out not to contain clash damage history).
//
// Usage:  npm run import -- data/import.csv
//
// Expected columns (header row required, order-independent):
//   week_number, start_date, end_date, player, clash_type, keys_used, total_damage [, progress]
//   - clash_type: "hydra" | "chimera"
//   - total_damage: raw number (16610000000) OR human form (16.61B / 250M / 900K)
//   - start_date/end_date: YYYY-MM-DD (only need to be present once per week)
//   - progress (optional): clan clash completion %, applies per (week, clash)
import { readFileSync } from "node:fs";
import { persist, type ProgressInfo, type WeekInfo } from "./lib/persist";
import type { NormalizedRow } from "./lib/admin";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((f) => f.trim() !== "")) rows.push(row); }

  const header = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function parseDamage(raw: string): number {
  const s = raw.trim().toUpperCase().replace(/,/g, "");
  const m = s.match(/^([\d.]+)\s*([BMK]?)$/);
  if (!m) return Number(s) || 0;
  const n = parseFloat(m[1]);
  const mult = m[2] === "B" ? 1e9 : m[2] === "M" ? 1e6 : m[2] === "K" ? 1e3 : 1;
  return Math.round(n * mult);
}

async function main() {
  const path = process.argv[2] || "data/import.csv";
  const records = parseCsv(readFileSync(path, "utf8"));
  if (!records.length) throw new Error(`No rows found in ${path}`);

  const rows: NormalizedRow[] = [];
  const weeksMap = new Map<number, WeekInfo>();
  const progressMap = new Map<string, ProgressInfo>();

  for (const rec of records) {
    const weekNumber = Number(rec.week_number);
    const clashType = rec.clash_type?.toLowerCase() as "hydra" | "chimera";
    if (!weekNumber || (clashType !== "hydra" && clashType !== "chimera")) {
      throw new Error(`Bad row (week_number/clash_type): ${JSON.stringify(rec)}`);
    }
    rows.push({
      weekNumber,
      memberName: rec.player,
      clashType,
      keysUsed: Number(rec.keys_used) || 0,
      totalDamage: parseDamage(rec.total_damage || "0"),
    });
    if (rec.start_date && rec.end_date && !weeksMap.has(weekNumber)) {
      weeksMap.set(weekNumber, { weekNumber, startDate: rec.start_date, endDate: rec.end_date });
    }
    if (rec.progress) {
      progressMap.set(`${weekNumber}-${clashType}`, {
        weekNumber, clashType, progress: Number(rec.progress),
      });
    }
  }

  const missingDates = [...new Set(rows.map((r) => r.weekNumber))].filter((w) => !weeksMap.has(w));
  if (missingDates.length) {
    throw new Error(
      `Weeks missing start_date/end_date: ${missingDates.join(", ")}. ` +
        "Provide the dates at least once per week in the CSV.",
    );
  }

  await persist(rows, [...weeksMap.values()], [...progressMap.values()]);
  console.log("CSV import complete.");
}

main().catch((err) => { console.error("Import failed:", err); process.exit(1); });
