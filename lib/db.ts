import { createClient, type Client } from "@libsql/client";

// Local SQLite (libSQL) connection. Defaults to a local file so the app runs
// with zero configuration; point DATABASE_URL at a hosted Turso DB later to
// share online — no code change required.
export const DATABASE_URL = process.env.DATABASE_URL || "file:data/clash.db";

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    client = createClient({
      url: DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN, // only needed for remote (Turso)
      intMode: "number", // damage values stay well under Number.MAX_SAFE_INTEGER
    });
  }
  return client;
}

export const isRemoteDb = !DATABASE_URL.startsWith("file:");
