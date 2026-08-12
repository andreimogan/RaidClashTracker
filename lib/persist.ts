// Server-only: writes a normalized import payload into Supabase Postgres.
// Shared by the API routes (in-app import, restore, member week edit) and the CLI scripts.
//
// Everything runs inside ONE transaction (sql.begin) — member/week upserts, the
// replace-mode deletes, the result and meta upserts. A failed import therefore
// leaves the database exactly as it was; a half-applied week is not a state the
// app can reach. (Before the Postgres port this was two separate batches, so a
// failure between them could leave members/weeks written and no results.)
import { getDb, type Db } from "./db";
import type { ImportPayload, NormalizedRow, ProgressInfo, WeekInfo } from "./import";

export type PersistMode = "upsert" | "replace";

export interface PersistSummary {
  members: number;
  weeks: number;
  results: number;
  weekNumbers: number[];
  mode: PersistMode;
}

export const slug = (name: string) =>
  "m-" + name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

const weekId = (n: number) => `w${n}`;
const resultId = (r: NormalizedRow) => `${weekId(r.weekNumber)}-${slug(r.memberName)}-${r.clashType}`;

// Postgres rejects an INSERT ... ON CONFLICT DO UPDATE that would touch the same
// row twice in one statement (21000), while the old statement-per-row write
// applied both and let the last one win. The normalizers do not dedupe (a CSV or
// a JSON export can list a player twice), so collapse duplicates here, last-wins,
// to keep the observable semantics identical.
function lastWins<T>(items: T[], key: (item: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) byKey.set(key(item), item);
  return [...byKey.values()];
}

// Postgres caps a statement at 65535 bind parameters; chunk so a big restore or
// a multi-week import can never hit it.
const CHUNK = 500;
function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function persist(
  payload: ImportPayload,
  mode: PersistMode = "upsert",
  client?: Db,
): Promise<PersistSummary> {
  const { rows, weeks, progress } = payload;
  const db = client ?? getDb();

  const memberNames = [...new Set(rows.map((r) => r.memberName))];
  const memberValues = memberNames.map((name) => ({ id: slug(name), in_game_name: name }));

  const weekInfos = weeks as WeekInfo[];
  const weekValues = lastWins(
    weekInfos.map((w) => ({
      id: weekId(w.weekNumber),
      week_number: w.weekNumber,
      start_date: w.startDate,
      end_date: w.endDate,
    })),
    (w) => w.id,
  );

  const resultValues = lastWins(
    rows.map((r) => ({
      id: resultId(r),
      week_id: weekId(r.weekNumber),
      member_id: slug(r.memberName),
      clash_type: r.clashType,
      keys_used: r.keysUsed,
      total_damage: r.totalDamage,
    })),
    (r) => r.id,
  );

  const metaValues = lastWins(
    (progress as ProgressInfo[]).map((p) => ({
      week_id: weekId(p.weekNumber),
      clash_type: p.clashType,
      progress: p.progress,
    })),
    (m) => `${m.week_id}|${m.clash_type}`,
  );

  // In replace mode the payload is the source of truth: clear each (week, clash)
  // present in it so removed players/rows disappear.
  const replacePairs =
    mode === "replace"
      ? lastWins(
          rows.map((r) => ({ weekId: weekId(r.weekNumber), clashType: r.clashType })),
          (p) => `${p.weekId}|${p.clashType}`,
        )
      : [];

  await db.begin(async (sql) => {
    // Members + weeks first so results/meta can reference them.
    for (const batch of chunks(memberValues)) {
      await sql`
        insert into members ${sql(batch, "id", "in_game_name")}
        on conflict (id) do update set in_game_name = excluded.in_game_name
      `;
    }

    for (const batch of chunks(weekValues)) {
      await sql`
        insert into weeks ${sql(batch, "id", "week_number", "start_date", "end_date")}
        on conflict (id) do update set
          week_number = excluded.week_number,
          start_date  = excluded.start_date,
          end_date    = excluded.end_date
      `;
    }

    for (const p of replacePairs) {
      await sql`delete from clash_results where week_id = ${p.weekId} and clash_type = ${p.clashType}`;
      await sql`delete from clash_meta    where week_id = ${p.weekId} and clash_type = ${p.clashType}`;
    }

    for (const batch of chunks(resultValues)) {
      await sql`
        insert into clash_results ${sql(
          batch,
          "id",
          "week_id",
          "member_id",
          "clash_type",
          "keys_used",
          "total_damage",
        )}
        on conflict (id) do update set
          keys_used    = excluded.keys_used,
          total_damage = excluded.total_damage
      `;
    }

    for (const batch of chunks(metaValues)) {
      await sql`
        insert into clash_meta ${sql(batch, "week_id", "clash_type", "progress")}
        on conflict (week_id, clash_type) do update set progress = excluded.progress
      `;
    }
  });

  // Counts describe the payload, not the deduped statements — unchanged from the
  // pre-Postgres summary so the import banners keep reporting the same numbers.
  return {
    members: memberNames.length,
    weeks: weekInfos.length,
    results: rows.length,
    weekNumbers: [...new Set(rows.map((r) => r.weekNumber))].sort((a, b) => a - b),
    mode,
  };
}
