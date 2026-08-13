"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { KeyUsageSummary } from "@/lib/types";
import { formatKeys } from "@/lib/format";
import { SectionTitle } from "./SectionTitle";

export function DonutSummary({ summary }: { summary: KeyUsageSummary }) {
  const data = [
    { name: "Hydra", value: summary.hydraAvgKeys, fill: "url(#grad-hydra)" },
    { name: "Chimera", value: summary.chimeraAvgKeys, fill: "url(#grad-chimera)" },
  ];

  return (
    // `xl:h-full` because this is a grid item on `/` sharing a row with
    // TimelineStrip (the taller of the two); it stretches, and once a
    // PendingSwap <div> sits between it and the grid, only that div inherits
    // the row height — the card has to claim it explicitly or the row gaps.
    <section className="card xl:h-full">
      <SectionTitle>Key Usage Summary</SectionTitle>

      <div className="mt-3 flex items-center gap-5">
        <div className="h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <linearGradient id="grad-hydra" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-hydra-bright)" />
                  <stop offset="100%" stopColor="var(--color-hydra)" />
                </linearGradient>
                <linearGradient id="grad-chimera" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chimera-bright)" />
                  <stop offset="100%" stopColor="var(--color-chimera)" />
                </linearGradient>
              </defs>
              <Pie
                data={data}
                dataKey="value"
                innerRadius="62%"
                outerRadius="92%"
                startAngle={90}
                endAngle={-270}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-hydra">
              <span className="h-2.5 w-2.5 rounded-full bg-hydra" /> Hydra Clash
            </div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">
              {formatKeys(summary.hydraAvgKeys)}
            </div>
            <div className="stat-label">Average Keys Used</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-chimera">
              <span className="h-2.5 w-2.5 rounded-full bg-chimera" /> Chimera Clash
            </div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">
              {formatKeys(summary.chimeraAvgKeys)}
            </div>
            <div className="stat-label">Average Keys Used</div>
          </div>
        </div>
      </div>
    </section>
  );
}
