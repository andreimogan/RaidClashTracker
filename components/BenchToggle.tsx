"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

type BenchToggleProps = {
  memberId: string;
  isBenched: boolean;
};

/**
 * Excuse a member from the Black List, or put them back under it.
 *
 * A leaf: the page renders it only for the signed-in clan admin on a live
 * database and leaves it out of the tree entirely otherwise, so this file's
 * POST helper and pending state do not exist for a reader who could never save
 * (hide, don't disable — same split as AvatarEditor/AvatarUploader). There is
 * no read-only branch in here on purpose; adding one would put the write path
 * back in every visitor's bundle.
 */
export function BenchToggle({ memberId, isBenched }: BenchToggleProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the last press did, for the live region below. Set from the click
  // handler, never from an effect.
  const [status, setStatus] = useState("");

  // What the click will do — the label names the action, not the state, so the
  // button reads as a verb rather than a status the reader has to invert.
  const next = !isBenched;
  const Icon = next ? ShieldCheck : ShieldOff;

  async function save() {
    // No-op guard FIRST, because the button is `aria-disabled`, not `disabled`
    // (see the button below): the click and the Enter/Space keypress both still
    // reach us while a save is in flight, and this is what makes them harmless.
    if (pending) return;
    setPending(true);
    setError(null);
    setStatus(next ? "Benching this player…" : "Unbenching this player…");
    try {
      const res = await fetch(`/api/members/${encodeURIComponent(memberId)}/bench`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ benched: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Save failed.");
      // The flag is read server-side (the shield here, the Black List's rows and
      // its judged count), so the server render is what has to change.
      router.refresh();
      setStatus(
        next
          ? "Benched. This player is excluded from the Black List."
          : "Unbenched. This player is judged by the Black List again.",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed.";
      setError(message);
      setStatus(`Bench update failed. ${message}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {/* `aria-disabled`, not the native attribute, with the no-op guard in the
          handler — the pattern Pagination.tsx:263 / :278 already ships. A focused
          button that becomes natively `disabled` mid-flight cannot keep focus, so
          the browser drops it to <body> and the admin's next Tab restarts at the
          top of the document, on the one control they are most likely to press
          twice. The dim rides on the `aria-disabled:` variant because btn-ghost's
          own `disabled:opacity-40` can no longer match anything. */}
      <button
        type="button"
        onClick={save}
        aria-disabled={pending}
        className="btn-ghost aria-disabled:opacity-40 aria-disabled:hover:border-border aria-disabled:hover:text-muted"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
        {next ? "Bench" : "Unbench"}
      </button>
      {/* router.refresh() is silent, the shield is silent and the label change is
          not in a live region, so without this a screen-reader admin presses the
          button and is told nothing happened. Announces both halves — the start
          and the outcome — like WeekTransition.tsx:167. */}
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
      {/* Names the consequence, which the verb on the button does not: "Unbench"
          says what is now available, never what benching did. Admin-only by
          construction — the whole component is. */}
      {isBenched && !pending && (
        <span className="max-w-[16rem] text-right text-xs text-muted">
          Excluded from the Black List until unbenched.
        </span>
      )}
      {error && <span className="max-w-[16rem] text-xs text-down">{error}</span>}
    </div>
  );
}
