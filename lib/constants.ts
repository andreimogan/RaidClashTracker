// Shared constants (safe to import from both server and client components).

// RAID clan member capacity.
export const CLAN_CAP = 30;

// Max clash keys each member can use per week, by clash type.
export const MAX_KEYS = { hydra: 3, chimera: 2 } as const;

// Max keys for a performance scope (a single clash, or both combined for "total").
export function maxKeysFor(scope: "hydra" | "chimera" | "total"): number {
  return scope === "total" ? MAX_KEYS.hydra + MAX_KEYS.chimera : MAX_KEYS[scope];
}
