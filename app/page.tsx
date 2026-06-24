import { loadDataset } from "@/lib/data";
import {
  getKeyUsageSummary,
  getOverview,
  getPerformance,
  getTimeline,
  latestWeekNumber,
  sortedWeeks,
} from "@/lib/compute";
import { ClashCard } from "@/components/ClashCard";
import { PerformanceTable } from "@/components/PerformanceTable";
import { TimelineStrip } from "@/components/TimelineStrip";
import { DonutSummary } from "@/components/DonutSummary";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { TopBar, type ExportData } from "@/components/TopBar";
import { formatDamage, formatDateRange, formatKeys } from "@/lib/format";
import { clashWindow } from "@/lib/week";

export default async function DashboardPage({
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

  const hydra = getOverview(ds, selectedWeek, "hydra");
  const chimera = getOverview(ds, selectedWeek, "chimera");
  const perf = {
    hydra: getPerformance(ds, selectedWeek, "hydra"),
    chimera: getPerformance(ds, selectedWeek, "chimera"),
    total: getPerformance(ds, selectedWeek, "total"),
  };
  const timeline = getTimeline(ds);
  const keyUsage = getKeyUsageSummary(ds, selectedWeek);

  const weekObj = weeks.find((w) => w.weekNumber === selectedWeek);
  const clashRange = (ct: "hydra" | "chimera") => {
    if (!weekObj) return undefined;
    const win = clashWindow(weekObj.startDate, ct);
    return formatDateRange(win.startDate, win.endDate);
  };

  const exportData: ExportData = {
    filename: `clash-week-${selectedWeek}.csv`,
    headers: [
      "Rank", "Player", "Keys (Week)", "Keys (Avg)",
      "Damage (Week)", "Damage (Avg)", "Avg Dmg/Key", "Participation %", "Trend %",
    ],
    rows: perf.total.map((r, i) => [
      i + 1,
      r.member.inGameName,
      formatKeys(r.keysThisWeek),
      formatKeys(r.keysAverage),
      formatDamage(r.damageThisWeek),
      formatDamage(r.damageAverage),
      formatDamage(r.avgDamagePerKey),
      r.participationPct.toFixed(0),
      r.trendPct.toFixed(0),
    ]),
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <TopBar
        title="Overview"
        weekNumbers={weekNumbers}
        weekRanges={weekRanges}
        currentWeek={selectedWeek}
        exportData={exportData}
      />

      {weeks.length === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-panel p-5 text-sm text-muted">
          <Inbox size={20} className="text-gold" />
          <span>
            No clash data yet — add a week from{" "}
            <Link href="/settings" className="text-text underline underline-offset-2 hover:text-gold">
              Clan Settings → Import data
            </Link>
            .
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ClashCard stats={hydra} dateRange={clashRange("hydra")} />
        <ClashCard stats={chimera} dateRange={clashRange("chimera")} />
      </div>

      <PerformanceTable data={perf} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TimelineStrip data={timeline} currentWeek={selectedWeek} />
        </div>
        <DonutSummary summary={keyUsage} />
      </div>
    </div>
  );
}
