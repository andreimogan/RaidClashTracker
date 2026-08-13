import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { resetDatabase } from "@/lib/backup";

// Wipe ALL data from the database. Takes no body. Admin-only — anonymous and
// signed-in-non-admin callers both get the frozen 401 from requireAdmin().
//
// It no longer creates the tables first: schema changes are numbered migrations
// applied by `npm run db:migrate`, and a reset against a database that was never
// migrated should say so rather than quietly bootstrapping one.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    await resetDatabase();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: resetError(err) }, { status: 500 });
  }
}

// Deliberately does NOT echo the driver's message: a Postgres authentication
// failure spells out the connection's user name, and a DNS failure spells out the
// host. The error code is safe and enough to act on, so it is all that leaks.
function resetError(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "42P01") {
    return "The clan tables don't exist yet. Run `npm run db:migrate` first.";
  }
  if (typeof code === "string") {
    return `Reset failed — the database rejected it (code ${code}).`;
  }
  return "Reset failed — couldn't reach the database.";
}
