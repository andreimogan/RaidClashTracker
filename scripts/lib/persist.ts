// Shared upsert logic used by the seed, CSV import, and RTK sync scripts.
import { db, type NormalizedRow } from "./db";

export interface WeekInfo {
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface ProgressInfo {
  weekNumber: number;
  clashType: "hydra" | "chimera";
  progress: number;
}

const slug = (name: string) =>
  "m-" + name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

const weekId = (n: number) => `w${n}`;

export async function persist(
  rows: NormalizedRow[],
  weeks: WeekInfo[],
  progress: ProgressInfo[] = [],
) {
  // 1) Members — set name on create, refresh on conflict (preserve other cols).
  const memberNames = [...new Set(rows.map((r) => r.memberName))];
  const memberStmts = memberNames.map((name) => ({
    sql: `insert into members (id, in_game_name) values (?, ?)
          on conflict(id) do update set in_game_name = excluded.in_game_name`,
    args: [slug(name), name],
  }));

  // 2) Weeks.
  const weekStmts = weeks.map((w) => ({
    sql: `insert into weeks (id, week_number, start_date, end_date) values (?, ?, ?, ?)
          on conflict(id) do update set
            week_number = excluded.week_number,
            start_date  = excluded.start_date,
            end_date    = excluded.end_date`,
    args: [weekId(w.weekNumber), w.weekNumber, w.startDate, w.endDate],
  }));

  // 3) Clash results — idempotent on week+member+clash.
  const resultStmts = rows.map((r) => ({
    sql: `insert into clash_results (id, week_id, member_id, clash_type, keys_used, total_damage)
          values (?, ?, ?, ?, ?, ?)
          on conflict(id) do update set
            keys_used    = excluded.keys_used,
            total_damage = excluded.total_damage`,
    args: [
      `${weekId(r.weekNumber)}-${slug(r.memberName)}-${r.clashType}`,
      weekId(r.weekNumber),
      slug(r.memberName),
      r.clashType,
      r.keysUsed,
      r.totalDamage,
    ],
  }));

  // 4) Per-clash progress meta when provided.
  const metaStmts = progress.map((p) => ({
    sql: `insert into clash_meta (week_id, clash_type, progress) values (?, ?, ?)
          on conflict(week_id, clash_type) do update set progress = excluded.progress`,
    args: [weekId(p.weekNumber), p.clashType, p.progress],
  }));

  // Members and weeks must exist before results reference them.
  await db.batch([...memberStmts, ...weekStmts], "write");
  await db.batch([...resultStmts, ...metaStmts], "write");

  console.log(
    `Upserted ${memberStmts.length} members, ${weekStmts.length} weeks, ${resultStmts.length} results.`,
  );
}
