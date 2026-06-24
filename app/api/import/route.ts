import { NextResponse } from "next/server";
import { normalizeFlatResults, normalizeWeekJson } from "@/lib/import";
import { persist } from "@/lib/persist";
import { loadDataset } from "@/lib/data";
import { sortedWeeks } from "@/lib/compute";
import { clashWindow, currentWeek, weekWednesday } from "@/lib/week";

// Local write endpoint — unauthenticated (fine for local use; gate before any
// public deploy).
//   Flat:   { results: [...], weekNumber, clashType, progress? }
//           → canonical week dates are derived from the schedule; replaces the
//             selected (week, clash) with the imported standings.
//   Nested: { week, clashes } → upserts (back-compat).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body && Array.isArray(body.results)) {
      const { results, weekNumber, clashType } = body;
      // Canonical week window (Hydra Wed→next-Wed) derived from the schedule.
      const cur = currentWeek(sortedWeeks(await loadDataset()));
      const wed = weekWednesday(cur.weekNumber, cur.startDate, Number(weekNumber));
      const canonical = clashWindow(wed, "hydra");
      const payload = normalizeFlatResults(results, {
        weekNumber: Number(weekNumber),
        startDate: canonical.startDate,
        endDate: canonical.endDate,
        clashType,
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
