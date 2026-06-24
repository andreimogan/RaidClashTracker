"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileJson, Sheet, Upload, RefreshCw, CheckCircle2, AlertTriangle, Database, FlaskConical } from "lucide-react";
import { normalizeFlatResults, type ClashType } from "@/lib/import";
import { formatDamage, formatDateRange } from "@/lib/format";
import { clashWindow, weekWednesday, type CurrentWeek } from "@/lib/week";
import type { PersistSummary } from "@/lib/persist";
import type { DbEnv } from "@/lib/db";

type WeekOpt = { weekNumber: number; startDate: string; endDate: string };

function ResultBanner({ summary }: { summary: PersistSummary }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-hydra/30 bg-hydra/5 p-4">
      <CheckCircle2 className="mt-0.5 shrink-0 text-hydra" size={20} />
      <div className="text-sm">
        <div className="font-medium text-hydra">
          {summary.mode === "replace" ? "Synced" : "Imported"} {summary.results} result
          {summary.results === 1 ? "" : "s"} into week{summary.weekNumbers.length === 1 ? "" : "s"}{" "}
          {summary.weekNumbers.join(", ")}.
        </div>
        <div className="mt-1 text-muted">
          {summary.weekNumbers.map((w, i) => (
            <span key={w}>
              {i > 0 && " · "}
              <Link href={`/?week=${w}`} className="text-text underline underline-offset-2 hover:text-hydra">
                View Week {w}
              </Link>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-down/30 bg-down/5 p-4">
      <AlertTriangle className="mt-0.5 shrink-0 text-down" size={20} />
      <pre className="whitespace-pre-wrap text-sm text-down">{message}</pre>
    </div>
  );
}

const RECENT_WEEKS = 12;

export function ImportPanel({
  weeks,
  currentWeek,
  existingData,
  active,
  envOverride,
}: {
  weeks: WeekOpt[];
  currentWeek: CurrentWeek;
  existingData: Record<number, { hydra: number; chimera: number }>;
  active: DbEnv;
  envOverride: boolean;
}) {
  const router = useRouter();

  // ---- import destination (active database) ----
  const [switching, setSwitching] = useState<DbEnv | null>(null);
  async function switchTo(env: DbEnv) {
    if (env === active || switching || envOverride) return;
    setSwitching(env);
    try {
      const res = await fetch("/api/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: env }),
      });
      const data = await res.json();
      if (data.ok) router.refresh();
    } finally {
      setSwitching(null);
    }
  }

  // ---- week / clash selection ----
  const existingNumbers = useMemo(() => new Set(weeks.map((w) => w.weekNumber)), [weeks]);

  // The current week + the last ~12 weeks, plus any already-imported weeks.
  const weekOptions = useMemo(() => {
    const nums = new Set<number>(existingNumbers);
    for (let i = 0; i < RECENT_WEEKS; i++) {
      const n = currentWeek.weekNumber - i;
      if (n >= 1) nums.add(n);
    }
    return [...nums]
      .sort((a, b) => b - a)
      .map((n) => {
        const win = clashWindow(weekWednesday(currentWeek.weekNumber, currentWeek.startDate, n), "hydra");
        const counts = existingData[n];
        return {
          weekNumber: n,
          range: formatDateRange(win.startDate, win.endDate),
          isCurrent: n === currentWeek.weekNumber,
          hasData: !!counts && counts.hydra + counts.chimera > 0,
        };
      });
  }, [existingNumbers, currentWeek, existingData]);

  const [weekNumber, setWeekNumber] = useState(currentWeek.weekNumber);
  const [clashType, setClashType] = useState<ClashType>("hydra");

  // Rows already stored for the selected (week, clash) — drives the overwrite prompt.
  const existingCount = existingData[weekNumber]?.[clashType] ?? 0;

  // Dates are derived from the clash schedule, not entered by hand:
  // `window` = the selected clash's display dates; `canonical` = the Hydra
  // Wed→next-Wed window stored on the week row.
  const wed = weekWednesday(currentWeek.weekNumber, currentWeek.startDate, weekNumber);
  const clashDates = clashWindow(wed, clashType);
  const canonical = clashWindow(wed, "hydra");

  // ---- JSON payload ----
  const [json, setJson] = useState("");
  const [jsonResult, setJsonResult] = useState<PersistSummary | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-arm the overwrite prompt whenever the target or payload changes.
  useEffect(() => setConfirmOverwrite(false), [weekNumber, clashType, json]);

  const preview = useMemo(() => {
    if (!json.trim()) return null;
    try {
      const arr = JSON.parse(json);
      const { rows } = normalizeFlatResults(arr, {
        weekNumber,
        startDate: canonical.startDate,
        endDate: canonical.endDate,
        clashType,
      });
      return {
        ok: true as const,
        players: rows.length,
        participants: rows.filter((r) => r.keysUsed > 0).length,
        totalDamage: rows.reduce((s, r) => s + r.totalDamage, 0),
      };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Invalid JSON." };
    }
  }, [json, weekNumber, clashType, canonical.startDate, canonical.endDate]);

  async function onFile(file: File) {
    setJson(await file.text());
    setJsonResult(null);
  }

  async function importJson() {
    if (!preview?.ok) return;
    setImporting(true);
    setJsonError(null);
    setJsonResult(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          results: JSON.parse(json),
          weekNumber,
          clashType,
        }),
      });
      const data = await res.json();
      if (!data.ok) setJsonError(data.error);
      else setJsonResult(data.summary);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Import request failed.");
    } finally {
      setImporting(false);
    }
  }

  // ---- Google Sheet sync ----
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetResult, setSheetResult] = useState<PersistSummary | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("clash:sheetUrl");
    setSheetUrl(saved || process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL || "");
  }, []);

  async function syncSheet() {
    setSyncing(true);
    setSheetError(null);
    setSheetResult(null);
    localStorage.setItem("clash:sheetUrl", sheetUrl);
    try {
      const res = await fetch("/api/sheet-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetUrl }),
      });
      const data = await res.json();
      if (!data.ok) setSheetError(data.error);
      else setSheetResult(data.summary);
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Sync request failed.");
    } finally {
      setSyncing(false);
    }
  }

  const fieldCls =
    "rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-chimera/50";

  const isTest = active === "test";
  const DEST: { key: DbEnv; label: string }[] = [
    { key: "production", label: "Production" },
    { key: "test", label: "Test" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Destination database — imports write to the active DB */}
      <div
        className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${
          isTest ? "border-gold/30 bg-gold/5" : "border-border bg-panel"
        }`}
      >
        {isTest ? <FlaskConical size={20} className="text-gold" /> : <Database size={20} className="text-muted" />}
        <div className="min-w-0">
          <div className="font-medium">
            Importing into: <span className={isTest ? "text-gold" : "text-text"}>{isTest ? "Test" : "Production"}</span>
          </div>
          <div className="text-xs text-muted">
            JSON import and Google Sheet sync both write to the active database.
          </div>
        </div>
        {envOverride ? (
          <span className="ml-auto text-xs text-faint">Pinned via DATABASE_URL.</span>
        ) : (
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-panel-2 p-1">
            {DEST.map((d) => {
              const on = d.key === active;
              const activeCls = d.key === "test" ? "bg-panel text-gold" : "bg-panel text-hydra";
              return (
                <button
                  key={d.key}
                  onClick={() => switchTo(d.key)}
                  disabled={on || !!switching}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    on ? activeCls : "text-muted hover:text-text"
                  } disabled:cursor-default`}
                >
                  {switching === d.key ? "Switching…" : d.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* JSON import */}
      <section className="rounded-2xl border border-border bg-panel p-5">
        <div className="mb-1 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-panel-2 text-chimera">
            <FileJson size={20} />
          </span>
          <h2 className="text-lg font-semibold">JSON Import</h2>
        </div>
        <p className="mb-4 text-sm text-muted">
          Paste or upload a clash&apos;s standings — a flat array of{" "}
          <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">
            {"{ player_name, damage_dealt, keys_used }"}
          </code>
          . Choose the week &amp; clash below; importing <strong>replaces</strong> that week&apos;s clash.
        </p>

        {/* week + clash controls — dates are derived from the schedule */}
        <div className="mb-3 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Week</span>
            <select
              value={weekNumber}
              onChange={(e) => setWeekNumber(Number(e.target.value))}
              className={`${fieldCls} min-w-[20rem] cursor-pointer`}
            >
              {weekOptions.map((w) => {
                const tags = [w.isCurrent ? "current" : null, w.hasData ? "has data" : "no data"].filter(Boolean);
                return (
                  <option key={w.weekNumber} value={w.weekNumber} className="bg-panel">
                    Week {w.weekNumber} — {w.range} ({tags.join(" · ")})
                  </option>
                );
              })}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">Clash</span>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-panel-2 p-1">
              {(["hydra", "chimera"] as ClashType[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setClashType(c)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    clashType === c
                      ? c === "hydra"
                        ? "bg-panel text-hydra"
                        : "bg-panel text-chimera"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* derived schedule dates (read-only) */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm">
          <span className={`font-medium capitalize ${clashType === "hydra" ? "text-hydra" : "text-chimera"}`}>
            {clashType} clash
          </span>
          <span className="text-muted">·</span>
          <span className="text-muted">Week {weekNumber}</span>
          <span className="text-muted">·</span>
          <span className="text-text">{formatDateRange(clashDates.startDate, clashDates.endDate)} UTC</span>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm font-medium text-muted hover:text-text"
          >
            <Upload size={15} /> Choose .json file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <span className="text-xs text-faint">or paste below</span>
        </div>

        <textarea
          value={json}
          onChange={(e) => { setJson(e.target.value); setJsonResult(null); }}
          placeholder='[ { "player_name": "[ΚΛΕΩ] Hell", "damage_dealt": "16.61B", "keys_used": 3 } ]'
          rows={8}
          className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 font-mono text-xs outline-none placeholder:text-faint focus:border-chimera/50"
        />

        {preview?.ok && (
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border bg-panel-2 px-4 py-3 text-sm">
            <span className="text-muted">Week: <span className="text-text">{weekNumber}</span></span>
            <span className="text-muted capitalize">Clash: <span className="text-text">{clashType}</span></span>
            <span className="text-muted">Players: <span className="text-text">{preview.players}</span></span>
            <span className="text-muted">Participated: <span className="text-text">{preview.participants}</span></span>
            <span className="text-muted">Total dmg: <span className="text-text">{formatDamage(preview.totalDamage)}</span></span>
          </div>
        )}
        {preview && !preview.ok && <div className="mt-3"><ErrorBanner message={preview.error} /></div>}

        {existingCount > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm text-gold">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              Week {weekNumber} <span className="capitalize">{clashType}</span> already has{" "}
              {existingCount} {existingCount === 1 ? "entry" : "entries"} — importing will replace them.
            </span>
          </div>
        )}

        <div className="mt-4">
          {existingCount > 0 && confirmOverwrite ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted">
                Replace Week {weekNumber} <span className="capitalize">{clashType}</span> data?
              </span>
              <button
                onClick={importJson}
                disabled={importing}
                className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Upload size={16} /> {importing ? "Replacing..." : "Replace"}
              </button>
              <button
                onClick={() => setConfirmOverwrite(false)}
                className="rounded-lg px-3 py-2 text-sm text-muted hover:text-text"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => (existingCount > 0 ? setConfirmOverwrite(true) : importJson())}
              disabled={importing || !preview?.ok}
              className="flex items-center gap-2 rounded-lg bg-chimera px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Upload size={16} /> {existingCount > 0 ? "Replace data" : importing ? "Importing..." : "Import"}
            </button>
          )}
        </div>

        {(jsonResult || jsonError) && (
          <div className="mt-4">
            {jsonResult && <ResultBanner summary={jsonResult} />}
            {jsonError && <ErrorBanner message={jsonError} />}
          </div>
        )}
      </section>

      {/* Google Sheet sync */}
      <section className="rounded-2xl border border-border bg-panel p-5">
        <div className="mb-1 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-panel-2 text-hydra">
            <Sheet size={20} />
          </span>
          <h2 className="text-lg font-semibold">Google Sheet Sync</h2>
        </div>
        <p className="mb-4 text-sm text-muted">
          Keep your sheet as the source of truth. Syncing <strong>mirrors</strong> it — each week
          &amp; clash in the sheet replaces the app&apos;s data (deletions included). The sheet must be
          published to web / shared &quot;Anyone with the link&quot; and use the documented columns.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
            className="flex-1 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-hydra/50"
          />
          <button
            onClick={syncSheet}
            disabled={syncing || !sheetUrl.trim()}
            className="flex items-center justify-center gap-2 rounded-lg bg-hydra px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync"}
          </button>
        </div>
        {(sheetResult || sheetError) && (
          <div className="mt-4">
            {sheetResult && <ResultBanner summary={sheetResult} />}
            {sheetError && <ErrorBanner message={sheetError} />}
          </div>
        )}
      </section>
    </div>
  );
}
