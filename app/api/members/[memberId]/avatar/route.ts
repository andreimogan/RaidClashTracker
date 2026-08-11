import { NextResponse } from "next/server";
import { setMemberAvatar } from "@/lib/members";

// Set or clear a member's avatar on the active database. Local, unauthenticated
// (gate before any public deploy). Avatars are stored as small base64 data URLs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ~2MB of base64 text — generous ceiling; the client downsizes to ~10-30KB.
const MAX_LEN = 2_000_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
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
    const message = err instanceof Error ? err.message : "Avatar update failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
