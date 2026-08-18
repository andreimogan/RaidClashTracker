// Loads the dataset from Supabase Postgres. Falls back to the bundled demo data
// under exactly two conditions (see loadDataset) — never merely because a query
// failed, because a broken connection rendering fake clan numbers as real is the
// bug this data path exists to prevent.
import type { Dataset } from "./compute";
import { databaseUrl, getDb } from "./db";
import { CLASH_META, CLASH_RESULTS, MEMBERS, WEEKS } from "./mock-data";
import type { ClashMeta, ClashResult, Member, Week } from "./types";

export type DataSource = "postgres" | "demo";

// Postgres undefined_table. Raised on every table in the query when the
// migrations have not been applied yet.
const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === UNDEFINED_TABLE;
}

function mockDataset(): Dataset {
  return { members: MEMBERS, weeks: WEEKS, results: CLASH_RESULTS, meta: CLASH_META };
}

// Row shapes as postgres.js hands them back. The JS types are not the column
// types: `bigint` arrives as a *string* and `timestamptz` as a Date, which is
// why the mappers below are the single coercion boundary for the whole app.
type MemberRow = {
  id: string;
  in_game_name: string;
  level: number;
  hero_level: number;
  avatar_url: string | null;
  is_active: boolean;
  is_benched: boolean;
  created_at: Date;
};
type WeekRow = { id: string; week_number: number; start_date: string; end_date: string };
type ResultRow = {
  id: string;
  week_id: string;
  member_id: string;
  clash_type: string;
  keys_used: number;
  total_damage: string; // bigint
};
type MetaRow = { week_id: string; clash_type: string; progress: number };

// Returns null only for the two demo conditions; every other failure throws.
async function queryDb(): Promise<Dataset | null> {
  // No database configured at all — the zero-config demo case.
  if (databaseUrl() === null) return null;

  try {
    // All four reads go through ONE read-only transaction, which matters twice
    // over:
    //
    //   * Connection safety. postgres.js 3.4.9 against Supabase's transaction
    //     pooler deadlocks when more queries are in flight than the pool's `max`
    //     and a connection is already established — measured, 100% reproducible
    //     (`Promise.all` of these same four queries with max: 3 never resolves).
    //     A transaction reserves one connection and pipelines the queries on it,
    //     so the query concurrency is 1 no matter how many renders overlap;
    //     queueing whole transactions past `max` is safe.
    //   * Consistency. The four tables are read from one snapshot, so an import
    //     landing mid-render can't produce results pointing at a week we didn't
    //     read.
    const [members, weeks, results, meta] = await getDb().begin("read only", (sql) => [
      sql<MemberRow[]>`select * from members`,
      sql<WeekRow[]>`select * from weeks`,
      sql<ResultRow[]>`select * from clash_results`,
      sql<MetaRow[]>`select * from clash_meta`,
    ]);

    // The tables exist → return what's there, even if empty. A reset or a
    // freshly migrated database renders genuinely empty, not as demo data.
    return {
      members: members.map(toMember),
      weeks: weeks.map(toWeek),
      results: results.map(toResult),
      meta: meta.map(toMeta),
    };
  } catch (err) {
    // Tables not created yet (before `npm run db:migrate`) — fall back to demo.
    if (isUndefinedTable(err)) return null;
    // Anything else — wrong password (28P01), DNS, pooler exhaustion, a paused
    // project — is a real outage. Let it reach app/error.tsx.
    throw err;
  }
}

export async function loadDataset(): Promise<Dataset> {
  return (await queryDb()) ?? mockDataset();
}

// Lightweight check used by the Settings page to report where data came from.
export async function getDataSource(): Promise<DataSource> {
  return (await queryDb()) ? "postgres" : "demo";
}

const toMember = (m: MemberRow): Member => ({
  id: m.id,
  inGameName: m.in_game_name,
  level: Number(m.level),
  heroLevel: Number(m.hero_level),
  avatarUrl: m.avatar_url ?? null,
  isActive: m.is_active === true,
  // Postgres `boolean` reads back as a JS boolean here (measured for this
  // project), so no Number()-style coercion — but keep `=== true` so a row from
  // a database that has not had migration 0003 applied yet yields false rather
  // than undefined on a field the type declares required.
  isBenched: m.is_benched === true,
});

const toWeek = (w: WeekRow): Week => ({
  id: w.id,
  weekNumber: Number(w.week_number),
  startDate: w.start_date,
  endDate: w.end_date,
});

const toResult = (r: ResultRow): ClashResult => ({
  id: r.id,
  weekId: r.week_id,
  memberId: r.member_id,
  clashType: r.clash_type as ClashResult["clashType"],
  keysUsed: Number(r.keys_used),
  totalDamage: Number(r.total_damage), // bigint-as-string → number
});

const toMeta = (m: MetaRow): ClashMeta => ({
  weekId: m.week_id,
  clashType: m.clash_type as ClashMeta["clashType"],
  progress: Number(m.progress),
});
