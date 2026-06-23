// Service-role Supabase client for local data scripts.
// NEVER import this into the Next.js app — the service key bypasses RLS and
// must stay on your machine (set via .env.local, loaded by dotenv below).
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "Find them in Supabase → Project Settings → API.",
  );
  process.exit(1);
}

export const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

export type NormalizedRow = {
  weekNumber: number;
  memberName: string;
  clashType: "hydra" | "chimera";
  keysUsed: number;
  totalDamage: number;
};
