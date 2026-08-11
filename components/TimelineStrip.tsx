"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Flame, Cat } from "lucide-react";
import type { TimelineWeek } from "@/lib/types";
import { formatDamage, formatDateRange } from "@/lib/format";
import { SectionTitle } from "./SectionTitle";

function WeekCard({
  weekNumber,
  range,
  hydra,
  chimera,
  selected,
  onClick,
}: {
  weekNumber: number;
  range: string;
  hydra: number;
  chimera: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-[150px] shrink-0 flex-col items-center rounded-xl border p-3 text-center transition-colors ${
        selected
          ? "border-gold bg-panel-2 shadow-[inset_0_0_8px_-4px_var(--color-gold)]"
          : "border-border bg-panel-2/40 hover:border-border-soft"
      }`}
    >
      <div className="text-sm font-semibold">Week {weekNumber}</div>
      <div className="text-[11px] text-muted">{range}</div>
      <div className="my-2.5 h-px w-full bg-border-soft" />
      <div className="flex items-center gap-1.5 text-sm">
        <Flame size={16} className="text-hydra" />
        <span className="tabular-nums">{formatDamage(hydra)}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-sm">
        <Cat size={16} className="text-chimera" />
        <span className="tabular-nums">{formatDamage(chimera)}</span>
      </div>
    </button>
  );
}

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
    <section className="card xl:h-full">
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle>Clash Timeline</SectionTitle>
        <div className="flex items-center gap-4 text-s text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Flame size={16} className="text-hydra" /> Hydra Clash
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Cat size={16} className="text-chimera" /> Chimera Clash
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => scroll(-1)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:text-text"
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} />
        </button>

        <div ref={scrollRef} className="flex gap-3 overflow-x-auto scroll-smooth py-1">
          {data.map(({ week, hydraDamage, chimeraDamage }) => (
            <WeekCard
              key={week.id}
              weekNumber={week.weekNumber}
              range={formatDateRange(week.startDate, week.endDate)}
              hydra={hydraDamage}
              chimera={chimeraDamage}
              selected={week.weekNumber === currentWeek}
              onClick={() => go(week.weekNumber)}
            />
          ))}
        </div>

        <button
          onClick={() => scroll(1)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:text-text"
          aria-label="Scroll right"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
