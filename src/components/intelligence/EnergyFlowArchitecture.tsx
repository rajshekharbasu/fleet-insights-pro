import { motion } from "framer-motion";
import { Battery, BatteryCharging, Cpu, Plug, Zap } from "lucide-react";
import { Panel, PanelHeader, fmt } from "@/components/charger/charger-shared";
import type { EnergyFlowDaily } from "@/lib/intelligence-data";

interface Props {
  latest: EnergyFlowDaily;
}

export function EnergyFlowArchitecture({ latest }: Props) {
  const efficiency = latest.delivery_efficiency;
  const stress = latest.infra_stress;

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Live energy flow architecture"
        description="Grid → Transformer → Chargers → Buses · real-time delivery intelligence"
        action={<span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success ring-1 ring-success/30">LIVE</span>}
      />
      <div className="relative overflow-hidden p-6">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 30%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 50%), radial-gradient(circle at 80% 70%, color-mix(in oklab, var(--color-chart-3) 12%, transparent), transparent 50%)",
          }}
        />
        <div className="relative grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
          <FlowNode icon={Zap} label="Grid intake" value={`${fmt(latest.grid_intake_kwh, 0)} kWh`} color="var(--color-chart-3)" />
          <FlowStream color="var(--color-chart-3)" delay={0} />
          <FlowNode icon={Cpu} label="Transformer" value={`${fmt(stress, 0)}/100`} color="var(--color-warning)" subtitle="Stress" />
          <FlowStream color="var(--color-warning)" delay={0.4} />
          <FlowNode icon={Plug} label="Charger output" value={`${fmt(latest.charger_output_kwh, 0)} kWh`} color="var(--color-primary)" />
          <FlowStream color="var(--color-primary)" delay={0.8} />
          <FlowNode icon={BatteryCharging} label="Bus demand" value={`${fmt(latest.bus_demand_kwh, 0)} kWh`} color="var(--color-success)" />
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FlowStat label="Delivery efficiency" value={`${fmt(efficiency, 1)}%`} accent={efficiency >= 92 ? "good" : efficiency >= 85 ? "warn" : "bad"} />
          <FlowStat label="Energy gap" value={`${fmt(latest.energy_gap_kwh, 0)} kWh`} accent={latest.energy_gap_kwh > 500 ? "bad" : "good"} />
          <FlowStat label="Infrastructure stress" value={`${fmt(stress, 0)}/100`} accent={stress > 75 ? "bad" : stress > 55 ? "warn" : "good"} />
          <FlowStat label="Active depot zones" value="5" accent="good" />
        </div>
      </div>
    </Panel>
  );
}

function FlowNode({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: typeof Battery;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative flex flex-col items-center gap-2"
    >
      <div
        className="relative flex h-16 w-16 items-center justify-center rounded-2xl border backdrop-blur-md"
        style={{
          borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
          background: `color-mix(in oklab, ${color} 10%, var(--card))`,
          boxShadow: `0 0 24px color-mix(in oklab, ${color} 25%, transparent)`,
        }}
      >
        <Icon className="h-6 w-6" style={{ color }} />
        <motion.div
          className="absolute inset-0 rounded-2xl"
          animate={{ boxShadow: [`0 0 0 0 ${color}55`, `0 0 0 12px ${color}00`] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        />
      </div>
      <div className="text-center">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <div className="num text-[15px] font-semibold leading-tight">{value}</div>
        {subtitle && <div className="text-[9.5px] text-muted-foreground">{subtitle}</div>}
      </div>
    </motion.div>
  );
}

function FlowStream({ color, delay }: { color: string; delay: number }) {
  return (
    <div className="relative hidden h-1 w-full overflow-hidden rounded-full md:block" style={{ background: `color-mix(in oklab, ${color} 20%, transparent)` }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 h-1 w-6 -translate-y-1/2 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          initial={{ left: "-10%" }}
          animate={{ left: "110%" }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "linear",
            delay: delay + i * 0.6,
          }}
        />
      ))}
    </div>
  );
}

function FlowStat({ label, value, accent }: { label: string; value: string; accent: "good" | "warn" | "bad" }) {
  const color = accent === "good" ? "var(--color-success)" : accent === "warn" ? "var(--color-warning)" : "var(--color-destructive)";
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 px-3 py-2 backdrop-blur-md">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="num text-[15px] font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}
