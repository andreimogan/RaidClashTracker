import Link from "next/link";
import { ArrowLeft, AlertTriangle, ShieldCheck } from "lucide-react";
import { PageTitle } from "@/components/PageTitle";
import { SectionTitle } from "@/components/SectionTitle";
import { LoginForm } from "./LoginForm";

// Auth is per-request by definition, and rendering this page must never bake a
// build-time answer to "is sign-in configured?" into static HTML.
export const dynamic = "force-dynamic";

// Inline code / command treatment, same as /settings.
const CODE_CLS = "rounded bg-panel-2 px-1.5 py-0.5 text-text";

/**
 * Sign-in for the one clan-admin account.
 *
 * This page deliberately does NOT read isAdmin(): that reader lives in exactly
 * the two pages that render write affordances (/settings and the member detail
 * page), which keeps the auth read where the decision is made. Signing in again
 * while already signed in is harmless — the redirect lands on /settings, which
 * shows the signed-in state and the sign-out button.
 */
export default function LoginPage() {
  // Presence only. Neither value is rendered, logged, or sent to the client.
  const configured = Boolean(
    process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_PUBLISHABLE_KEY?.trim(),
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={15} /> Dashboard
      </Link>

      <PageTitle>Clan Admin Sign-in</PageTitle>

      <section className="card max-w-2xl">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-panel-2 text-gold">
            <ShieldCheck size={20} />
          </span>
          <div>
            <SectionTitle>Sign in</SectionTitle>
            {/* True in every state, without reading the data source. Saying
                flatly that "signing in unlocks" the write tools is false in demo
                mode — they stay locked for everybody until a database is
                connected. Qualified in the copy rather than by calling
                getDataSource() here: that helper rethrows every database failure
                except 42P01 (.claude/rules/database.md's allowlist), so reading
                it would take the sign-in page down with the root error boundary
                exactly when the database is unreachable — the paused-project
                case the sign-in error copy now handles. /login stays the one
                page that needs no database at all. */}
            <p className="mt-2 text-sm text-muted">
              Every stat on this dashboard is readable without signing in. Signing in is what lets
              the clan admin change data: importing a finished clash, editing a member&apos;s week,
              avatars, backups and reset. Those tools also need the clan database connected — while
              the dashboard is showing sample data, nothing can be changed by anyone, signed in or
              not.
            </p>
            <p className="mt-2 text-sm text-muted">
              There is one account — the clan admin&apos;s — and new signups are disabled, so
              there is nothing here to register for.
            </p>
          </div>
        </div>

        {configured ? (
          <LoginForm />
        ) : (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/5 p-4">
            <AlertTriangle className="mt-0.5 shrink-0 text-gold" size={20} />
            <div>
              <div className="font-medium text-gold">Sign-in isn&apos;t configured</div>
              <p className="mt-1 text-sm text-muted">
                This server has no sign-in settings, so there is nobody to sign in as. Copy the two
                sign-in lines from <code className={CODE_CLS}>.env.example</code> into{" "}
                <code className={CODE_CLS}>.env.local</code>, fill them in, and restart{" "}
                <code className={CODE_CLS}>npm run dev</code>. (Named here only in{" "}
                <code className={CODE_CLS}>.env.example</code> on purpose — this page is public, so
                it doesn&apos;t advertise which service handles sign-in.)
              </p>
              <p className="mt-2 text-sm text-muted">
                Nothing is exposed in the meantime: reading the dashboard is unaffected, and every
                route that writes or exports data stays locked while this is missing.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
