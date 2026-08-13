import { getDb } from "./db";

// Update a single member's avatar. Pass null to clear it (the UI then falls back
// to the generated initials avatar).
export async function setMemberAvatar(id: string, avatarUrl: string | null): Promise<void> {
  const sql = getDb();
  await sql`update members set avatar_url = ${avatarUrl} where id = ${id}`;
}
