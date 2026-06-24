"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TimelineWeek } from "@/lib/types";
import { formatDamage, formatDateRange } from "@/lib/format";
import { SectionTitle } from "./SectionTitle";

export function TimelineStrip({
  data,
  currentWeek,
}: {
  data: TimelineWeek[];
  currentWeek: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);

  const go = (week: number) => {
    const next = new URLSearchParams(params);
    next.set("week", String(week));
    router.push(`${pathname}?${next.toString()}`);
  };

  const scroll = (dir: -1 | 1) =>
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <section className="rounded-2xl border border-border bg-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle>Clash Timeline</SectionTitle>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-hydra" /> Hydra Clash
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-chimera" /> Chimera Clash
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => scroll(-1)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-panel-2 text-muted hover:text-text"
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} />
        </button>

        <div ref={scrollRef} className="flex gap-3 overflow-x-auto scroll-smooth py-1">
          {data.map(({ week, hydraDamage, chimeraDamage }) => {
            const active = week.weekNumber === currentWeek;
            return (
              <button
                key={week.id}
                onClick={() => go(week.weekNumber)}
                className={`min-w-[150px] shrink-0 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-gold bg-panel-2"
                    : "border-border bg-panel-2/40 hover:border-border-soft"
                }`}
              >
                <div className="text-sm font-semibold">Week {week.weekNumber}</div>
                <div className="text-[11px] text-muted">
                  {formatDateRange(week.startDate, week.endDate)}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-sm">
                  <span className="h-2 w-2 rounded-full bg-hydra" />
                  <span className="tabular-nums">{formatDamage(hydraDamage)}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm">
                  <span className="h-2 w-2 rounded-full bg-chimera" />
                  <span className="tabular-nums">{formatDamage(chimeraDamage)}</span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => scroll(1)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-panel-2 text-muted hover:text-text"
          aria-label="Scroll right"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
