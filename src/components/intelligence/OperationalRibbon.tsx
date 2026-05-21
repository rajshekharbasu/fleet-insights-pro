import { motion } from "framer-motion";
import { Activity, AlertTriangle, BatteryCharging, Bolt, Flame, Gauge, ShieldCheck, Sparkles, Waves, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

export interface RibbonKpi {
  id: string;
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  severity: "healthy" | "warning" | "critical";
  spark: { v: number }[];
  insight: string;
  icon: LucideIcon;
}

const ICONS: Record<string, LucideIcon> = {
  fleet: ShieldCheck,
  charger: Bolt,
  depot: Activity,
  active: BatteryCharging,
  abChg: AlertTriangle,
  abBus: AlertTriangle,
  stability: Waves,
  eff: Gauge,
  thermal: Flame,
  delivery: Zap,
};

const SEV_COLOR: Record<RibbonKpi["severity"], string> = {
  healthy: "var(--color-success)",
  warning: "var(--color-warning)",
  critical: "var(--color-destructive)",
};

function KpiTile({ k, idx }: { k: RibbonKpi; idx: number }) {
  const color = SEV_COLOR[k.severity];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03, duration: 0.35, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-4 backdrop-blur-xl transition-all hover:border-primary/40 hover:shadow-elevated"
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-50"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg ring-1"
            style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, color, borderColor: color }}
          >
            <k.icon className="h-3.5 w-3.5" />
          </div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {k.label}
          </div>
        </div>
        {typeof k.delta === "number" && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
            style={{
              color: k.delta >= 0 ? "var(--color-success)" : "var(--color-destructive)",
              background: `color-mix(in oklab, ${k.delta >= 0 ? "var(--color-success)" : "var(--color-destructive)"} 12%, transparent)`,
            }}
          >
            {k.delta >= 0 ? "+" : ""}
            {k.delta.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="relative mt-3 flex items-end justify-between gap-2">
        <div className="num text-[22px] font-semibold leading-none tracking-tight">
          {k.value}
          {k.unit && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{k.unit}</span>}
        </div>
        <div className="h-10 w-20 opacity-90">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={k.spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`grad-${k.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#grad-${k.id})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="relative mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
        <Sparkles className="mr-1 inline h-3 w-3 text-primary/80" />
        {k.insight}
      </p>
    </motion.div>
  );
}

export function OperationalRibbon({ kpis }: { kpis: RibbonKpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
      {kpis.map((k, i) => (
        <KpiTile key={k.id} k={k} idx={i} />
      ))}
    </div>
  );
}

export { ICONS as RibbonIcons };
