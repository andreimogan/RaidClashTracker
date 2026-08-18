import { getDb } from "./db";

// Update a single member's avatar. Pass null to clear it (the UI then falls back
// to the generated initials avatar).
export async function setMemberAvatar(id: string, avatarUrl: string | null): Promise<void> {
  const sql = getDb();
  await sql`update members set avatar_url = ${avatarUrl} where id = ${id}`;
}

// Excuse a member from the Black List, or put them back under it. Direct SQL is
// correct here for the same reason it is above: `.claude/rules/data-pipeline.md`
// forbids bypassing `persist()` for INGEST (weeks, clashes, results), and this
// writes member metadata — one column on one existing row, no payload, no week.
// Nothing here creates a member; an unknown id updates zero rows and resolves,
// exactly as setMemberAvatar does. Re-imports do not undo it: persist()'s
// conflict update touches only in_game_name.
export async function setMemberBenched(id: string, benched: boolean): Promise<void> {
  const sql = getDb();
  await sql`update members set is_benched = ${benched} where id = ${id}`;
}
