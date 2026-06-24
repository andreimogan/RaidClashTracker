import { NextResponse } from "next/server";
import { resetDatabase } from "@/lib/backup";

// Wipe ALL data (clean slate). Local, unauthenticated (gate before any public
// deploy).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await resetDatabase();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
