import { Database, CheckCircle2, AlertTriangle, Users, UsersRound, Swords } from "lucide-react";
import { loadDataset, getDataSource } from "@/lib/data";
import { activeMemberIds, sortedWeeks } from "@/lib/compute";
import { currentWeek } from "@/lib/week";
import { CLAN_CAP } from "@/lib/constants";
import { DATABASE_URL, isRemoteDb } from "@/lib/db";
import { SettingsTabs } from "@/components/SettingsTabs";
import { ImportPanel } from "@/components/ImportPanel";
import { DataManagement } from "@/components/DataManagement";

// Reflects live DB state (seeded vs demo), so render per-request.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ds = await loadDataset();
  const source = await getDataSource();
  const currentRoster = Math.min(activeMemberIds(ds).size, CLAN_CAP);
  const trackedMembers = ds.members.length;

  const weeks = sortedWeeks(ds);
  const current = currentWeek(weeks);

  // Per-week, per-clash row counts so the import panel can warn before overwrite.
  const weekNumById = new Map(ds.weeks.map((w) => [w.id, w.weekNumber]));
  const existingData: Record<number, { hydra: number; chimera: number }> = {};
  for (const r of ds.results) {
    const wn = weekNumById.get(r.weekId);
    if (wn == null) continue;
    (existingData[wn] ??= { hydra: 0, chimera: 0 })[r.clashType]++;
  }

  const overview = (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-panel p-5">
        <h2 className="mb-4 text-lg font-semibold">Clan</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-panel-2 p-4">
            <div className="flex items-center gap-2 text-muted">
              <Users size={16} /> <span className="text-sm">Current Roster</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">{currentRoster} / {CLAN_CAP}</div>
          </div>
          <div className="rounded-xl border border-border bg-panel-2 p-4">
            <div className="flex items-center gap-2 text-muted">
              <UsersRound size={16} /> <span className="text-sm">Tracked Members</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">{trackedMembers}</div>
            <div className="text-xs text-muted">all-time, incl. former</div>
          </div>
          <div className="rounded-xl border border-border bg-panel-2 p-4">
            <div className="flex items-center gap-2 text-muted">
              <Swords size={16} /> <span className="text-sm">Tracked Clashes</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">Hydra · Chimera</div>
          </div>
          <div className="rounded-xl border border-border bg-panel-2 p-4">
            <div className="flex items-center gap-2 text-muted">
              <Database size={16} /> <span className="text-sm">Weeks Tracked</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">{ds.weeks.length}</div>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-panel p-5">
        <h2 className="mb-4 text-lg font-semibold">Data Source</h2>
        {source === "sqlite" ? (
          <div className="flex items-start gap-3 rounded-xl border border-hydra/30 bg-hydra/5 p-4">
            <CheckCircle2 className="mt-0.5 text-hydra" size={20} />
            <div>
              <div className="font-medium text-hydra">
                {isRemoteDb ? "Connected to remote database" : "Local database"}
              </div>
              <p className="mt-1 text-sm text-muted">
                Reading live data from{" "}
                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">{DATABASE_URL}</code>.
                Use the <span className="text-text">Import data</span> tab after each clash to update it.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4">
            <AlertTriangle className="mt-0.5 text-gold" size={20} />
            <div>
              <div className="font-medium text-gold">Demo mode (seed data)</div>
              <p className="mt-1 text-sm text-muted">
                The local database isn&apos;t set up yet, so the dashboard is showing bundled
                sample data. Run{" "}
                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run db:init</code>{" "}
                then{" "}
                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run seed</code>{" "}
                to create and populate{" "}
                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">data/clash.db</code>.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-panel p-5">
        <h2 className="mb-2 text-lg font-semibold">Updating the Data</h2>
        <ol className="ml-5 list-decimal space-y-1.5 text-sm text-muted">
          <li>One-time: <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run db:init</code> creates the local database (skip if it&apos;s already set up).</li>
          <li>After a clash ends, open the <span className="text-text">Import data</span> tab above — sync your Google Sheet, or upload/paste the clash JSON.</li>
          <li>Pick the week (it defaults to the current clash week) and the clash; the start/end dates auto-derive from the clash schedule.</li>
          <li>Prefer the terminal? <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run sync:sheet</code>, <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run import:json</code>, or <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run import</code> (CSV) do the same.</li>
          <li>Run <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run dev</code> whenever you want to view stats.</li>
        </ol>
      </section>

      <DataManagement />
    </div>
  );

  const importPanel = (
    <ImportPanel
      weeks={weeks.map((w) => ({
        weekNumber: w.weekNumber,
        startDate: w.startDate,
        endDate: w.endDate,
      }))}
      currentWeek={current}
      existingData={existingData}
    />
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Clan Settings</h1>
      <SettingsTabs overview={overview} importPanel={importPanel} />
    </div>
  );
}
