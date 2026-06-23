// Clash schedule math (all UTC). Dates are date-only ISO (YYYY-MM-DD); the
// times below only decide which week is "current", they are not displayed.
//
//   Hydra:   starts Wednesday 14:00 UTC, ends the following Wednesday 08:00 UTC.
//   Chimera: starts Friday 11:30 UTC,    ends the following Thursday 11:30 UTC.
//
// A week number N is anchored on its Hydra Wednesday; that week's Chimera starts
// the Friday two days later (same calendar week).
import type { ClashType, Week } from "./types";

const DAY = 86_400_000;
const HOUR = 3_600_000;

const utcMidnight = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// Snap a date (ms at UTC midnight) back to the most recent Wednesday.
function snapToWednesday(midMs: number): number {
  const day = new Date(midMs).getUTCDay(); // 0=Sun … 3=Wed
  const delta = (day - 3 + 7) % 7;
  return midMs - delta * DAY;
}

// Date (UTC midnight ms) of the Hydra Wednesday for the clash currently running
// (or most recently started): most recent Wednesday whose 14:00 UTC start ≤ now.
function currentHydraWednesday(now: Date): number {
  let wedMid = snapToWednesday(utcMidnight(now));
  if (now.getTime() < wedMid + 14 * HOUR) wedMid -= 7 * DAY;
  return wedMid;
}

export interface CurrentWeek {
  weekNumber: number;
  startDate: string; // canonical Hydra window start (Wednesday)
  endDate: string; // following Wednesday
}

// Per-clash display window (date-only) from the week's Hydra Wednesday.
export function clashWindow(
  weekWednesdayISO: string,
  clashType: ClashType,
): { startDate: string; endDate: string } {
  const wed = utcMidnight(new Date(weekWednesdayISO));
  if (clashType === "hydra") {
    return { startDate: iso(wed), endDate: iso(wed + 7 * DAY) };
  }
  // Chimera: Friday (Wed+2) → following Thursday (Wed+8).
  return { startDate: iso(wed + 2 * DAY), endDate: iso(wed + 8 * DAY) };
}

// The Hydra Wednesday for an arbitrary week number, from a known anchor pair.
export function weekWednesday(anchorNumber: number, anchorWedISO: string, n: number): string {
  const anchorWed = snapToWednesday(utcMidnight(new Date(anchorWedISO)));
  return iso(anchorWed + (n - anchorNumber) * 7 * DAY);
}

// Current clash week: canonical Hydra window + week number derived from the
// latest stored week's (number ↔ Wednesday) anchor.
export function currentWeek(weeks: Week[], now: Date = new Date()): CurrentWeek {
  const wedMid = currentHydraWednesday(now);
  const startDate = iso(wedMid);
  const endDate = iso(wedMid + 7 * DAY);

  if (weeks.length) {
    const anchor = [...weeks].sort((a, b) => b.weekNumber - a.weekNumber)[0];
    const anchorWed = snapToWednesday(utcMidnight(new Date(anchor.startDate)));
    const offset = Math.round((wedMid - anchorWed) / (7 * DAY));
    return { weekNumber: anchor.weekNumber + offset, startDate, endDate };
  }

  // Empty DB: fall back to an ISO-week-ish number so something sensible shows.
  const jan1 = Date.UTC(new Date(wedMid).getUTCFullYear(), 0, 1);
  const weekNumber = Math.floor((wedMid - jan1) / (7 * DAY)) + 1;
  return { weekNumber, startDate, endDate };
}
