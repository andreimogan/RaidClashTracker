// Server-only: writes a normalized import payload into the local SQLite DB.
// Shared by the API routes (in-app import/sync) and the CLI scripts.
import { getDb } from "./db";
import type { Client } from "@libsql/client";
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

export async function persist(
  payload: ImportPayload,
  mode: PersistMode = "upsert",
  client?: Client,
): Promise<PersistSummary> {
  const { rows, weeks, progress } = payload;
  const db = client ?? getDb();

  const memberNames = [...new Set(rows.map((r) => r.memberName))];
  const memberStmts = memberNames.map((name) => ({
    sql: `insert into members (id, in_game_name) values (?, ?)
          on conflict(id) do update set in_game_name = excluded.in_game_name`,
    args: [slug(name), name] as (string | number)[],
  }));

  const weekStmts = (weeks as WeekInfo[]).map((w) => ({
    sql: `insert into weeks (id, week_number, start_date, end_date) values (?, ?, ?, ?)
          on conflict(id) do update set
            week_number = excluded.week_number,
            start_date  = excluded.start_date,
            end_date    = excluded.end_date`,
    args: [weekId(w.weekNumber), w.weekNumber, w.startDate, w.endDate] as (string | number)[],
  }));

  // Members + weeks first so results/meta can reference them.
  await db.batch([...memberStmts, ...weekStmts], "write");

  const writeStmts: { sql: string; args: (string | number)[] }[] = [];

  // In replace mode, the sheet is the source of truth: clear each (week, clash)
  // present in the payload so removed players/rows disappear.
  if (mode === "replace") {
    const pairs = new Set(rows.map((r) => `${r.weekNumber}|${r.clashType}`));
    for (const pair of pairs) {
      const [wn, ct] = pair.split("|");
      writeStmts.push({
        sql: `delete from clash_results where week_id = ? and clash_type = ?`,
        args: [weekId(Number(wn)), ct],
      });
      writeStmts.push({
        sql: `delete from clash_meta where week_id = ? and clash_type = ?`,
        args: [weekId(Number(wn)), ct],
      });
    }
  }

  for (const r of rows) {
    writeStmts.push({
      sql: `insert into clash_results (id, week_id, member_id, clash_type, keys_used, total_damage)
            values (?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
              keys_used    = excluded.keys_used,
              total_damage = excluded.total_damage`,
      args: [resultId(r), weekId(r.weekNumber), slug(r.memberName), r.clashType, r.keysUsed, r.totalDamage],
    });
  }

  for (const p of progress as ProgressInfo[]) {
    writeStmts.push({
      sql: `insert into clash_meta (week_id, clash_type, progress) values (?, ?, ?)
            on conflict(week_id, clash_type) do update set progress = excluded.progress`,
      args: [weekId(p.weekNumber), p.clashType, p.progress],
    });
  }

  await db.batch(writeStmts, "write");

  return {
    members: memberStmts.length,
    weeks: weekStmts.length,
    results: rows.length,
    weekNumbers: [...new Set(rows.map((r) => r.weekNumber))].sort((a, b) => a - b),
    mode,
  };
}
