import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/parse";
import { normalizeCsvRecords } from "@/lib/import";
import { persist } from "@/lib/persist";
import { fetchSheetCsv, toCsvExportUrl } from "@/lib/sheets";

// Pulls a published Google Sheet (CSV columns) and mirrors it into the DB:
// each (week, clash) in the sheet replaces the app's data for that pair.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ ok: false, error: "Provide a Google Sheet URL." }, { status: 400 });
    }
    const csv = await fetchSheetCsv(toCsvExportUrl(url));
    const payload = normalizeCsvRecords(parseCsv(csv));
    const summary = await persist(payload, "replace");
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
