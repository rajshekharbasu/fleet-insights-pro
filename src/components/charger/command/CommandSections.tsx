import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { AlertTriangle, Wrench, Zap } from "lucide-react";
import { CHART_ENTER } from "@/lib/chart-motion";
import type {
  BusLeaderboardRow,
  ChargerLeaderboardRow,
  CommandKpiCard,
} from "@/lib/charger-analytics";
import {
  BUS_BEHAVIOR_META,
  busBehaviorTrend,
  busLeaderboardExtended,
  busPeerScatter,
  busThermalHeatmap,
  chargerDailyTrends,
  chargerLeaderboardExtended,
  dailyFleetTrends,
  depotComparison,
  trendSummaryStats,
  type BusBehaviorMetric,
} from "@/lib/charger-analytics";
import type {
  AbnormalityEvent,
  BusOperationalHealthDaily,
  ChargerBusCompatibility,
  ChargerHealthDaily,
  DepotEnergyDaily,
  MaintenanceRecommendation,
} from "@/lib/charger-data";
import {
  fmt,
  GlassPanel,
  LivePulse,
  PanelHead,
  RiskPill,
  SectionShell,
} from "./primitives";

const RISK_COLOR = { healthy: "#2dd4bf", warning: "#fbbf24", critical: "#f87171" };

export function SectionBus({
  buses,
  maintenance,
}: {
  buses: BusOperationalHealthDaily[];
  maintenance: MaintenanceRecommendation[];
}) {
  const [metric, setMetric] = useState<BusBehaviorMetric>("energy_per_soc");
  const rows = useMemo(() => busLeaderboardExtended(buses), [buses]);
  const trend = useMemo(() => busBehaviorTrend(buses, metric), [buses, metric]);
  const stats = useMemo(
    () => trendSummaryStats(trend.map((t) => ({ ...t, abnormalSessions: 0, abnormalBuses: 0 }))),
    [trend],
  );
  const scatter = useMemo(() => busPeerScatter(buses).map((b) => ({
    ...b,
    accept: rows.find((r) => r.vehicle_number === b.vehicle)?.charge_acceptance_rate ?? 70,
    thermalKwh: rows.find((r) => r.vehicle_number === b.vehicle)?.thermal_rise_per_kwh ?? 1,
  })), [buses, rows]);
  const heatmap = useMemo(() => busThermalHeatmap(buses, 10), [buses]);

  return (
    <SectionShell
      id="bus-intel"
      label="Section 01"
      title="Fleet behavioral intelligence"
      description="Which buses are degrading — energy per SOC, thermal stress, acceptance rate, and stability vs fleet norms."
    >
      <GlassPanel>
        <PanelHead title="Fleet health matrix" sub="Percentile-ranked · sparkline abnormality trend" />
        <div className="max-h-[360px] overflow-auto">
          <table className="cc-table w-full text-[12px]">
            <thead>
              <tr>
                {["Vehicle", "Depot", "kWh/SOC%", "Accept %", "Thermal/kWh", "Disc.", "Stability", "Health", "Risk"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r) => (
                <tr key={r.vehicle_id} className={`cc-row ${r.risk !== "healthy" ? "cc-row-alert" : ""}`}>
                  <td className="px-3 py-2 font-medium num">{r.vehicle_number}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.depot_name}</td>
                  <td className="px-3 py-2 num">{fmt(r.energy_per_soc_pct, 2)}</td>
                  <td className="px-3 py-2 num">{fmt(r.charge_acceptance_rate, 0)}</td>
                  <td className="px-3 py-2 num">{fmt(r.thermal_rise_per_kwh, 2)}</td>
                  <td className="px-3 py-2 num">{r.disconnect_sessions}</td>
                  <td className="px-3 py-2 num">{fmt(r.charging_consistency, 0)}</td>
                  <td className="px-3 py-2 num font-semibold">{fmt(r.operational_health_score, 0)}</td>
                  <td className="px-3 py-2"><RiskPill level={r.risk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <PanelHead title="Charging behavioral intelligence" sub="30-day rolling · fleet average overlay" />
        <div className="mb-3 flex flex-wrap gap-1.5 px-5">
          {(Object.keys(BUS_BEHAVIOR_META) as BusBehaviorMetric[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMetric(k)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${metric === k ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground"}`}
            >
              {BUS_BEHAVIOR_META[k].label}
            </button>
          ))}
        </div>
        <div className="h-64 px-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.35} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <ReferenceLine y={stats.average} stroke="var(--color-primary)" strokeDasharray="5 4" />
              <ReferenceLine y={stats.median} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Area type="monotone" dataKey="value" stroke="var(--color-chart-1)" fill="var(--color-chart-1)" fillOpacity={0.12} strokeWidth={2} {...CHART_ENTER} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassPanel className="p-5">
          <PanelHead title="Peer benchmark" sub="Acceptance vs thermal/kWh · size = energy" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" dataKey="accept" name="Accept %" tick={{ fontSize: 10 }} />
                <YAxis type="number" dataKey="thermalKwh" name="Thermal/kWh" tick={{ fontSize: 10 }} />
                <ZAxis type="number" dataKey="energy" range={[60, 400]} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Scatter data={scatter} shape={(p: { cx?: number; cy?: number; payload?: { risk: keyof typeof RISK_COLOR } }) => (
                  <circle cx={p.cx} cy={p.cy} r={7} fill={RISK_COLOR[p.payload?.risk ?? "healthy"]} fillOpacity={0.85} />
                )} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
        <GlassPanel>
          <PanelHead title="Thermal heatmap" sub="Persistent stress clusters" />
          <div className="overflow-x-auto p-4">
            <table className="text-[10px]">
              <thead>
                <tr>
                  <th className="p-1 text-left">Bus</th>
                  {heatmap[0]?.days.slice(-14).map((d) => (
                    <th key={d.date} className="p-0.5 font-normal text-muted-foreground">{d.date}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.map((row) => (
                  <tr key={row.label}>
                    <td className="p-1 num font-medium">{row.label}</td>
                    {row.days.slice(-14).map((d) => (
                      <td key={d.date} className="p-0.5">
                        <div
                          className="cc-heat-cell h-4 w-4 rounded-sm"
                          style={{ opacity: Math.min(1, d.thermal / 100) }}
                          title={`${d.thermal}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {maintenance.map((m) => (
          <GlassPanel key={m.id} className="p-4" glow={m.severity === "critical" ? "critical" : m.severity === "warning" ? "warning" : undefined}>
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <RiskPill level={m.severity} />
              <span className="text-[10px] uppercase text-muted-foreground">{m.urgency.replace("_", " ")}</span>
            </div>
            <h4 className="mt-2 text-[13px] font-semibold">{m.title}</h4>
            <p className="mt-1 text-[12px] text-muted-foreground">{m.root_cause}</p>
            <p className="mt-2 text-[11px] text-primary">{m.trend}</p>
            <p className="mt-1 text-[11px]"><strong>Impact:</strong> {m.impact}</p>
          </GlassPanel>
        ))}
      </div>
    </SectionShell>
  );
}

export function SectionCharger({
  chargers,
  compatibility,
}: {
  chargers: ChargerHealthDaily[];
  compatibility: ChargerBusCompatibility[];
}) {
  const rows = useMemo(() => chargerLeaderboardExtended(chargers), [chargers]);
  const daily = useMemo(() => chargerDailyTrends(chargers), [chargers]);

  return (
    <SectionShell
      id="charger-infra"
      label="Section 02"
      title="EV infrastructure operations"
      description="Charger throughput, utilization, stability, expected expense, and bus compatibility intelligence."
    >
      <GlassPanel>
        <PanelHead title="Charger operational leaderboard" />
        <div className="max-h-[340px] overflow-auto">
          <table className="cc-table w-full text-[12px]">
            <thead>
              <tr>
                {["Charger", "Depot", "Util %", "Energy", "Exp. cost", "kW", "Disc.", "Health", "Risk"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] uppercase text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 18).map((r) => (
                <tr key={r.charger_id} className={r.risk !== "healthy" ? "cc-row-alert" : ""}>
                  <td className="px-3 py-2 num font-medium">{r.charger_id}</td>
                  <td className="px-3 py-2">{r.depot_name}</td>
                  <td className={`px-3 py-2 num ${r.utilization_pct > 85 ? "text-warning" : ""}`}>{fmt(r.utilization_pct, 0)}</td>
                  <td className="px-3 py-2 num">{fmt(r.total_energy_kwh, 0)}</td>
                  <td className="px-3 py-2 num text-warning">₹{fmt(r.estimated_expense_inr, 0)}</td>
                  <td className="px-3 py-2 num">{fmt(r.avg_power_kw, 1)}</td>
                  <td className="px-3 py-2 num text-destructive">{r.disconnect_sessions}</td>
                  <td className="px-3 py-2 num">{fmt(r.health_score, 0)}</td>
                  <td className="px-3 py-2"><RiskPill level={r.risk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassPanel className="p-5">
          <PanelHead title="Utilization & throughput" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                <Area yAxisId="l" dataKey="sessions" fill="var(--color-primary)" fillOpacity={0.2} stroke="var(--color-primary)" />
                <Line yAxisId="r" dataKey="energy" stroke="var(--color-chart-3)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
        <GlassPanel className="p-5">
          <PanelHead title="Stability analytics" sub="Disconnects & instability proxy" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Bar dataKey="disconnects" fill="var(--color-destructive)" fillOpacity={0.75} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel glow="primary">
        <PanelHead title="Charger–bus compatibility intelligence" sub="Pairing anomalies · operational action list" />
        <div className="divide-y divide-border/30">
          {compatibility.slice(0, 8).map((c) => (
            <div key={`${c.charger_id}-${c.vehicle_number}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
              <div>
                <span className="font-medium">{c.charger_id}</span>
                <span className="mx-2 text-muted-foreground">×</span>
                <span className="num">Bus {c.vehicle_number}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">{c.depot_name}</span>
              </div>
              <div className="text-right text-[11px]">
                <span className="num text-destructive">{c.performance_delta_pct}%</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="num">{c.disconnect_rate_pct}% disc.</span>
                <p className="mt-0.5 text-primary">{c.note}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>
    </SectionShell>
  );
}

export function SectionDepot({ depots }: { depots: DepotEnergyDaily[] }) {
  const agg = useMemo(() => depotComparison(depots), [depots]);
  const radar = ["Energy", "Expense", "Ops", "Sessions", "Anomalies"].map((dim) => {
    const row: Record<string, string | number> = { dim };
    agg.forEach((d) => {
      const v = dim === "Energy" ? d.energy / 1000 : dim === "Expense" ? d.expected_expense / 100000 : dim === "Ops" ? d.operational_score : dim === "Sessions" ? d.sessions / 50 : d.anomalies;
      row[d.depot] = +v.toFixed(1);
    });
    return row;
  });

  return (
    <SectionShell
      id="depot-ops"
      label="Section 03"
      title="Depot energy & operations"
      description="Depot energy, expected expense (pre-bill reconciliation), transformer stress, and comparative intelligence."
      action={<Zap className="h-5 w-5 text-primary" />}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agg.map((d) => (
          <GlassPanel key={d.depot_id} className="p-4" glow={d.anomalies > 25 ? "warning" : undefined}>
            <div className="text-[11px] text-muted-foreground">{d.depot}</div>
            <div className="mt-1 num text-[22px] font-semibold">{fmt(d.energy, 0)} <span className="text-[12px] font-normal">kWh</span></div>
            <div className="mt-2 flex justify-between text-[11px]">
              <span className="num text-warning" title="Expected expense · reconcile with utility bill">₹{fmt(d.expected_expense, 0)}</span>
              <span className="num">Ops {fmt(d.operational_score, 0)}</span>
            </div>
          </GlassPanel>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <GlassPanel className="p-5">
          <PanelHead title="Depot comparison" sub="Energy delivered vs expected expense (pre-reconciliation)" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.35} />
                <XAxis dataKey="depot" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Bar dataKey="energy" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expected_expense" name="Expected expense ₹" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
        <GlassPanel className="p-5">
          <PanelHead title="Operational fingerprint" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="70%">
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10 }} />
                {agg.slice(0, 4).map((d, i) => (
                  <Radar key={d.depot_id} name={d.depot} dataKey={d.depot} stroke={`var(--color-chart-${i + 1})`} fill={`var(--color-chart-${i + 1})`} fillOpacity={0.1} />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      </div>
    </SectionShell>
  );
}

export function SectionWarRoom({
  events,
  buses,
  depots,
  busRisks,
  chargerRisks,
  depotRisks,
}: {
  events: AbnormalityEvent[];
  buses: BusOperationalHealthDaily[];
  depots: DepotEnergyDaily[];
  busRisks: BusLeaderboardRow[];
  chargerRisks: ChargerLeaderboardRow[];
  depotRisks: ReturnType<typeof depotComparison>;
}) {
  const trends = useMemo(() => dailyFleetTrends(buses, depots), [buses, depots]);

  return (
    <SectionShell
      id="war-room"
      label="Section 04"
      title="Live abnormality command center"
      description="Operational war-room — streaming alerts, risk ranking, degradation trends."
      action={<span className="inline-flex items-center gap-2 text-[11px] text-primary"><LivePulse /> Live telemetry</span>}
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <GlassPanel className="xl:col-span-2" glow="critical">
          <PanelHead title="Operational alert feed" sub="Severity-ranked events" />
          <div className="max-h-[320px] divide-y divide-border/30 overflow-auto">
            {events.map((e) => (
              <div key={e.id} className="flex gap-3 px-5 py-3">
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${e.severity === "critical" ? "text-destructive" : "text-warning"}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <RiskPill level={e.severity} />
                    <span className="text-[10px] text-muted-foreground num">{new Date(e.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 font-medium">{e.entity_label}</div>
                  <p className="text-[12px] text-muted-foreground">{e.message}</p>
                  <p className="mt-1 text-[11px] text-primary">→ {e.recommended_action}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
        <GlassPanel>
          <PanelHead title="Risk ranking" />
          <div className="space-y-4 p-4 pt-0">
            {[
              { title: "Buses", items: busRisks, label: (x: BusLeaderboardRow) => x.vehicle_number, score: (x: BusLeaderboardRow) => x.abnormality_score },
              { title: "Chargers", items: chargerRisks, label: (x: ChargerLeaderboardRow) => x.charger_id, score: (x: ChargerLeaderboardRow) => x.abnormality_score },
            ].map((col) => (
              <div key={col.title}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{col.title}</div>
                <ol className="mt-1 space-y-1">
                  {col.items.slice(0, 4).map((item, i) => (
                    <li key={i} className="flex justify-between text-[12px]">
                      <span>{col.label(item as never)}</span>
                      <span className="num text-destructive">{fmt(col.score(item as never), 0)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
      <GlassPanel className="p-5">
        <PanelHead title="Abnormality trend intelligence" sub="30-day rolling · acceleration markers" />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Line dataKey="abnormalityScore" stroke="#f87171" strokeWidth={2} name="Abnormality" dot={false} {...CHART_ENTER} />
              <Line dataKey="operationalHealth" stroke="#2dd4bf" strokeWidth={2} name="Ops health" dot={false} />
              <Line dataKey="disconnects" stroke="#fbbf24" strokeWidth={1.5} name="Disconnects" dot={false} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel>
    </SectionShell>
  );
}

export function SectionExecutive({ kpis, busLb, chargerLb, depotAgg }: {
  kpis: CommandKpiCard[];
  busLb: BusLeaderboardRow[];
  chargerLb: ChargerLeaderboardRow[];
  depotAgg: ReturnType<typeof depotComparison>;
}) {
  const insights = [
    { title: "Depot Khapri delivered 21% higher energy this month", body: "Throughput exceeds fleet median with stable transformer headroom.", tone: "primary" as const },
    { title: "Charger TV-KHA-12 shows worsening disconnect instability", body: "14d disconnect trend +340% vs fleet — firmware intervention queued.", tone: "warning" as const },
    { title: "Fleet operational stability improved 8.3% over 30 days", body: `Health score now ${kpis.find((k) => k.id === "fleet_health")?.value ?? "—"}/100 with fewer thermal flags.`, tone: "success" as const },
    { title: "Bus 1107 thermal stress indicates elevated maintenance risk", body: "Thermal/kWh trend ↑ 18% — schedule pack inspection.", tone: "destructive" as const },
  ];

  return (
    <SectionShell
      id="executive"
      label="Section 05"
      title="Executive intelligence"
      description="AI-synthesized operational narrative for leadership."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((ins) => (
          <GlassPanel key={ins.title} className="p-4" glow={ins.tone === "destructive" ? "critical" : ins.tone === "warning" ? "warning" : "primary"}>
            <div className="text-[10px] uppercase tracking-wider text-primary">AI insight</div>
            <h4 className="mt-1 text-[14px] font-semibold">{ins.title}</h4>
            <p className="mt-1 text-[12px] text-muted-foreground">{ins.body}</p>
          </GlassPanel>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <GlassPanel className="p-4">
          <div className="text-[11px] text-muted-foreground">Healthiest depot</div>
          <div className="mt-1 font-semibold">{[...depotAgg].sort((a, b) => b.operational_score - a.operational_score)[0]?.depot}</div>
        </GlassPanel>
        <GlassPanel className="p-4">
          <div className="text-[11px] text-muted-foreground">Highest expected expense</div>
          <div className="mt-1 font-semibold">{[...depotAgg].sort((a, b) => b.expected_expense - a.expected_expense)[0]?.depot}</div>
        </GlassPanel>
        <GlassPanel className="p-4">
          <div className="text-[11px] text-muted-foreground">Bus needing intervention</div>
          <div className="mt-1 font-semibold num">Bus {busLb[0]?.vehicle_number ?? "—"}</div>
        </GlassPanel>
      </div>
    </SectionShell>
  );
}
