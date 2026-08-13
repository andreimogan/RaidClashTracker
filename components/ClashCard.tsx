import { Flame, Cat } from "lucide-react";
import type { OverviewStats } from "@/lib/types";
import { formatDamage, formatKeys } from "@/lib/format";

/**
 * The clash accent pairing — Hydra warm amber, Chimera steel-blue.
 * Exported because `components/Skeleton.tsx` renders this card's week-independent
 * chrome (icon + label) for real during a week swap and must not hand-copy it:
 * a renamed label or a swapped icon would otherwise survive in the placeholder.
 */
export const THEME = {
  hydra: {
    label: "HYDRA CLASH",
    Icon: Flame,
    text: "text-hydra",
    bar: "fill-hydra",
  },
  chimera: {
    label: "CHIMERA CLASH",
    Icon: Cat,
    text: "text-chimera",
    bar: "fill-chimera",
  },
} as const;

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="flex-1 px-4 py-3 text-center">
      <div className="text-[11px] font-medium leading-tight text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {caption && <div className="text-xs text-muted">{caption}</div>}
    </div>
  );
}

export function ClashCard({ stats, dateRange }: { stats: OverviewStats; dateRange?: string }) {
  const t = THEME[stats.clashType];
  return (
    <section className="card xl:h-full">
      <div className="flex items-center gap-2.5">
        <t.Icon size={22} className={t.text} />
        <h2 className={`font-display text-base font-semibold ${t.text}`}>{t.label}</h2>
        {dateRange && <span className="ml-auto text-s text-muted">{dateRange} UTC</span>}
      </div>

      <div className="mt-4 flex divide-x divide-border overflow-hidden inset">
        <Stat label="Key Usage" value={formatKeys(stats.keyUsageAvg)} caption="Average" />
        <Stat label="Total Damage" value={formatDamage(stats.totalDamage)} />
        <Stat label="Avg Damage / Key" value={formatDamage(stats.avgDamagePerKey)} />
        <Stat
          label="Members Participated"
          value={`${stats.membersParticipated} / ${stats.totalMembers}`}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-s text-muted">Progress</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full ${t.bar}`}
            style={{ width: `${stats.progress}%` }}
          />
        </div>
        <span className="text-sm font-medium tabular-nums">{stats.progress.toFixed(1)}%</span>
      </div>
    </section>
  );
}
