// Google Sheet sync (mirror/replace). Usage:
//   npm run sync:sheet -- "<sheet-url>"
//   (or set GOOGLE_SHEET_URL in .env.local and run with no argument)
// Pulls the published sheet's CSV and replaces each (week, clash) it contains.
import "./lib/load-env";
import { parseCsv } from "../lib/parse";
import { normalizeCsvRecords } from "../lib/import";
import { persist } from "../lib/persist";
import { fetchSheetCsv, toCsvExportUrl } from "../lib/sheets";

async function main() {
  const url = process.argv[2] || process.env.GOOGLE_SHEET_URL;
  if (!url) {
    throw new Error("Provide a sheet URL: npm run sync:sheet -- <url> (or set GOOGLE_SHEET_URL).");
  }
  const csv = await fetchSheetCsv(toCsvExportUrl(url));
  const payload = normalizeCsvRecords(parseCsv(csv));
  const s = await persist(payload, "replace");
  console.log(`Sheet sync complete (mirror): ${s.results} results across weeks ${s.weekNumbers.join(", ")}.`);
}

main().catch((err) => { console.error("Sync failed:", err.message ?? err); process.exit(1); });
