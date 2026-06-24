// Pure functions that turn raw clash data into the derived metrics the UI shows.
// Kept framework-free so it works for both the Supabase and mock data paths.
import { MAX_KEYS, maxKeysFor } from "./constants";
import type {
  ClashMeta,
  ClashResult,
  ClashType,
  KeyUsageSummary,
  Member,
  OverviewStats,
  PerformanceRow,
  TimelineWeek,
  Week,
} from "./types";

export interface Dataset {
  members: Member[];
  weeks: Week[];
  results: ClashResult[];
  meta: ClashMeta[];
}

export type PerfScope = ClashType | "total";

const byWeekNumberAsc = (a: Week, b: Week) => a.weekNumber - b.weekNumber;

export function sortedWeeks(ds: Dataset): Week[] {
  return [...ds.weeks].sort(byWeekNumberAsc);
}

export function latestWeekNumber(ds: Dataset): number {
  return sortedWeeks(ds).at(-1)?.weekNumber ?? 0;
}

function weekByNumber(ds: Dataset, weekNumber: number): Week | undefined {
  return ds.weeks.find((w) => w.weekNumber === weekNumber);
}

// Members present in the latest week's data (any clash) = the current roster.
// Membership varies week to week, so "active" is derived, not a stored flag.
export function activeMemberIds(ds: Dataset): Set<string> {
  const latest = latestWeekNumber(ds);
  const week = weekByNumber(ds, latest);
  if (!week) return new Set();
  return new Set(ds.results.filter((r) => r.weekId === week.id).map((r) => r.memberId));
}

function resultsFor(ds: Dataset, weekId: string, clash: PerfScope): ClashResult[] {
  return ds.results.filter(
    (r) => r.weekId === weekId && (clash === "total" || r.clashType === clash),
  );
}

// Aggregate a member's results within a week into a single {keys, damage} pair.
function aggregateMemberWeek(
  ds: Dataset,
  memberId: string,
  weekId: string,
  clash: PerfScope,
): { keys: number; damage: number } {
  const rows = ds.results.filter(
    (r) =>
      r.memberId === memberId &&
      r.weekId === weekId &&
      (clash === "total" || r.clashType === clash),
  );
  return {
    keys: rows.reduce((s, r) => s + r.keysUsed, 0),
    damage: rows.reduce((s, r) => s + r.totalDamage, 0),
  };
}

export function getOverview(
  ds: Dataset,
  weekNumber: number,
  clashType: ClashType,
): OverviewStats {
  const week = weekByNumber(ds, weekNumber);
  const rows = week ? resultsFor(ds, week.id, clashType) : [];
  const participants = rows.filter((r) => r.keysUsed > 0);
  const totalKeys = participants.reduce((s, r) => s + r.keysUsed, 0);
  const totalDamage = participants.reduce((s, r) => s + r.totalDamage, 0);
  // Progress = clan key usage: keys used vs every roster member's max keys.
  // 100% means all clan members used all their keys this clash.
  const keysPossible = rows.length * MAX_KEYS[clashType];
  return {
    clashType,
    keyUsageAvg: participants.length ? totalKeys / participants.length : 0,
    totalDamage,
    avgDamagePerKey: totalKeys ? totalDamage / totalKeys : 0,
    membersParticipated: participants.length,
    // Roster present for this week + clash (participants + benched 0-key rows),
    // not the all-time member count — the roster varies week to week.
    totalMembers: rows.length,
    progress: keysPossible ? (totalKeys / keysPossible) * 100 : 0,
  };
}

export function getPerformance(
  ds: Dataset,
  weekNumber: number,
  scope: PerfScope,
): PerformanceRow[] {
  const weeks = sortedWeeks(ds);
  const week = weekByNumber(ds, weekNumber);
  if (!week) return [];

  const priorWeeks = weeks.filter((w) => w.weekNumber < weekNumber);
  const maxKeys = maxKeysFor(scope);

  const rows: PerformanceRow[] = ds.members
    .filter((m) => m.isActive)
    .map((member) => {
      const thisWeek = aggregateMemberWeek(ds, member.id, week.id, scope);

      // Member averages across every week they have an entry for.
      const memberWeeks = weeks
        .map((w) => aggregateMemberWeek(ds, member.id, w.id, scope))
        .filter((a) => a.keys > 0);
      const keysAverage = memberWeeks.length
        ? memberWeeks.reduce((s, a) => s + a.keys, 0) / memberWeeks.length
        : 0;
      const damageAverage = memberWeeks.length
        ? memberWeeks.reduce((s, a) => s + a.damage, 0) / memberWeeks.length
        : 0;

      // Participation = keys used this week vs the max keys for this clash
      // (Hydra 3, Chimera 2, Total 5). e.g. 1 Hydra key = 33.33%.
      const participationPct = maxKeys
        ? Math.min(100, (thisWeek.keys / maxKeys) * 100)
        : 0;

      // Trend: this week's dmg/key vs the average dmg/key of prior weeks.
      const thisPerKey = thisWeek.keys ? thisWeek.damage / thisWeek.keys : 0;
      const priorAgg = priorWeeks
        .map((w) => aggregateMemberWeek(ds, member.id, w.id, scope))
        .filter((a) => a.keys > 0);
      const priorPerKey = priorAgg.length
        ? priorAgg.reduce((s, a) => s + a.damage / a.keys, 0) / priorAgg.length
        : 0;
      const trendPct =
        priorPerKey > 0 ? ((thisPerKey - priorPerKey) / priorPerKey) * 100 : 0;

      return {
        rank: 0,
        member,
        keysThisWeek: thisWeek.keys,
        keysAverage,
        damageThisWeek: thisWeek.damage,
        damageAverage,
        avgDamagePerKey: thisPerKey,
        participationPct,
        trendPct,
      };
    })
    // Only show members who have at least appeared in the data.
    .filter((r) => r.keysThisWeek > 0 || r.damageAverage > 0);

  rows.sort((a, b) => b.damageThisWeek - a.damageThisWeek);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export function getTimeline(ds: Dataset): TimelineWeek[] {
  return sortedWeeks(ds).map((week) => ({
    week,
    hydraDamage: resultsFor(ds, week.id, "hydra").reduce(
      (s, r) => s + r.totalDamage,
      0,
    ),
    chimeraDamage: resultsFor(ds, week.id, "chimera").reduce(
      (s, r) => s + r.totalDamage,
      0,
    ),
  }));
}

export function getKeyUsageSummary(
  ds: Dataset,
  weekNumber: number,
): KeyUsageSummary {
  return {
    hydraAvgKeys: getOverview(ds, weekNumber, "hydra").keyUsageAvg,
    chimeraAvgKeys: getOverview(ds, weekNumber, "chimera").keyUsageAvg,
  };
}
