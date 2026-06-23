import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function TrendBadge({ value }: { value: number }) {
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
      {up ? "+" : ""}
      {value.toFixed(0)}%
    </span>
  );
}
