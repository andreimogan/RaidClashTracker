"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, FlaskConical, AlertTriangle } from "lucide-react";

type DbEnv = "production" | "test";

const OPTIONS: { key: DbEnv; label: string; desc: string }[] = [
  { key: "production", label: "Production", desc: "Your real clan tracking data." },
  { key: "test", label: "Test", desc: "Sandbox for trying things out — starts with demo data." },
];

// Concrete classes per state so Tailwind can statically detect them.
const ACTIVE_BOX = {
  production: "border-hydra/40 bg-hydra/5",
  test: "border-gold/40 bg-gold/5",
} as const;
const ACTIVE_BADGE = {
  production: "border-hydra/30 bg-hydra/10 text-hydra",
  test: "border-gold/30 bg-gold/10 text-gold",
} as const;

export function DatabaseSwitcher({
  active,
  envOverride,
}: {
  active: DbEnv;
  envOverride: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<DbEnv | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(env: DbEnv) {
    if (env === active || pending || envOverride) return;
    setPending(env);
    setError(null);
    try {
      const res = await fetch("/api/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: env }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error ?? "Switch failed.");
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Switch failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-panel p-5">
      <div className="flex items-center gap-2">
        <Database size={18} className="text-muted" />
        <h2 className="text-lg font-semibold">Database</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        Switch between your live <span className="text-text">Production</span> data and an
        isolated <span className="text-gold">Test</span> sandbox. Imports, resets and backups
        only affect the active database.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const isActive = o.key === active;
          const isTest = o.key === "test";
          return (
            <button
              key={o.key}
              onClick={() => switchTo(o.key)}
              disabled={isActive || !!pending || envOverride}
              className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors disabled:cursor-default ${
                isActive
                  ? ACTIVE_BOX[o.key]
                  : "border-border bg-panel-2 hover:border-border-soft disabled:opacity-60"
              }`}
            >
              <div className="flex w-full items-center gap-2">
                {isTest ? (
                  <FlaskConical size={16} className="text-gold" />
                ) : (
                  <Database size={16} className="text-hydra" />
                )}
                <span className="font-medium">{o.label}</span>
                {isActive && (
                  <span className={`ml-auto rounded-full border px-2 py-0.5 text-xs font-medium ${ACTIVE_BADGE[o.key]}`}>
                    Active
                  </span>
                )}
                {!isActive && pending === o.key && (
                  <span className="ml-auto text-xs text-muted">Switching…</span>
                )}
              </div>
              <span className="text-xs text-muted">{o.desc}</span>
            </button>
          );
        })}
      </div>

      {envOverride && (
        <p className="mt-3 text-xs text-faint">
          A <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">DATABASE_URL</code> is set, so the
          database is pinned and switching is disabled.
        </p>
      )}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-down/30 bg-down/5 p-3 text-sm text-down">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}
    </section>
  );
}
