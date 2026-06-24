import { NextResponse } from "next/server";
import { activeEnv, setActiveEnv, getDbFor, isEnvOverride, type DbEnv } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";
import { seedDemo } from "@/lib/seed";

// Local write endpoint — unauthenticated (fine for local use; gate before any
// public deploy). Switches the active local database (Production <-> Test).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ active: activeEnv(), envOverride: isEnvOverride });
}

export async function POST(request: Request) {
  try {
    if (isEnvOverride) {
      return NextResponse.json(
        { ok: false, error: "DATABASE_URL is set, so the database is pinned and can't be switched." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const active = body?.active as DbEnv;
    if (active !== "production" && active !== "test") {
      return NextResponse.json({ ok: false, error: 'Expected { active: "production" | "test" }.' }, { status: 400 });
    }

    // First time we point at the Test DB: create the schema and seed it with the
    // bundled demo data. "First time" = its tables don't exist yet, so a later
    // deliberate reset leaves it empty instead of being re-seeded here.
    if (active === "test") {
      const db = getDbFor("test");
      let firstTime = false;
      try {
        await db.execute("select 1 from members limit 1");
      } catch {
        firstTime = true;
      }
      await ensureSchema(db);
      if (firstTime) await seedDemo(db);
    }

    setActiveEnv(active);
    return NextResponse.json({ ok: true, active });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Switch failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
