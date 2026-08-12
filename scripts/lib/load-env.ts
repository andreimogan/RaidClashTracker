// Side-effect module: load .env.local before anything reads process.env.
// Import this FIRST in every CLI entry so DATABASE_URL is available before
// lib/db evaluates. There is no default: without it every CLI entry fails.
import { config } from "dotenv";

config({ path: ".env.local" });
