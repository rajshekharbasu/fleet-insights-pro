import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { CommandKpiCard } from "@/lib/charger-analytics";
import { DeltaBadge, InsightTooltip, MiniSparkline, SeverityDot } from "./primitives";

export function CommandRibbon({ kpis }: { kpis: CommandKpiCard[] }) {
  return (
    <div className="cc-ribbon -mx-1 flex gap-3 overflow-x-auto pb-2 pt-1">
      {kpis.map((k) => (
        <div
          key={k.id}
          className="cc-kpi-card group relative min-w-[168px] shrink-0 rounded-2xl border border-border/40 p-4 transition-all hover:border-primary/40"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {k.label}
            </span>
            <div className="flex items-center gap-1.5">
              <SeverityDot level={k.severity} />
              <InsightTooltip text={k.insight} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="num text-[24px] font-semibold tracking-tight">{k.value}</span>
            {k.unit && <span className="text-[11px] text-muted-foreground">{k.unit}</span>}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <DeltaBadge delta={k.delta} positiveIsGood={k.positiveIsGood} />
            <MiniSparkline values={k.spark.map((s) => s.v)} />
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={k.spark}>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="transparent"
                  fill="var(--color-primary)"
                  fillOpacity={0.06}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
