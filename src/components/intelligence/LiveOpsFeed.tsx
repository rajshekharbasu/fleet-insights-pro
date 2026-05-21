import { motion, AnimatePresence } from "framer-motion";
import { AlertOctagon, AlertTriangle, CheckCircle2, Radio } from "lucide-react";
import { Panel, PanelHeader } from "@/components/charger/charger-shared";
import { liveOpsFeed, type LiveEvent } from "@/lib/intelligence-data";
import { useEffect, useState } from "react";

export function LiveOpsFeed() {
  const [events, setEvents] = useState<LiveEvent[]>(() => liveOpsFeed(13));
  useEffect(() => {
    let seed = 31;
    const id = setInterval(() => {
      seed += 7;
      setEvents((prev) => [liveOpsFeed(seed)[0], ...prev].slice(0, 14));
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel>
      <PanelHeader
        title="Live operational feed"
        description="Telemetry-driven events streaming from gold tables"
        action={
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative h-2 w-2 rounded-full bg-primary" />
            </span>
            Streaming
          </span>
        }
      />
      <div className="max-h-[420px] divide-y divide-border/40 overflow-y-auto">
        <AnimatePresence initial={false}>
          {events.map((ev) => {
            const Icon = ev.severity === "critical" ? AlertOctagon : ev.severity === "warning" ? AlertTriangle : CheckCircle2;
            const color =
              ev.severity === "critical" ? "var(--color-destructive)" : ev.severity === "warning" ? "var(--color-warning)" : "var(--color-success)";
            return (
              <motion.div
                key={ev.id + ev.ts}
                layout
                initial={{ opacity: 0, x: -12, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.3 }}
                className="flex items-start gap-3 px-4 py-3"
              >
                <div
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1"
                  style={{ background: `color-mix(in oklab, ${color} 14%, transparent)`, color, borderColor: color }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold">{ev.entity}</span>
                    <span className="text-[10px] text-muted-foreground">{ev.ts} ago</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{ev.message}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Panel>
  );
}
