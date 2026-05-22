import { useMemo } from "react";
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
import { AbnormalBusTrendPanel } from "@/components/charger/AbnormalBusTrendPanel";
import { AbnormalChargerTrendPanel } from "@/components/charger/AbnormalChargerTrendPanel";
import { ExplainableBusIntelligence } from "./ExplainableBusIntelligence";
import { ExplainableChargerIntelligence } from "./ExplainableChargerIntelligence";
import { PredictiveIntel } from "./PredictiveIntel";
import type { PredictiveCard } from "@/lib/charger-explainability";
import type { OperationalNarrative } from "@/lib/charger-explainability";
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
  compatibility,
  selectedBusId,
  onSelectBus,
  highlightDrillBusId,
}: {
  buses: BusOperationalHealthDaily[];
  maintenance: MaintenanceRecommendation[];
  compatibility: ChargerBusCompatibility[];
  selectedBusId: string | null;
  onSelectBus: (vehicleId: string | null) => void;
  highlightDrillBusId?: string | null;
}) {
  const rows = useMemo(() => busLeaderboardExtended(buses), [buses]);

  return (
    <SectionShell
      id="bus-intel"
      label="Fleet"
      title="Bus health"
      description="Click an unhealthy bus for diagnostics and 30-day KPI trends."
    >
      <GlassPanel>
        <PanelHead title="Fleet health matrix" sub="Click an unhealthy row to load 30-day KPI trends below" />
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
                <tr
                  key={r.vehicle_id}
                  onClick={() => r.risk !== "healthy" && onSelectBus(r.vehicle_id)}
                  className={`cc-row ${r.risk !== "healthy" ? "cc-row-alert cursor-pointer" : ""} ${selectedBusId === r.vehicle_id ? "ring-1 ring-inset ring-primary/50" : ""}`}
                >
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

      {selectedBusId && (
        <ExplainableBusIntelligence
          buses={buses}
          selectedVehicleId={selectedBusId}
          compatibility={compatibility}
          highlightDrill={highlightDrillBusId === selectedBusId}
        />
      )}

      <AbnormalBusTrendPanel
        buses={buses}
        leaderboard={rows}
        variant="glass"
        selectedVehicleId={selectedBusId}
        onSelectVehicle={onSelectBus}
      />
    </SectionShell>
  );
}

export function SectionCharger({
  chargers,
  compatibility,
  selectedChargerId,
  onSelectCharger,
  highlightDrillChargerId,
}: {
  chargers: ChargerHealthDaily[];
  compatibility: ChargerBusCompatibility[];
  selectedChargerId: string | null;
  onSelectCharger: (chargerId: string | null) => void;
  highlightDrillChargerId?: string | null;
}) {
  const rows = useMemo(() => chargerLeaderboardExtended(chargers), [chargers]);
  return (
    <SectionShell
      id="charger-infra"
      label="Fleet"
      title="Charger health"
      description="Charger throughput, utilization, stability, expected expense, and bus compatibility intelligence."
    >
      <GlassPanel>
        <PanelHead title="Charger operational leaderboard" sub="Click an unhealthy row to load 30-day KPI trends below" />
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
                <tr
                  key={r.charger_id}
                  onClick={() => r.risk !== "healthy" && onSelectCharger(r.charger_id)}
                  className={`${r.risk !== "healthy" ? "cc-row-alert cursor-pointer" : ""} ${selectedChargerId === r.charger_id ? "ring-1 ring-inset ring-primary/50" : ""}`}
                >
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

      {selectedChargerId && (
        <ExplainableChargerIntelligence
          chargers={chargers}
          selectedChargerId={selectedChargerId}
          compatibility={compatibility}
          highlightDrill={highlightDrillChargerId === selectedChargerId}
        />
      )}

      <AbnormalChargerTrendPanel
        chargers={chargers}
        leaderboard={rows}
        variant="glass"
        selectedChargerId={selectedChargerId}
        onSelectCharger={onSelectCharger}
      />

      <GlassPanel>
        <PanelHead title="Compatibility issues" sub="Problematic charger–bus pairings" />
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
  predictive,
  onDrillBus,
  onDrillCharger,
  onDrillFromEvent,
}: {
  events: AbnormalityEvent[];
  buses: BusOperationalHealthDaily[];
  depots: DepotEnergyDaily[];
  busRisks: BusLeaderboardRow[];
  chargerRisks: ChargerLeaderboardRow[];
  depotRisks: ReturnType<typeof depotComparison>;
  predictive: PredictiveCard[];
  onDrillBus: (vehicleId: string) => void;
  onDrillCharger: (chargerId: string) => void;
  onDrillFromEvent: (event: AbnormalityEvent) => void;
}) {
  const trends = useMemo(() => dailyFleetTrends(buses, depots), [buses, depots]);

  return (
    <SectionShell
      id="war-room"
      label="Alerts"
      title="Live alerts"
      description="Operational events and risk ranking."
      action={<span className="inline-flex items-center gap-2 text-[11px] text-primary"><LivePulse /> Live telemetry</span>}
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <GlassPanel className="xl:col-span-2" glow="critical">
          <PanelHead title="Operational alert feed" sub="Severity-ranked events" />
          <div className="max-h-[320px] divide-y divide-border/30 overflow-auto">
            {events.map((e) => {
              const drillable = e.entity_type === "bus" || e.entity_type === "charger";
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={!drillable}
                  onClick={() => drillable && onDrillFromEvent(e)}
                  className={`flex w-full gap-3 px-5 py-3 text-left transition-colors ${
                    drillable ? "hover:bg-muted/30 cursor-pointer" : "cursor-default"
                  }`}
                >
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${e.severity === "critical" ? "text-destructive" : "text-warning"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <RiskPill level={e.severity} />
                      <span className="text-[10px] text-muted-foreground num">{new Date(e.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 font-medium">{e.entity_label}</div>
                    <p className="text-[12px] text-muted-foreground">{e.message}</p>
                    <p className="mt-1 text-[11px] text-primary">
                      {drillable ? "Investigate → opens story, curve & root cause" : `→ ${e.recommended_action}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </GlassPanel>
        <GlassPanel>
          <PanelHead title="Risk ranking" sub="Click a bus or charger to open operational story & curve" />
          <div className="space-y-4 p-4 pt-0">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Buses</div>
              <ol className="mt-1 space-y-0.5">
                {busRisks.slice(0, 4).map((item) => (
                  <li key={item.vehicle_id}>
                    <button
                      type="button"
                      onClick={() => onDrillBus(item.vehicle_id)}
                      className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-[12px] transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <span className="num font-medium">{item.vehicle_number}</span>
                      <span className="num text-destructive">{fmt(item.abnormality_score, 0)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Chargers</div>
              <ol className="mt-1 space-y-0.5">
                {chargerRisks.slice(0, 4).map((item) => (
                  <li key={item.charger_id}>
                    <button
                      type="button"
                      onClick={() => onDrillCharger(item.charger_id)}
                      className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-[12px] transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <span className="font-medium">{item.charger_id}</span>
                      <span className="num text-destructive">{fmt(item.abnormality_score, 0)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Depots</div>
              <ol className="mt-1 space-y-1">
                {depotRisks.slice(0, 4).map((item, i) => (
                  <li key={i} className="flex justify-between text-[12px] text-muted-foreground">
                    <span>{item.depot}</span>
                    <span className="num">{fmt(item.anomalies, 0)}</span>
                  </li>
                ))}
              </ol>
            </div>
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
      <PredictiveIntel cards={predictive} />
    </SectionShell>
  );
}

export function SectionExecutive({
  narratives,
  kpis,
  busLb,
  chargerLb,
  depotAgg,
}: {
  narratives: OperationalNarrative[];
  kpis: CommandKpiCard[];
  busLb: BusLeaderboardRow[];
  chargerLb: ChargerLeaderboardRow[];
  depotAgg: ReturnType<typeof depotComparison>;
}) {
  const toneMap = { healthy: "primary" as const, warning: "warning" as const, critical: "critical" as const };

  return (
    <SectionShell
      id="executive"
      label="Section 05"
      title="Operational explainability & executive synthesis"
      description="Data-driven narratives and leadership summary tiles."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {narratives.slice(0, 4).map((ins) => (
          <GlassPanel key={ins.id} className="p-4" glow={toneMap[ins.severity] === "primary" ? "primary" : toneMap[ins.severity]}>
            <div className="text-[10px] uppercase tracking-wider text-primary">Operational narrative</div>
            <h4 className="mt-1 text-[14px] font-semibold">{ins.title}</h4>
            <p className="mt-1 text-[12px] text-muted-foreground">{ins.body}</p>
            {ins.action && <p className="mt-2 text-[11px] text-primary">→ {ins.action}</p>}
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
