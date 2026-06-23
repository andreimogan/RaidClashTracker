// Shared upsert logic used by the seed, CSV import, and RTK sync scripts.
import { admin, type NormalizedRow } from "./admin";

export interface WeekInfo {
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface ProgressInfo {
  weekNumber: number;
  clashType: "hydra" | "chimera";
  progress: number;
}

const slug = (name: string) =>
  "m-" + name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

const weekId = (n: number) => `w${n}`;

export async function persist(
  rows: NormalizedRow[],
  weeks: WeekInfo[],
  progress: ProgressInfo[] = [],
) {
  // 1) Upsert members (preserve existing level/hero data; only set name on create).
  const members = [...new Map(rows.map((r) => [r.memberName, r.memberName])).keys()].map(
    (name) => ({ id: slug(name), in_game_name: name }),
  );
  let res = await admin.from("members").upsert(members, { onConflict: "id" });
  if (res.error) throw res.error;

  // 2) Upsert weeks.
  const weekRows = weeks.map((w) => ({
    id: weekId(w.weekNumber),
    week_number: w.weekNumber,
    start_date: w.startDate,
    end_date: w.endDate,
  }));
  res = await admin.from("weeks").upsert(weekRows, { onConflict: "id" });
  if (res.error) throw res.error;

  // 3) Upsert clash results (idempotent on week+member+clash).
  const resultRows = rows.map((r) => ({
    id: `${weekId(r.weekNumber)}-${slug(r.memberName)}-${r.clashType}`,
    week_id: weekId(r.weekNumber),
    member_id: slug(r.memberName),
    clash_type: r.clashType,
    keys_used: r.keysUsed,
    total_damage: r.totalDamage,
  }));
  res = await admin.from("clash_results").upsert(resultRows, { onConflict: "id" });
  if (res.error) throw res.error;

  // 4) Upsert per-clash progress meta when provided.
  if (progress.length) {
    const metaRows = progress.map((p) => ({
      week_id: weekId(p.weekNumber),
      clash_type: p.clashType,
      progress: p.progress,
    }));
    res = await admin.from("clash_meta").upsert(metaRows, { onConflict: "week_id,clash_type" });
    if (res.error) throw res.error;
  }

  console.log(
    `Upserted ${members.length} members, ${weekRows.length} weeks, ${resultRows.length} results.`,
  );
}
