import { Database, CheckCircle2, AlertTriangle, Users, Swords } from "lucide-react";
import { loadDataset, getDataSource } from "@/lib/data";
import { DATABASE_URL, isRemoteDb } from "@/lib/db";

// Reflects live DB state (seeded vs demo), so render per-request.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ds = await loadDataset();
  const source = await getDataSource();
  const activeMembers = ds.members.filter((m) => m.isActive).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Clan Settings</h1>

      <section className="rounded-2xl border border-border bg-panel p-5">
        <h2 className="mb-4 text-lg font-semibold">Clan</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-panel-2 p-4">
            <div className="flex items-center gap-2 text-muted">
              <Users size={16} /> <span className="text-sm">Members</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">{activeMembers} / 30</div>
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
                Run{" "}
                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run import</code> or{" "}
                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run sync</code>{" "}
                after each clash to update it.
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
          <li>One-time: <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run db:init</code> creates the local database.</li>
          <li>After a clash ends, run <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run import -- data/import.csv</code> (CSV) or <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run sync</code> (RaidToolkit) to write the week&apos;s numbers.</li>
          <li>Start the app with <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run dev</code> whenever you want to view stats.</li>
          <li>No clash data in the RaidToolkit dump? Use the CSV path — it works the same (see the project README).</li>
        </ol>
      </section>
    </div>
  );
}
