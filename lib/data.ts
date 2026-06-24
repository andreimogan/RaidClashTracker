// Loads the dataset from the local SQLite (libSQL) database when it has data,
// otherwise falls back to the bundled seed so the app always renders.
import type { Row } from "@libsql/client";
import type { Dataset } from "./compute";
import { getDb } from "./db";
import { CLASH_META, CLASH_RESULTS, MEMBERS, WEEKS } from "./mock-data";
import type { ClashMeta, ClashResult, Member, Week } from "./types";

export type DataSource = "sqlite" | "demo";

function mockDataset(): Dataset {
  return { members: MEMBERS, weeks: WEEKS, results: CLASH_RESULTS, meta: CLASH_META };
}

async function queryDb(): Promise<Dataset | null> {
  try {
    const db = getDb();
    const [members, weeks, results, meta] = await Promise.all([
      db.execute("select * from members"),
      db.execute("select * from weeks"),
      db.execute("select * from clash_results"),
      db.execute("select * from clash_meta"),
    ]);

    // Tables exist → return what's there, even if empty (e.g. after a reset).
    // Only a query error (tables missing, before `npm run db:init`) falls back
    // to the bundled demo data — see the catch below.
    return {
      members: members.rows.map(toMember),
      weeks: weeks.rows.map(toWeek),
      results: results.rows.map(toResult),
      meta: meta.rows.map(toMeta),
    };
  } catch {
    // DB file/tables missing (e.g. before `npm run db:init`) — fall back.
    return null;
  }
}

export async function loadDataset(): Promise<Dataset> {
  return (await queryDb()) ?? mockDataset();
}

// Lightweight check used by the Settings page to report where data came from.
export async function getDataSource(): Promise<DataSource> {
  return (await queryDb()) ? "sqlite" : "demo";
}

const toMember = (m: Row): Member => ({
  id: m.id as string,
  inGameName: m.in_game_name as string,
  level: Number(m.level),
  heroLevel: Number(m.hero_level),
  avatarUrl: (m.avatar_url as string | null) ?? null,
  isActive: Number(m.is_active) === 1,
});

const toWeek = (w: Row): Week => ({
  id: w.id as string,
  weekNumber: Number(w.week_number),
  startDate: w.start_date as string,
  endDate: w.end_date as string,
});

const toResult = (r: Row): ClashResult => ({
  id: r.id as string,
  weekId: r.week_id as string,
  memberId: r.member_id as string,
  clashType: r.clash_type as ClashResult["clashType"],
  keysUsed: Number(r.keys_used),
  totalDamage: Number(r.total_damage),
});

const toMeta = (m: Row): ClashMeta => ({
  weekId: m.week_id as string,
  clashType: m.clash_type as ClashMeta["clashType"],
  progress: Number(m.progress),
});
