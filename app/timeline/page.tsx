import { loadDataset } from "@/lib/data";
import { getTimeline, latestWeekNumber, sortedWeeks } from "@/lib/compute";
import { TopBar, type ExportData } from "@/components/TopBar";
import { TimelineStrip } from "@/components/TimelineStrip";
import { WeeklyBarChart } from "@/components/WeeklyBarChart";
import { SectionTitle } from "@/components/SectionTitle";
import { formatDamage, formatDateRange } from "@/lib/format";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const ds = await loadDataset();
  const weeks = sortedWeeks(ds);
  const weekNumbers = weeks.map((w) => w.weekNumber);
  const weekRanges = Object.fromEntries(
    weeks.map((w) => [w.weekNumber, formatDateRange(w.startDate, w.endDate)]),
  );
  const requested = Number(week);
  const selectedWeek = weekNumbers.includes(requested) ? requested : latestWeekNumber(ds);
  const timeline = getTimeline(ds);

  const exportData: ExportData = {
    filename: "clash-timeline.csv",
    headers: ["Week", "Dates", "Hydra Damage", "Chimera Damage"],
    rows: timeline.map((t) => [
      t.week.weekNumber,
      formatDateRange(t.week.startDate, t.week.endDate),
      formatDamage(t.hydraDamage),
      formatDamage(t.chimeraDamage),
    ]),
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <TopBar title="Timeline" weekNumbers={weekNumbers} weekRanges={weekRanges} currentWeek={selectedWeek} exportData={exportData} />
      <TimelineStrip data={timeline} currentWeek={selectedWeek} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <WeeklyBarChart timeline={timeline} clashType="hydra" currentWeek={selectedWeek} />
        <WeeklyBarChart timeline={timeline} clashType="chimera" currentWeek={selectedWeek} />
      </div>

      <section className="card-flush">
        <div className="p-5 pb-3"><SectionTitle>Weekly Totals</SectionTitle></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">Week</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium text-hydra">Hydra Damage</th>
                <th className="px-3 py-2 font-medium text-chimera">Chimera Damage</th>
                <th className="px-3 py-2 font-medium">Combined</th>
              </tr>
            </thead>
            <tbody>
              {[...timeline].reverse().map((t) => (
                <tr key={t.week.id} className="border-b border-border-soft last:border-0 hover:bg-panel-2/50">
                  <td className="px-5 py-2.5 font-medium">Week {t.week.weekNumber}</td>
                  <td className="px-3 py-2.5 text-muted">{formatDateRange(t.week.startDate, t.week.endDate)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatDamage(t.hydraDamage)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatDamage(t.chimeraDamage)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">
                    {formatDamage(t.hydraDamage + t.chimeraDamage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
