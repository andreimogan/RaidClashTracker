import postgres from "postgres";

// The app's single Supabase Postgres connection pool, resolved once from the
// first non-blank of DATABASE_URL then POSTGRES_URL (a pooled `:6543`
// postgresql:// URI). There is no second engine and no local file database:
// no URL at all means demo mode, which lib/data.ts decides.
//
// Three things here are load-bearing:
//
//   1. The pool lives on `globalThis`, not a module `const`. Next's dev server
//      re-evaluates modules on every HMR reload, and a module-level pool would
//      leak one pool per reload until Supabase's pooler refuses connections.
//   2. The URI carries the database password, so it is never logged, returned to
//      a client, rendered, or put in an error message. That includes the port
//      warning below, which names the port and the variable and nothing else.
//   3. DATABASE_URL wins over POSTGRES_URL. Local `.env.local` and every CLI
//      script under scripts/ set DATABASE_URL, so they behave exactly as before,
//      and an explicitly set value always beats the platform's copy.
//
// Deliberately free of filesystem I/O: every page render goes through here.

// Resolution order — first non-blank wins:
//
//   DATABASE_URL   the explicit one. `.env.local`, CI, and the CLI scripts.
//   POSTGRES_URL   what the Supabase/Vercel integration creates; the deployed
//                  app has this and no DATABASE_URL unless one is set by hand.
//
// DELIBERATELY EXCLUDED — the integration also sets these two, and neither is
// ever read here. They are named because the next reader debugging a connection
// problem will reach for exactly them:
//
//   POSTGRES_URL_NON_POOLING   the DIRECT 5432 connection, bypassing the pooler.
//                              On serverless it opens one real Postgres
//                              connection per invocation and holds it, so a
//                              burst of renders exhausts the project's
//                              connection limit and the site starts erroring.
//   POSTGRES_PRISMA_URL        the same pooled endpoint with Prisma-specific
//                              query parameters (connection_limit, pgbouncer=…)
//                              bolted on. We use postgres.js, not Prisma; those
//                              parameters mean nothing to it.
const CONNECTION_VARS = ["DATABASE_URL", "POSTGRES_URL"] as const;

// The pooled endpoint. Not an assumption we act on: Vercel's marketplace page
// says POSTGRES_URL is the transaction pooler, Supabase's own integration doc
// says nothing about ports — so the port is checked and reported, never trusted.
const POOLED_PORT = "6543";

// postgres.js's client type. Re-exported so nothing else in the app imports
// `postgres` directly. Named `Sql` in node_modules/postgres/types/index.d.ts:701
// (`interface Sql<TTypes> extends ISql<TTypes>`), which is what the `postgres()`
// factory returns (same file, :8 and :18).
export type Db = postgres.Sql;

// Not exported as a value anywhere: callers get a client, never the URI.
// `__raidClashPortChecked` rides on the same object for the same reason the pool
// does — it must survive HMR, or the port warning would repeat once per reload.
const dbGlobal = globalThis as typeof globalThis & {
  __raidClashDb?: Db;
  __raidClashPortChecked?: boolean;
};

// Which variable supplied the URI, kept alongside it so the port warning can say
// where to go and fix it. Internal: nothing outside this file sees the URI.
function resolveConnection(): { name: string; url: string } | null {
  for (const name of CONNECTION_VARS) {
    // Blank counts as unset: a commented-out or emptied line in .env.local (or an
    // empty string left behind in a Vercel environment) should land in demo mode
    // like an absent one, not in an error page — and must not shadow the next
    // name in the chain.
    const url = process.env[name]?.trim();
    if (url) return { name, url };
  }
  return null;
}

// Reports a connection string that is not on the pooled port, once per process.
// It does NOT throw: a session-pooler or direct URI still works here (`prepare:
// false` is unconditional), and a site that is up on the wrong port beats a site
// that is down. Nothing from the URI but the port number is ever printed — no
// host, user, password or project ref.
function warnIfNotPooledPort(conn: { name: string; url: string }): void {
  // Checked once per process, not once per render: getDb() is on every page's
  // path, and this is the only work here that isn't a property read.
  if (dbGlobal.__raidClashPortChecked) return;
  dbGlobal.__raidClashPortChecked = true;

  let port: string;
  try {
    port = new URL(conn.url).port;
  } catch {
    // Unparseable URI. Say nothing — postgres.js will fail on its own terms, and
    // anything we printed here would risk echoing the string back out.
    return;
  }
  if (port === POOLED_PORT) return;

  // No explicit port means Postgres's default 5432, i.e. not the pooler either.
  const effective = port === "" ? "5432 (implicit, no port in the URI)" : port;
  console.warn(
    `lib/db.ts: ${conn.name} points at port ${effective}, not the pooled ` +
      `${POOLED_PORT} this app expects. Continuing — but the direct port opens one ` +
      `connection per serverless invocation and will exhaust the project's limit. ` +
      `Check the transaction-pooler URI in the Supabase connection panel.`,
  );
}

export function databaseUrl(): string | null {
  return resolveConnection()?.url ?? null;
}

export function getDb(): Db {
  const conn = resolveConnection();
  if (!conn) {
    // No URL in the message — it would not exist anyway, but keep the habit.
    throw new Error(
      "DATABASE_URL is not set, and neither is POSTGRES_URL (the name the " +
        "Supabase/Vercel integration creates). Locally: copy .env.example to " +
        ".env.local and point DATABASE_URL at your Supabase pooled (:6543) " +
        "connection, then run `npm run db:migrate`. On a deployment: POSTGRES_URL " +
        "comes from the Supabase integration — if it is missing, reconnect the " +
        "integration or set DATABASE_URL on the project yourself.",
    );
  }
  warnIfNotPooledPort(conn);
  return (dbGlobal.__raidClashDb ??= postgres(conn.url, {
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
