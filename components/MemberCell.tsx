import Link from "next/link";
import type { Member } from "@/lib/types";
import { Avatar } from "./Avatar";

// Canonical member cell: avatar + name linked to the member's page, with a
// configurable treatment for former members. Server-safe (no "use client")
// so both server pages and client tables can render it.
export function MemberCell({
  member,
  formerStyle = "badge", // "badge" = Former pill (tables) | "muted" = dimmed name (members page)
}: {
  member: Pick<Member, "id" | "inGameName" | "avatarUrl" | "isActive">;
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
      {!member.isActive && formerStyle === "badge" && (
        <span className="rounded-full border border-border bg-panel-2 px-2 py-0.5 text-xs font-medium text-faint">
          Former
        </span>
      )}
    </div>
  );
}
