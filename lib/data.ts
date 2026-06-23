// Loads the dataset from Supabase when configured, otherwise the seed data.
import type { Dataset } from "./compute";
import { CLASH_META, CLASH_RESULTS, MEMBERS, WEEKS } from "./mock-data";
import { getSupabase } from "./supabase";
import type { ClashMeta, ClashResult, Member, Week } from "./types";

function mockDataset(): Dataset {
  return { members: MEMBERS, weeks: WEEKS, results: CLASH_RESULTS, meta: CLASH_META };
}

export async function loadDataset(): Promise<Dataset> {
  const supabase = getSupabase();
  if (!supabase) return mockDataset();

  const [membersRes, weeksRes, resultsRes, metaRes] = await Promise.all([
    supabase.from("members").select("*"),
    supabase.from("weeks").select("*"),
    supabase.from("clash_results").select("*"),
    supabase.from("clash_meta").select("*"),
  ]);

  // Fall back to seed data if the schema isn't there yet / query failed.
  if (membersRes.error || weeksRes.error || resultsRes.error) {
    return mockDataset();
  }

  const members: Member[] = (membersRes.data ?? []).map((m) => ({
    id: m.id,
    inGameName: m.in_game_name,
    level: m.level,
    heroLevel: m.hero_level,
    avatarUrl: m.avatar_url,
    isActive: m.is_active,
  }));
  const weeks: Week[] = (weeksRes.data ?? []).map((w) => ({
    id: w.id,
    weekNumber: w.week_number,
    startDate: w.start_date,
    endDate: w.end_date,
  }));
  const results: ClashResult[] = (resultsRes.data ?? []).map((r) => ({
    id: r.id,
    weekId: r.week_id,
    memberId: r.member_id,
    clashType: r.clash_type,
    keysUsed: Number(r.keys_used),
    totalDamage: Number(r.total_damage),
  }));
  const meta: ClashMeta[] = (metaRes.data ?? []).map((m) => ({
    weekId: m.week_id,
    clashType: m.clash_type,
    progress: Number(m.progress),
  }));

  if (!members.length || !weeks.length) return mockDataset();
  return { members, weeks, results, meta };
}
