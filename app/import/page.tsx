import { loadDataset } from "@/lib/data";
import { sortedWeeks } from "@/lib/compute";
import { currentWeek } from "@/lib/week";
import { ImportPanel } from "@/components/ImportPanel";

// Reads existing weeks + computes the current clash week per request.
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const ds = await loadDataset();
  const weeks = sortedWeeks(ds);
  const current = currentWeek(weeks);

  return (
    <ImportPanel
      weeks={weeks.map((w) => ({
        weekNumber: w.weekNumber,
        startDate: w.startDate,
        endDate: w.endDate,
      }))}
      currentWeek={current}
    />
  );
}
