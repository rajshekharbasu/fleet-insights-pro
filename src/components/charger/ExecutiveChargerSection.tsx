import { Sparkles, TrendingUp, Zap } from "lucide-react";
import { InsightCard } from "@/components/dashboard/InsightCard";
import type { ExecutiveKpis } from "@/lib/charger-analytics";
import { fmt } from "./charger-shared";

export function ExecutiveChargerSection({ kpis }: { kpis: ExecutiveKpis }) {
  const healthImproved = kpis.healthDeltaPct >= 0;
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight">Executive intelligence</h2>
          <p className="text-[12.5px] text-muted-foreground">
            AI-synthesized operational narratives for leadership & finance.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          Generated summary
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <InsightCard
          icon={Zap}
          tone="primary"
          tag="Depot Khapri"
          title="Depot Khapri delivered 18% higher energy this month"
          body="Throughput exceeds fleet median with stable transformer loading — candidate for capacity expansion modeling."
        />
        <InsightCard
          icon={TrendingUp}
          tone="warning"
          tag="TV-KHA-08"
          title="Charger TV-KHA-08 shows persistent disconnect instability"
          body="14-day disconnect rate 2.4× fleet median — firmware upgrade recommended before peak season."
        />
        <InsightCard
          icon={Sparkles}
          tone={healthImproved ? "success" : "destructive"}
          title={`Fleet operational health ${healthImproved ? "improved" : "declined"} ${fmt(Math.abs(kpis.healthDeltaPct), 1)}% over 30 days`}
          body={`${kpis.abnormalBuses} buses and ${kpis.abnormalChargers} chargers flagged abnormal in the current window.`}
        />
        <InsightCard
          icon={Zap}
          tone="success"
          tag="Finance"
          title="Expected expense per charger trending above median"
          body="Tariff-modeled cost up on Mumbai depots — reconcile BKC and Andheri sessions against utility bills for leak detection."
        />
        <InsightCard
          icon={TrendingUp}
          tone="primary"
          title="Maintenance queue: 4 buses need thermal review"
          body="Peer benchmark identifies sustained thermal rise — schedule inspections before monsoon peak loads."
        />
        <InsightCard
          icon={Sparkles}
          tone="warning"
          title="Depot Wadi congestion risk elevated"
          body="Utilization heatmap shows charger saturation 06:00–09:00 — consider load balancing to TX-03 cluster."
        />
      </div>
    </section>
  );
}
