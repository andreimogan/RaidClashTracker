// Server-only: export / restore / reset the clan data in Supabase Postgres.
// resetDatabase and restoreBackup each run in ONE transaction, so a failure
// never leaves the database half-wiped.
import { getDb, type Db } from "./db";

const TABLES = ["members", "weeks", "clash_results", "clash_meta"] as const;

// Children before parents (FK order). The cascades would cover it, but staying
// explicit keeps the intent readable.
const WIPE_ORDER = ["clash_results", "clash_meta", "weeks", "members"] as const;

export interface Backup {
  app: "raid-clash-tracker";
  version: number;
  exportedAt: string;
  members: Record<string, unknown>[];
  weeks: Record<string, unknown>[];
  clash_results: Record<string, unknown>[];
  clash_meta: Record<string, unknown>[];
}

type Row = Record<string, unknown>;
const num = (v: unknown, d = 0) => (v == null ? d : Number(v));
const str = (v: unknown) => (v == null ? null : String(v));

export async function exportBackup(): Promise<Backup> {
  // One read-only transaction, for the same two reasons as lib/data.ts: a
  // `Promise.all` of four queries deadlocks postgres.js against the transaction
  // pooler once it exceeds the pool's `max`, and a backup should be a single
  // consistent snapshot rather than four independently-timed reads.
  //
  // Table names come from the const tuple above, never from a request, and go
  // through postgres.js's identifier helper (`sql(name)` → "name") rather than
  // string concatenation.
  const [members, weeks, clash_results, clash_meta] = await getDb().begin("read only", (sql) =>
    TABLES.map((t) => sql<Record<string, unknown>[]>`select * from ${sql(t)}`),
  );
  return {
    app: "raid-clash-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    members: [...members],
    weeks: [...weeks],
    // total_damage is a `bigint` column, which postgres.js hands back as a
    // string. Coerce it so the backup file keeps a JSON *number* there, as it
    // always has (values top out near 5.8e10, far inside Number's safe range).
    clash_results: clash_results.map((r) => ({ ...r, total_damage: num(r.total_damage) })),
    clash_meta: [...clash_meta],
  };
}

export async function resetDatabase(client?: Db): Promise<void> {
  const db = client ?? getDb();
  await db.begin(async (sql) => {
    for (const t of WIPE_ORDER) await sql`delete from ${sql(t)}`;
  });
}

// Two backup vintages must both restore, because the owner's archived export is
// the input for the real-data import: the pre-port files carry `is_active` as
// 1/0 and `created_at` as "2026-08-12 10:00:00", the current ones carry
// true/false and ISO-8601.
//
// created_at needs care. postgres.js serializes whatever you bind to a
// timestamptz parameter through `new Date(value)` — src/connection.js:958-961
// looks up options.serializers by the *server-described* OID, and src/types.js
// registers the date serializer for 1082/1114/1184 — and V8 reads the
// space-separated form as LOCAL time, which silently shifted every archived
// timestamp by the machine's UTC offset (measured: 10:00 stored as 07:00Z). The
// old writer emitted UTC, so a value with no zone marker means UTC. Say so.
const ts = (v: unknown): Date | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  const raw = String(v).trim();
  const zoned = /([zZ]|[+-]\d{2}(:?\d{2})?)$/.test(raw) ? raw : raw.replace(" ", "T") + "Z";
  const d = new Date(zoned);
  return Number.isNaN(d.getTime()) ? null : d; // unparseable → the coalesce's now()
};

const bool = (v: unknown, d = true): boolean => {
  if (v == null || v === "") return d;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "t" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "f" || s === "no") return false;
  return d;
};

export async function restoreBackup(data: unknown): Promise<{ members: number; weeks: number; results: number }> {
  const b = data as Partial<Backup>;
  if (
    !b || typeof b !== "object" ||
    !Array.isArray(b.members) || !Array.isArray(b.weeks) || !Array.isArray(b.clash_results)
  ) {
    throw new Error("Not a valid backup file (expected members, weeks, clash_results arrays).");
  }

  const members = (b.members as Row[]).map((m) => ({
    id: str(m.id),
    in_game_name: str(m.in_game_name),
    level: num(m.level),
    hero_level: num(m.hero_level),
    avatar_url: str(m.avatar_url),
    is_active: bool(m.is_active),
    created_at: ts(m.created_at),
  }));

  const weeks = (b.weeks as Row[]).map((w) => ({
    id: str(w.id),
    week_number: num(w.week_number),
    start_date: str(w.start_date),
    end_date: str(w.end_date),
  }));

  const results = (b.clash_results as Row[]).map((r) => ({
    id: str(r.id),
    week_id: str(r.week_id),
    member_id: str(r.member_id),
    clash_type: str(r.clash_type),
    keys_used: num(r.keys_used),
    total_damage: num(r.total_damage),
  }));

  const meta = ((b.clash_meta ?? []) as Row[]).map((m) => ({
    week_id: str(m.week_id),
    clash_type: str(m.clash_type),
    progress: num(m.progress),
  }));

  await getDb().begin(async (sql) => {
    for (const t of WIPE_ORDER) await sql`delete from ${sql(t)}`;

    // Members go one row at a time so created_at can keep its coalesce: an
    // absent or unparseable timestamp becomes now(), and both the old
    // "YYYY-MM-DD HH:MM:SS" text and the new ISO-8601 form cast cleanly.
    for (const m of members) {
      await sql`
        insert into members (id, in_game_name, level, hero_level, avatar_url, is_active, created_at)
        values (${m.id}, ${m.in_game_name}, ${m.level}, ${m.hero_level}, ${m.avatar_url},
                ${m.is_active}, coalesce(${m.created_at}::timestamptz, now()))
      `;
    }

    for (const batch of chunks(weeks)) {
      await sql`insert into weeks ${sql(batch, "id", "week_number", "start_date", "end_date")}`;
    }
    for (const batch of chunks(results)) {
      await sql`insert into clash_results ${sql(
        batch, "id", "week_id", "member_id", "clash_type", "keys_used", "total_damage",
      )}`;
    }
    for (const batch of chunks(meta)) {
      await sql`insert into clash_meta ${sql(batch, "week_id", "clash_type", "progress")}`;
    }
  });

  return { members: b.members.length, weeks: b.weeks.length, results: b.clash_results.length };
}

// Postgres caps a statement at 65535 bind parameters — chunk the bulk inserts.
function chunks<T>(items: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
