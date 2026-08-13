import Link from "next/link";
import {
  Database,
  DatabaseZap,
  CheckCircle2,
  AlertTriangle,
  Users,
  UsersRound,
  Swords,
  ShieldCheck,
  Lock,
  LogIn,
  LogOut,
} from "lucide-react";
import { loadDataset, getDataSource } from "@/lib/data";
import { isAdmin } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
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

  // SEAM C. Two independent reasons the write tools on this page disappear: the
  // visitor is not the signed-in clan admin, or the numbers are bundled demo
  // data. `readOnlyReason` carries which one, because the two need different
  // sentences and different fixes.
  //
  // Demo wins when both apply: it is the blocker that survives signing in.
  //
  // isAdmin() is read here rather than in app/layout.tsx on purpose. It uses
  // cookies(), "a Request-time API … Using it in a layout or page will opt a
  // route into dynamic rendering" (node_modules/next/dist/docs/01-app/
  // 03-api-reference/04-functions/cookies.md) — in the root layout that would
  // opt EVERY route in, including the statically prerendered /import.
  const signedIn = await isAdmin();
  const readOnly = !signedIn || source === "demo";
  const readOnlyReason = source === "demo" ? "demo" : signedIn ? null : "anonymous";

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
              {/* The instruction is gated on `signedIn`: for an anonymous
                  visitor the Import data tab is the locked note, so "upload a
                  finished clash" is a step they cannot take. */}
              <p className="mt-1 text-sm text-muted">
                The connection works, so the zeroes above are real: nothing has been imported yet.{" "}
                {signedIn ? (
                  <>
                    Open the <span className="text-text">Import data</span> tab and upload a
                    finished clash to fill them in.
                  </>
                ) : (
                  <>
                    The clan admin fills them in from the{" "}
                    <span className="text-text">Import data</span> tab after each clash.
                  </>
                )}{" "}
                Nothing on this dashboard is sample data.
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

      {/* Who this browser is, and the one place to change it. Never renders the
          admin address — that value is a secret in its own right.

          THREE states, off the same `source` / `signedIn` pair as `readOnly`
          above — not `signedIn` alone. The missing third state was a button to
          nowhere on the zero-config first run: demo mode offered "Sign in", and
          /login in that state has no form because the sign-in settings are
          absent too. `.claude/rules/ux.md`: demo mode gets "connect the clan
          database" and NEVER the sign-in sentence, because signing in would
          leave every write failing anyway. Consequence, and it is the intended
          answer: in demo mode this app has no /login link anywhere. */}
      <section className="card">
        <SectionTitle className="mb-4">Admin Access</SectionTitle>
        {signedIn && source !== "demo" ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hydra/30 bg-hydra/5 p-4">
            <ShieldCheck className="shrink-0 text-hydra" size={20} />
            <div className="min-w-0">
              <div className="font-medium text-hydra">Signed in as the clan admin</div>
              <p className="mt-1 text-sm text-muted">
                Imports, member edits, avatars, backups and reset are unlocked in this browser.
              </p>
            </div>
            <form action={signOut} className="ml-auto">
              <button type="submit" className="btn-ghost">
                <LogOut size={16} /> Sign out
              </button>
            </form>
          </div>
        ) : signedIn ? (
          /* Signed in AND still locked, because the dashboard is on sample data.
             Unreachable on a first run (with no sign-in settings nobody can be
             signed in) but reachable the moment auth is configured and the
             database is not: a typo'd connection string, tables not migrated
             yet, or a paused project. Locked composition, not the green one —
             writes are refused here, and the Sign out button stays because this
             is the only place it lives. */
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-panel-2/40 p-4">
            <Lock className="shrink-0 text-muted" size={20} />
            <div className="min-w-0">
              <div className="font-medium">Signed in — but the numbers are sample data</div>
              <p className="mt-1 text-sm text-muted">
                You are the clan admin in this browser, and every write is still refused: the
                dashboard is showing bundled sample data, so there is nothing to import into,
                nowhere to restore and nothing to reset. Connect the clan database — the{" "}
                <span className="text-text">Data Source</span> box above has the steps — and these
                tools unlock without signing in again.
              </p>
            </div>
            <form action={signOut} className="ml-auto">
              <button type="submit" className="btn-ghost">
                <LogOut size={16} /> Sign out
              </button>
            </form>
          </div>
        ) : source === "demo" ? (
          /* Demo + anonymous: the zero-config first run. No /login link, and no
             call to action to sign in — the fix is the database, and the copy
             matches components/DataManagement.tsx's locked note. */
          <div className="flex items-start gap-3 rounded-xl border border-border bg-panel-2/40 p-4">
            <Lock className="mt-0.5 shrink-0 text-muted" size={20} />
            <div>
              <div className="font-medium">Read-only — there is no clan database yet</div>
              <p className="mt-1 text-sm text-muted">
                These numbers are bundled sample data, not your clan&apos;s, so nobody can change
                anything here — there is nothing to import into, nowhere to restore and nothing to
                reset. Connect the clan database first; the{" "}
                <span className="text-text">Data Source</span> box above has the steps. An admin
                account only starts to matter once real data is in place.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-panel-2/40 p-4">
            <Lock className="shrink-0 text-muted" size={20} />
            <div className="min-w-0">
              <div className="font-medium">Read-only — this browser isn&apos;t the clan admin</div>
              <p className="mt-1 text-sm text-muted">
                Anyone can read every stat on this dashboard. Changing it — imports, member edits,
                avatars, backups, reset — needs the clan admin account, and each of those requests
                is refused on the server, not just hidden in the interface.
              </p>
            </div>
            <Link href="/login" className="btn-ghost ml-auto">
              <LogIn size={16} /> Sign in
            </Link>
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

      <DataManagement readOnly={readOnly} readOnlyReason={readOnlyReason} />
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
      readOnly={readOnly}
      readOnlyReason={readOnlyReason}
    />
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageTitle>Clan Settings</PageTitle>
      <SettingsTabs overview={overview} importPanel={importPanel} />
    </div>
  );
}
