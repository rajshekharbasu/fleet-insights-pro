import { motion } from "framer-motion";
import { Sparkles, TrendingUp } from "lucide-react";
import { Panel, PanelHeader } from "@/components/charger/charger-shared";
import type { PredictiveInsight } from "@/lib/intelligence-data";

export function PredictiveCards({ insights }: { insights: PredictiveInsight[] }) {
  return (
    <Panel>
      <PanelHeader
        title="Predictive operational intelligence"
        description="Forward-looking degradation signals · auto-generated from trend slopes"
        action={<Sparkles className="h-4 w-4 text-primary" />}
      />
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((p, i) => {
          const color =
            p.severity === "critical" ? "var(--color-destructive)" : p.severity === "warning" ? "var(--color-warning)" : "var(--color-success)";
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-4"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl" style={{ background: color }} />
              <div className="relative flex items-center justify-between">
                <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {p.horizon}
                </div>
                <span className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase ring-1" style={{ color, borderColor: color, background: `color-mix(in oklab, ${color} 10%, transparent)` }}>
                  {p.severity}
                </span>
              </div>
              <div className="relative mt-2 flex items-center gap-2 text-[14px] font-semibold tracking-tight">
                <TrendingUp className="h-4 w-4" style={{ color }} />
                {p.entity}
              </div>
              <p className="relative mt-2 text-[12px] leading-snug text-muted-foreground">{p.prediction}</p>
              <div className="relative mt-3 rounded-lg bg-muted/30 px-2.5 py-2 text-[11.5px]">
                <span className="text-muted-foreground">Recommended · </span>
                <span className="text-foreground">{p.recommended}</span>
              </div>
              <div className="relative mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Confidence</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-muted/50">
                    <div className="h-full rounded-full" style={{ width: `${p.confidence}%`, background: color }} />
                  </div>
                  <span className="num font-semibold text-foreground">{p.confidence.toFixed(0)}%</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}
