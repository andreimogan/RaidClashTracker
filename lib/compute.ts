// Pure functions that turn raw clash data into the derived metrics the UI shows.
// Kept framework-free so it works for both the Supabase and mock data paths.
import { MAX_KEYS, maxKeysFor } from "./constants";
import type {
  ClashMeta,
  ClashResult,
  ClashType,
  KeyUsageSummary,
  Member,
  MemberClashStat,
  MemberProfile,
  MemberTotalsRow,
  MemberWeekRow,
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

  const weekIdx = weeks.findIndex((w) => w.weekNumber === weekNumber);
  const prevWeek = weekIdx > 0 ? weeks[weekIdx - 1] : undefined;
  const maxKeys = maxKeysFor(scope);

  // Show every member who has an uploaded row for this week + scope — including
  // benched (0-key) rows and former members no longer in the clan. "Former" is
  // derived from the latest week's roster (same notion as the Members page), not
  // the DB is_active column.
  const activeIds = activeMemberIds(ds);
  const memberById = new Map(ds.members.map((m) => [m.id, m]));
  const present = [...new Set(resultsFor(ds, week.id, scope).map((r) => r.memberId))];

  const rows: PerformanceRow[] = present
    .map((id) => memberById.get(id))
    .filter((m): m is Member => Boolean(m))
    .map((m) => {
      const member = { ...m, isActive: activeIds.has(m.id) };
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

      // Trend: this week's dmg/key vs the immediately previous week's dmg/key.
      const thisPerKey = thisWeek.keys ? thisWeek.damage / thisWeek.keys : 0;
      const prev = prevWeek
        ? aggregateMemberWeek(ds, member.id, prevWeek.id, scope)
        : { keys: 0, damage: 0 };
      const prevPerKey = prev.keys ? prev.damage / prev.keys : 0;
      const trendPct =
        prevPerKey > 0 ? ((thisPerKey - prevPerKey) / prevPerKey) * 100 : 0;

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
    });

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

// Lifetime stats for one member + scope across the weeks they were present.
function memberClashStat(
  ds: Dataset,
  memberId: string,
  presentWeeks: Week[],
  scope: PerfScope,
): MemberClashStat {
  const perWeek = presentWeeks.map((w) => aggregateMemberWeek(ds, memberId, w.id, scope));
  const totalKeys = perWeek.reduce((s, a) => s + a.keys, 0);
  const totalDamage = perWeek.reduce((s, a) => s + a.damage, 0);
  const weeksPresent = presentWeeks.length;
  const weeksActive = perWeek.filter((a) => a.keys > 0).length;

  // Trend = the member's trend in their latest present week (reuses getPerformance).
  const lastWeek = presentWeeks.at(-1);
  const trendPct = lastWeek
    ? getPerformance(ds, lastWeek.weekNumber, scope).find((r) => r.member.id === memberId)
        ?.trendPct ?? 0
    : 0;

  const maxKeys = maxKeysFor(scope);
  return {
    scope,
    totalDamage,
    totalKeys,
    weeksPresent,
    weeksActive,
    avgKeys: weeksPresent ? totalKeys / weeksPresent : 0,
    avgDamagePerKey: totalKeys ? totalDamage / totalKeys : 0,
    participationPct: weeksPresent && maxKeys ? (totalKeys / (weeksPresent * maxKeys)) * 100 : 0,
    trendPct,
  };
}

// Everything the member detail page needs. Returns null if the id is unknown.
export function getMemberProfile(ds: Dataset, memberId: string): MemberProfile | null {
  const member = ds.members.find((m) => m.id === memberId);
  if (!member) return null;

  const weeks = sortedWeeks(ds);
  // Weeks where the member has any row (incl. benched 0-key rows).
  const presentWeekIds = new Set(
    ds.results.filter((r) => r.memberId === memberId).map((r) => r.weekId),
  );
  const presentWeeks = weeks.filter((w) => presentWeekIds.has(w.id));

  const history: MemberWeekRow[] = presentWeeks.map((week) => {
    const hydra = aggregateMemberWeek(ds, memberId, week.id, "hydra");
    const chimera = aggregateMemberWeek(ds, memberId, week.id, "chimera");
    const totalKeys = hydra.keys + chimera.keys;
    const totalDamage = hydra.damage + chimera.damage;
    const maxKeys = maxKeysFor("total");

    // Trend: this week's total dmg/key vs the average of prior present weeks.
    const thisPerKey = totalKeys ? totalDamage / totalKeys : 0;
    const priorPerKey = presentWeeks
      .filter((w) => w.weekNumber < week.weekNumber)
      .map((w) => aggregateMemberWeek(ds, memberId, w.id, "total"))
      .filter((a) => a.keys > 0)
      .map((a) => a.damage / a.keys);
    const priorAvg = priorPerKey.length
      ? priorPerKey.reduce((s, v) => s + v, 0) / priorPerKey.length
      : 0;

    return {
      week,
      hydra,
      chimera,
      totalKeys,
      totalDamage,
      participationPct: maxKeys ? Math.min(100, (totalKeys / maxKeys) * 100) : 0,
      trendPct: priorAvg > 0 ? ((thisPerKey - priorAvg) / priorAvg) * 100 : 0,
    };
  });

  const activeIds = activeMemberIds(ds);
  const bestWeek = history.length
    ? history.reduce((best, r) => (r.totalDamage > best.totalDamage ? r : best)).week
    : undefined;

  return {
    member: { ...member, isActive: activeIds.has(member.id) },
    isActive: activeIds.has(member.id),
    firstWeek: presentWeeks[0],
    lastWeek: presentWeeks.at(-1),
    weeksPresent: presentWeeks.length,
    weeksActive: history.filter((r) => r.totalKeys > 0).length,
    bestWeek,
    history,
    total: memberClashStat(ds, memberId, presentWeeks, "total"),
    hydra: memberClashStat(ds, memberId, presentWeeks, "hydra"),
    chimera: memberClashStat(ds, memberId, presentWeeks, "chimera"),
  };
}

// All-weeks per-clash aggregate per member (across every ingested week, incl.
// former members). Drives the Clan Performance "Total (All Weeks)" tab.
export function getAllWeeksTotals(ds: Dataset): MemberTotalsRow[] {
  const activeIds = activeMemberIds(ds);
  const weeks = sortedWeeks(ds);

  return ds.members
    .map((member) => {
      const presentWeekIds = new Set(
        ds.results.filter((r) => r.memberId === member.id).map((r) => r.weekId),
      );
      const presentWeeks = weeks.filter((w) => presentWeekIds.has(w.id));
      if (!presentWeeks.length) return null;

      return {
        member: { ...member, isActive: activeIds.has(member.id) },
        hydra: memberClashStat(ds, member.id, presentWeeks, "hydra"),
        chimera: memberClashStat(ds, member.id, presentWeeks, "chimera"),
      } satisfies MemberTotalsRow;
    })
    .filter((r): r is MemberTotalsRow => r !== null);
}
