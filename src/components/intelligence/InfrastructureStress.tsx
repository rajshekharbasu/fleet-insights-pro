import { motion } from "framer-motion";
import { Cpu } from "lucide-react";
import { Panel, PanelHeader } from "@/components/charger/charger-shared";
import { transformerLoad } from "@/lib/intelligence-data";
import type { ChargerHealthDaily } from "@/lib/charger-data";

export function InfrastructureStress({ chargers }: { chargers: ChargerHealthDaily[] }) {
  const nodes = transformerLoad(chargers);

  return (
    <Panel>
      <PanelHeader
        title="Infrastructure stress topology"
        description="Transformer load distribution · charger congestion overlay"
        action={<Cpu className="h-4 w-4 text-muted-foreground" />}
      />
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        {nodes.map((n, i) => {
          const color =
            n.severity === "critical" ? "var(--color-destructive)" : n.severity === "warning" ? "var(--color-warning)" : "var(--color-success)";
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-4"
            >
              <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 70% 20%, ${color}, transparent 60%)` }} />
              <div className="relative flex items-center justify-between">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{n.id}</div>
                <span className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase ring-1" style={{ color, borderColor: color, background: `color-mix(in oklab, ${color} 12%, transparent)` }}>
                  {n.severity}
                </span>
              </div>
              <div className="relative mt-3 num text-[26px] font-semibold leading-none">
                {n.load_pct}
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">% load</span>
              </div>
              <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-muted/40">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${n.load_pct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.05 }}
                  className="h-full rounded-full"
                  style={{ background: color, boxShadow: `0 0 12px ${color}` }}
                />
              </div>
              <div className="relative mt-2 text-[10.5px] text-muted-foreground">
                {n.chargers} chargers downstream
              </div>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}
