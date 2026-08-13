// Deterministic seed dataset that mirrors the design mockup.
// Used as the zero-config fallback when no DATABASE_URL is set (or the tables
// don't exist yet), and as the source rows pushed by `npm run seed`.
import type { ClashMeta, ClashResult, Member, Week } from "./types";

// --- tiny seeded PRNG so the dataset is stable across runs ---
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// Hydra weeks: start on a Wednesday, end the following Wednesday (canonical
// week window). Per-clash display windows are derived in lib/week.ts.
export const WEEKS: Week[] = [
  { id: "w20", weekNumber: 20, startDate: "2026-05-06", endDate: "2026-05-13" },
  { id: "w21", weekNumber: 21, startDate: "2026-05-13", endDate: "2026-05-20" },
  { id: "w22", weekNumber: 22, startDate: "2026-05-20", endDate: "2026-05-27" },
  { id: "w23", weekNumber: 23, startDate: "2026-05-27", endDate: "2026-06-03" },
  { id: "w24", weekNumber: 24, startDate: "2026-06-03", endDate: "2026-06-10" },
];

// Named members from the mockup come first (with tuned strength), then filler.
const NAMED = [
  "[ΚΛΕΩ] Hell",
  "iisdroopy",
  "Joe",
  "Valmeyjar",
  "Kr4d",
  "xMrSATANx",
  "NcRoughNeck",
];
const FILLER = [
  "ShadowReaper", "Grimspike", "Lyssandra", "Toragon", "Vael",
  "NyxBane", "Drakemoor", "Seraphine", "Korgath", "Mirae",
  "Ravox", "Thalrik", "Ysolde", "Brommir", "Caedis",
  "Wyrmclaw", "Eluned", "Garrosh", "Nephele", "Skarn",
  "Tindra", "Vorgath", "Aelwyn",
];

const ALL_NAMES = [...NAMED, ...FILLER]; // 30 members

const rng = makeRng(20260623);

export const MEMBERS: Member[] = ALL_NAMES.map((name, i) => ({
  id: `m${i + 1}`,
  inGameName: name,
  level: i === 0 ? 13 : 50 + Math.floor(rng() * 40),
  heroLevel: i < 5 ? 100 : 80 + Math.floor(rng() * 20),
  avatarUrl: null,
  isActive: true,
}));

// Per-member strength profile (hydra/chimera damage-per-key in raw units).
interface Profile {
  hydraPerKey: number;
  chimeraPerKey: number;
  participation: number; // probability of using keys in a given week
  avgKeys: number;
}

const profiles: Record<string, Profile> = {};
MEMBERS.forEach((m, i) => {
  // Named members get descending strength so ranking matches the mockup.
  const topBias = i < NAMED.length ? (NAMED.length - i) / NAMED.length : 0;
  const base = 1.2e9 + topBias * 4.2e9 + rng() * 1.6e9;
  profiles[m.id] = {
    hydraPerKey: base,
    chimeraPerKey: base * (0.85 + rng() * 0.5),
    participation: i < NAMED.length ? 0.95 : 0.6 + rng() * 0.35,
    avgKeys: 1.3 + rng() * 1.5,
  };
});

// Weekly clan-wide damage targets (billions) taken from the mockup timeline.
const HYDRA_TARGET: Record<number, number> = {
  20: 178.2e9, 21: 182.7e9, 22: 193.5e9, 23: 175.8e9, 24: 187.6e9,
};
const CHIMERA_TARGET: Record<number, number> = {
  20: 94.1e9, 21: 96.8e9, 22: 102.3e9, 23: 97.2e9, 24: 98.3e9,
};

function buildResults(): ClashResult[] {
  const results: ClashResult[] = [];
  let idCounter = 1;

  for (const week of WEEKS) {
    for (const clashType of ["hydra", "chimera"] as const) {
      const maxKeys = clashType === "hydra" ? 3 : 2;
      const rows: { memberId: string; keys: number; rawDamage: number }[] = [];

      for (const m of MEMBERS) {
        const p = profiles[m.id];
        const participates = rng() < p.participation;
        if (!participates) continue;
        const keys = Math.max(1, Math.min(maxKeys, Math.round(p.avgKeys + rng() * 0.8)));
        const perKey = clashType === "hydra" ? p.hydraPerKey : p.chimeraPerKey;
        const variance = 0.8 + rng() * 0.4;
        rows.push({ memberId: m.id, keys, rawDamage: keys * perKey * variance });
      }

      // Scale so the week's total matches the mockup timeline target.
      const target = clashType === "hydra" ? HYDRA_TARGET[week.weekNumber] : CHIMERA_TARGET[week.weekNumber];
      const rawTotal = rows.reduce((sum, r) => sum + r.rawDamage, 0);
      const scale = target / rawTotal;

      for (const r of rows) {
        results.push({
          id: `cr${idCounter++}`,
          weekId: week.id,
          memberId: r.memberId,
          clashType,
          keysUsed: r.keys,
          totalDamage: Math.round(r.rawDamage * scale),
        });
      }
    }
  }
  return results;
}

export const CLASH_RESULTS: ClashResult[] = buildResults();

export const CLASH_META: ClashMeta[] = [
  { weekId: "w20", clashType: "hydra", progress: 55.0 },
  { weekId: "w20", clashType: "chimera", progress: 70.0 },
  { weekId: "w21", clashType: "hydra", progress: 58.3 },
  { weekId: "w21", clashType: "chimera", progress: 75.0 },
  { weekId: "w22", clashType: "hydra", progress: 66.7 },
  { weekId: "w22", clashType: "chimera", progress: 80.0 },
  { weekId: "w23", clashType: "hydra", progress: 54.2 },
  { weekId: "w23", clashType: "chimera", progress: 79.2 },
  { weekId: "w24", clashType: "hydra", progress: 62.5 },
  { weekId: "w24", clashType: "chimera", progress: 83.3 },
];
