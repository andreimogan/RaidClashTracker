"use client";

// The Black List — roster members falling short on clash participation over the
// trailing window. Derived by getBlackList() in lib/compute.ts; there is no
// curated list behind it and no write surface, so this component only renders.
//
// IT COVERS EVERY TRACKED WEEK, exactly like the "Total (All Weeks)" tab. Two
// consequences, and they are the reason this file looks different from
// PerformanceTable:
//   * its numbers do not move when the week picker moves, so it must NOT draw
//     loading placeholders during a week change — a placeholder is a claim that
//     THIS data is loading, and none of it is. It therefore reads no transition
//     state and is not wrapped in the swap component; that absence is greppable
//     and deliberate, so please leave it absent.
//   * every threshold it states is read off `rule`, never typed as a literal
//     here. Re-pinning the rule in lib/constants.ts must move this copy with it.
//
// THREE EMPTY STATES, NOT TWO — and the middle one is the whole point of
// `membersJudged`. An empty table means one of three different things and they
// need three different sentences:
//   1. `rule.weekNumbers` is []  — no week is fully imported yet (both clashes
//      must be in before a week is judged), so there is nothing to measure at
//      all. Makes NO claim about the roster.
//   2. weeks exist, `membersJudged` is 0 — there are weeks, but nobody cleared
//      the "present for at least minWeeksPresent of them" gate. Also makes NO
//      claim about the roster: this is the state a clan sits in after its first
//      import and after every Settings -> Reset, and the green all-clear here
//      would be a cheerful lie about players nobody has measured.
//   3. weeks exist and `membersJudged` > 0 — genuinely good news. Only this
//      branch gets the shield.
//
// THE EXCUSED ARE INVISIBLE HERE UNLESS THIS FILE SAYS SO. An admin can excuse
// a member, and getBlackList drops them at the roster gate — before `rows` is
// built and before `membersJudged` is counted. So the name marker that means
// "excused" can never appear on this card (every row's member cleared that
// gate), and the all-clear prints a denominator smaller than the roster with
// nothing explaining it. `excusedCount` is rendered in two places for that
// reason — a header line and a clause on the all-clear — and BOTH are gated on
// it being non-zero, so a clan with nobody excused sees neither.
//
// Contrast: the dimmest text token is not used anywhere below (~3.05:1, fails AA
// under this project's `html { font-size: 75% }`) — every word here is something
// the reader needs in order to understand why a clanmate is named. `text-muted`
// is ~6.23:1 and carries the secondary detail instead.

import { Hourglass, Inbox, ShieldCheck } from "lucide-react";
import type { BlackListResult } from "@/lib/types";
import { MemberCell } from "./MemberCell";
import { SectionTitle } from "./SectionTitle";
import { Pagination, usePagination } from "./Pagination";

// Same three tiers the two Clan Performance tables use, so one participation
// figure does not change colour depending on which card it is read in. (Third
// hand-copy of this expression; a shared home for it would need a file this
// slice does not own.)
const participationColor = (pct: number) =>
  pct >= 90 ? "text-up" : pct >= 60 ? "text-muted" : "text-down";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function BlackListTable({ data }: { data: BlackListResult }) {
  const { rule, rows, membersJudged, excusedCount } = data;
  const view = usePagination(rows);

  const weeksJudged = rule.weekNumbers.length;
  // No fully imported week is the connected-but-empty database (or a first
  // import still in flight), not a clean roster: nothing to judge anybody
  // against yet.
  const noWeeks = weeksJudged === 0;
  // Weeks on the board, but not one member cleared both gates. Distinct from
  // the above and from good news — see the three-empty-states note up top.
  const nobodyJudged = !noWeeks && membersJudged === 0;

  return (
    // xl:flex + xl:flex-col so the pagination bar can be pushed to the card's
    // foot with mt-auto. At 2xl the grid stretches this card to the height of
    // Clan Performance beside it; without the flex column the bordered bar
    // floated mid-card with dead space under it.
    <section className="card-flush xl:flex xl:h-full xl:flex-col">
      <div className="p-5 pb-3">
        <SectionTitle>Black List</SectionTitle>
        {/* ONE LINE, UNCONDITIONAL, AND IT NAMES THE RULE'S WINDOW — the owner
            asked for a plain label here rather than a description of the data
            behind it, so this states the size the rule is written for and holds
            still while imports come and go. It is read off `rule` all the same
            (see the note at the top of this file: no threshold in here is ever
            typed as a digit), which is what keeps it honest if the rule in
            lib/constants.ts is ever re-pinned.

            The header is therefore no longer where a reader reconstructs the
            list: the per-row detail lives in the table — which weeks a player
            missed in the missed-weeks column, whose own header states what
            counts as a miss, and how many weeks they were judged on under the
            percentage — and the empty states below still say in full why a
            table with no rows is empty. */}
        <p className="mt-1 text-sm text-muted">
          Last {rule.windowWeeks} weeks of participation.
        </p>
        {/* CONDITIONAL, and it must stay conditional: with nobody excused the
            header is exactly the one line above, which is the owner's pinned
            shape. It only appears when there is something to explain.

            What it explains: an excused member is dropped at the roster gate in
            getBlackList, so they are in neither `rows` nor `membersJudged`. That
            makes the exclusion invisible on this card twice over — the name
            marker can never render here (every row's member cleared the gate, so
            the flag is false by construction), and the all-clear's denominator
            silently shrinks. `excusedCount` is roster-scoped for exactly that
            reason: it counts only people the reader could otherwise expect to
            see on this list. */}
        {excusedCount > 0 && (
          <p className="mt-0.5 text-sm text-muted">
            {excusedCount} {plural(excusedCount, "player is", "players are")} excused from
            this list.
          </p>
        )}
      </div>

      {/* Horizontal scroller only, for the min-width grid on a narrow viewport.
          Nothing scrolls vertically in here — a page is 10 rows. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2 pl-5 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Player</th>
              {/* The header states the accusation's DEFINITION, because this
                  column is where the accusation is made: a reader looking at
                  "W21, W23" beside a player who used two keys in W21 otherwise
                  reads "missed" as false and the whole list as broken, and the
                  listing threshold is stated nowhere else on screen (only the
                  all-clear branch prints one, and that branch renders only when
                  the table is empty). Costs no vertical space: the words go in a
                  row that already exists. Read off `rule` like every other
                  number in this file — no digit is typed here. */}
              <th className="px-3 py-2 font-medium">
                Missed weeks (under {rule.minKeysPerWeek} of {rule.maxKeysPerWeek} keys)
              </th>
              <th className="px-3 py-2 pr-5 font-medium">Participation</th>
            </tr>
          </thead>
          <tbody>
            {view.pageRows.map((r, i) => (
              <tr
                key={r.member.id}
                className="border-b border-border-soft last:border-0 hover:bg-panel-2/50"
              >
                {/* offset + i + 1 — worst first, and the count carries on across pages. */}
                <td className="px-3 py-2.5 pl-5 text-muted tabular-nums">{view.offset + i + 1}</td>
                <td className="px-3 py-2.5">
                  <MemberCell member={r.member} />
                </td>
                {/* `W` prefixed: these are week NUMBERS, not a count of misses,
                    and the header alone reads as a quantity. It also stops the
                    bare digits colliding visually with the numbers next door. */}
                <td className="px-3 py-2.5 tabular-nums">
                  {r.missedWeekNumbers.map((w) => `W${w}`).join(", ")}
                </td>
                {/* Two lines, because the DENOMINATOR is the confusing number and
                    it lives here: 8/15 above 12/20 is two players judged on
                    different numbers of weeks, not two players on one scale.
                    The judged count is now VISIBLE rather than tooltip-only —
                    `title` is not keyboard reachable, never appears on touch and
                    is announced inconsistently, so it can only ever be the
                    redundant long form. Vertical space is free at 10 rows a page;
                    horizontal space is not, which is why this is stacked. */}
                <td
                  className="px-3 py-2.5 pr-5"
                  title={`${r.keysUsed} of a possible ${r.keysPossible} keys across the ${r.weeksConsidered} window ${plural(r.weeksConsidered, "week", "weeks")} this player has results for. Players judged on different numbers of weeks have different totals — compare the percentages.`}
                >
                  <div className={`tabular-nums ${participationColor(r.participationPct)}`}>
                    {r.participationPct.toFixed(0)}%
                  </div>
                  <div className="whitespace-nowrap text-xs tabular-nums text-muted">
                    {r.keysUsed} / {r.keysPossible} keys · {r.weeksConsidered}{" "}
                    {plural(r.weeksConsidered, "week", "weeks")} judged
                  </div>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center">
                  {noWeeks ? (
                    // Connected but empty, or a half-imported first week.
                    // Deliberately NOT the good-news copy: an unjudged roster is
                    // not a clean one.
                    <span className="inline-flex items-center gap-2.5 text-sm text-muted">
                      <Inbox size={18} className="shrink-0 text-gold" />
                      No clash week is fully imported yet — a week is judged once both Hydra
                      and Chimera results are in, so there is nothing to measure
                      participation against.
                    </span>
                  ) : nobodyJudged ? (
                    // Weeks exist, but not one member cleared the "present for
                    // enough of them" gate. Says what is missing and makes no
                    // claim at all about how the clan is playing.
                    <span className="inline-flex items-center gap-2.5 text-sm text-muted">
                      <Hourglass size={18} className="shrink-0 text-gold" />
                      Nobody can be judged yet — {weeksJudged}{" "}
                      {plural(weeksJudged, "week is", "weeks are")} fully imported, and a
                      player is judged once they have results for at least{" "}
                      {rule.minWeeksPresent} of them.
                    </span>
                  ) : (
                    // Zero rows, with weeks on the board AND members actually
                    // measured, is GOOD NEWS and has to read that way — this is
                    // not a surface that failed to load.
                    //
                    // The trailing clause names the hidden denominator: this
                    // sentence prints an N that is smaller than the roster
                    // whenever someone is excused, and without the clause there
                    // is nothing on screen accounting for the difference. It is
                    // one clause on purpose — the rule is already stated in the
                    // sentence it hangs off, so it says only that the excused
                    // were not measured. Absent entirely at zero.
                    <span className="inline-flex items-center gap-2.5 text-sm text-muted">
                      <ShieldCheck size={18} className="shrink-0 text-up" />
                      Nobody is on the Black List — none of the {membersJudged} players judged
                      missed {rule.minMisses} or more of the weeks they played
                      {excusedCount > 0 && (
                        <>
                          , and {excusedCount} excused{" "}
                          {plural(excusedCount, "player was", "players were")} not measured
                        </>
                      )}
                      .
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Outside the table, sibling of the scroller, inside the card. Renders
          nothing at all while the list is empty. `xl:mt-auto` seats it at the
          foot of a card the 2xl grid has stretched. `label` names the landmark
          and the announcement — two of these sit side by side up there. */}
      <Pagination
        {...view}
        onPageChange={view.setPage}
        itemLabel="players"
        label="Black List"
        className="xl:mt-auto"
      />
    </section>
  );
}
