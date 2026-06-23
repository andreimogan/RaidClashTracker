// Phase 5 — map a raw RaidToolkit account dump into NormalizedRow[].
//
// IMPORTANT: the dump schema is not yet confirmed to include per-member
// Hydra/Chimera Clash damage. This module makes a best-effort attempt to locate
// it and throws a clear message (pointing to the CSV path) if it can't. Once you
// have a real dump (from `npm run extract`), open data/raw/dump-*.json, find the
// clan/clash structures, and replace the heuristic below with an exact mapping.
import type { NormalizedRow } from "../lib/admin";

type ClashType = "hydra" | "chimera";

// Recursively search for an array of objects that look like per-member clash
// contributions (have a name-ish field and a damage-ish numeric field).
function findMemberDamageArray(node: unknown, depth = 0): any[] | null {
  if (depth > 6 || node == null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    const looksRight =
      node.length > 0 &&
      node.every(
        (e) =>
          e && typeof e === "object" &&
          ("name" in e || "memberName" in e || "userName" in e) &&
          Object.values(e).some((v) => typeof v === "number" && v > 1000),
      );
    if (looksRight) return node as any[];
  }
  for (const v of Object.values(node as Record<string, unknown>)) {
    const found = findMemberDamageArray(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function pick<T>(obj: any, keys: string[], fallback: T): T {
  for (const k of Object.keys(obj)) {
    if (keys.includes(k.toLowerCase())) return obj[k];
  }
  return fallback;
}

export function normalizeDump(dump: unknown, weekNumber: number): NormalizedRow[] {
  const rows: NormalizedRow[] = [];

  // Try to locate a "clan" container, then hydra/chimera sub-sections.
  const root = dump as Record<string, any>;
  const clan =
    pick(root, ["clan", "clandata", "clanboss"], null) ?? root;

  for (const clashType of ["hydra", "chimera"] as ClashType[]) {
    const section = pick(clan, [clashType, `${clashType}clash`], null);
    const arr = findMemberDamageArray(section) ?? null;
    if (!arr) continue;
    for (const e of arr) {
      const name = pick(e, ["name", "membername", "username"], "");
      const damage = Number(pick(e, ["damage", "totaldamage", "score"], 0));
      const keys = Number(pick(e, ["keys", "keysused", "attempts"], 0));
      if (name) rows.push({ weekNumber, memberName: String(name), clashType, keysUsed: keys, totalDamage: damage });
    }
  }

  if (!rows.length) {
    throw new Error(
      "Could not locate Hydra/Chimera clash damage in the dump.\n" +
        "Open the saved data/raw/dump-*.json, find the clash structures, and update\n" +
        "scripts/rtk/normalize.ts with the real field paths — or use `npm run import`\n" +
        "(CSV) which works regardless of what the dump contains.",
    );
  }
  return rows;
}
