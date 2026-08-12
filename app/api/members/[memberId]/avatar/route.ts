import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setMemberAvatar } from "@/lib/members";

// Set or clear a member's avatar on the active database. Admin-only — anonymous
// and signed-in-non-admin callers both get the frozen 401 from requireAdmin().
// Avatars are stored as small base64 data URLs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ~2MB of base64 text — generous ceiling; the client downsizes to ~10-30KB.
const MAX_LEN = 2_000_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { memberId } = await params;
    const body = await request.json().catch(() => ({}));
    const avatarUrl = body?.avatarUrl ?? null;

    if (avatarUrl !== null) {
      if (typeof avatarUrl !== "string" || !avatarUrl.startsWith("data:image/")) {
        return NextResponse.json(
          { ok: false, error: "Avatar must be an image data URL." },
          { status: 400 },
        );
      }
      if (avatarUrl.length > MAX_LEN) {
        return NextResponse.json(
          { ok: false, error: "Image is too large." },
          { status: 413 },
        );
      }
    }

    await setMemberAvatar(memberId, avatarUrl);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: avatarError(err) }, { status: 500 });
  }
}

// This route's own validation returns early with its own copy (above), so
// nothing reaching the catch is user-facing validation — it is the database.
// Sanitized like /api/reset's resetError(): map the Postgres code, never echo
// the driver's message. `28P01` spells out the connection's user name (which
// embeds the project ref) and a connection failure spells out `host:port`,
// because postgres.js builds that message as `write <code> <host>:<port>`
// (node_modules/postgres/src/errors.js).
function avatarError(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === "42P01") {
    return "The clan tables don't exist yet. Run `npm run db:migrate` first.";
  }
  if (typeof code === "string") {
    return `Avatar update failed — the database rejected it (code ${code}).`;
  }
  return "Avatar update failed — couldn't reach the database.";
}
