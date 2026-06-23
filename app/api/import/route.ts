import { NextResponse } from "next/server";
import { normalizeFlatResults, normalizeWeekJson } from "@/lib/import";
import { persist } from "@/lib/persist";

// Local write endpoint — unauthenticated (fine for local use; gate before any
// public deploy).
//   Flat:   { results: [...], weekNumber, startDate, endDate, clashType, progress? }
//           → replaces the selected (week, clash) with the imported standings.
//   Nested: { week, clashes } → upserts (back-compat).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body && Array.isArray(body.results)) {
      const { results, weekNumber, startDate, endDate, clashType, progress } = body;
      const payload = normalizeFlatResults(results, {
        weekNumber: Number(weekNumber),
        startDate,
        endDate,
        clashType,
        progress,
      });
      const summary = await persist(payload, "replace");
      return NextResponse.json({ ok: true, summary });
    }

    const payload = normalizeWeekJson(body);
    const summary = await persist(payload, "upsert");
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
