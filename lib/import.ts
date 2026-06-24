// Pure normalization: turn JSON (nested per-week) or CSV/Sheet records into the
// flat shape the persistence layer writes. Validation throws a descriptive Error.
// No Node/DB imports — usable in the browser for live preview.
import { parseDamage } from "./parse";

export type ClashType = "hydra" | "chimera";

export interface NormalizedRow {
  weekNumber: number;
  memberName: string;
  clashType: ClashType;
  keysUsed: number;
  totalDamage: number;
}

export interface WeekInfo {
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface ProgressInfo {
  weekNumber: number;
  clashType: ClashType;
  progress: number;
}

export interface ImportPayload {
  rows: NormalizedRow[];
  weeks: WeekInfo[];
  progress: ProgressInfo[];
}

const isClash = (v: unknown): v is ClashType => v === "hydra" || v === "chimera";

class ValidationError extends Error {}

function fail(errors: string[]): never {
  throw new ValidationError(errors.join("\n"));
}

// ---- Nested per-week JSON ----
// Accepts a single { week, clashes } object or an array of them.
export function normalizeWeekJson(input: unknown): ImportPayload {
  const weeksInput = Array.isArray(input) ? input : [input];
  const errors: string[] = [];
  const rows: NormalizedRow[] = [];
  const weeks: WeekInfo[] = [];
  const progress: ProgressInfo[] = [];

  weeksInput.forEach((entry, i) => {
    const where = weeksInput.length > 1 ? ` (entry ${i + 1})` : "";
    const obj = entry as Record<string, unknown>;
    const week = obj?.week as Record<string, unknown> | undefined;
    const weekNumber = Number(week?.number);
    const startDate = week?.startDate as string | undefined;
    const endDate = week?.endDate as string | undefined;

    if (!week || !weekNumber || !startDate || !endDate) {
      errors.push(`Missing or invalid "week" (need number, startDate, endDate)${where}.`);
      return;
    }
    weeks.push({ weekNumber, startDate, endDate });

    const clashes = obj.clashes as Record<string, unknown> | undefined;
    const present = clashes ? (Object.keys(clashes).filter(isClash) as ClashType[]) : [];
    if (!present.length) {
      errors.push(`Week ${weekNumber}: no clashes found (expected "hydra" and/or "chimera")${where}.`);
      return;
    }

    for (const clashType of present) {
      const section = clashes![clashType] as Record<string, unknown>;
      if (section?.progress != null && !Number.isNaN(Number(section.progress))) {
        progress.push({ weekNumber, clashType, progress: Number(section.progress) });
      }
      const results = section?.results;
      if (!Array.isArray(results)) {
        errors.push(`Week ${weekNumber} ${clashType}: "results" must be an array.`);
        continue;
      }
      results.forEach((r: Record<string, unknown>, j) => {
        const player = (r?.player as string)?.trim();
        const keys = Number(r?.keys);
        if (!player) errors.push(`Week ${weekNumber} ${clashType} row ${j + 1}: missing "player".`);
        if (Number.isNaN(keys) || keys < 0) errors.push(`Week ${weekNumber} ${clashType} row ${j + 1}: invalid "keys".`);
        if (r?.damage == null) errors.push(`Week ${weekNumber} ${clashType} row ${j + 1}: missing "damage".`);
        if (player && !Number.isNaN(keys) && r?.damage != null) {
          rows.push({
            weekNumber,
            memberName: player,
            clashType,
            keysUsed: keys,
            totalDamage: parseDamage(r.damage as string | number),
          });
        }
      });
    }
  });

  if (errors.length) fail(errors);
  if (!rows.length) fail(["No clash results found in the JSON."]);
  return { rows, weeks, progress };
}

// ---- Flat per-player array (one clash, week chosen in the UI) ----
// e.g. [{ player_name, damage_dealt, keys_used }] — see Database/test-week.json.
export interface FlatResult {
  player_name?: string;
  damage_dealt?: string | number | null;
  keys_used?: number | string | null;
}

export interface FlatMeta {
  weekNumber: number;
  startDate: string;
  endDate: string;
  clashType: ClashType;
}

export function normalizeFlatResults(items: unknown, meta: FlatMeta): ImportPayload {
  const errors: string[] = [];
  if (!meta?.weekNumber || !meta.startDate || !meta.endDate) {
    errors.push("Choose a week (number + start/end dates).");
  }
  if (!isClash(meta?.clashType)) errors.push('Choose a clash type ("hydra" or "chimera").');
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("Expected a non-empty array of player results.");
  }
  if (errors.length) fail(errors);

  const rows: NormalizedRow[] = [];
  (items as FlatResult[]).forEach((it, i) => {
    const player = (it?.player_name ?? "").toString().trim();
    const keys = Number(it?.keys_used ?? 0);
    if (!player) {
      errors.push(`Row ${i + 1}: missing "player_name".`);
      return;
    }
    if (Number.isNaN(keys) || keys < 0) {
      errors.push(`Row ${i + 1} (${player}): invalid "keys_used".`);
      return;
    }
    rows.push({
      weekNumber: meta.weekNumber,
      memberName: player,
      clashType: meta.clashType,
      keysUsed: keys,
      totalDamage: parseDamage(it?.damage_dealt),
    });
  });
  if (errors.length) fail(errors);

  const weeks: WeekInfo[] = [
    { weekNumber: meta.weekNumber, startDate: meta.startDate, endDate: meta.endDate },
  ];

  // Progress is now computed from key usage (not entered on import).
  return { rows, weeks, progress: [] };
}

// ---- CSV / Google Sheet records ----
// Columns: week_number, start_date, end_date, player, clash_type, keys_used,
//          total_damage [, progress]
export function normalizeCsvRecords(records: Record<string, string>[]): ImportPayload {
  if (!records.length) fail(["No rows found."]);

  const errors: string[] = [];
  const rows: NormalizedRow[] = [];
  const weeksMap = new Map<number, WeekInfo>();
  const progressMap = new Map<string, ProgressInfo>();

  records.forEach((rec, i) => {
    const weekNumber = Number(rec.week_number);
    const clashType = rec.clash_type?.toLowerCase();
    if (!weekNumber || !isClash(clashType)) {
      errors.push(`Row ${i + 1}: invalid week_number/clash_type (${JSON.stringify(rec)}).`);
      return;
    }
    rows.push({
      weekNumber,
      memberName: (rec.player ?? "").trim(),
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
  });

  const missingDates = [...new Set(rows.map((r) => r.weekNumber))].filter((w) => !weeksMap.has(w));
  if (missingDates.length) {
    errors.push(
      `Weeks missing start_date/end_date: ${missingDates.join(", ")}. ` +
        "Provide the dates at least once per week.",
    );
  }
  if (errors.length) fail(errors);

  return { rows, weeks: [...weeksMap.values()], progress: [...progressMap.values()] };
}
