import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  delta: number; // percent change vs previous period
  positiveIsGood?: boolean;
  icon: LucideIcon;
  spark: { v: number }[];
  accent?: "primary" | "warning" | "destructive";
}

export function KpiCard({
  label, value, unit, delta, positiveIsGood = false, icon: Icon, spark, accent = "primary",
}: KpiCardProps) {
  const good = positiveIsGood ? delta >= 0 : delta <= 0;
  const tone =
    accent === "destructive" ? "text-destructive bg-destructive/10 ring-destructive/20"
      : accent === "warning" ? "text-warning bg-warning/10 ring-warning/20"
      : "text-primary bg-primary/10 ring-primary/20";

  const colorVar = accent === "destructive" ? "var(--color-destructive)"
    : accent === "warning" ? "var(--color-warning)"
    : "var(--color-primary)";

  const gradId = `kpi-grad-${label.replace(/\s+/g, "-")}`;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-elevated transition-colors hover:border-border">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="num text-[26px] font-semibold tracking-tight text-foreground">{value}</span>
            {unit && <span className="text-[12px] font-medium text-muted-foreground">{unit}</span>}
          </div>
        </div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium num ${
            good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}%
          <span className="ml-1 font-normal opacity-70">vs prev</span>
        </div>

        <div className="h-10 w-28 opacity-90">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={colorVar} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={colorVar} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={colorVar}
                strokeWidth={1.5}
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
