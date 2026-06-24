import { NextResponse } from "next/server";
import { resetDatabase } from "@/lib/backup";
import { getDbFor, activeEnv, type DbEnv } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

// Wipe ALL data of a specific database (Production or Test) — independent of
// which one is active. Local, unauthenticated (gate before any public deploy).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const requested = body?.target;
    const target: DbEnv = requested === "production" || requested === "test" ? requested : activeEnv();

    const db = getDbFor(target);
    await ensureSchema(db); // make sure tables exist (e.g. Test never created yet)
    await resetDatabase(db);
    return NextResponse.json({ ok: true, target });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
