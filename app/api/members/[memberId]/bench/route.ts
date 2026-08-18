import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setMemberBenched } from "@/lib/members";

// Excuse a member from the Black List, or put them back under it, on the active
// database. Admin-only — anonymous and signed-in-non-admin callers both get the
// frozen 401 from requireAdmin(). One boolean column (members.is_benched,
// migration 0003) on one existing member row; nothing here creates a member.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { memberId } = await params;
  // Decoded, like the sibling results route and the member page — NOT like the
  // sibling avatar route, which skips this step. Member ids keep Unicode
  // letters: lib/persist.ts:23 slugs a name with a `\p{L}`-preserving pattern,
  // so "Κλεω" becomes "m-κλεω" and the segment reaches us percent-encoded. A raw
  // segment would make `where id = …` match nothing, the update would touch zero
  // rows, postgres.js would report no error, and the caller would be told
  // `{ ok: true }` about a write that never happened. Decode is idempotent here
  // (ids carry no literal "%"); guard a malformed hand-typed URL.
  let id = memberId;
  try {
    id = decodeURIComponent(memberId);
  } catch {
    /* malformed %-sequence → keep raw, the update then matches no row */
  }

  try {
    const body = await request.json().catch(() => ({}));
    const benched = body?.benched;

    // Strictly a boolean: no truthiness coercion, so a typo'd or missing field
    // can never be read as "put this member back under the list".
    if (typeof benched !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "Bench state must be true or false." },
        { status: 400 },
      );
    }

    await setMemberBenched(id, benched);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: benchError(err) }, { status: 500 });
  }
}

// This route's own validation returns early with its own copy (above), so
// nothing reaching the catch is user-facing validation — it is the database.
// Sanitized like /api/reset's resetError(): map the Postgres code, never echo
// the driver's message. `28P01` spells out the connection's user name (which
// embeds the project ref) and a connection failure spells out `host:port`,
// because postgres.js builds that message as `write <code> <host>:<port>`
// (node_modules/postgres/src/errors.js).
function benchError(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "42P01") {
    return "The clan tables don't exist yet. Run `npm run db:migrate` first.";
  }
  // One mapped code beyond the avatar template, for this route's own likeliest
  // first failure: the tables exist but migration 0003 has not been applied, so
  // the column is missing (`42703 undefined_column`). The generic branch below
  // would print a bare number where the fix is the same one 42P01 already names.
  if (code === "42703") {
    return "This database is missing the bench column. Run `npm run db:migrate` first.";
  }
  if (typeof code === "string") {
    return `Bench update failed — the database rejected it (code ${code}).`;
  }
  return "Bench update failed — couldn't reach the database.";
}
