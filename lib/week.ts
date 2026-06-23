// Determine the "current" clash week from the existing weeks' cadence.
// RAID clash weeks run 7 days but don't start on ISO Monday, so we anchor on
// the latest known week's actual start date and step forward in whole weeks.
import type { Week } from "./types";

const DAY = 86_400_000;

function toUtcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function addDaysIso(startMs: number, days: number): string {
  return new Date(startMs + days * DAY).toISOString().slice(0, 10);
}

export interface CurrentWeek {
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export function currentWeekFromCadence(weeks: Week[], today: Date = new Date()): CurrentWeek {
  const todayMs = toUtcMidnight(today);

  if (weeks.length) {
    const anchor = [...weeks].sort((a, b) => b.weekNumber - a.weekNumber)[0];
    const anchorMs = toUtcMidnight(new Date(anchor.startDate));
    const weeksSince = Math.max(0, Math.floor((todayMs - anchorMs) / (7 * DAY)));
    const startMs = anchorMs + weeksSince * 7 * DAY;
    return {
      weekNumber: anchor.weekNumber + weeksSince,
      startDate: addDaysIso(startMs, 0),
      endDate: addDaysIso(startMs, 6),
    };
  }

  // No weeks yet: fall back to the ISO week number, Monday–Sunday.
  const dow = (new Date(todayMs).getUTCDay() + 6) % 7; // 0 = Monday
  const mondayMs = todayMs - dow * DAY;
  const jan1 = Date.UTC(new Date(todayMs).getUTCFullYear(), 0, 1);
  const isoWeek = Math.floor((todayMs - jan1) / (7 * DAY)) + 1;
  return {
    weekNumber: isoWeek,
    startDate: addDaysIso(mondayMs, 0),
    endDate: addDaysIso(mondayMs, 6),
  };
}
