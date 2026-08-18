// Shared constants (safe to import from both server and client components).

// RAID clan member capacity.
export const CLAN_CAP = 30;

// Max clash keys each member can use per week, by clash type.
export const MAX_KEYS = { hydra: 3, chimera: 2 } as const;

// Max keys for a performance scope (a single clash, or both combined for "total").
export function maxKeysFor(scope: "hydra" | "chimera" | "total"): number {
  return scope === "total" ? MAX_KEYS.hydra + MAX_KEYS.chimera : MAX_KEYS[scope];
}

// ---- Black List thresholds ----
// The participation rule behind `getBlackList` in lib/compute.ts. Named here so
// the UI can state the rule from `BlackListRule` instead of hardcoding numbers,
// and so re-pinning the rule is a one-line change in one place.

// How many trailing FULLY IMPORTED weeks of the dataset are judged. A week
// counts only once both clashes are on the board (see `getBlackList`), so a
// mid-import week does not shrink the window, it just isn't in it yet.
// Re-pin freely: `getBlackList` floors the window at 1 week, because slice(-0)
// would silently judge the entire dataset.
export const BLACKLIST_WINDOW_WEEKS = 4;

// Combined Hydra + Chimera keys a member needs in a week for it to not count as
// a missed week (out of maxKeysFor("total") = 5 available).
export const BLACKLIST_MIN_KEYS_PER_WEEK = 3;

// Missed weeks inside the window before a member is listed.
export const BLACKLIST_MIN_MISSES = 2;

// Window weeks a member must be present for before they are judged at all —
// a newcomer with one tracked week is too new to blacklist. With the current
// BLACKLIST_MIN_MISSES this gate is implied (you cannot miss 2 weeks you were
// not present for), but it stays explicit: it is what protects newcomers the
// moment the miss threshold is re-pinned lower.
export const BLACKLIST_MIN_WEEKS_PRESENT = 2;
