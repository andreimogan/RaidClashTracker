import { createClient, type Client } from "@libsql/client";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Local SQLite (libSQL) connections. The app keeps two local databases —
// Production (real clan data) and Test (sandbox) — switchable from Clan
// Settings. The active choice is persisted in a small pointer file so it
// survives restarts and applies to every server request.
//
// Setting DATABASE_URL explicitly (e.g. a hosted Turso DB) overrides the
// toggle and pins the app to that single database — no code change needed.

export type DbEnv = "production" | "test";

export const DB_FILES: Record<DbEnv, string> = {
  production: "file:data/clash.db",
  test: "file:data/clash-test.db",
};

const POINTER_PATH = "data/active-db.json";

// True when DATABASE_URL is set — switching is disabled (single pinned DB).
export const isEnvOverride = !!process.env.DATABASE_URL;

export function dbUrlFor(env: DbEnv): string {
  return process.env.DATABASE_URL || DB_FILES[env];
}

export function activeEnv(): DbEnv {
  if (isEnvOverride) return "production";
  try {
    const parsed = JSON.parse(readFileSync(POINTER_PATH, "utf8")) as { active?: string };
    return parsed.active === "test" ? "test" : "production";
  } catch {
    return "production"; // pointer missing/unreadable → default DB
  }
}

export function setActiveEnv(env: DbEnv): void {
  mkdirSync("data", { recursive: true });
  writeFileSync(POINTER_PATH, JSON.stringify({ active: env }, null, 2));
}

export function activeDbUrl(): string {
  return dbUrlFor(activeEnv());
}

export function isRemoteDb(): boolean {
  return !activeDbUrl().startsWith("file:");
}

// One client per resolved URL, created lazily and reused.
const clients = new Map<string, Client>();

export function getDbFor(env: DbEnv): Client {
  const url = dbUrlFor(env);
  let client = clients.get(url);
  if (!client) {
    client = createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN, // only needed for remote (Turso)
      intMode: "number", // damage values stay well under Number.MAX_SAFE_INTEGER
    });
    clients.set(url, client);
  }
  return client;
}

export function getDb(): Client {
  return getDbFor(activeEnv());
}
