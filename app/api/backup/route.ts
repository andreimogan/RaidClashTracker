import { exportBackup } from "@/lib/backup";

// Download all current data as a JSON backup file.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const backup = await exportBackup();
  const date = backup.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="clash-backup-${date}.json"`,
    },
  });
}
