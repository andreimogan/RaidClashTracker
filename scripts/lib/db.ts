// libSQL client for local data scripts (seed / CSV import / RTK sync).
// Defaults to the local file; set DATABASE_URL (+ DATABASE_AUTH_TOKEN) to write
// to a hosted Turso DB instead. dotenv loads .env.local if present (optional).
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

export const DATABASE_URL = process.env.DATABASE_URL || "file:data/clash.db";

export const db = createClient({
  url: DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
  intMode: "number",
});

export type NormalizedRow = {
  weekNumber: number;
  memberName: string;
  clashType: "hydra" | "chimera";
  keysUsed: number;
  totalDamage: number;
};
