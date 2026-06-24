"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";

type Msg = { ok: boolean; text: string } | null;

export function DataManagement() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<Msg>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<Msg>(null);

  async function onRestoreFile(file: File) {
    setRestoring(true);
    setRestoreMsg(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = await res.json();
      if (!data.ok) setRestoreMsg({ ok: false, text: data.error });
      else {
        const s = data.summary;
        setRestoreMsg({ ok: true, text: `Restored ${s.members} members, ${s.weeks} weeks, ${s.results} results.` });
        router.refresh();
      }
    } catch (err) {
      setRestoreMsg({ ok: false, text: err instanceof Error ? err.message : "Restore failed." });
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function doReset() {
    setResetting(true);
    setResetMsg(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();
      if (!data.ok) setResetMsg({ ok: false, text: data.error });
      else {
        setResetMsg({ ok: true, text: "Database wiped. The app is now empty." });
        setConfirmOpen(false);
        setConfirmText("");
        router.refresh();
      }
    } catch (err) {
      setResetMsg({ ok: false, text: err instanceof Error ? err.message : "Reset failed." });
    } finally {
      setResetting(false);
    }
  }

  function Banner({ msg }: { msg: Msg }) {
    if (!msg) return null;
    return (
      <div
        className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-sm ${
          msg.ok ? "border-hydra/30 bg-hydra/5 text-hydra" : "border-down/30 bg-down/5 text-down"
        }`}
      >
        {msg.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
        <span>{msg.text}</span>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-panel p-5">
      <h2 className="mb-1 text-lg font-semibold">Data Management</h2>
      <p className="mb-4 text-sm text-muted">
        Back up your data to a file, restore it later, or wipe everything to start over.
      </p>

      {/* Backup + Restore */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href="/api/backup"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-panel-2 px-4 py-2 text-sm font-medium text-text hover:border-border-soft"
        >
          <Download size={16} /> Export backup
        </a>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={restoring}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-panel-2 px-4 py-2 text-sm font-medium text-text hover:border-border-soft disabled:opacity-50"
        >
          <Upload size={16} /> {restoring ? "Restoring..." : "Restore from backup"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onRestoreFile(e.target.files[0])}
        />
        <span className="text-xs text-faint">Restore replaces all current data.</span>
      </div>
      <Banner msg={restoreMsg} />

      {/* Danger zone */}
      <div className="mt-6 rounded-xl border border-down/30 bg-down/5 p-4">
        <div className="flex items-center gap-2 text-down">
          <Trash2 size={16} />
          <h3 className="text-sm font-semibold">Danger zone</h3>
        </div>
        <p className="mt-1 text-sm text-muted">
          Reset the database — permanently deletes every member, week and clash result. This cannot be undone.
        </p>

        {!confirmOpen ? (
          <button
            onClick={() => { setConfirmOpen(true); setResetMsg(null); }}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-down/50 px-4 py-2 text-sm font-medium text-down hover:bg-down/10"
          >
            <Trash2 size={16} /> Reset database
          </button>
        ) : (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type RESET to confirm"
              className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-down/50"
            />
            <button
              onClick={doReset}
              disabled={confirmText !== "RESET" || resetting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-down px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Trash2 size={16} /> {resetting ? "Resetting..." : "Confirm reset"}
            </button>
            <button
              onClick={() => { setConfirmOpen(false); setConfirmText(""); }}
              className="rounded-lg px-3 py-2 text-sm text-muted hover:text-text"
            >
              Cancel
            </button>
          </div>
        )}
        <Banner msg={resetMsg} />
      </div>
    </section>
  );
}
