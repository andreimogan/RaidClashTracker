"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { KeyUsageSummary } from "@/lib/types";
import { formatKeys } from "@/lib/format";

export function DonutSummary({ summary }: { summary: KeyUsageSummary }) {
  const data = [
    { name: "Hydra", value: summary.hydraAvgKeys, color: "var(--color-hydra)" },
    { name: "Chimera", value: summary.chimeraAvgKeys, color: "var(--color-chimera)" },
  ];

  return (
    <section className="rounded-2xl border border-border bg-panel p-5">
      <h2 className="text-lg font-semibold">Key Usage Summary</h2>

      <div className="mt-3 flex items-center gap-5">
        <div className="h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={44}
                outerRadius={64}
                startAngle={90}
                endAngle={-270}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={d.color} />
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
            <div className="text-xs text-muted">Average Keys Used</div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-chimera">
              <span className="h-2.5 w-2.5 rounded-full bg-chimera" /> Chimera Clash
            </div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums">
              {formatKeys(summary.chimeraAvgKeys)}
            </div>
            <div className="text-xs text-muted">Average Keys Used</div>
          </div>
        </div>
      </div>
    </section>
  );
}
