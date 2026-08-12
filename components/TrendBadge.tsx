import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatPct } from "@/lib/format";

// Signed trend indicator. `null` = no comparable baseline (e.g. a member's first
// tracked week) and renders an em-dash instead of a misleading flat 0%.
// The dash is `text-muted`, deliberately NOT the `text-faint` of an absent-week
// cell: "present, but nothing to compare against" is a different state from "no
// data this week", and text-faint (#586478) fails WCAG AA on the card gradient at
// the 10.5px that `text-sm` becomes under the global 75% root font size.
export function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  if (Math.abs(value) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-faint">
        <Minus size={14} /> 0%
      </span>
    );
  }
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${up ? "text-up" : "text-down"}`}
    >
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {formatPct(value, true)}
    </span>
  );
}
