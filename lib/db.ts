import postgres from "postgres";

// The app's single Supabase Postgres connection pool, resolved once from
// DATABASE_URL (a pooled `:6543` postgresql:// URI). There is no second engine
// and no local file database: no URL means demo mode, which lib/data.ts decides.
//
// Two things here are load-bearing:
//
//   1. The pool lives on `globalThis`, not a module `const`. Next's dev server
//      re-evaluates modules on every HMR reload, and a module-level pool would
//      leak one pool per reload until Supabase's pooler refuses connections.
//   2. The URI carries the database password, so it is never logged, returned to
//      a client, rendered, or put in an error message.
//
// Deliberately free of filesystem I/O: every page render goes through here.

// postgres.js's client type. Re-exported so nothing else in the app imports
// `postgres` directly. Named `Sql` in node_modules/postgres/types/index.d.ts:701
// (`interface Sql<TTypes> extends ISql<TTypes>`), which is what the `postgres()`
// factory returns (same file, :8 and :18).
export type Db = postgres.Sql;

// Not exported as a value anywhere: callers get a client, never the URI.
const dbGlobal = globalThis as typeof globalThis & { __raidClashDb?: Db };

export function databaseUrl(): string | null {
  // Blank counts as unset: a commented-out or emptied line in .env.local should
  // land in demo mode like an absent one, not in an error page.
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : null;
}

export function getDb(): Db {
  const url = databaseUrl();
  if (!url) {
    // No URL in the message — it would not exist anyway, but keep the habit.
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local, point DATABASE_URL " +
        "at your Supabase pooled connection, then run `npm run db:migrate`.",
    );
  }
  return (dbGlobal.__raidClashDb ??= postgres(url, {
    // Mandatory on Supabase's transaction pooler: it multiplexes connections
    // and has no place to keep a prepared statement between queries.
    prepare: false,
    max: 3, // one local reader; the pooler is shared with everything else
    idle_timeout: 20, // seconds — release pooler slots between page loads
    connect_timeout: 15, // seconds — fail loudly instead of hanging a render
    // postgres.js's default dumps the whole notice object (8 lines each), which
    // buries `npm run db:migrate`'s "already exists, skipping" output. Notices
    // carry no connection detail, so one line each is safe and readable.
    onnotice: (n) => console.log(`postgres ${n.severity} ${n.code}: ${n.message}`),
  }));
}

// Closes the pool so a CLI entry's process can exit. Web requests never call it.
export async function closeDb(): Promise<void> {
  const sql = dbGlobal.__raidClashDb;
  if (!sql) return;
  dbGlobal.__raidClashDb = undefined;
  await sql.end();
}
