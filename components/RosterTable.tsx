"use client";

// The /members Roster table, lifted out of app/members/page.tsx.
//
// WHY IT IS A CLIENT LEAF. The page stays a server component — it still reads
// `loadDataset()` and computes every summary below. Only the paging *position*
// is client state, and it is deliberately client state: putting it in the URL
// (`?page=`) would make the page read `searchParams` again, which is the thing
// the `force-dynamic` guard at app/members/page.tsx:17 exists to replace. So
// this file holds a `useState` (inside `usePagination`) and nothing else; the
// page hands it a finished array of rows.
//
// The row shape is exported as a type so the page and this file cannot drift.
// Everything in it is plain JSON — it crosses the server→client boundary.

import { useMemo } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import type { Member } from "@/lib/types";
import { formatDamage, formatKeys } from "@/lib/format";
import { MemberCell } from "./MemberCell";
import { SectionTitle } from "./SectionTitle";
import { Pagination, usePagination } from "./Pagination";

/** One roster line, exactly as app/members/page.tsx derives it. */
export interface RosterRow {
  member: Member;
  /** The DERIVED current-roster flag (activeMemberIds), not member.isActive. */
  isActive: boolean;
  weeksPresent: number;
  hydraTotal: number;
  chimeraTotal: number;
  avgKeys: number;
  participationPct: number;
}

export function RosterTable({ rows }: { rows: RosterRow[] }) {
  // Counted over the WHOLE roster, never the visible page: this line answers
  // "how big is the clan", which does not change when the reader turns a page.
  const { activeCount, formerCount } = useMemo(() => {
    const active = rows.filter((r) => r.isActive).length;
    return { activeCount: active, formerCount: rows.length - active };
  }, [rows]);

  // The page index is chrome. `usePagination` clamps it on read, so a roster
  // that shrinks under the reader folds them back into range instead of showing
  // a blank slab — no effect, no reset.
  const view = usePagination(rows);

  return (
    // `xl:flex` + `xl:flex-col` so the pagination bar can be pushed to the
    // card's foot with `mt-auto`. This card is a grid item as of the Benched
    // Roster order, and at 2xl the grid stretches the shorter of the two to the
    // taller one's height; without the flex column a card that ends early gets
    // its bordered pagination bar floating mid-card over dead space. Same fix,
    // same reason as components/BlackListTable.tsx:79.
    <section className="card-flush xl:flex xl:h-full xl:flex-col">
      <div className="flex items-center justify-between p-5 pb-3">
        <SectionTitle>Roster</SectionTitle>
        <span className="text-sm text-muted">
          <span className="text-hydra">{activeCount} active</span> · {formerCount} former ·{" "}
          {rows.length} tracked
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2 pl-5 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Weeks</th>
              <th className="px-3 py-2 font-medium text-hydra">Hydra Total</th>
              <th className="px-3 py-2 font-medium text-chimera">Chimera Total</th>
              <th className="px-3 py-2 font-medium">Avg Keys / Week</th>
              <th className="px-3 py-2 pr-5 font-medium">Participation</th>
            </tr>
          </thead>
          <tbody>
            {view.pageRows.map((s, i) => (
              <tr key={s.member.id} className="border-b border-border-soft last:border-0 hover:bg-panel-2/50">
                {/* `offset + i + 1` so the rank keeps counting across pages. */}
                <td className="px-3 py-2.5 pl-5 text-muted tabular-nums">{view.offset + i + 1}</td>
                <td className="px-3 py-2.5">
                  {/* Pass the derived active flag: the raw member row carries the DB
                      is_active column, which stays 1 on a live DB. */}
                  <MemberCell member={{ ...s.member, isActive: s.isActive }} formerStyle="muted" />
                </td>
                <td className="px-3 py-2.5">
                  {s.isActive ? (
                    <span className="rounded-full border border-hydra/30 bg-hydra/10 px-2 py-0.5 text-xs font-medium text-hydra">
                      Active
                    </span>
                  ) : (
                    // `text-muted` (~6.23:1), NOT the dimmest text token (~3.05:1,
                    // fails WCAG AA at this project's html { font-size: 75% }).
                    // Whether a player is still in the clan is information the
                    // reader is here for, so it may not be decorative-grade.
                    <span className="rounded-full border border-border bg-panel-2 px-2 py-0.5 text-xs font-medium text-muted">
                      Former
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-muted">{s.weeksPresent}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatDamage(s.hydraTotal)}</td>
                <td className="px-3 py-2.5 tabular-nums">{formatDamage(s.chimeraTotal)}</td>
                <td className="px-3 py-2.5 tabular-nums text-muted">{formatKeys(s.avgKeys)}</td>
                <td className="px-3 py-2.5 pr-5 tabular-nums">{s.participationPct.toFixed(0)}%</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                {/* CONNECTED BUT EMPTY, and the copy has to say exactly that.
                    A migrated-but-unimported database (or one just Reset from
                    Settings) reaches here: eight headers over a void, with
                    "0 active · 0 former · 0 tracked" above them. Nothing is
                    broken and nothing is read-only — the admin's next action
                    is a first import, so point at it. Deliberately NOT demo
                    mode's "connect the clan database" and NOT a permissions
                    sentence (.claude/rules/ux.md, five data-source states).
                    Same shape as components/BlackListTable.tsx's empty row and
                    the same destination as app/page.tsx's empty-state note. */}
                <td colSpan={8} className="px-5 py-10 text-center">
                  <span className="inline-flex items-center gap-2.5 text-sm text-muted">
                    <Inbox size={18} className="shrink-0 text-gold" />
                    <span>
                      No players yet — the roster builds itself from imported clash
                      weeks. Add one from{" "}
                      <Link
                        href="/settings"
                        className="text-text underline underline-offset-2 hover:text-gold"
                      >
                        Clan Settings → Import data
                      </Link>
                      .
                    </span>
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* OUTSIDE the <table>, a sibling of the scroll wrapper: a <nav> among
          <tbody>s is invalid HTML and the browser hoists it out of the table.
          `xl:mt-auto` seats it at the foot of a card the grid has stretched —
          see the note on the <section> above. */}
      <Pagination
        {...view}
        onPageChange={view.setPage}
        itemLabel="members"
        label="Roster"
        className="xl:mt-auto"
      />
    </section>
  );
}
