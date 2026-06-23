import { Flame, Cat, Info } from "lucide-react";
import type { OverviewStats } from "@/lib/types";
import { formatDamage, formatKeys } from "@/lib/format";

const THEME = {
  hydra: {
    label: "Hydra Clash",
    Icon: Flame,
    text: "text-hydra",
    bar: "bg-hydra",
    glow: "shadow-[0_0_24px_-8px_var(--color-hydra)]",
  },
  chimera: {
    label: "Chimera Clash",
    Icon: Cat,
    text: "text-chimera",
    bar: "bg-chimera",
    glow: "shadow-[0_0_24px_-8px_var(--color-chimera)]",
  },
} as const;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-4 first:pl-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function ClashCard({ stats, dateRange }: { stats: OverviewStats; dateRange?: string }) {
  const t = THEME[stats.clashType];
  return (
    <section className="rounded-2xl border border-border bg-panel p-5">
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 place-items-center rounded-lg bg-panel-2 ${t.text} ${t.glow}`}>
          <t.Icon size={20} />
        </span>
        <h2 className={`text-lg font-semibold ${t.text}`}>{t.label}</h2>
        {dateRange && <span className="ml-auto text-xs text-muted">{dateRange} UTC</span>}
      </div>

      <div className="mt-5 grid grid-cols-4 divide-x divide-border">
        <Stat label="Key Usage" value={formatKeys(stats.keyUsageAvg)} sub="Average" />
        <Stat label="Total Damage" value={formatDamage(stats.totalDamage)} />
        <Stat label="Avg Damage / Key" value={formatDamage(stats.avgDamagePerKey)} />
        <Stat
          label="Members Participated"
          value={`${stats.membersParticipated}`}
          sub={`of ${stats.totalMembers}`}
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="text-xs text-muted">Progress</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full ${t.bar}`}
            style={{ width: `${stats.progress}%` }}
          />
        </div>
        <span className="text-sm font-medium tabular-nums">{stats.progress.toFixed(1)}%</span>
        <Info size={14} className="text-faint" />
      </div>
    </section>
  );
}
