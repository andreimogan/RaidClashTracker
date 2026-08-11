import { NextResponse } from "next/server";
import { upsertMemberWeekResults, ValidationError } from "@/lib/results";

// Upsert one member's hydra + chimera results for one tracked week, through
// the sanctioned import pipeline (persist "upsert" — no direct SQL). Local,
// unauthenticated (gate before any public deploy).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
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
    if (err instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Saving results failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
