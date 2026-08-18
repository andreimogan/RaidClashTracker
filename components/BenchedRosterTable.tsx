"use client";

// The /members Benched Roster — the card beside the Roster, listing only the
// players an admin has benched.
//
// WHAT IT IS NOT: a partition of the Roster. Benching does not remove anybody
// from the clan; it records that they will sit events out. So every player on
// this card is ALSO on the Roster card beside it, by the owner's decision, and
// this file must never be read as the "other half" of that table. It receives a
// subset of the very same rows and renders two of the same columns.
//
// WHY IT IS A CLIENT LEAF, same as its neighbour: `app/members/page.tsx` stays a
// server component and hands down finished rows; the only client state in here
// is the paging position, inside `usePagination`. Putting that position in the
// URL would make the page read `searchParams` again, which is exactly what the
// `force-dynamic` guard at app/members/page.tsx:17 exists to replace.
//
// The row type is imported from the Roster rather than redeclared, so the two
// cards on this page cannot drift apart in shape.

import { Users } from "lucide-react";
import type { RosterRow } from "./RosterTable";
import { MemberCell } from "./MemberCell";
import { SectionTitle } from "./SectionTitle";
import { Pagination, usePagination } from "./Pagination";

export function BenchedRosterTable({ rows }: { rows: RosterRow[] }) {
  // Paging position only — no filtering, no sorting. The page did both.
  const view = usePagination(rows);

  return (
    // The stretch treatment, not decoration: at 2xl this card is a grid item
    // beside a much taller Roster, and the grid stretches it to match. Without
    // the flex column the pagination bar below floats mid-card with its top
    // border ruled across empty space — the defect fixed on the overview's two
    // cards (docs/reference/design-system.md, Pagination entry).
    <section className="card-flush xl:flex xl:h-full xl:flex-col">
      {/* Stacked header rather than the Roster's title-and-count row: this card
          sits in the narrow third of the grid, where a justified pair wraps. */}
      <div className="p-5 pb-3">
        <SectionTitle>Benched Roster</SectionTitle>
        {/* Counted over EVERY benched player, never the visible page — the
            question this line answers ("how many are sitting out") does not
            change when the reader turns a page. Gold matches the marker beside
            each name below, so the count and the glyph read as one thing. */}
        <p className="mt-1 text-sm text-muted">
          <span className="text-gold">{rows.length}</span>{" "}
          {rows.length === 1 ? "player is" : "players are"} sitting events out.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[220px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2 pl-5 font-medium">#</th>
              <th className="px-3 py-2 pr-5 font-medium">Player</th>
            </tr>
          </thead>
          <tbody>
            {view.pageRows.map((s, i) => (
              <tr
                key={s.member.id}
                className="border-b border-border-soft last:border-0 hover:bg-panel-2/50"
              >
                {/* `offset + i + 1` so the rank keeps counting across pages. */}
                <td className="px-3 py-2.5 pl-5 text-muted tabular-nums">{view.offset + i + 1}</td>
                <td className="px-3 py-2.5 pr-5">
                  {/* The gold marker beside each name arrives from MemberCell,
                      which renders it for any benched member — every row here
                      carries one by construction, and this file deliberately
                      draws none of its own. The pinned markup lives in exactly
                      two places and this is not one of them.

                      `isActive` is overridden with the DERIVED roster flag for
                      the same reason the Roster does it: the raw member row
                      carries the DB is_active column, which stays 1 on a live
                      database. `formerStyle="muted"` so a benched player who has
                      since gone Former dims here exactly as they do next door,
                      instead of gaining a pill this two-column card has no room
                      for. */}
                  <MemberCell member={{ ...s.member, isActive: s.isActive }} formerStyle="muted" />
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                {/* THE ORDINARY STATE, and the copy has to sound like it. Nobody
                    benched is what a healthy clan looks like on most days and is
                    what the live database says right now — so this is not "no
                    data yet", not a first-import prompt, and not an error. It
                    also has to say what the card is FOR, because an empty card
                    otherwise teaches nobody that the feature exists (which is
                    why the card is unconditional in the first place), and it has
                    to close the one wrong reading available here: that a benched
                    player has been dropped from the clan. Hence the explicit
                    "still on the Roster". No admin verb and no link: the control
                    is on the member's own page and is hidden from anyone who
                    cannot use it, so pointing at it from here would advertise an
                    action most readers will never have. */}
                <td colSpan={2} className="px-5 py-10 text-center">
                  <span className="inline-flex items-center gap-2.5 text-sm text-muted">
                    <Users size={18} className="shrink-0 text-gold" />
                    <span>
                      Nobody is benched. Benching records that a player is sitting events
                      out for now — they stay in the clan and on the Roster, and their
                      name is listed here as well.
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
          `xl:mt-auto` seats it at the foot of a card the grid has stretched.
          `label` is not optional here — the Roster's control is on the same
          page, and unlabelled the two hand a screen reader identical landmarks
          and two range summaries naming no table. At the one page this list
          almost always fits on, the control is just the range summary; at zero
          rows it renders nothing at all. */}
      <Pagination
        {...view}
        onPageChange={view.setPage}
        itemLabel="members"
        label="Benched Roster"
        className="xl:mt-auto"
      />
    </section>
  );
}
