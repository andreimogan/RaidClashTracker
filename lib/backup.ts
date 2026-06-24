// Server-only: export / restore / reset the local SQLite data.
import { getDb } from "./db";
import type { Client, InStatement } from "@libsql/client";

const TABLES = ["members", "weeks", "clash_results", "clash_meta"] as const;

export interface Backup {
  app: "raid-clash-tracker";
  version: number;
  exportedAt: string;
  members: Record<string, unknown>[];
  weeks: Record<string, unknown>[];
  clash_results: Record<string, unknown>[];
  clash_meta: Record<string, unknown>[];
}

export async function exportBackup(): Promise<Backup> {
  const db = getDb();
  const [members, weeks, clash_results, clash_meta] = await Promise.all(
    TABLES.map((t) => db.execute(`select * from ${t}`)),
  );
  return {
    app: "raid-clash-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    members: members.rows as unknown as Record<string, unknown>[],
    weeks: weeks.rows as unknown as Record<string, unknown>[],
    clash_results: clash_results.rows as unknown as Record<string, unknown>[],
    clash_meta: clash_meta.rows as unknown as Record<string, unknown>[],
  };
}

// Delete every row, children before parents (FK order).
function wipeStatements(): InStatement[] {
  return [
    "delete from clash_results",
    "delete from clash_meta",
    "delete from weeks",
    "delete from members",
  ];
}

export async function resetDatabase(client?: Client): Promise<void> {
  await (client ?? getDb()).batch(wipeStatements(), "write");
}

type Row = Record<string, unknown>;
const num = (v: unknown, d = 0) => (v == null ? d : Number(v));
const str = (v: unknown) => (v == null ? null : String(v));

export async function restoreBackup(data: unknown): Promise<{ members: number; weeks: number; results: number }> {
  const b = data as Partial<Backup>;
  if (
    !b || typeof b !== "object" ||
    !Array.isArray(b.members) || !Array.isArray(b.weeks) || !Array.isArray(b.clash_results)
  ) {
    throw new Error("Not a valid backup file (expected members, weeks, clash_results arrays).");
  }

  const stmts: InStatement[] = [...wipeStatements()];

  for (const m of b.members as Row[]) {
    stmts.push({
      sql: `insert into members (id, in_game_name, level, hero_level, avatar_url, is_active, created_at)
            values (?, ?, ?, ?, ?, ?, coalesce(?, datetime('now')))`,
      args: [
        str(m.id), str(m.in_game_name), num(m.level), num(m.hero_level),
        str(m.avatar_url), num(m.is_active, 1), str(m.created_at),
      ],
    });
  }
  for (const w of b.weeks as Row[]) {
    stmts.push({
      sql: `insert into weeks (id, week_number, start_date, end_date) values (?, ?, ?, ?)`,
      args: [str(w.id), num(w.week_number), str(w.start_date), str(w.end_date)],
    });
  }
  for (const r of b.clash_results as Row[]) {
    stmts.push({
      sql: `insert into clash_results (id, week_id, member_id, clash_type, keys_used, total_damage)
            values (?, ?, ?, ?, ?, ?)`,
      args: [str(r.id), str(r.week_id), str(r.member_id), str(r.clash_type), num(r.keys_used), num(r.total_damage)],
    });
  }
  for (const m of (b.clash_meta ?? []) as Row[]) {
    stmts.push({
      sql: `insert into clash_meta (week_id, clash_type, progress) values (?, ?, ?)`,
      args: [str(m.week_id), str(m.clash_type), num(m.progress)],
    });
  }

  await (getDb() as Client).batch(stmts, "write");
  return { members: b.members.length, weeks: b.weeks.length, results: b.clash_results.length };
}
