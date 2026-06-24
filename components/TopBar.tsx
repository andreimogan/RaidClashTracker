"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { ExportButton, type ExportData } from "./ExportButton";

export type { ExportData };

export function TopBar({
  title,
  weekNumbers,
  currentWeek,
  exportData,
  weekRanges,
}: {
  title: string;
  weekNumbers: number[];
  currentWeek: number;
  exportData?: ExportData;
  weekRanges?: Record<number, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const go = (week: number) => {
    const next = new URLSearchParams(params);
    next.set("week", String(week));
    router.push(`${pathname}?${next.toString()}`);
  };

  const idx = weekNumbers.indexOf(currentWeek);
  const canPrev = idx > 0;
  const canNext = idx >= 0 && idx < weekNumbers.length - 1;

  return (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2">
          <Calendar size={15} className="text-muted" />
          <select
            value={currentWeek}
            onChange={(e) => go(Number(e.target.value))}
            className="cursor-pointer bg-transparent text-sm font-medium outline-none"
          >
            {weekNumbers.map((w) => (
              <option key={w} value={w} className="bg-panel text-text">
                Week {w}{weekRanges?.[w] ? ` (${weekRanges[w]})` : ""}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => canPrev && go(weekNumbers[idx - 1])}
          disabled={!canPrev}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-panel text-muted enabled:hover:text-text disabled:opacity-40"
          aria-label="Previous week"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => canNext && go(weekNumbers[idx + 1])}
          disabled={!canNext}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-panel text-muted enabled:hover:text-text disabled:opacity-40"
          aria-label="Next week"
        >
          <ChevronRight size={18} />
        </button>

        <ExportButton data={exportData} />
      </div>
    </div>
  );
}
