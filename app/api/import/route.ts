import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { normalizeFlatResults, normalizeWeekJson } from "@/lib/import";
import { persist } from "@/lib/persist";
import { loadDataset } from "@/lib/data";
import { sortedWeeks } from "@/lib/compute";
import { clashWindow, currentWeek, weekWednesday } from "@/lib/week";

// Write endpoint. Admin-only — anonymous and signed-in-non-admin callers both
// get the frozen 401 from requireAdmin().
//   Flat:   { results: [...], weekNumber, clashType, progress? }
//           → canonical week dates are derived from the schedule; replaces the
//             selected (week, clash) with the imported standings.
//   Nested: { week, clashes } → upserts (back-compat).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();

    if (body && Array.isArray(body.results)) {
      const { results, weekNumber, clashType } = body;
      // Canonical week window (Hydra Wed→next-Wed) derived from the schedule.
      const cur = currentWeek(sortedWeeks(await fromDatabase(() => loadDataset())));
      const wed = weekWednesday(cur.weekNumber, cur.startDate, Number(weekNumber));
      const canonical = clashWindow(wed, "hydra");
      const payload = normalizeFlatResults(results, {
        weekNumber: Number(weekNumber),
        startDate: canonical.startDate,
        endDate: canonical.endDate,
        clashType,
      });
      const summary = await fromDatabase(() => persist(payload, "replace"));
      return NextResponse.json({ ok: true, summary });
    }

    const payload = normalizeWeekJson(body);
    const summary = await fromDatabase(() => persist(payload, "upsert"));
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    // Split catch, on purpose — and split by PROVENANCE, not by the error's
    // shape. The only calls in here that can reach Postgres are wrapped in
    // fromDatabase(), so a database failure arrives as a DatabaseFailure and
    // nothing else can. Everything else keeps its message verbatim: the
    // normalizers' validation copy is the whole value of this endpoint's 400 —
    // it is the only thing that tells the owner WHICH row or field was rejected.
    //
    // This test used to be `typeof err.code === "string"`, which was correct
    // only for as long as lib/import.ts's ValidationError happened to carry no
    // `code`. Giving it a machine-readable one (`code = "MISSING_WEEK"`) would
    // have silently turned every validation message into "the database rejected
    // it", with nothing to catch it. app/api/members/[memberId]/results/route.ts
    // discriminates with `instanceof ValidationError`; lib/import.ts does not
    // export its ValidationError, so provenance is the equivalent type-based
    // test available here — and it is also right about the mirror case, since a
    // body-read failure (undici sets a string `code` too) is not a database
    // rejection either.
    if (err instanceof DatabaseFailure) {
      return NextResponse.json({ ok: false, error: databaseError(err.reason) }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Import failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

// Provenance marker: thrown only by fromDatabase(), which wraps the two calls
// that touch Postgres (loadDataset, persist). It carries the original error
// rather than replacing it, so the sanitizer below still sees the PG code.
// Status codes are unaffected — the catch answers 400 on both branches, exactly
// as before (400-vs-500 for a driver failure is a separate, deferred question).
class DatabaseFailure extends Error {
  reason: unknown;
  constructor(reason: unknown) {
    super("Database failure");
    this.name = "DatabaseFailure";
    this.reason = reason;
  }
}

async function fromDatabase<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    throw new DatabaseFailure(err);
  }
}

// Sanitizer, same shape as /api/reset's resetError(): map the Postgres code,
// never echo the driver's message. `28P01` spells out the connection's user name
// (which embeds the project ref) and a connection failure spells out
// `host:port` — postgres.js builds that message as `write <code> <host>:<port>`
// and every driver error carries a string `code`
// (node_modules/postgres/src/errors.js).
function databaseError(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "42P01") {
    return "The clan tables don't exist yet. Run `npm run db:migrate` first.";
  }
  if (typeof code === "string") {
    return `Import failed — the database rejected it (code ${code}).`;
  }
  // No `code` at all means postgres.js never built it. The reachable case is
  // getDb()'s own "DATABASE_URL is not set…" instruction, which is actionable
  // and deliberately carries no URL (lib/db.ts) — passed through as before.
  return err instanceof Error ? err.message : "Import failed.";
}
