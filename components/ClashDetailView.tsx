import { loadDataset } from "@/lib/data";
import {
  getOverview,
  getPerformance,
  getTimeline,
  latestWeekNumber,
  sortedWeeks,
} from "@/lib/compute";
import type { ClashType } from "@/lib/types";
import { ClashCard } from "./ClashCard";
import { ClashTable } from "./ClashTable";
import { WeeklyBarChart } from "./WeeklyBarChart";
import { TopBar, type ExportData } from "./TopBar";
import { formatDamage, formatDateRange, formatKeys } from "@/lib/format";
import { clashWindow } from "@/lib/week";

export async function ClashDetailView({
  clashType,
  weekParam,
}: {
  clashType: ClashType;
  weekParam?: string;
}) {
  const ds = await loadDataset();
  const weeks = sortedWeeks(ds);
  const weekNumbers = weeks.map((w) => w.weekNumber);
  const weekRanges = Object.fromEntries(
    weeks.map((w) => {
      const win = clashWindow(w.startDate, clashType);
      return [w.weekNumber, formatDateRange(win.startDate, win.endDate)];
    }),
  );
  const requested = Number(weekParam);
  const selectedWeek = weekNumbers.includes(requested) ? requested : latestWeekNumber(ds);

  const overview = getOverview(ds, selectedWeek, clashType);
  const rows = getPerformance(ds, selectedWeek, clashType);
  const timeline = getTimeline(ds);
  const title = clashType === "hydra" ? "Hydra Clash" : "Chimera Clash";

  const weekObj = weeks.find((w) => w.weekNumber === selectedWeek);
  const dateRange = weekObj
    ? (() => {
        const win = clashWindow(weekObj.startDate, clashType);
        return formatDateRange(win.startDate, win.endDate);
      })()
    : undefined;

  const exportData: ExportData = {
    filename: `${clashType}-week-${selectedWeek}.csv`,
    headers: ["Rank", "Player", "Keys", "Damage", "Avg Dmg/Key", "Participation %", "Trend %"],
    rows: rows.map((r, i) => [
      i + 1,
      r.member.inGameName,
      formatKeys(r.keysThisWeek),
      formatDamage(r.damageThisWeek),
      formatDamage(r.avgDamagePerKey),
      r.participationPct.toFixed(0),
      r.trendPct.toFixed(0),
    ]),
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <TopBar title={title} weekNumbers={weekNumbers} weekRanges={weekRanges} currentWeek={selectedWeek} exportData={exportData} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ClashCard stats={overview} dateRange={dateRange} />
        </div>
        <WeeklyBarChart timeline={timeline} clashType={clashType} currentWeek={selectedWeek} />
      </div>
      <ClashTable rows={rows} clashType={clashType} />
    </div>
  );
}
