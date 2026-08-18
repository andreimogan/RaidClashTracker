import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { restoreBackup } from "@/lib/backup";

// Replace ALL data with an uploaded backup. Admin-only — anonymous and
// signed-in-non-admin callers both get the frozen 401 from requireAdmin().
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const summary = await fromDatabase(() => restoreBackup(body));
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    // Split catch, on purpose — and split by PROVENANCE where provenance can
    // tell them apart. A JSON parse failure never goes through fromDatabase(),
    // so its message survives verbatim by construction rather than because it
    // happens to carry no `code` (undici sets a string `code` on a truncated
    // body, and that is not a database rejection).
    //
    // Known limit, deliberately not papered over: restoreBackup() validates the
    // file AND writes it in the same call, so its own rejection copy ("Not a
    // valid backup file (expected members, weeks, clash_results arrays).")
    // reaches this route with database provenance and is only distinguishable
    // from a driver error by shape — it is a bare `Error` with no `code`, so
    // databaseError() passes it through. Closing that properly needs the throw
    // at lib/backup.ts to be a typed ValidationError this route can test with
    // `instanceof`, the way app/api/members/[memberId]/results/route.ts does;
    // lib/backup.ts is outside this slice's ownership. Until then: adding a
    // machine-readable `code` to that one throw would silently rewrite its copy.
    if (err instanceof DatabaseFailure) {
      return NextResponse.json({ ok: false, error: databaseError(err.reason) }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Restore failed." },
      { status: 400 },
    );
  }
}

// Provenance marker: thrown only by fromDatabase(), which wraps the one call
// that touches Postgres. It carries the original error rather than replacing it,
// so the sanitizer below still sees the PG code. Status codes are unaffected —
// the catch answers 400 on both branches, exactly as before.
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
  // Second mapped code, same failure mode the bench route already maps: the
  // tables exist but a migration has not been applied, so the restore's insert
  // names a column this database does not have (`42703 undefined_column`).
  // Restore is the worst place to meet it — restoreBackup() clears all four
  // tables and re-inserts inside ONE transaction, so the rollback leaves the
  // data intact but the admin has just watched a disaster-recovery attempt fail,
  // and this is a path they can reach before ever thinking about migrations.
  // The generic branch below would print a bare code number where the fix is the
  // same instruction `42P01` already gives.
  if (code === "42703") {
    return "This database is missing a column the backup needs. Run `npm run db:migrate` first.";
  }
  if (typeof code === "string") {
    return `Restore failed — the database rejected it (code ${code}).`;
  }
  // No `code` at all means postgres.js never built it: restoreBackup()'s own
  // rejection copy, or getDb()'s "DATABASE_URL is not set…" instruction (which
  // deliberately carries no URL, lib/db.ts). Both stay verbatim, as before.
  return err instanceof Error ? err.message : "Restore failed.";
}
