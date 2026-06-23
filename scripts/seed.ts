// Seeds the local SQLite DB with the bundled sample dataset (same data the app
// shows in demo mode). Run after `npm run db:init`: `npm run seed`.
import "./lib/load-env";
import { CLASH_META, CLASH_RESULTS, MEMBERS, WEEKS } from "../lib/mock-data";
import { persist } from "../lib/persist";
import type { NormalizedRow, ProgressInfo, WeekInfo } from "../lib/import";

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

persist({ rows, weeks, progress }, "upsert")
  .then((s) => {
    console.log(`Seed complete: ${s.results} results across weeks ${s.weekNumbers.join(", ")}.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
