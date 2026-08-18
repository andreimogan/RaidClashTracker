// Core domain types for the Clan Clash Tracker.

export type ClashType = "hydra" | "chimera";

export interface Member {
  id: string;
  inGameName: string;
  level: number; // account level
  heroLevel: number; // level shown on the avatar badge in-game
  avatarUrl?: string | null;
  isActive: boolean;
  // Admin-set roster flag: this member is excused from the Black List entirely —
  // out of its rows AND out of the count it measured. Required, not optional: an
  // optional field lets a surface render "not excused" for a member whose flag
  // was simply never threaded through, which is the one failure this field's
  // shape is here to make impossible. Column: members.is_benched (migration
  // 0003), default false.
  isBenched: boolean;
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

// One week of a single member's results (both clashes), incl. zero-key weeks.
export interface MemberWeekRow {
  week: Week;
  hydra: { keys: number; damage: number };
  chimera: { keys: number; damage: number };
  totalKeys: number;
  totalDamage: number;
  participationPct: number; // totalKeys / max possible (Hydra 3 + Chimera 2)
  // Signed % change of totalDamage vs the member's most recent prior PRESENT
  // week (gaps skipped). null = no baseline (first tracked week, or a baseline
  // week with 0 damage) — the UI renders a dash, not 0%.
  trendPct: number | null;
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

// One row of the Clan Performance "Total (All Weeks)" table: a member's
// all-weeks aggregate split per clash.
export interface MemberTotalsRow {
  member: Member;
  hydra: MemberClashStat;
  chimera: MemberClashStat;
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

// ---- Black List (derived participation shortfall, all weeks) ----

// The thresholds a Black List result was computed with. Carried on the result so
// the UI can explain why someone is listed without restating any number itself.
export interface BlackListRule {
  windowWeeks: number; // trailing weeks judged (the window's intended size)
  minKeysPerWeek: number; // keys needed in a week for it to not be a miss
  maxKeysPerWeek: number; // keys available per week (Hydra 3 + Chimera 2)
  minMisses: number; // missed weeks needed to be listed
  minWeeksPresent: number; // window weeks needed before a member is judged
  // The weeks actually judged, ascending. Shorter than windowWeeks when the
  // dataset holds fewer FULLY IMPORTED weeks, and [] for an empty dataset or
  // one where no week has both clashes uploaded yet.
  weekNumbers: number[];
}

// One listed member: the weeks that earned them the spot, plus their key usage
// across the window weeks they were present for.
export interface BlackListRow {
  member: Member;
  weeksConsidered: number; // window weeks the member has a row in
  missedWeeks: number;
  missedWeekNumbers: number[]; // ascending
  keysUsed: number; // combined keys across weeksConsidered
  keysPossible: number; // weeksConsidered * maxKeysPerWeek
  participationPct: number; // keysUsed vs keysPossible
}

export interface BlackListResult {
  rule: BlackListRule;
  rows: BlackListRow[];
  // How many members were actually evaluated: on the roster AND present for at
  // least `rule.minWeeksPresent` of `rule.weekNumbers`. Lets the UI tell "we
  // measured the clan and nobody is failing" (rows 0, membersJudged > 0) apart
  // from "nobody could be measured yet" (both 0) — a first import, a fresh
  // Reset, or a window where no week has both clashes in. Those two need
  // opposite copy: one is good news, the other is not news at all.
  membersJudged: number;
  // How many members an admin has excused (members.is_benched) out of the people
  // who would otherwise have been measured — i.e. they clear the roster gate and
  // are dropped only by that flag. ROSTER-SCOPED on purpose: someone excused who
  // is also off the current roster was never going to be judged, so counting
  // them would print a number the reader cannot reconcile with anything on
  // screen. It is NOT the number of excused members in the dataset.
  //
  // The UI needs this because the exclusion is otherwise invisible: an excused
  // member is absent from `rows`, so nothing on the list can mark them, and
  // `membersJudged` silently shrinks with no on-screen explanation for the
  // smaller N. 0 whenever nobody excused was in scope — including the empty
  // window — so a caller can hide the line entirely rather than print a zero.
  //
  // Not a partition of the roster: this count applies only the roster gate,
  // while `membersJudged` also applies `rule.minWeeksPresent`. The two do not
  // have to add up to the roster size, and neither is derivable from the other.
  excusedCount: number;
}
