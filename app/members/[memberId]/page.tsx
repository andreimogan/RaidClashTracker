import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Flame, Cat } from "lucide-react";
import { loadDataset } from "@/lib/data";
import { getMemberProfile } from "@/lib/compute";
import type { MemberClashStat } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { TrendBadge } from "@/components/TrendBadge";
import { ExportButton, type ExportData } from "@/components/ExportButton";
import { SectionTitle } from "@/components/SectionTitle";
import { formatDamage, formatKeys, formatDateRange } from "@/lib/format";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel-2 p-4">
      <div className="stat-label">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

const CLASH_THEME = {
  hydra: { label: "Hydra Clash", Icon: Flame, text: "text-hydra" },
  chimera: { label: "Chimera Clash", Icon: Cat, text: "text-chimera" },
} as const;

function ClashBreakdown({ stat }: { stat: MemberClashStat }) {
  const t = CLASH_THEME[stat.scope as "hydra" | "chimera"];
  const facts: { label: string; value: string }[] = [
    { label: "Total Damage", value: formatDamage(stat.totalDamage) },
    { label: "Total Keys", value: formatKeys(stat.totalKeys) },
    { label: "Avg Dmg / Key", value: formatDamage(stat.avgDamagePerKey) },
    { label: "Participation", value: `${stat.participationPct.toFixed(0)}%` },
  ];
  return (
    <section className="rounded-2xl border border-border bg-panel p-5">
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 place-items-center rounded-lg bg-panel-2 ${t.text}`}>
          <t.Icon size={20} />
        </span>
        <h2 className={`font-display text-sm font-semibold uppercase tracking-[0.18em] ${t.text}`}>{t.label}</h2>
        <span className="ml-auto">
          <TrendBadge value={stat.trendPct} />
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-y-4 sm:grid-cols-4 sm:divide-x sm:divide-border">
        {facts.map((f, i) => (
          <div key={f.label} className={i > 0 ? "sm:pl-4" : ""}>
            <div className="stat-label">{f.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{f.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs text-muted">
        Active {stat.weeksActive} of {stat.weeksPresent} tracked weeks · avg{" "}
        {formatKeys(stat.avgKeys)} keys / week
      </div>
    </section>
  );
}

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  // Next.js hands the route segment percent-encoded; member ids contain Unicode
  // letters (e.g. "m-κλεω-hell"), so decode before lookup. Decode is idempotent
  // here (ids have no literal "%"); guard against a malformed hand-typed URL.
  let id = memberId;
  try {
    id = decodeURIComponent(memberId);
  } catch {
    /* malformed %-sequence → keep raw, lookup will 404 */
  }
  const ds = await loadDataset();
  const profile = getMemberProfile(ds, id);
  if (!profile) notFound();

  const { member, isActive, firstWeek, lastWeek, weeksPresent, weeksActive, bestWeek, total } =
    profile;

  // Newest week first in the table.
  const history = [...profile.history].reverse();

  const tracked =
    firstWeek && lastWeek
      ? firstWeek.weekNumber === lastWeek.weekNumber
        ? `W${firstWeek.weekNumber}`
        : `W${firstWeek.weekNumber}–W${lastWeek.weekNumber}`
      : "—";

  const exportData: ExportData = {
    filename: `${member.id}-history.csv`,
    headers: [
      "Week",
      "Start",
      "End",
      "Hydra Keys",
      "Hydra Damage",
      "Chimera Keys",
      "Chimera Damage",
      "Total Keys",
      "Total Damage",
      "Participation %",
      "Trend %",
    ],
    rows: history.map((r) => [
      r.week.weekNumber,
      r.week.startDate,
      r.week.endDate,
      r.hydra.keys,
      r.hydra.damage,
      r.chimera.keys,
      r.chimera.damage,
      r.totalKeys,
      r.totalDamage,
      r.participationPct.toFixed(0),
      r.trendPct.toFixed(0),
    ]),
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link
        href="/members"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={15} /> Members
      </Link>

      {/* Identity header */}
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-panel p-5">
        <Avatar
          name={member.inGameName}
          size={56}
          ring={isActive ? "hydra" : "none"}
        />
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{member.inGameName}</h1>
            {isActive ? (
              <span className="rounded-full border border-hydra/30 bg-hydra/10 px-2 py-0.5 text-xs font-medium text-hydra">
                Active
              </span>
            ) : (
              <span className="rounded-full border border-border bg-panel-2 px-2 py-0.5 text-xs font-medium text-faint">
                Former
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-muted">
            Tracked {tracked} · {weeksPresent} weeks ({weeksActive} active)
          </div>
        </div>
        <div className="ml-auto">
          <ExportButton data={exportData} />
        </div>
      </section>

      {/* Lifetime summary */}
      <section className="rounded-2xl border border-border bg-panel p-5">
        <SectionTitle className="mb-4">Lifetime</SectionTitle>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Damage"
            value={formatDamage(total.totalDamage)}
            sub={`H ${formatDamage(profile.hydra.totalDamage)} · C ${formatDamage(profile.chimera.totalDamage)}`}
          />
          <StatCard
            label="Total Keys"
            value={formatKeys(total.totalKeys)}
            sub={`avg ${formatKeys(total.avgKeys)} / week`}
          />
          <StatCard label="Avg Damage / Key" value={formatDamage(total.avgDamagePerKey)} />
          <StatCard
            label="Participation"
            value={`${total.participationPct.toFixed(0)}%`}
            sub={bestWeek ? `best W${bestWeek.weekNumber}` : undefined}
          />
        </dl>
      </section>

      {/* Per-clash breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ClashBreakdown stat={profile.hydra} />
        <ClashBreakdown stat={profile.chimera} />
      </div>

      {/* Week-by-week history */}
      <section className="rounded-2xl border border-border bg-panel">
        <div className="flex items-center justify-between p-5 pb-3">
          <SectionTitle>Week-by-Week History</SectionTitle>
          <span className="text-sm text-muted">{weeksPresent} weeks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2 pl-5 font-medium">Week</th>
                <th className="px-3 py-2 font-medium text-hydra">Hydra Keys</th>
                <th className="px-3 py-2 font-medium text-hydra">Hydra Dmg</th>
                <th className="px-3 py-2 font-medium text-chimera">Chimera Keys</th>
                <th className="px-3 py-2 font-medium text-chimera">Chimera Dmg</th>
                <th className="px-3 py-2 font-medium">Total Keys</th>
                <th className="px-3 py-2 font-medium">Total Dmg</th>
                <th className="px-3 py-2 font-medium">Participation</th>
                <th className="px-3 py-2 pr-5 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr
                  key={r.week.id}
                  className="border-b border-border-soft last:border-0 hover:bg-panel-2/50"
                >
                  <td className="px-3 py-2.5 pl-5">
                    <div className="font-medium">W{r.week.weekNumber}</div>
                    <div className="text-xs text-muted">
                      {formatDateRange(r.week.startDate, r.week.endDate)}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{r.hydra.keys}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {r.hydra.damage ? formatDamage(r.hydra.damage) : "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{r.chimera.keys}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {r.chimera.damage ? formatDamage(r.chimera.damage) : "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{formatKeys(r.totalKeys)}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {r.totalDamage ? formatDamage(r.totalDamage) : "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{r.participationPct.toFixed(0)}%</td>
                  <td className="px-3 py-2.5 pr-5 tabular-nums">
                    <TrendBadge value={r.trendPct} />
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-muted">
                    No tracked weeks for this member yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
