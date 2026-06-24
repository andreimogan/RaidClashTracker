import { NextResponse } from "next/server";
import { restoreBackup } from "@/lib/backup";

// Replace ALL data with an uploaded backup. Local, unauthenticated (gate before
// any public deploy).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const summary = await restoreBackup(body);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Restore failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
