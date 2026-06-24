// Seeds the local SQLite DB with the bundled sample dataset (same data the app
// shows in demo mode). Run after `npm run db:init`: `npm run seed`.
import "./lib/load-env";
import { getDb } from "../lib/db";
import { seedDemo } from "../lib/seed";

seedDemo(getDb())
  .then((s) => {
    console.log(`Seed complete: ${s.results} results across weeks ${s.weekNumbers.join(", ")}.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
