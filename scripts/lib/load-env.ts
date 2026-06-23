// Side-effect module: load .env.local before anything reads process.env.
// Import this FIRST in every CLI entry so DATABASE_URL / GOOGLE_SHEET_URL are
// available before lib/db evaluates. Local default (file:data/clash.db) needs none.
import { config } from "dotenv";

config({ path: ".env.local" });
