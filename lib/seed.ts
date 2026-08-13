// Server-only: build the bundled demo dataset as an import payload and write it
// into a given DB. Used by the seed CLI script (`npm run seed`), its only caller.
import type { Db } from "./db";
import { CLASH_META, CLASH_RESULTS, MEMBERS, WEEKS } from "./mock-data";
import { persist, type PersistSummary } from "./persist";
import type { ImportPayload, NormalizedRow, ProgressInfo, WeekInfo } from "./import";

export function buildDemoPayload(): ImportPayload {
  const memberName = new Map(MEMBERS.map((m) => [m.id, m.inGameName]));
  const weekNum = new Map(WEEKS.map((w) => [w.id, w.weekNumber]));

  const rows: NormalizedRow[] = CLASH_RESULTS.map((r) => ({
    weekNumber: weekNum.get(r.weekId)!,
    memberName: memberName.get(r.memberId)!,
    clashType: r.clashType,
    keysUsed: r.keysUsed,
    totalDamage: r.totalDamage,
  }));

  const weeks: WeekInfo[] = WEEKS.map((w) => ({
    weekNumber: w.weekNumber,
    startDate: w.startDate,
    endDate: w.endDate,
  }));

  const progress: ProgressInfo[] = CLASH_META.map((m) => ({
    weekNumber: weekNum.get(m.weekId)!,
    clashType: m.clashType,
    progress: m.progress,
  }));

  return { rows, weeks, progress };
}

export async function seedDemo(db?: Db): Promise<PersistSummary> {
  return persist(buildDemoPayload(), "upsert", db);
}
