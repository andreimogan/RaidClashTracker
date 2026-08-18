// Pure functions that turn raw clash data into the derived metrics the UI shows.
// Kept framework-free so it works for both the Supabase and mock data paths.
import {
  BLACKLIST_MIN_KEYS_PER_WEEK,
  BLACKLIST_MIN_MISSES,
  BLACKLIST_MIN_WEEKS_PRESENT,
  BLACKLIST_WINDOW_WEEKS,
  MAX_KEYS,
  maxKeysFor,
} from "./constants";
import type {
  BlackListResult,
  BlackListRow,
  BlackListRule,
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

// Signed percentage change of `current` against `previous`, e.g. (12, 10) => +20.
// Returns null when there is no usable baseline (previous <= 0), so callers can
// distinguish "nothing to compare against" from a genuinely flat 0%.
export function deltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
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
    // Roster present for this week + clash (participants + zero-key rows),
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
  // zero-key rows and former members no longer in the clan. "Former" is
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
      const trendPct = deltaPct(thisPerKey, prevPerKey) ?? 0;

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
  // Weeks where the member has any row (incl. zero-key rows).
  const presentWeekIds = new Set(
    ds.results.filter((r) => r.memberId === memberId).map((r) => r.weekId),
  );
  const presentWeeks = weeks.filter((w) => presentWeekIds.has(w.id));

  const history: MemberWeekRow[] = presentWeeks.map((week, i) => {
    const hydra = aggregateMemberWeek(ds, memberId, week.id, "hydra");
    const chimera = aggregateMemberWeek(ds, memberId, week.id, "chimera");
    const totalKeys = hydra.keys + chimera.keys;
    const totalDamage = hydra.damage + chimera.damage;
    const maxKeys = maxKeysFor("total");

    // Trend: this week's total damage vs the member's most recent PRIOR PRESENT
    // week (presentWeeks is ascending, so that is simply the previous entry —
    // gaps in the roster are skipped, not counted as a zero week). The member's
    // first tracked week, or one whose baseline dealt no damage, has no basis for
    // comparison and yields null so the UI can show a dash instead of "0%".
    const priorWeek = presentWeeks[i - 1];
    const priorDamage = priorWeek
      ? aggregateMemberWeek(ds, memberId, priorWeek.id, "total").damage
      : 0;

    return {
      week,
      hydra,
      chimera,
      totalKeys,
      totalDamage,
      participationPct: maxKeys ? Math.min(100, (totalKeys / maxKeys) * 100) : 0,
      trendPct: deltaPct(totalDamage, priorDamage),
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

// The clashes a tracked week is expected to hold. Read off MAX_KEYS so this and
// maxKeysFor("total") — the denominator a week is judged against — can never
// disagree about which clashes make up a week.
const TRACKED_CLASHES = Object.keys(MAX_KEYS) as ClashType[];

// A week is judged only once BOTH clashes are on the board. Hydra closes
// Wed->Wed and Chimera Fri->Thu, and lib/import.ts loads one clash for one week
// at a time, so the normal admin workflow always leaves a window where a tracked
// week holds only Hydra (or only Chimera). Judging that half-imported week
// scores every member against a 5-key denominator when only 3 keys' worth of
// rows exist, manufacturing misses out of data that simply hasn't been uploaded
// yet — and reads are public, so the whole clan sees the accusation.
//
// The owner's rule: a tracked week always runs both clashes, so an incomplete
// week is never a real shortfall, only a mid-import state. It drops out of the
// window until the second import lands, and `rule.weekNumbers` shows the reader
// exactly which weeks were judged.
function isWeekComplete(ds: Dataset, week: Week): boolean {
  const imported = new Set(
    ds.results.filter((r) => r.weekId === week.id).map((r) => r.clashType),
  );
  return TRACKED_CLASHES.every((c) => imported.has(c));
}

// Members falling short on clash participation over the trailing window — the
// Black List. Derived from the same rows every other metric reads: there is no
// curated list and no write surface behind it.
//
// All-weeks by design (no week argument, like getAllWeeksTotals), so the week
// picker does not change it.
//
// Which weeks: the last BLACKLIST_WINDOW_WEEKS *fully imported* weeks (see
// isWeekComplete). Who is judged: members on the roster as of the newest judged
// week who have rows in at least BLACKLIST_MIN_WEEKS_PRESENT of the window weeks
// — a newcomer with one tracked week is too new to name. Only weeks the member
// was actually present for are counted, the same way getMemberProfile skips
// gaps: a week with no row at all is a roster gap, not a miss, so a newcomer
// with perfect keys is never listed for the weeks before they joined. A present
// week (including a zero-key row) is missed when the member's combined
// Hydra + Chimera keys come in under BLACKLIST_MIN_KEYS_PER_WEEK of the week's
// available keys (maxKeysFor("total")).
//
// One roster exception: a member an admin has excused (members.is_benched) is
// dropped at the roster gate, so they appear in neither `rows` nor
// `membersJudged` — the list does not measure them at all. Because that makes
// the exclusion invisible on the list itself, the result also carries
// `excusedCount`: how many roster members were dropped that way, so the UI can
// say the smaller denominator has a reason.
export function getBlackList(ds: Dataset): BlackListResult {
  // Floor at 1: slice(-0) is slice(0), which would quietly judge every week in
  // the dataset if the constant were ever re-pinned to 0.
  const windowSize = Math.max(1, BLACKLIST_WINDOW_WEEKS);
  const windowWeeks = sortedWeeks(ds)
    .filter((w) => isWeekComplete(ds, w))
    .slice(-windowSize);
  const maxKeysPerWeek = maxKeysFor("total");
  const rule: BlackListRule = {
    windowWeeks: BLACKLIST_WINDOW_WEEKS,
    minKeysPerWeek: BLACKLIST_MIN_KEYS_PER_WEEK,
    maxKeysPerWeek,
    minMisses: BLACKLIST_MIN_MISSES,
    minWeeksPresent: BLACKLIST_MIN_WEEKS_PRESENT,
    weekNumbers: windowWeeks.map((w) => w.weekNumber),
  };
  // A connected-but-empty database is not an error state, and neither is a
  // clan whose only tracked week is still half imported: the window is whatever
  // complete weeks exist, and with none there is nobody to judge. membersJudged
  // 0 is what tells the UI this is "not measured", not "all clear".
  // excusedCount is 0 here too, not "unknown": with no judged week there is no
  // roster to scope it to, so nobody was excused FROM ANYTHING. Zeroing it keeps
  // the shape uniform across both exits, so a caller never has to branch.
  if (!windowWeeks.length) return { rule, rows: [], membersJudged: 0, excusedCount: 0 };

  // The roster as of the newest JUDGED week rather than activeMemberIds', which
  // reads the newest week in the dataset. The two are the same set whenever that
  // week is complete; they differ only mid-import, and there taking the roster
  // off a half-imported week drops anyone whose only row that week belonged to
  // the clash that hasn't landed yet — a current clanmate silently unjudged.
  const rosterWeekId = windowWeeks[windowWeeks.length - 1].id;
  const activeIds = new Set(
    ds.results.filter((r) => r.weekId === rosterWeekId).map((r) => r.memberId),
  );
  // Counted here, off the SAME roster set the gate below uses, so the number can
  // never disagree with the gate that produced it: these are the people who would
  // have been measured had an admin not excused them. Deliberately not every
  // excused member in the dataset — one who is also off the current roster was
  // never a candidate, and including them would print a figure that matches
  // nothing the reader can see. Nothing is subtracted anywhere: `judged` below
  // simply never contains them.
  const excusedCount = ds.members.filter(
    (m) => activeIds.has(m.id) && m.isBenched,
  ).length;

  const windowWeekIds = new Set(windowWeeks.map((w) => w.id));
  // "Present" = the member has any row that week, incl. a zero-key row.
  const presence = new Set(
    ds.results
      .filter((r) => windowWeekIds.has(r.weekId))
      .map((r) => `${r.memberId}:${r.weekId}`),
  );

  // Everyone who passed BOTH gates — on the roster, and present for enough of
  // the window to be measurable. This is the denominator behind the empty
  // state: zero rows out of a non-empty `judged` is genuinely good news, zero
  // rows out of an empty one just means nobody could be measured.
  const judged = ds.members
    // Two roster gates, and the second one is total by design: an excused member
    // (members.is_benched) leaves `rows` AND leaves `judged`, so they are absent
    // from the listing and from the denominator the all-clear sentence quotes.
    // Filtering later, at `rows`, would have kept them in that count.
    .filter((m) => activeIds.has(m.id) && !m.isBenched)
    .map((m) => {
      const present = windowWeeks
        .filter((w) => presence.has(`${m.id}:${w.id}`))
        .map((w) => ({
          weekNumber: w.weekNumber,
          keys: aggregateMemberWeek(ds, m.id, w.id, "total").keys,
        }));

      const missedWeekNumbers = present
        .filter((w) => w.keys < BLACKLIST_MIN_KEYS_PER_WEEK)
        .map((w) => w.weekNumber);
      const keysUsed = present.reduce((s, w) => s + w.keys, 0);
      const keysPossible = present.length * maxKeysPerWeek;

      return {
        member: { ...m, isActive: true }, // roster-only by construction
        weeksConsidered: present.length,
        missedWeeks: missedWeekNumbers.length,
        missedWeekNumbers,
        keysUsed,
        keysPossible,
        participationPct: keysPossible ? (keysUsed / keysPossible) * 100 : 0,
      } satisfies BlackListRow;
    })
    .filter((r) => r.weeksConsidered >= BLACKLIST_MIN_WEEKS_PRESENT);

  const rows = judged.filter((r) => r.missedWeeks >= BLACKLIST_MIN_MISSES);

  // Worst first: most missed weeks, then lowest participation, then by name so
  // the order is stable for members who tie on both.
  rows.sort(
    (a, b) =>
      b.missedWeeks - a.missedWeeks ||
      a.participationPct - b.participationPct ||
      a.member.inGameName.localeCompare(b.member.inGameName),
  );

  return { rule, rows, membersJudged: judged.length, excusedCount };
}
