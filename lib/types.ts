// Core domain types for the Clan Clash Tracker.

export type ClashType = "hydra" | "chimera";

export interface Member {
  id: string;
  inGameName: string;
  level: number; // account level
  heroLevel: number; // level shown on the avatar badge in-game
  avatarUrl?: string | null;
  isActive: boolean;
}

export interface Week {
  id: string;
  weekNumber: number;
  startDate: string; // ISO date
  endDate: string; // ISO date
}

export interface ClashResult {
  id: string;
  weekId: string;
  memberId: string;
  clashType: ClashType;
  keysUsed: number;
  totalDamage: number; // raw damage value
}

// Per (week, clash) clan-level metadata such as the progress bar in the mockup.
export interface ClashMeta {
  weekId: string;
  clashType: ClashType;
  progress: number; // 0-100, boss/clash completion percentage
}

// ---- Derived/view types used by the UI ----

export interface OverviewStats {
  clashType: ClashType;
  keyUsageAvg: number;
  totalDamage: number;
  avgDamagePerKey: number;
  membersParticipated: number;
  totalMembers: number;
  progress: number;
}

export interface PerformanceRow {
  rank: number;
  member: Member;
  keysThisWeek: number;
  keysAverage: number;
  damageThisWeek: number;
  damageAverage: number;
  avgDamagePerKey: number;
  participationPct: number; // last 4 weeks
  trendPct: number; // signed
}

export interface TimelineWeek {
  week: Week;
  hydraDamage: number;
  chimeraDamage: number;
}

export interface KeyUsageSummary {
  hydraAvgKeys: number;
  chimeraAvgKeys: number;
}

// ---- Member detail (per-member history) ----

// One week of a single member's results (both clashes), incl. benched 0-key weeks.
export interface MemberWeekRow {
  week: Week;
  hydra: { keys: number; damage: number };
  chimera: { keys: number; damage: number };
  totalKeys: number;
  totalDamage: number;
  participationPct: number; // totalKeys / max possible (Hydra 3 + Chimera 2)
  trendPct: number; // total dmg/key vs the member's prior present weeks
}

// A member's lifetime stats for one scope (hydra | chimera | total).
export interface MemberClashStat {
  scope: "hydra" | "chimera" | "total";
  totalDamage: number;
  totalKeys: number;
  weeksPresent: number; // weeks with any row for this scope
  weeksActive: number; // weeks with keys > 0
  avgKeys: number; // keys per present week
  avgDamagePerKey: number;
  participationPct: number; // keys used vs keys available across present weeks
  trendPct: number; // from the member's latest present week
}

export interface MemberProfile {
  member: Member;
  isActive: boolean;
  firstWeek?: Week;
  lastWeek?: Week;
  weeksPresent: number;
  weeksActive: number;
  bestWeek?: Week; // highest total damage week
  history: MemberWeekRow[]; // ascending by week number
  total: MemberClashStat;
  hydra: MemberClashStat;
  chimera: MemberClashStat;
}
