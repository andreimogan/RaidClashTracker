// Seeds the database with the bundled sample dataset (same data the app shows in
// demo mode). Run after `npm run db:migrate`: `npm run seed`.
//
// Note: the samples occupy weeks 20-24 — skip this if you are importing real
// weeks that overlap them.
import "./lib/load-env";
import { closeDb, getDb } from "../lib/db";
import { seedDemo } from "../lib/seed";

seedDemo(getDb())
  .then((s) => {
    console.log(`Seed complete: ${s.results} results across weeks ${s.weekNumbers.join(", ")}.`);
  })
  .catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  // Close the pool or the process keeps the pooler connection open and hangs.
  .finally(() => closeDb());
