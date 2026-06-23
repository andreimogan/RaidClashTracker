import { loadDataset } from "@/lib/data";
import { activeMemberIds, latestWeekNumber, sortedWeeks } from "@/lib/compute";
import { TopBar, type ExportData } from "@/components/TopBar";
import { Avatar } from "@/components/Avatar";
import { formatDamage, formatKeys } from "@/lib/format";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const ds = await loadDataset();
  const weeks = sortedWeeks(ds);
  const weekNumbers = weeks.map((w) => w.weekNumber);
  const requested = Number(week);
  const selectedWeek = weekNumbers.includes(requested) ? requested : latestWeekNumber(ds);
  const activeIds = activeMemberIds(ds);

  const summaries = ds.members
    .map((member) => {
      const rows = ds.results.filter((r) => r.memberId === member.id);
      const hydra = rows.filter((r) => r.clashType === "hydra");
      const chimera = rows.filter((r) => r.clashType === "chimera");
      const weeksPresent = new Set(rows.map((r) => r.weekId)).size;
      const weeksActive = new Set(rows.filter((r) => r.keysUsed > 0).map((r) => r.weekId)).size;
      const totalKeys = rows.reduce((s, r) => s + r.keysUsed, 0);
      return {
        member,
        isActive: activeIds.has(member.id),
        weeksPresent,
        hydraTotal: hydra.reduce((s, r) => s + r.totalDamage, 0),
        chimeraTotal: chimera.reduce((s, r) => s + r.totalDamage, 0),
        avgKeys: weeksPresent ? totalKeys / weeksPresent : 0,
        participationPct: weeksPresent ? (weeksActive / weeksPresent) * 100 : 0,
      };
    })
    // Current roster first, then by total damage dealt.
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.hydraTotal + b.chimeraTotal - (a.hydraTotal + a.chimeraTotal);
    });

  const activeCount = summaries.filter((s) => s.isActive).length;
  const formerCount = summaries.length - activeCount;

  const exportData: ExportData = {
    filename: "members.csv",
    headers: ["Player", "Status", "Weeks", "Level", "Hydra Total", "Chimera Total", "Avg Keys/Week", "Participation %"],
    rows: summaries.map((s) => [
      s.member.inGameName,
      s.isActive ? "Active" : "Former",
      s.weeksPresent,
      s.member.level,
      formatDamage(s.hydraTotal),
      formatDamage(s.chimeraTotal),
      formatKeys(s.avgKeys),
      s.participationPct.toFixed(0),
    ]),
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <TopBar title="Members" weekNumbers={weekNumbers} currentWeek={selectedWeek} exportData={exportData} />
      <section className="rounded-2xl border border-border bg-panel">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-lg font-semibold">Roster</h2>
          <span className="text-sm text-muted">
            <span className="text-hydra">{activeCount} active</span> · {formerCount} former ·{" "}
            {summaries.length} tracked
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2 pl-5 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Weeks</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="px-3 py-2 font-medium text-hydra">Hydra Total</th>
                <th className="px-3 py-2 font-medium text-chimera">Chimera Total</th>
                <th className="px-3 py-2 font-medium">Avg Keys / Week</th>
                <th className="px-3 py-2 pr-5 font-medium">Participation</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s, i) => (
                <tr key={s.member.id} className="border-b border-border-soft last:border-0 hover:bg-panel-2/50">
                  <td className="px-3 py-2.5 pl-5 text-muted tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.member.inGameName} size={32} badge={s.member.heroLevel} />
                      <span className={`font-medium ${s.isActive ? "" : "text-muted"}`}>
                        {s.member.inGameName}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {s.isActive ? (
                      <span className="rounded-full border border-hydra/30 bg-hydra/10 px-2 py-0.5 text-xs font-medium text-hydra">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-panel-2 px-2 py-0.5 text-xs font-medium text-faint">
                        Former
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{s.weeksPresent}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{s.member.level}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatDamage(s.hydraTotal)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatDamage(s.chimeraTotal)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{formatKeys(s.avgKeys)}</td>
                  <td className="px-3 py-2.5 pr-5 tabular-nums">{s.participationPct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
