import { Database, CheckCircle2, AlertTriangle, Users, Swords } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { loadDataset } from "@/lib/data";

export default async function SettingsPage() {
  const ds = await loadDataset();
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
        {isSupabaseConfigured ? (
          <div className="flex items-start gap-3 rounded-xl border border-hydra/30 bg-hydra/5 p-4">
            <CheckCircle2 className="mt-0.5 text-hydra" size={20} />
            <div>
              <div className="font-medium text-hydra">Connected to Supabase</div>
              <p className="mt-1 text-sm text-muted">
                Live data is being read from your Supabase project. Run{" "}
                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run sync</code>{" "}
                after each clash to push the latest numbers.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4">
            <AlertTriangle className="mt-0.5 text-gold" size={20} />
            <div>
              <div className="font-medium text-gold">Demo mode (seed data)</div>
              <p className="mt-1 text-sm text-muted">
                Supabase isn&apos;t configured, so the dashboard is showing bundled sample data.
                Add{" "}
                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
                and{" "}
                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
                to your environment to connect live data.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-panel p-5">
        <h2 className="mb-2 text-lg font-semibold">Updating the Data</h2>
        <ol className="ml-5 list-decimal space-y-1.5 text-sm text-muted">
          <li>After a clash ends, run the RaidToolkit extractor on your PC (<code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">npm run sync</code>).</li>
          <li>It reads your account dump, normalizes the clash data, and upserts it into Supabase.</li>
          <li>This site reads from Supabase, so clanmates see the update on refresh.</li>
          <li>No clash data in the dump? Use the CSV import path instead (see the project README).</li>
        </ol>
      </section>
    </div>
  );
}
