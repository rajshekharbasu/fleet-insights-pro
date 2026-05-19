import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IndianRupee, MapPin, Zap } from "lucide-react";
import { CHART_ENTER } from "@/lib/chart-motion";
import { depotComparison, transformerStress } from "@/lib/charger-analytics";
import type { DepotEnergyDaily } from "@/lib/charger-data";
import { median } from "@/lib/analytics";
import { fmt, Panel, PanelHeader, RiskBadge } from "./charger-shared";
import type { RiskLevel } from "@/lib/charger-data";

function depotRisk(score: number, anomalies: number): RiskLevel {
  if (score < 55 || anomalies > 40) return "critical";
  if (score < 68 || anomalies > 20) return "warning";
  return "healthy";
}

export function DepotEnergySection({ depots }: { depots: DepotEnergyDaily[] }) {
  const depotsAgg = useMemo(() => depotComparison(depots), [depots]);
  const txStress = useMemo(() => transformerStress(depots), [depots]);
  const latestByDepot = useMemo(() => {
    const m = new Map<string, DepotEnergyDaily>();
    depots.forEach((d) => m.set(d.depot_id, d));
    return [...m.values()];
  }, [depots]);

  const expenseMedian = median(depotsAgg.map((d) => d.expected_expense));

  const radarData = ["Energy", "Sessions", "Ops Score", "Anomalies", "Power"].map((dim) => {
    const row: Record<string, string | number> = { dim };
    depotsAgg.forEach((d) => {
      const v =
        dim === "Energy" ? d.energy / 1000
          : dim === "Sessions" ? d.sessions / 10
          : dim === "Ops Score" ? d.operational_score
          : dim === "Anomalies" ? d.anomalies
          : d.avg_power;
      row[d.depot] = +v.toFixed(1);
    });
    return row;
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {latestByDepot.map((d) => (
          <div
            key={d.depot_id}
            className="accent-bar-top rounded-2xl border border-border/50 bg-card p-4 shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">{d.depot_name}</span>
              <RiskBadge level={depotRisk(d.operational_score, d.abnormality_count)} />
            </div>
            <div className="mt-2 num text-[20px] font-semibold">{fmt(d.total_energy_kwh, 0)}</div>
            <div className="text-[10px] text-muted-foreground">kWh today</div>
            <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
              <span className="text-muted-foreground">Peak</span>
              <span className="num text-right">{d.peak_current_a} A</span>
              <span className="text-muted-foreground">Sessions</span>
              <span className="num text-right">{d.sessions}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <PanelHeader title="Depot comparison" description="Energy, utilization & operational score." />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={depotsAgg}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
                <XAxis dataKey="depot" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="energy" name="Energy kWh" fill="var(--color-primary)" radius={[4, 4, 0, 0]} {...CHART_ENTER} />
                <Bar dataKey="sessions" name="Sessions" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} {...CHART_ENTER} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Depot operational fingerprint" description="Normalized multi-axis depot profile." />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="70%">
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10 }} />
                {depotsAgg.slice(0, 4).map((d, i) => (
                  <Radar
                    key={d.depot_id}
                    name={d.depot}
                    dataKey={d.depot}
                    stroke={`var(--color-chart-${(i % 5) + 1})`}
                    fill={`var(--color-chart-${(i % 5) + 1})`}
                    fillOpacity={0.12}
                    {...CHART_ENTER}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <PanelHeader title="Transformer stress monitoring" description="Peak current vs 380A threshold." />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={txStress.slice(-60)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[100, 450]} />
              <ReferenceLine y={380} stroke="var(--color-destructive)" strokeDasharray="6 4" label={{ value: "Limit", fontSize: 9 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Line dataKey="peak" stroke="var(--color-warning)" strokeWidth={2} dot={false} name="Peak A" {...CHART_ENTER} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Energy & expected expense"
          description={`Median depot expected expense ₹${fmt(expenseMedian, 0)} · reconcile with utility bill`}
        />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={depotsAgg}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
              <XAxis dataKey="depot" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <ReferenceLine y={expenseMedian} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="expected_expense" name="Expected expense ₹" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} {...CHART_ENTER} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {depotsAgg.map((d) => (
          <div
            key={d.depot_id}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 shadow-elevated transition-all hover:border-primary/30"
            style={{
              boxShadow:
                d.anomalies > 25
                  ? "0 0 24px -8px color-mix(in oklab, var(--color-destructive) 40%, transparent)"
                  : undefined,
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <MapPin className="mb-1 h-4 w-4 text-primary" />
                <div className="font-semibold">{d.depot}</div>
                <div className="text-[11px] text-muted-foreground">Ops {fmt(d.operational_score, 0)}/100</div>
              </div>
              <RiskBadge level={depotRisk(d.operational_score, d.anomalies)} />
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px]">
              <Zap className="h-3.5 w-3.5 text-warning" />
              <span className="num">{fmt(d.energy, 0)} kWh</span>
              <IndianRupee className="ml-auto h-3.5 w-3.5 text-warning" />
              <span className="num text-warning" title="Expected expense">₹{fmt(d.expected_expense, 0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
