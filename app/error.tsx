"use client";

// Root error boundary. It exists because the dashboard used to swallow a
// database outage and silently render bundled sample data as if it were the
// clan's real numbers — so an unreachable database now stops here and says so.
// Wraps every route segment under app/ (not app/layout.tsx itself, which does
// no data access). Props per node_modules/next/dist/docs/01-app/03-api-reference
// /03-file-conventions/error.md: `unstable_retry` is the recovery prop in
// Next 16.2 (`reset` still exists but the doc directs you to unstable_retry).
//
// Because EVERY data route renders this same page during an outage, the copy
// must never promise that other pages are showing real numbers right now — it
// promises the opposite: that no page will ever substitute sample numbers.
//
// Never render error.message or anything derived from DATABASE_URL: in dev
// Next forwards the original message to the client, and a Postgres URI carries
// the password. error.digest is a hash and is safe to show.
import { useState, useTransition } from "react";
import { Loader2, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";
import { PageTitle } from "@/components/PageTitle";
import { SectionTitle } from "@/components/SectionTitle";

// Inline code, same treatment as /settings.
const CODE_CLS = "rounded bg-panel-2 px-1.5 py-0.5 text-text";

// Retry attempts are counted at MODULE scope, not only in component state.
// unstable_retry() is `startTransition(() => { router.refresh(); setState({error: null}) })`
// (node_modules/next/dist/client/components/error-boundary.js:43-48), so the
// boundary clears its error and renders its children — and when the refresh
// fails again it mounts this component FRESH. Measured against a real outage: a
// state-only counter stayed at 0 across two failed retries while a new instance
// was created each time. So a useState count would be wiped; the module variable
// survives, and the state mirror exists only to trigger the re-render.
// lastRetryAt stops a later, unrelated outage from inheriting an old count.
let retryAttempts = 0;
let lastRetryAt = 0;
const ATTEMPT_WINDOW_MS = 60_000;

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // unstable_retry's own transition is Next's, not ours, so it cannot be
  // observed from here — wrapping the call in our transition is what makes the
  // wait visible instead of looking like a dead button.
  const [isPending, startTransition] = useTransition();
  const [attempts, setAttempts] = useState(() => {
    if (Date.now() - lastRetryAt > ATTEMPT_WINDOW_MS) retryAttempts = 0;
    return retryAttempts;
  });

  function retry() {
    retryAttempts += 1;
    lastRetryAt = Date.now();
    setAttempts(retryAttempts);
    startTransition(() => unstable_retry());
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageTitle>Data Unavailable</PageTitle>

      <section className="card">
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-down/30 bg-down/5 p-4"
        >
          <PlugZap className="mt-0.5 shrink-0 text-down" size={20} />
          <div>
            <div className="font-medium text-down">
              The dashboard couldn&apos;t reach its database
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Every clash stat here is read from a database, and right now this app can&apos;t get
              an answer from it — so there is nothing to show on this page. Nothing has been lost:
              the results that were already imported are still stored, the connection just
              isn&apos;t responding.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={retry}
            disabled={isPending}
            aria-busy={isPending}
            className="btn-accent bg-gold"
          >
            {isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}{" "}
            Try again
          </button>
          {/* Live region: without it a screen-reader user who retries and fails
              again is told nothing at all. */}
          <span aria-live="polite" className="text-xs text-muted">
            {isPending
              ? "Reaching for the database…"
              : attempts === 0
                ? "Reloads the data from scratch — a brief outage often clears on the second try."
                : `Tried ${attempts} ${attempts === 1 ? "time" : "times"} — still no answer. If it keeps failing, this is more than a hiccup.`}
          </span>
        </div>
      </section>

      <section className="card">
        <SectionTitle className="mb-3">Why There Are No Numbers Here</SectionTitle>
        <div className="inset rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-hydra" size={20} />
            <p className="text-sm text-muted">
              <span className="text-text">
                This dashboard never fills a gap with sample numbers.
              </span>{" "}
              When it can&apos;t reach the database it stops here and says so, instead of showing
              stale, cached or stand-in figures dressed up as the clan&apos;s. So while the
              connection is down, the other pages will show you this same message — that&apos;s the
              outage, not a frozen app. No stats on screen means no stats available, never invented
              ones.
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <SectionTitle className="mb-2">What to Do</SectionTitle>
        <ol className="ml-5 list-decimal space-y-1.5 text-sm text-muted">
          <li>
            Give it a few seconds, then press <span className="text-text">Try again</span> — most
            connection hiccups clear on their own.
          </li>
          <li>Check your internet connection and reload the page.</li>
          <li>
            Still stuck? Let whoever set up the tracker know that the database isn&apos;t answering
            — your stats are safe in the meantime, this is a connection problem, not lost data.
            {error.digest && (
              <>
                {" "}
                Pass on this reference code so they can find this exact failure:{" "}
                <span className="font-mono tabular-nums text-text">{error.digest}</span>
              </>
            )}
          </li>
        </ol>
        <p className="mt-4 text-sm text-muted">
          Set the tracker up yourself? Check that <code className={CODE_CLS}>.env.local</code> still
          has a working <code className={CODE_CLS}>DATABASE_URL</code>, and read the terminal
          running <code className={CODE_CLS}>npm run dev</code> — the full error is printed there.
        </p>
      </section>
    </div>
  );
}
