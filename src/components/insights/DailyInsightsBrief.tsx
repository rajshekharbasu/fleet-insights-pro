import { useMemo, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Trip } from "@/lib/mock-data";
import {
  buildDailyInsights,
  filterInsightsByAudience,
  type DailyInsight,
  type InsightAudience,
} from "@/lib/daily-insights";
import { fetchMartInsightsFact, mapGraphQlInsight } from "@/lib/graphql/insights";
import { ExportTableButton } from "./ExportTableButton";
import { InsightDetailDrawer } from "./InsightDetailDrawer";

const AUDIENCE_TABS: { id: InsightAudience; label: string; hint: string }[] = [
  { id: "operations", label: "Operations", hint: "Reliability, anomalies, charging, depots" },
  { id: "revenue", label: "Revenue", hint: "Efficiency, utilization, margin leakage" },
];

const SEV_DOT = {
  critical: "bg-destructive shadow-[0_0_8px_var(--color-destructive)]",
  warning: "bg-warning",
  info: "bg-primary/80",
};

function InsightSpark({ values }: { values: number[] }) {
  if (!values.length) return <span className="text-muted-foreground">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((v - min) / (max - min)) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 28" className="h-7 w-16" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        points={pts}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function DailyInsightsBrief({
  trips,
  chargingOnly = false,
  className = "",
}: {
  trips?: Trip[];
  /** When true, only charging/depot ops insights (for Charger Command page). */
  chargingOnly?: boolean;
  className?: string;
}) {
  const [audience, setAudience] = useState<InsightAudience>("operations");
  const [selected, setSelected] = useState<DailyInsight | null>(null);

  const { data: graphQlInsights, isLoading } = useQuery({
    queryKey: ["mart_insights_fact"],
    queryFn: () => fetchMartInsightsFact(20),
  });

  const allInsights = useMemo(() => {
    if (graphQlInsights && graphQlInsights.length > 0) {
      const mapped = graphQlInsights
        .map((item, idx) => mapGraphQlInsight(item, idx))
        .filter((i) => i.title !== "Battery health degraded");
      if (chargingOnly) {
        return mapped.filter((i) =>
          ["charging", "depot", "battery", "thermal"].includes(i.domain.toLowerCase())
        );
      }
      return mapped;
    }

    if (chargingOnly) return buildDailyInsights([], { charging: true });
    return buildDailyInsights(trips ?? [], { charging: true });
  }, [trips, chargingOnly, graphQlInsights]);

  const insights = useMemo(
    () => filterInsightsByAudience(allInsights, audience),
    [allInsights, audience],
  );

  const exportRows = insights.map((i) => ({
    Severity: i.severity,
    Title: i.title,
    Domain: i.domain,
    Metric: i.metric,
    Baseline: i.vsBaseline,
    Audience: i.audience.join(", "),
    Action: i.action,
  }));

  return (
    <>
      <section
        id="daily-brief"
        className={`scroll-mt-28 rounded-2xl border border-border/60 bg-card shadow-elevated ${className}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 p-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Daily insights brief
            </div>
            <h2 className="mt-1 text-[18px] font-semibold tracking-tight">
              What needs attention today
            </h2>
            <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">
              Prioritized for {audience === "operations" ? "operations" : "revenue"} teams — click a
              row for trend proof and exportable detail.
            </p>
          </div>
          <ExportTableButton
            filename={`voltline-daily-brief-${audience}`}
            columns={[
              { key: "Severity", header: "Severity" },
              { key: "Title", header: "Insight" },
              { key: "Domain", header: "Domain" },
              { key: "Metric", header: "Metric" },
              { key: "Baseline", header: "Vs baseline" },
              { key: "Action", header: "Action" },
            ]}
            rows={exportRows}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border/40 px-5 py-3">
          {AUDIENCE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAudience(tab.id)}
              className={`rounded-xl px-4 py-2 text-left transition-all ${
                audience === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
              }`}
            >
              <div className="text-[12px] font-semibold">{tab.label}</div>
              <div
                className={`text-[10px] ${audience === tab.id ? "text-primary-foreground/80" : ""}`}
              >
                {tab.hint}
              </div>
            </button>
          ))}
          <div className="ml-auto self-center text-[11px] text-muted-foreground num">
            {insights.length} insights
          </div>
        </div>

        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="w-8 px-4 py-2.5" />
                <th className="px-3 py-2.5 text-left font-medium">Insight</th>
                <th className="px-3 py-2.5 text-left font-medium">Domain</th>
                <th className="px-3 py-2.5 text-left font-medium">Metric</th>
                <th className="px-3 py-2.5 text-left font-medium">Vs baseline</th>
                <th className="px-3 py-2.5 text-left font-medium">Trend</th>
                <th className="w-10 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`loading-${i}`} className="border-b border-border/40 animate-pulse">
                    <td className="px-4 py-5 w-8">
                      <div className="h-2.5 w-2.5 bg-muted rounded-full animate-ping" />
                    </td>
                    <td className="px-3 py-5">
                      <div className="h-4 bg-muted rounded w-48 mb-2" />
                      <div className="h-3 bg-muted rounded w-72" />
                    </td>
                    <td className="px-3 py-5"><div className="h-4 bg-muted rounded w-16" /></td>
                    <td className="px-3 py-5"><div className="h-4 bg-muted rounded w-16" /></td>
                    <td className="px-3 py-5"><div className="h-4 bg-muted rounded w-20" /></td>
                    <td className="px-3 py-5"><div className="h-4 bg-muted rounded w-20" /></td>
                    <td className="px-3 py-5 w-10" />
                  </tr>
                ))
              ) : (
                insights.map((ins) => (
                  <tr
                    key={ins.id}
                    onClick={() => setSelected(ins)}
                    className="group cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-primary/5"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          SEV_DOT[ins.severity as keyof typeof SEV_DOT] || SEV_DOT.info
                        }`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground group-hover:text-primary">
                        {ins.title}
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                        {ins.summary}
                      </div>
                    </td>
                    <td className="px-3 py-3 capitalize text-muted-foreground">{ins.domain}</td>
                    <td className="px-3 py-3 num font-medium">{ins.metric}</td>
                    <td className="px-3 py-3 text-muted-foreground">{ins.vsBaseline}</td>
                    <td className="px-3 py-3">
                      <InsightSpark values={ins.spark.length ? ins.spark : ins.trend.map((t) => t.value)} />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      <ChevronRight className="h-4 w-4 opacity-40 group-hover:opacity-100" />
                    </td>
                  </tr>
                ))
              )}
              {!isLoading && insights.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No insights for this view in the current window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <InsightDetailDrawer insight={selected} onClose={() => setSelected(null)} />
    </>
  );
}
