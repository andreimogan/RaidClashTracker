import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { Member } from "@/lib/types";
import { Avatar } from "./Avatar";

// Canonical member cell: avatar + name linked to the member's page, with a
// configurable treatment for former members. Server-safe (no "use client")
// so both server pages and client tables can render it.
//
// FIVE TABLES RENDER THIS ONE COMPONENT (ClashTable, PerformanceTable,
// TotalPerformanceTable, BlackListTable, RosterTable), which is why a marker
// that belongs beside every occurrence of a member's name goes HERE and
// nowhere else — the alternative is the same span copy-pasted five times and
// drifting four ways. Every call site already hands over a whole member
// object, so widening the `Pick` below costs no call-site edits.
export function MemberCell({
  member,
  formerStyle = "badge", // "badge" = Former pill (tables) | "muted" = dimmed name (members page)
}: {
  member: Pick<Member, "id" | "inGameName" | "avatarUrl" | "isActive" | "isBenched">;
  formerStyle?: "badge" | "muted";
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={member.inGameName} size={32} src={member.avatarUrl} />
      <Link
        href={`/members/${encodeURIComponent(member.id)}`}
        className={`font-medium hover:text-text hover:underline ${
          !member.isActive && formerStyle === "muted" ? "text-muted" : ""
        }`}
      >
        {member.inGameName}
      </Link>
      {/* Excused from the Black List by an admin, so the name can appear on a
          participation table with poor numbers and still be settled. It sits
          AFTER the name rather than on the avatar: the avatar has a corner slot
          of its own and, at the larger size used on the member page, a camera
          button over it. `shrink-0` because the name beside it is the element
          allowed to shrink.

          `role="img"` IS LOAD-BEARING, not decoration on a wrapper. lucide-react
          stamps `aria-hidden="true"` on the svg unless an a11y prop is passed,
          and `aria-label` on a bare `<span>` (role `generic`) is prohibited by
          ARIA in HTML and dropped by browsers and AT — measured in the served
          HTML. Without the role this marker does not exist for a screen reader
          at all. Deleting it re-silences the icon.

          `text-gold`, NOT the good-number token: that token means "high
          participation / positive trend" in the very rows this marker appears
          in, and is the glyph+colour the Black List's own all-clear uses, so
          green read as "good player" rather than "excused". Gold is not a
          performance tier, so it cannot be misread as one.

          The hover text is a native `title`, chosen deliberately over a richer
          pattern (this project has none, and the trade-off was put to the owner
          and accepted): it is invisible on touch, unreachable by keyboard and
          announced inconsistently. That is why the `aria-label` above is the
          carrier that has to work. Size 14 here, 18 beside the member page's
          heading — same markup otherwise, so the two stay in step. */}
      {member.isBenched && (
        <span className="inline-flex shrink-0" role="img" title="This player is safe from the blacklist" aria-label="This player is safe from the blacklist">
          <ShieldCheck size={14} className="text-gold" />
        </span>
      )}
      {!member.isActive && formerStyle === "badge" && (
        <span className="rounded-full border border-border bg-panel-2 px-2 py-0.5 text-xs font-medium text-faint">
          Former
        </span>
      )}
    </div>
  );
}
