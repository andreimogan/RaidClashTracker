import { loadDataset } from "@/lib/data";
import {
  getAllWeeksTotals,
  getBlackList,
  getKeyUsageSummary,
  getOverview,
  getPerformance,
  getTimeline,
  latestWeekNumber,
  sortedWeeks,
} from "@/lib/compute";
import { ClashCard } from "@/components/ClashCard";
import { BlackListTable } from "@/components/BlackListTable";
import { PerformanceTable } from "@/components/PerformanceTable";
import { TimelineStrip } from "@/components/TimelineStrip";
import { DonutSummary } from "@/components/DonutSummary";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { TopBar, type ExportData } from "@/components/TopBar";
import { PendingSwap } from "@/components/WeekTransition";
import { ClashCardSkeleton, DonutSummarySkeleton } from "@/components/Skeleton";
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
  };
  const totals = getAllWeeksTotals(ds);
  // All-weeks, like getAllWeeksTotals — no week argument, so the week picker
  // does not change it and it draws no placeholders during a week change.
  const blackList = getBlackList(ds);
  // Export keeps the selected week's combined standings (independent of tab).
  const weekTotal = getPerformance(ds, selectedWeek, "total");
  const timeline = getTimeline(ds);
  const keyUsage = getKeyUsageSummary(ds, selectedWeek);

  const weekLabel = weekRanges[selectedWeek]
    ? `Week ${selectedWeek} (${weekRanges[selectedWeek]})`
    : `Week ${selectedWeek}`;
  const allWeeksLabel = weeks.length
    ? formatDateRange(weeks[0].startDate, weeks[weeks.length - 1].endDate)
    : "";

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
    rows: weekTotal.map((r, i) => [
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

  // The overview scrolls as one document. It used to be pinned to the viewport
  // (a full-height flex column with the table as the only scrolling child), which
  // is why every block here carried sizing scaffolding; paginating the tables at
  // 10 rows is what made that unnecessary, so the scaffolding is gone with it.
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
        <div className="card flex items-center gap-3 text-sm text-muted">
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

      {/* Week-scoped: getOverview(ds, selectedWeek, …). PendingSwap takes these
          as `children`, so the cards stay server-rendered. */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <PendingSwap className="xl:h-full" skeleton={<ClashCardSkeleton clashType="hydra" />}>
          <ClashCard stats={hydra} dateRange={clashRange("hydra")} />
        </PendingSwap>
        <PendingSwap className="xl:h-full" skeleton={<ClashCardSkeleton clashType="chimera" />}>
          <ClashCard stats={chimera} dateRange={clashRange("chimera")} />
        </PendingSwap>
      </div>

      {/* Clan Performance + Black List, 2 + 1 — the same split the TimelineStrip
          row below uses, but held back to `2xl` (1536px) rather than `xl`
          (1280px). Measured: two of three columns here is
          `2*(vw - 76 sidebar - 36 padding - 30 gaps)/3 + 15`, so Clan
          Performance's min-w-[860px] grid needs ~1410px of viewport and the
          Total tab's min-w-[920px] needs ~1500px. Splitting at `xl` would put a
          permanent horizontal scrollbar on the app's main table for every
          1280–1500px laptop; `2xl` clears both. Below it the two cards stack at
          full width and neither scrolls. */}
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-3">
        <div className="xl:h-full 2xl:col-span-2">
          <PerformanceTable data={perf} totals={totals} weekLabel={weekLabel} allWeeksLabel={allWeeksLabel} />
        </div>
        {/* Not swapped, and not for the same reason TimelineStrip isn't: this one
            has no week input at all. */}
        <div className="xl:h-full">
          <BlackListTable data={blackList} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* TimelineStrip is deliberately NOT swapped: getTimeline(ds) covers
            every week and `currentWeek` only moves a highlight. */}
        <div className="xl:col-span-2 xl:h-full">
          <TimelineStrip data={timeline} currentWeek={selectedWeek} />
        </div>
        <PendingSwap className="xl:h-full" skeleton={<DonutSummarySkeleton />}>
          <DonutSummary summary={keyUsage} />
        </PendingSwap>
      </div>
    </div>
  );
}
