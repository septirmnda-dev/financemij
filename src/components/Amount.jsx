import { cn } from "@/lib/utils";
import { formatSigned, formatCurrency } from "@/lib/format";

export function Amount({ value, className, showSign = true }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "tabular-nums font-medium",
        positive ? "text-emerald-600" : "text-rose-500",
        className
      )}
    >
      {showSign ? formatSigned(value) : formatCurrency(value)}
    </span>
  );
}