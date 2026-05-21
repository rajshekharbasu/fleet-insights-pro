import { motion } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";
import { Panel, PanelHeader } from "@/components/charger/charger-shared";
import type { OpsNarrative } from "@/lib/intelligence-data";

export function OperationalNarratives({ narratives }: { narratives: OpsNarrative[] }) {
  return (
    <Panel className="p-5">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        Operational explainability engine
      </div>
      <h3 className="mt-1.5 text-[16px] font-semibold tracking-tight">Why operational health changed today</h3>
      <div className="mt-4 space-y-2.5">
        {narratives.map((n, i) => {
          const color =
            n.severity === "critical" ? "var(--color-destructive)" : n.severity === "warning" ? "var(--color-warning)" : "var(--color-success)";
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-start gap-3 rounded-xl border border-border/40 bg-card/50 p-3"
            >
              <span
                className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1"
                style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, color, borderColor: color }}
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold">
                  {n.entity}
                  <span className="ml-2 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider" style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)` }}>
                    {n.severity}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{n.message}</p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground/80">{n.driver}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}
