"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileJson, Sheet, Upload, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { normalizeWeekJson } from "@/lib/import";
import { formatDamage } from "@/lib/format";
import type { PersistSummary } from "@/lib/persist";

interface Preview {
  weeks: number[];
  results: number;
  totalDamage: number;
  perClash: Record<string, number>;
}

function summarizeJson(text: string): { preview?: Preview; error?: string } {
  try {
    const { rows, weeks } = normalizeWeekJson(JSON.parse(text));
    const perClash: Record<string, number> = {};
    let totalDamage = 0;
    for (const r of rows) {
      perClash[r.clashType] = (perClash[r.clashType] ?? 0) + 1;
      totalDamage += r.totalDamage;
    }
    return {
      preview: {
        weeks: weeks.map((w) => w.weekNumber).sort((a, b) => a - b),
        results: rows.length,
        totalDamage,
        perClash,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid JSON." };
  }
}

function ResultBanner({ summary }: { summary: PersistSummary }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-hydra/30 bg-hydra/5 p-4">
      <CheckCircle2 className="mt-0.5 shrink-0 text-hydra" size={20} />
      <div className="text-sm">
        <div className="font-medium text-hydra">
          {summary.mode === "replace" ? "Synced" : "Imported"} {summary.results} result
          {summary.results === 1 ? "" : "s"} across week{summary.weekNumbers.length === 1 ? "" : "s"}{" "}
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

export default function ImportPage() {
  // --- JSON state ---
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonResult, setJsonResult] = useState<PersistSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- Sheet state ---
  const [sheetUrl, setSheetUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetResult, setSheetResult] = useState<PersistSummary | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("clash:sheetUrl");
    setSheetUrl(saved || process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL || "");
  }, []);

  async function onFile(file: File) {
    const text = await file.text();
    setJson(text);
    runPreview(text);
  }

  function runPreview(text: string) {
    setJsonResult(null);
    if (!text.trim()) {
      setPreview(null);
      setJsonError(null);
      return;
    }
    const { preview, error } = summarizeJson(text);
    setPreview(preview ?? null);
    setJsonError(error ?? null);
  }

  async function importJson() {
    setImporting(true);
    setJsonError(null);
    setJsonResult(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Import Data</h1>

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

      {/* JSON import */}
      <section className="rounded-2xl border border-border bg-panel p-5">
        <div className="mb-1 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-panel-2 text-chimera">
            <FileJson size={20} />
          </span>
          <h2 className="text-lg font-semibold">JSON Import</h2>
        </div>
        <p className="mb-4 text-sm text-muted">
          Upload or paste a nested per-week JSON file, preview it, then import (upsert). See{" "}
          <code className="rounded bg-panel-2 px-1.5 py-0.5 text-text">data/sample-week.json</code>.
        </p>

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
          onChange={(e) => { setJson(e.target.value); runPreview(e.target.value); }}
          placeholder='{ "week": { "number": 25, "startDate": "...", "endDate": "..." }, "clashes": { ... } }'
          rows={8}
          className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 font-mono text-xs outline-none placeholder:text-faint focus:border-chimera/50"
        />

        {preview && (
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-border bg-panel-2 px-4 py-3 text-sm">
            <span className="text-muted">Week(s): <span className="text-text">{preview.weeks.join(", ")}</span></span>
            <span className="text-muted">Rows: <span className="text-text">{preview.results}</span></span>
            {Object.entries(preview.perClash).map(([k, v]) => (
              <span key={k} className="text-muted capitalize">{k}: <span className="text-text">{v}</span></span>
            ))}
            <span className="text-muted">Total dmg: <span className="text-text">{formatDamage(preview.totalDamage)}</span></span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={importJson}
            disabled={importing || !preview}
            className="flex items-center gap-2 rounded-lg bg-chimera px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Upload size={16} /> {importing ? "Importing..." : "Import"}
          </button>
          {!preview && json.trim() === "" && (
            <span className="text-xs text-faint">Add JSON to enable import</span>
          )}
        </div>

        {(jsonResult || jsonError) && (
          <div className="mt-4">
            {jsonResult && <ResultBanner summary={jsonResult} />}
            {jsonError && <ErrorBanner message={jsonError} />}
          </div>
        )}
      </section>
    </div>
  );
}
