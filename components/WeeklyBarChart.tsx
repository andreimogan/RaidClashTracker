"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import type { TimelineWeek } from "@/lib/types";
import type { ClashType } from "@/lib/types";
import { formatDamage } from "@/lib/format";
import { SectionTitle } from "./SectionTitle";

export function WeeklyBarChart({
  timeline,
  clashType,
  currentWeek,
}: {
  timeline: TimelineWeek[];
  clashType: ClashType;
  currentWeek: number;
}) {
  const gradId = clashType === "hydra" ? "grad-hydra-bar" : "grad-chimera-bar";
  const stopBright = clashType === "hydra" ? "var(--color-hydra-bright)" : "var(--color-chimera-bright)";
  const stopDeep = clashType === "hydra" ? "var(--color-hydra)" : "var(--color-chimera)";
  const data = timeline.map((t) => ({
    week: `W${t.week.weekNumber}`,
    weekNumber: t.week.weekNumber,
    damage: clashType === "hydra" ? t.hydraDamage : t.chimeraDamage,
  }));

  return (
    <section className="card">
      <SectionTitle>Clan Damage by Week</SectionTitle>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stopBright} />
                <stop offset="100%" stopColor={stopDeep} />
              </linearGradient>
            </defs>
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
              itemStyle={{ color: "var(--color-text)" }}
              labelStyle={{ color: "var(--color-muted)" }}
              formatter={(v) => [formatDamage(Number(v)), "Damage"]}
            />
            <Bar dataKey="damage" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell
                  key={d.week}
                  fill={`url(#${gradId})`}
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
