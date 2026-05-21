import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { PredictiveCard } from "@/lib/charger-explainability";
import { GlassPanel, PanelHead, RiskPill } from "./primitives";

export function PredictiveIntel({ cards }: { cards: PredictiveCard[] }) {
  if (!cards.length) return null;

  return (
    <GlassPanel className="p-5">
      <PanelHead title="Predictive operational intelligence" sub="Forecasted risk trajectories" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-border/50 bg-gradient-to-br from-card/80 to-muted/20 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold">{c.entity}</span>
              <RiskPill level={c.severity} />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{c.forecast}</p>
            <div className="mt-3 flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Confidence {c.confidence}%</span>
              {c.trend === "down" ? (
                <TrendingDown className="h-4 w-4 text-destructive" />
              ) : c.trend === "up" ? (
                <TrendingUp className="h-4 w-4 text-warning" />
              ) : null}
            </div>
          </motion.div>
        ))}
      </div>
    </GlassPanel>
  );
}
