"use client";

// Week-by-week history for the member detail page. Lists ALL tracked weeks
// (absent weeks render em-dashes) and — when the app is connected to the clan
// database rather than showing demo data — lets the user edit a week's four
// values (Hydra/Chimera keys + damage) in a small dialog that POSTs to
// /api/members/[memberId]/results.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { SectionTitle } from "./SectionTitle";
import { TrendBadge } from "./TrendBadge";
import { formatDamage, formatKeys, formatDateRange } from "@/lib/format";
import { parseDamage } from "@/lib/parse";
import { MAX_KEYS } from "@/lib/constants";

export interface HistoryRow {
  week: { id: string; weekNumber: number; startDate: string; endDate: string };
  present: boolean; // false = member has no rows this week
  hydra: { keys: number; damage: number };
  chimera: { keys: number; damage: number };
  totalKeys: number;
  totalDamage: number;
  participationPct: number | null; // null when !present
  // Signed % change of totalDamage vs the member's most recent prior present
  // week. null = absent week, or no baseline to compare against → renders a dash.
  trendPct: number | null;
}

export function MemberHistoryTable({
  rows,
  memberId,
  memberName,
  weeksPresent,
  totalWeeks,
  readOnly,
}: {
  rows: HistoryRow[];
  memberId: string;
  memberName: string;
  weeksPresent: number;
  totalWeeks: number;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState<HistoryRow | null>(null);

  return (
    <section className="card-flush">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-5 pb-3">
        <SectionTitle>Week-by-Week History</SectionTitle>
        <div className="flex items-center gap-3">
          {/* The only explanation the user gets for the missing edit pencils, so
              it names the actual cause: demo data, not a missing local file. */}
          {readOnly && (
            <span className="text-xs text-muted">
              Editing needs the clan database connected — demo data is read-only
            </span>
          )}
          <span className="text-sm text-muted">
            {weeksPresent} of {totalWeeks} weeks
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2 pl-5 font-medium">Week</th>
              <th className="px-3 py-2 font-medium text-hydra">Hydra Keys</th>
              <th className="px-3 py-2 font-medium text-hydra">Hydra Dmg</th>
              <th className="px-3 py-2 font-medium text-chimera">Chimera Keys</th>
              <th className="px-3 py-2 font-medium text-chimera">Chimera Dmg</th>
              <th className="px-3 py-2 font-medium">Total Keys</th>
              <th className="px-3 py-2 font-medium">Total Dmg</th>
              <th className="px-3 py-2 font-medium">Participation</th>
              {/* Self-describing header: this column is total damage vs the prior
                  present week, NOT the dmg/key trend the clash tables show. */}
              <th className={`px-3 py-2 font-medium ${readOnly ? "pr-5" : ""}`}>
                Dmg vs Prev Week
              </th>
              {!readOnly && (
                <th className="w-10 px-3 py-2 pr-5">
                  <span className="sr-only">Edit</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.week.id}
                className="border-b border-border-soft last:border-0 hover:bg-panel-2/50"
              >
                <td className="px-3 py-2.5 pl-5">
                  <div className="font-medium">W{r.week.weekNumber}</div>
                  <div className="text-xs text-muted">
                    {formatDateRange(r.week.startDate, r.week.endDate)}
                  </div>
                </td>
                {r.present ? (
                  <>
                    <td className="px-3 py-2.5 tabular-nums">{r.hydra.keys}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {r.hydra.damage ? formatDamage(r.hydra.damage) : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{r.chimera.keys}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {r.chimera.damage ? formatDamage(r.chimera.damage) : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{formatKeys(r.totalKeys)}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {r.totalDamage ? formatDamage(r.totalDamage) : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {(r.participationPct ?? 0).toFixed(0)}%
                    </td>
                    <td className={`px-3 py-2.5 tabular-nums ${readOnly ? "pr-5" : ""}`}>
                      <TrendBadge value={r.trendPct} />
                    </td>
                  </>
                ) : (
                  <>
                    {Array.from({ length: 7 }).map((_, i) => (
                      <td key={i} className="px-3 py-2.5 text-faint">
                        —
                      </td>
                    ))}
                    <td className={`px-3 py-2.5 text-faint ${readOnly ? "pr-5" : ""}`}>—</td>
                  </>
                )}
                {!readOnly && (
                  <td className="px-3 py-2.5 pr-5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      aria-label={`Edit W${r.week.weekNumber}`}
                      className="inline-grid h-7 w-7 place-items-center rounded-md border border-border bg-panel-2/50 text-muted transition-colors hover:border-gold/40 hover:text-gold"
                    >
                      <Pencil size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 9 : 10} className="px-5 py-10 text-center text-muted">
                  No tracked weeks for this member yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditWeekDialog
          row={editing}
          memberId={memberId}
          memberName={memberName}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

// ---- Edit dialog (mounted only while editing — unmount resets all fields) ----

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-gold/50";

function EditWeekDialog({
  row,
  memberId,
  memberName,
  onClose,
}: {
  row: HistoryRow;
  memberId: string;
  memberName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [hydraKeys, setHydraKeys] = useState(String(row.hydra.keys));
  // Prefill damage with the exact stored digits — a shorthand prefill like
  // "16.61B" is rounded to 2 decimals, and saving an untouched field would
  // write that rounded value back. The live preview under the field still
  // shows the pretty shorthand, and typing shorthand still works.
  const [hydraDamage, setHydraDamage] = useState(String(row.hydra.damage));
  const [chimeraKeys, setChimeraKeys] = useState(String(row.chimera.keys));
  const [chimeraDamage, setChimeraDamage] = useState(String(row.chimera.damage));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (!pending) onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // Light pre-validation only — the server is authoritative.
  function validateKeys(raw: string, clash: "hydra" | "chimera"): number | string {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > MAX_KEYS[clash]) {
      return `${clash === "hydra" ? "Hydra" : "Chimera"} keys must be a whole number 0–${MAX_KEYS[clash]}.`;
    }
    return n;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const hk = validateKeys(hydraKeys, "hydra");
    if (typeof hk === "string") return setError(hk);
    const ck = validateKeys(chimeraKeys, "chimera");
    if (typeof ck === "string") return setError(ck);

    setPending(true);
    try {
      const res = await fetch(`/api/members/${encodeURIComponent(memberId)}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberName,
          weekNumber: row.week.weekNumber,
          hydra: { keys: hk, damage: hydraDamage },
          chimera: { keys: ck, damage: chimeraDamage },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Save failed.");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit W${row.week.weekNumber}`}
        className="card w-full max-w-sm"
      >
        <SectionTitle>Edit W{row.week.weekNumber}</SectionTitle>
        <div className="mt-1 text-xs text-muted">
          {formatDateRange(row.week.startDate, row.week.endDate)}
        </div>

        <form onSubmit={save} className="mt-4 flex flex-col gap-4">
          <ClashFields
            clash="hydra"
            keysValue={hydraKeys}
            onKeys={setHydraKeys}
            damageValue={hydraDamage}
            onDamage={setHydraDamage}
            disabled={pending}
            autoFocusKeys
          />
          <ClashFields
            clash="chimera"
            keysValue={chimeraKeys}
            onKeys={setChimeraKeys}
            damageValue={chimeraDamage}
            onDamage={setChimeraDamage}
            disabled={pending}
          />

          {error && <div className="whitespace-pre-line text-xs text-down">{error}</div>}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={close} disabled={pending} className="btn-ghost">
              <X size={14} /> Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-accent bg-gold">
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const CLASH_FIELD_THEME = {
  hydra: { label: "Hydra", text: "text-hydra" },
  chimera: { label: "Chimera", text: "text-chimera" },
} as const;

function ClashFields({
  clash,
  keysValue,
  onKeys,
  damageValue,
  onDamage,
  disabled,
  autoFocusKeys = false,
}: {
  clash: "hydra" | "chimera";
  keysValue: string;
  onKeys: (v: string) => void;
  damageValue: string;
  onDamage: (v: string) => void;
  disabled: boolean;
  autoFocusKeys?: boolean;
}) {
  const t = CLASH_FIELD_THEME[clash];
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend
        className={`mb-2 font-display text-xs font-semibold uppercase tracking-[0.18em] ${t.text}`}
      >
        {t.label}
      </legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="stat-label">Keys</span>
          <input
            type="number"
            step="1"
            min="0"
            max={MAX_KEYS[clash]}
            value={keysValue}
            onChange={(e) => onKeys(e.target.value)}
            autoFocus={autoFocusKeys}
            className={`${INPUT_CLS} tabular-nums`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="stat-label">Damage</span>
          <input
            type="text"
            value={damageValue}
            onChange={(e) => onDamage(e.target.value)}
            placeholder="e.g. 16.61B"
            className={`${INPUT_CLS} tabular-nums`}
          />
          {damageValue.trim() !== "" && (
            <span className="text-xs text-faint tabular-nums">
              = {formatDamage(parseDamage(damageValue))}
            </span>
          )}
        </label>
      </div>
    </fieldset>
  );
}
