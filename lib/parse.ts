// Pure parsing helpers shared by the file CSV importer, the Google Sheet sync,
// and the JSON importer. No Node/DB imports — safe in the browser too.

// Parse "16.61B" / "250M" / "900K" shorthand or a raw number into a number.
// null / undefined / "" (e.g. a benched player's damage) → 0.
export function parseDamage(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  if (typeof raw === "number") return Math.round(raw);
  const s = raw.trim().toUpperCase().replace(/,/g, "");
  if (!s) return 0;
  const m = s.match(/^([\d.]+)\s*([BMK]?)$/);
  if (!m) return Number(s) || 0;
  const n = parseFloat(m[1]);
  const mult = m[2] === "B" ? 1e9 : m[2] === "M" ? 1e6 : m[2] === "K" ? 1e3 : 1;
  return Math.round(n * mult);
}

// Minimal RFC-4180-ish CSV parser → array of header-keyed records.
// Handles quoted fields, escaped quotes, and CRLF/LF line endings.
export function parseCsv(text: string): Record<string, string>[] {
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
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }

  const header = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}
