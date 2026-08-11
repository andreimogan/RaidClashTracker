import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Flame, Cat } from "lucide-react";
import { loadDataset, getDataSource } from "@/lib/data";
import { getMemberProfile } from "@/lib/compute";
import type { MemberClashStat } from "@/lib/types";
import { AvatarEditor } from "@/components/AvatarEditor";
import { TrendBadge } from "@/components/TrendBadge";
import { ExportButton, type ExportData } from "@/components/ExportButton";
import { SectionTitle } from "@/components/SectionTitle";
import { MemberHistoryTable, type HistoryRow } from "@/components/MemberHistoryTable";
import { formatDamage, formatKeys } from "@/lib/format";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="inset rounded-xl p-4">
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
    <section className="card">
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

  // Demo data (bundled seed) is read-only — editing needs the local database.
  const readOnly = (await getDataSource()) !== "sqlite";

  const { member, isActive, firstWeek, lastWeek, weeksPresent, weeksActive, bestWeek, total } =
    profile;

  // All tracked weeks (newest first), merged with the member's history — weeks
  // without an entry become "absent" rows so they can be filled in via edit.
  const historyByWeekId = new Map(profile.history.map((r) => [r.week.id, r]));
  const historyRows: HistoryRow[] = [...ds.weeks]
    .sort((a, b) => b.weekNumber - a.weekNumber)
    .map((week) => {
      const w = {
        id: week.id,
        weekNumber: week.weekNumber,
        startDate: week.startDate,
        endDate: week.endDate,
      };
      const h = historyByWeekId.get(week.id);
      if (!h) {
        return {
          week: w,
          present: false,
          hydra: { keys: 0, damage: 0 },
          chimera: { keys: 0, damage: 0 },
          totalKeys: 0,
          totalDamage: 0,
          participationPct: null,
          trendPct: null,
        };
      }
      return {
        week: w,
        present: true,
        hydra: { keys: h.hydra.keys, damage: h.hydra.damage },
        chimera: { keys: h.chimera.keys, damage: h.chimera.damage },
        totalKeys: h.totalKeys,
        totalDamage: h.totalDamage,
        participationPct: h.participationPct,
        trendPct: h.trendPct,
      };
    });

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
    // Same merged rows as the table — absent weeks emit empty stat columns.
    rows: historyRows.map((r) =>
      r.present
        ? [
            r.week.weekNumber,
            r.week.startDate,
            r.week.endDate,
            r.hydra.keys,
            r.hydra.damage,
            r.chimera.keys,
            r.chimera.damage,
            r.totalKeys,
            r.totalDamage,
            (r.participationPct ?? 0).toFixed(0),
            (r.trendPct ?? 0).toFixed(0),
          ]
        : [r.week.weekNumber, r.week.startDate, r.week.endDate, "", "", "", "", "", "", "", ""],
    ),
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
      <section className="flex flex-wrap items-center gap-4 card">
        <AvatarEditor
          memberId={member.id}
          name={member.inGameName}
          avatarUrl={member.avatarUrl}
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
      <section className="card">
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

      {/* Week-by-week history (all tracked weeks; editable on a local DB) */}
      <MemberHistoryTable
        rows={historyRows}
        memberId={member.id}
        memberName={member.inGameName}
        weeksPresent={weeksPresent}
        totalWeeks={ds.weeks.length}
        readOnly={readOnly}
      />
    </div>
  );
}
