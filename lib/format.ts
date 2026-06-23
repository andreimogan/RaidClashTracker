// Formatting helpers for displaying damage, keys, percentages.

export function formatDamage(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

export function formatKeys(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

export function formatPct(value: number, withSign = false): string {
  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(0)}%`;
}

export function formatDateRange(startISO: string, endISO: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = new Date(startISO).toLocaleDateString("en-US", opts);
  const end = new Date(endISO).toLocaleDateString("en-US", opts);
  return `${start} – ${end}`;
}
