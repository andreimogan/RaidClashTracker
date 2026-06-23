// Seeds Supabase with the bundled sample dataset (the same data the app shows
// in demo mode). Run once after applying the migration: `npm run seed`.
import { CLASH_META, CLASH_RESULTS, MEMBERS, WEEKS } from "../lib/mock-data";
import { persist, type ProgressInfo, type WeekInfo } from "./lib/persist";
import type { NormalizedRow } from "./lib/db";

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

persist(rows, weeks, progress)
  .then(() => {
    console.log("Seed complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
