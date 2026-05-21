import { motion } from "framer-motion";
import { AlertTriangle, BookOpen, ChevronRight } from "lucide-react";
import type { OperationalNarrative } from "@/lib/charger-explainability";
import { GlassPanel } from "./primitives";

const SEV_STYLE = {
  healthy: "border-primary/30 bg-primary/6",
  warning: "border-warning/40 bg-warning/8",
  critical: "border-destructive/40 bg-destructive/8",
};

export function OperationalNarratives({ narratives }: { narratives: OperationalNarrative[] }) {
  if (!narratives.length) return null;

  return (
    <GlassPanel className="overflow-hidden">
      <div className="border-b border-border/40 px-5 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-[14px] font-semibold">Operational explainability engine</h3>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Auto-generated narratives — why health, curves, and energy flow are degrading
        </p>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {narratives.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`rounded-xl border p-4 ${SEV_STYLE[n.severity]}`}
          >
            <div className="flex items-start gap-2">
              {n.severity !== "healthy" && (
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 shrink-0 ${n.severity === "critical" ? "text-destructive" : "text-warning"}`}
                />
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-[13px] font-semibold">{n.title}</h4>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{n.body}</p>
                {n.action && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary">
                    <ChevronRight className="h-3 w-3" />
                    {n.action}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassPanel>
  );
}
