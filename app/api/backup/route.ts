import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { exportBackup } from "@/lib/backup";

// Download all current data as a JSON backup file.
//
// This is the whole dataset in one request — an exfiltration route, not a write
// one — so it is gated exactly like the writes. An anonymous caller gets the
// frozen 401 JSON, never an attachment.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const backup = await exportBackup();
    const date = backup.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="clash-backup-${date}.json"`,
      },
    });
  } catch (err) {
    // Previously there was no catch at all: a database outage threw out of the
    // handler and Next answered with its own 500 page. The client opens this
    // route as a link, so the reader saw a framework error page instead of a
    // sentence. Sanitized, for the reason spelled out in backupError().
    return NextResponse.json({ ok: false, error: backupError(err) }, { status: 500 });
  }
}

// Deliberately does NOT echo the driver's message: a Postgres authentication
// failure spells out the connection's user name (which embeds the project ref)
// and a connection failure spells out `host:port` — postgres.js builds that
// message as `write <code> <host>:<port>` (node_modules/postgres/src/errors.js).
// The error code is safe and enough to act on, so it is all that leaks.
function backupError(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "42P01") {
    return "The clan tables don't exist yet. Run `npm run db:migrate` first.";
  }
  if (typeof code === "string") {
    return `Backup failed — the database rejected it (code ${code}).`;
  }
  return "Backup failed — couldn't reach the database.";
}
