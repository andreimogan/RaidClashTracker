import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { upsertMemberWeekResults, ValidationError } from "@/lib/results";

// Upsert one member's hydra + chimera results for one tracked week, through
// the sanctioned import pipeline (persist "upsert" — no direct SQL). Admin-only
// — anonymous and signed-in-non-admin callers both get the frozen 401 from
// requireAdmin().
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { memberId } = await params;
  // The route segment arrives percent-encoded; member ids contain Unicode
  // letters (e.g. "m-κλεω-hell"), so decode before the slug guard. Decode is
  // idempotent here (ids have no literal "%"); guard malformed hand-typed URLs.
  let id = memberId;
  try {
    id = decodeURIComponent(memberId);
  } catch {
    /* malformed %-sequence → keep raw, the member lookup will reject it */
  }

  try {
    const body = await request.json().catch(() => ({}));
    await upsertMemberWeekResults(id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // ValidationError first, and its message untouched: lib/results.ts's copy is
    // stricter than the import paths' and naming the exact field is the point of
    // the 400 (docs/reference/data-pipeline.md documents that strictness).
    if (err instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: resultsError(err) }, { status: 500 });
  }
}

// Everything that is not a ValidationError is unexpected, and the likeliest
// unexpected thing is the database. Sanitized like /api/reset's resetError():
// map the Postgres code, never echo the driver's message — `28P01` spells out
// the connection's user name (which embeds the project ref) and a connection
// failure spells out `host:port`, because postgres.js builds that message as
// `write <code> <host>:<port>` (node_modules/postgres/src/errors.js).
function resultsError(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "42P01") {
    return "The clan tables don't exist yet. Run `npm run db:migrate` first.";
  }
  if (typeof code === "string") {
    return `Saving results failed — the database rejected it (code ${code}).`;
  }
  return "Saving results failed — couldn't reach the database.";
}
