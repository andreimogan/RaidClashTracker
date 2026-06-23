import { NextResponse } from "next/server";
import { normalizeWeekJson } from "@/lib/import";
import { persist } from "@/lib/persist";

// Local write endpoint — unauthenticated (fine for local use; gate before any
// public deploy). Accepts the nested per-week JSON and upserts it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = normalizeWeekJson(body);
    const summary = await persist(payload, "upsert");
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
