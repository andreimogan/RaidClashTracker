import {
  Database,
  DatabaseZap,
  CheckCircle2,
  AlertTriangle,
  Users,
  UsersRound,
  Swords,
} from "lucide-react";
import { loadDataset, getDataSource } from "@/lib/data";
import { activeMemberIds, sortedWeeks } from "@/lib/compute";
import { currentWeek } from "@/lib/week";
import { CLAN_CAP } from "@/lib/constants";
import { SettingsTabs } from "@/components/SettingsTabs";
import { ImportPanel } from "@/components/ImportPanel";
import { DataManagement } from "@/components/DataManagement";
import { PageTitle } from "@/components/PageTitle";
import { SectionTitle } from "@/components/SectionTitle";

// Reflects live DB state (seeded vs demo), so render per-request.
export const dynamic = "force-dynamic";

// Inline code / command treatment, used by every instruction on this page.
const CODE_CLS = "rounded bg-panel-2 px-1.5 py-0.5 text-text";

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
      <section className="card">
        <SectionTitle className="mb-4">Clan</SectionTitle>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="inset rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted">
              <Users size={16} /> <span className="text-sm">Current Roster</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">{currentRoster} / {CLAN_CAP}</div>
          </div>
          <div className="inset rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted">
              <UsersRound size={16} /> <span className="text-sm">Tracked Members</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">{trackedMembers}</div>
            <div className="text-xs text-muted">all-time, incl. former</div>
          </div>
          <div className="inset rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted">
              <Swords size={16} /> <span className="text-sm">Tracked Clashes</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">Hydra · Chimera</div>
          </div>
          <div className="inset rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted">
              <Database size={16} /> <span className="text-sm">Weeks Tracked</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">{ds.weeks.length}</div>
          </div>
        </dl>
      </section>

      <section className="card">
        <SectionTitle className="mb-4">Data Source</SectionTitle>
        {/* Three states, not two: connected-with-data, connected-but-empty (a
            green tick next to "0 weeks tracked" reads as a bug), and demo. */}
        {source === "demo" ? (
          <div className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4">
            <AlertTriangle className="mt-0.5 text-gold" size={20} />
            <div>
              <div className="font-medium text-gold">Demo mode (sample data)</div>
              <p className="mt-1 text-sm text-muted">
                No database is configured, so the dashboard is showing bundled sample data — none
                of these numbers are your clan&apos;s. To connect it: copy{" "}
                <code className={CODE_CLS}>.env.example</code> to{" "}
                <code className={CODE_CLS}>.env.local</code> and fill in{" "}
                <code className={CODE_CLS}>DATABASE_URL</code>, then run{" "}
                <code className={CODE_CLS}>npm run db:migrate</code> to create the tables.{" "}
                <code className={CODE_CLS}>npm run seed</code> afterwards loads a starter dataset
                you can throw away later.
              </p>
            </div>
          </div>
        ) : ds.weeks.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-hydra/30 bg-hydra/5 p-4">
            <DatabaseZap className="mt-0.5 shrink-0 text-hydra" size={20} />
            <div>
              <div className="font-medium text-hydra">
                Connected to the clan database — no clash data yet
              </div>
              <p className="mt-1 text-sm text-muted">
                The connection works, so the zeroes above are real: nothing has been imported yet.
                Open the <span className="text-text">Import data</span> tab and upload a finished
                clash to fill them in. Nothing on this dashboard is sample data.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-hydra/30 bg-hydra/5 p-4">
            <CheckCircle2 className="mt-0.5 text-hydra" size={20} />
            <div>
              <div className="font-medium text-hydra">Connected to the clan database</div>
              <p className="mt-1 text-sm text-muted">
                Every number on this dashboard is read live from the database. Use the{" "}
                <span className="text-text">Import data</span> tab after each clash to update it.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <SectionTitle className="mb-2">Updating the Data</SectionTitle>
        <ol className="ml-5 list-decimal space-y-1.5 text-sm text-muted">
          <li>One-time, in this order: put your <code className={CODE_CLS}>DATABASE_URL</code> in <code className={CODE_CLS}>.env.local</code> (copy <code className={CODE_CLS}>.env.example</code> as a starting point), then run <code className={CODE_CLS}>npm run db:migrate</code> to create the tables. Skip both if it&apos;s already set up — <code className={CODE_CLS}>db:migrate</code> has nothing to do without a <code className={CODE_CLS}>DATABASE_URL</code>.</li>
          <li>After a clash ends, open the <span className="text-text">Import data</span> tab above.</li>
          <li>Pick the week (it defaults to the current clash week) and the clash; the start/end dates auto-derive from the clash schedule.</li>
          <li>Upload or paste the clash JSON and hit <span className="text-text">Import</span> — it reads <span className="text-text">Replace data</span> if that week already has results. Or, from the terminal, <code className={CODE_CLS}>npm run import:json</code> or <code className={CODE_CLS}>npm run import</code> (CSV) do the same.</li>
        </ol>
        <p className="mt-2 text-sm text-muted">
          Stats are served by <code className={CODE_CLS}>npm run dev</code> — the app you are reading this in.
        </p>
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
      <PageTitle>Clan Settings</PageTitle>
      <SettingsTabs overview={overview} importPanel={importPanel} />
    </div>
  );
}
