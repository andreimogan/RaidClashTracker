// Server-only: single-member weekly results write. Validates a { memberName,
// weekNumber, hydra, chimera } body and funnels it through the sanctioned
// pipeline as a one-member ImportPayload → persist(payload, "upsert").
// No direct SQL here — persist() is the only DB write.
import { MAX_KEYS } from "./constants";
import { getDataSource, loadDataset } from "./data";
import type { ClashType, ImportPayload, NormalizedRow } from "./import";
import { parseDamage } from "./parse";
import { persist, slug, type PersistSummary } from "./persist";

// Invalid input / demo mode / unknown member or week — the route maps this
// to a 400. Anything else that escapes is unexpected (500).
export class ValidationError extends Error {}

function fail(errors: string[]): never {
  throw new ValidationError(errors.join("\n"));
}

// Same accepted shapes as the import paths (number, "16.61B" shorthand,
// null/empty = benched → 0), but stricter: unrecognized strings and negative
// values are rejected instead of coerced to 0.
function validateDamage(clash: ClashType, raw: unknown, errors: string[]): number {
  if (raw == null || raw === "") return 0; // benched semantic
  if (typeof raw !== "number" && typeof raw !== "string") {
    errors.push(`${clash}: "damage" must be a number or a string like "16.61B".`);
    return 0;
  }
  if (typeof raw === "string" && !/^\d+(\.\d+)?\s*[BMK]?$/.test(raw.trim().toUpperCase().replace(/,/g, ""))) {
    errors.push(`${clash}: "${raw}" is not a valid damage value (use a number or "16.61B" shorthand).`);
    return 0;
  }
  const value = parseDamage(raw);
  if (!Number.isFinite(value) || value < 0) {
    errors.push(`${clash}: "damage" must be a finite value >= 0.`);
    return 0;
  }
  return value;
}

function validateKeys(clash: ClashType, raw: unknown, errors: string[]): number {
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    errors.push(`${clash}: "keys" must be a whole number.`);
    return 0;
  }
  if (raw < 0 || raw > MAX_KEYS[clash]) {
    errors.push(`${clash}: "keys" must be between 0 and ${MAX_KEYS[clash]}.`);
    return 0;
  }
  return raw;
}

// Upsert both clash rows for one member in one tracked week. Both rows are
// always written — 0 keys / 0 damage is the established "benched" row.
export async function upsertMemberWeekResults(
  memberId: string,
  input: unknown,
): Promise<PersistSummary> {
  // Demo mode has no writable tables — refuse before validating anything else.
  if ((await getDataSource()) !== "sqlite") {
    throw new ValidationError(
      "Demo data is read-only. Initialize a local database (npm run db:init) to edit results.",
    );
  }

  const body = (input ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const memberName = typeof body.memberName === "string" ? body.memberName.trim() : "";
  if (!memberName) {
    errors.push('"memberName" is required.');
  } else if (slug(memberName) !== memberId) {
    errors.push(`"memberName" (${memberName}) does not match member id "${memberId}".`);
  }

  const weekNumber = body.weekNumber;
  if (typeof weekNumber !== "number" || !Number.isInteger(weekNumber) || weekNumber <= 0) {
    errors.push('"weekNumber" must be a positive whole number.');
  }

  const values = (["hydra", "chimera"] as const).map((clashType) => {
    const section = body[clashType] as Record<string, unknown> | undefined;
    if (typeof section !== "object" || section === null) {
      errors.push(`"${clashType}" must be an object with "keys" and "damage".`);
      return { clashType, keysUsed: 0, totalDamage: 0 };
    }
    return {
      clashType,
      keysUsed: validateKeys(clashType, section.keys, errors),
      totalDamage: validateDamage(clashType, section.damage, errors),
    };
  });

  if (errors.length) fail(errors);

  // The member and the week must already exist; week dates come from the
  // stored week (never from the client), so no phantom weeks can be created.
  const ds = await loadDataset();
  const member = ds.members.find((m) => m.id === memberId);
  if (!member) {
    fail([`Unknown member "${memberId}".`]);
  }
  const week = ds.weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) {
    fail([`Week ${weekNumber} is not a tracked week.`]);
  }

  // Rows carry the STORED display name: persist() upserts in_game_name, and
  // the slug guard admits case/punctuation variants ("cleon" vs "Cleon"), so
  // using the client's spelling would silently rename the member.
  const rows: NormalizedRow[] = values.map((v) => ({
    weekNumber: weekNumber as number,
    memberName: member.inGameName,
    clashType: v.clashType,
    keysUsed: v.keysUsed,
    totalDamage: v.totalDamage,
  }));

  const payload: ImportPayload = {
    rows,
    weeks: [{ weekNumber: week.weekNumber, startDate: week.startDate, endDate: week.endDate }],
    progress: [],
  };
  return persist(payload, "upsert");
}
