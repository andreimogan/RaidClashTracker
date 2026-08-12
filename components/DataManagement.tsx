"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Upload, Trash2, CheckCircle2, AlertTriangle, Lock } from "lucide-react";
import { SectionTitle } from "./SectionTitle";

type Msg = { ok: boolean; text: string } | null;

// Why every control here is gone. Two different problems with two different
// fixes, so they get two different sentences — telling an anonymous visitor on a
// live database that "demo data is read-only" would simply be false.
type ReadOnlyReason = "anonymous" | "demo" | null;

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

// The type-RESET confirmation gate in front of a full database wipe.
function ResetControl() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function doReset() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) setMsg({ ok: false, text: data.error });
      else {
        setMsg({ ok: true, text: "Database wiped." });
        setOpen(false);
        setText("");
        router.refresh();
      }
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Reset failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-down/30 bg-down/5 p-4">
      <p className="text-sm text-muted">
        Permanently deletes every member, week and clash result. This cannot be undone — export a
        backup first if you might want the data again.
      </p>

      {!open ? (
        <button
          onClick={() => { setOpen(true); setMsg(null); }}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-down/50 px-4 py-2 text-sm font-medium text-down hover:bg-down/10"
        >
          <Trash2 size={16} /> Reset database
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type RESET to confirm"
            className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-down/50"
          />
          <button onClick={doReset} disabled={text !== "RESET" || busy} className="btn-accent bg-down">
            <Trash2 size={16} /> {busy ? "Resetting..." : "Confirm reset"}
          </button>
          <button
            onClick={() => { setOpen(false); setText(""); }}
            className="rounded-lg px-3 py-2 text-sm text-muted hover:text-text"
          >
            Cancel
          </button>
        </div>
      )}
      <Banner msg={msg} />
    </div>
  );
}

// Read-only explanation. Nothing actionable is rendered — the backup link in
// particular is HIDDEN rather than disabled, because a disabled control still
// advertises /api/backup to anyone reading the page.
function LockedNote({ reason }: { reason: ReadOnlyReason }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-panel-2/40 p-4">
      <Lock className="mt-0.5 shrink-0 text-muted" size={18} />
      {reason === "demo" ? (
        <p className="text-sm text-muted">
          These numbers are bundled sample data, not your clan&apos;s — there is nothing to back
          up, nowhere to restore into and nothing to reset. Connect the clan database to enable
          these tools.
        </p>
      ) : (
        <p className="text-sm text-muted">
          Backups, restore and reset read or rewrite every row, so they need the clan admin
          account.{" "}
          <Link href="/login" className="text-text underline underline-offset-2 hover:text-gold">
            Sign in
          </Link>{" "}
          to use them. Reading the dashboard never requires an account.
        </p>
      )}
    </div>
  );
}

export function DataManagement({
  readOnly,
  readOnlyReason,
}: {
  readOnly: boolean;
  readOnlyReason: ReadOnlyReason;
}) {
  return (
    <section className="card">
      <SectionTitle className="mb-1">Data Management</SectionTitle>
      <p className="mb-4 text-sm text-muted">
        Back up your data to a file, restore it later, or wipe the database to start over.
      </p>
      {/* Split so the hooks below never sit behind a conditional return. */}
      {readOnly ? <LockedNote reason={readOnlyReason} /> : <DataTools />}
    </section>
  );
}

function DataTools() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<Msg>(null);

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

  return (
    <>
      {/* Backup + Restore */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <a href="/api/backup" className="btn-ghost">
          <Download size={16} /> Export backup
        </a>
        <button onClick={() => fileRef.current?.click()} disabled={restoring} className="btn-ghost">
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

      {/* Danger zone: wipe the database */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2 text-down">
          <Trash2 size={16} />
          <h3 className="text-sm font-semibold">Danger zone</h3>
        </div>
        <ResetControl />
      </div>
    </>
  );
}
