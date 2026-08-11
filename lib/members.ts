import { getDb } from "./db";

// Update a single member's avatar on the active database. Pass null to clear it
// (the UI then falls back to the generated initials avatar).
export async function setMemberAvatar(id: string, avatarUrl: string | null): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "update members set avatar_url = ? where id = ?",
    args: [avatarUrl, id],
  });
}
