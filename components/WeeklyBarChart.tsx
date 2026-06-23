"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import type { TimelineWeek } from "@/lib/types";
import type { ClashType } from "@/lib/types";
import { formatDamage } from "@/lib/format";

export function WeeklyBarChart({
  timeline,
  clashType,
  currentWeek,
}: {
  timeline: TimelineWeek[];
  clashType: ClashType;
  currentWeek: number;
}) {
  const accent = clashType === "hydra" ? "var(--color-hydra)" : "var(--color-chimera)";
  const data = timeline.map((t) => ({
    week: `W${t.week.weekNumber}`,
    weekNumber: t.week.weekNumber,
    damage: clashType === "hydra" ? t.hydraDamage : t.chimeraDamage,
  }));

  return (
    <section className="rounded-2xl border border-border bg-panel p-5">
      <h2 className="text-lg font-semibold">Clan Damage by Week</h2>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis
              dataKey="week"
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatDamage(v)}
              tick={{ fill: "var(--color-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              cursor={{ fill: "var(--color-panel-2)" }}
              contentStyle={{
                background: "var(--color-panel-2)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                color: "var(--color-text)",
              }}
              formatter={(v) => [formatDamage(Number(v)), "Damage"]}
            />
            <Bar dataKey="damage" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell
                  key={d.week}
                  fill={accent}
                  fillOpacity={d.weekNumber === currentWeek ? 1 : 0.4}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
