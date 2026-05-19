import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer } from "recharts";

export interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  delta: number;
  positiveIsGood?: boolean;
  icon: LucideIcon;
  spark: { v: number }[];
  accent?: "primary" | "warning" | "destructive";
  /** Fleet median benchmark for this metric (shown under the headline value). */
  medianBenchmark?: { value: string; lowerIsBetter?: boolean; numericValue?: number };
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  positiveIsGood = false,
  icon: Icon,
  spark,
  accent = "primary",
  medianBenchmark,
}: KpiCardProps) {
  const good = positiveIsGood ? delta >= 0 : delta <= 0;
  const tone =
    accent === "destructive"
      ? "text-destructive bg-destructive/10 ring-destructive/25"
      : accent === "warning"
        ? "text-warning bg-warning/10 ring-warning/25"
        : "text-primary bg-primary/10 ring-primary/25";

  const colorVar =
    accent === "destructive"
      ? "var(--color-destructive)"
      : accent === "warning"
        ? "var(--color-warning)"
        : "var(--color-primary)";

  const gradId = `kpi-grad-${label.replace(/\s+/g, "-")}`;

  return (
    <div
      className="accent-bar-top card-interactive group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-elevated"
      style={{ "--accent-color": colorVar } as React.CSSProperties}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: colorVar }}
        aria-hidden
      />

      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="section-label">{label}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="num text-[27px] font-semibold tracking-tight text-foreground">{value}</span>
            {unit && <span className="text-[12px] font-medium text-muted-foreground">{unit}</span>}
          </div>
          {medianBenchmark && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-0.5 rounded-full bg-muted-foreground/60" />
              <span>
                Median{" "}
                <span className="num font-medium text-foreground">{medianBenchmark.value}</span>
              </span>
            </div>
          )}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${tone}`}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold num ${
            good ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"
          }`}
        >
          {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}%
          <span className="ml-0.5 font-normal opacity-65">vs prev</span>
        </div>

        <div className="h-11 w-[7.5rem] opacity-95">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={colorVar} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={colorVar} stopOpacity={0} />
                </linearGradient>
              </defs>
              {medianBenchmark?.numericValue != null && (
                <ReferenceLine
                  y={medianBenchmark.numericValue}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              )}
              <Area
                type="monotone"
                dataKey="v"
                stroke={colorVar}
                strokeWidth={1.75}
                fill={`url(#${gradId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
