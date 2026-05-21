import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, ArrowRight, Bus, PlugZap } from "lucide-react";
import { CHART_ENTER } from "@/lib/chart-motion";
import type {
  BusLeaderboardRow,
  ChargerLeaderboardRow,
} from "@/lib/charger-analytics";
import {
  abnormalBusRows,
  abnormalChargerRows,
  applyTrendWindow,
  busLeaderboard,
  chargerLeaderboard,
} from "@/lib/charger-analytics";
import {
  classifyEnergyFlow,
  energyFlowDailyTrend,
  entityFlowToTrend,
  faultyBusEnergyFlows,
  faultyChargerEnergyFlows,
  type EntityEnergyFlowSummary,
} from "@/lib/charger-explainability";
import type {
  BusOperationalHealthDaily,
  ChargerHealthDaily,
  ChargingSession,
  EnergyFlowIntelligenceDaily,
} from "@/lib/charger-data";
import { EnergyFlowDiagram } from "./EnergyFlowDiagram";
import { fmt, GlassPanel, RiskPill, SectionShell } from "./primitives";

type FlowScope = "fleet" | "faulty_bus" | "faulty_charger";

function sumFlow(rows: EnergyFlowIntelligenceDaily[]) {
  return rows.reduce(
    (acc, r) => ({
      grid: acc.grid + r.grid_intake_kwh,
      charger: acc.charger + r.charger_output_kwh,
      bus: acc.bus + r.bus_demand_kwh,
      gap: acc.gap + r.energy_gap_kwh,
    }),
    { grid: 0, charger: 0, bus: 0, gap: 0 },
  );
}

function LossBreakdown({
  lossCharger,
  lossBus,
  gap,
  dominant,
}: {
  lossCharger: number;
  lossBus: number;
  gap: number;
  dominant: EntityEnergyFlowSummary["dominantLoss"];
}) {
  const total = lossCharger + lossBus + gap || 1;
  return (
    <div className="mx-4 mb-4 grid gap-3 sm:grid-cols-3">
      {[
        {
          label: "Charger-stage loss",
          value: lossCharger,
          pct: (lossCharger / total) * 100,
          highlight: dominant === "charger",
          color: "bg-cyan-500",
        },
        {
          label: "Bus-stage loss",
          value: lossBus,
          pct: (lossBus / total) * 100,
          highlight: dominant === "bus",
          color: "bg-amber-500",
        },
        {
          label: "Unmet demand gap",
          value: gap,
          pct: (gap / total) * 100,
          highlight: dominant === "balanced" && gap > lossCharger,
          color: "bg-red-500",
        },
      ].map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border px-3 py-3 ${
            item.highlight ? "border-destructive/40 bg-destructive/5" : "border-border/40 bg-muted/10"
          }`}
        >
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {item.label}
          </div>
          <div className="num mt-1 text-[18px] font-semibold">{fmt(item.value, 0)} kWh</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">{fmt(item.pct, 0)}% of total loss</div>
        </div>
      ))}
    </div>
  );
}

function WeekDayStrip({ days }: { days: EntityEnergyFlowSummary["days"] }) {
  return (
    <div className="border-t border-border/40 bg-card/30 px-4 py-4">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        7-day flow snapshot
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const loss = d.loss_charger_kwh + d.loss_bus_kwh + d.gap;
          const hot = loss > d.grid * 0.15;
          return (
            <div
              key={d.date}
              className={`rounded-lg border px-1.5 py-2 text-center ${
                hot ? "border-destructive/35 bg-destructive/8" : "border-border/40 bg-muted/10"
              }`}
            >
              <div className="text-[9px] text-muted-foreground">{d.label}</div>
              <div className="num mt-1 text-[11px] font-semibold">{fmt(d.gap, 0)}</div>
              <div className="text-[8px] text-muted-foreground">gap kWh</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EnergyFlowSection({
  flow,
  buses,
  chargers,
  sessions,
}: {
  flow: EnergyFlowIntelligenceDaily[];
  buses: BusOperationalHealthDaily[];
  chargers: ChargerHealthDaily[];
  sessions: ChargingSession[];
}) {
  const [scope, setScope] = useState<FlowScope>("fleet");
  const [granularity, setGranularity] = useState<"daily" | "hourly">("daily");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const busLb = useMemo(() => busLeaderboard(buses), [buses]);
  const chargerLb = useMemo(() => chargerLeaderboard(chargers), [chargers]);
  const faultyBuses = useMemo(() => abnormalBusRows(buses, busLb), [buses, busLb]);
  const faultyChargers = useMemo(() => abnormalChargerRows(chargers, chargerLb), [chargers, chargerLb]);

  const busFlows = useMemo(
    () => faultyBusEnergyFlows(sessions, faultyBuses),
    [sessions, faultyBuses],
  );
  const chargerFlows = useMemo(
    () => faultyChargerEnergyFlows(sessions, faultyChargers),
    [sessions, faultyChargers],
  );

  const entityFlows = scope === "faulty_bus" ? busFlows : chargerFlows;

  useEffect(() => {
    if (scope === "fleet") return;
    const list = scope === "faulty_bus" ? faultyBuses : faultyChargers;
    const id = scope === "faulty_bus" ? list[0]?.vehicle_id : list[0]?.charger_id;
    setSelectedEntityId(id ?? null);
  }, [scope, faultyBuses, faultyChargers]);

  const windowed7d = useMemo(() => applyTrendWindow(flow, "7D"), [flow]);
  const fleetTotals = useMemo(() => sumFlow(windowed7d), [windowed7d]);
  const fleetEfficiency =
    fleetTotals.grid > 0 ? (fleetTotals.charger / fleetTotals.grid) * 100 : 0;

  const activeEntity = useMemo(() => {
    if (scope === "fleet" || !selectedEntityId) return null;
    return entityFlows.find((e) => e.entityId === selectedEntityId) ?? entityFlows[0] ?? null;
  }, [scope, selectedEntityId, entityFlows]);

  const displayTotals = useMemo(() => {
    if (activeEntity) {
      const t = activeEntity.totals;
      return {
        gridKwh: t.grid,
        chargerKwh: t.output,
        busKwh: t.demand,
        gapKwh: t.gap,
        efficiencyPct: t.grid > 0 ? (t.output / t.grid) * 100 : 0,
      };
    }
    return {
      gridKwh: fleetTotals.grid,
      chargerKwh: fleetTotals.charger,
      busKwh: fleetTotals.bus,
      gapKwh: fleetTotals.gap,
      efficiencyPct: fleetEfficiency,
    };
  }, [activeEntity, fleetTotals, fleetEfficiency]);

  const trend = useMemo(() => {
    if (activeEntity) return entityFlowToTrend(activeEntity.days);
    return energyFlowDailyTrend(
      applyTrendWindow(flow, "7D"),
      granularity,
    ).slice(-7);
  }, [activeEntity, flow, granularity]);

  const { interpretation, pattern } = useMemo(
    () =>
      activeEntity
        ? {
            pattern: activeEntity.dominantLoss === "charger" ? "charger_bottleneck" as const : activeEntity.dominantLoss === "bus" ? "bus_instability" as const : "stable" as const,
            interpretation: activeEntity.lossInsight,
          }
        : classifyEnergyFlow(trend),
    [activeEntity, trend],
  );

  const absMetrics = [
    { id: "grid", label: "Grid intake", value: displayTotals.gridKwh, unit: "kWh", color: "text-indigo-400", border: "border-indigo-500/30", bg: "from-indigo-500/10 to-transparent" },
    { id: "charger", label: "Charger output", value: displayTotals.chargerKwh, unit: "kWh", color: "text-cyan-400", border: "border-cyan-500/30", bg: "from-cyan-500/10 to-transparent" },
    { id: "bus", label: "Bus demand", value: displayTotals.busKwh, unit: "kWh", color: "text-amber-400", border: "border-amber-500/30", bg: "from-amber-500/10 to-transparent" },
    { id: "gap", label: "Energy gap", value: displayTotals.gapKwh, unit: "kWh", color: displayTotals.gapKwh > displayTotals.gridKwh * 0.1 ? "text-red-400" : "text-slate-400", border: displayTotals.gapKwh > displayTotals.gridKwh * 0.1 ? "border-red-500/30" : "border-border/40", bg: "from-red-500/10 to-transparent" },
    { id: "eff", label: "Delivery efficiency", value: displayTotals.efficiencyPct, unit: "%", color: displayTotals.efficiencyPct >= 85 ? "text-emerald-400" : "text-amber-400", border: "border-emerald-500/30", bg: "from-emerald-500/10 to-transparent" },
  ];

  const windowLabel = scope === "fleet" ? "7-day fleet total" : "7-day asset total";

  return (
    <SectionShell
      id="energy-flow"
      label="Energy intelligence"
      title="Energy flow"
      description="Trace where energy is lost — fleet-wide or drill into faulty buses and chargers over the last 7 days."
    >
      {/* Scope: fleet vs faulty assets */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "fleet" as const, label: "Fleet (7 days)", icon: Activity },
            { id: "faulty_bus" as const, label: "Faulty buses", icon: Bus },
            { id: "faulty_charger" as const, label: "Faulty chargers", icon: PlugZap },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setScope(id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[12px] font-medium transition-colors ${
              scope === id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/50 text-muted-foreground hover:border-primary/30"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === "faulty_bus" && faultyBuses.length > 0 && (
              <span className="num rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
                {faultyBuses.length}
              </span>
            )}
            {id === "faulty_charger" && faultyChargers.length > 0 && (
              <span className="num rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
                {faultyChargers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Entity picker for faulty scope */}
      {scope !== "fleet" && (
        <div className="flex flex-wrap gap-2">
          {(scope === "faulty_bus" ? faultyBuses : faultyChargers).map((item) => {
            const id = scope === "faulty_bus" ? (item as BusLeaderboardRow).vehicle_id : (item as ChargerLeaderboardRow).charger_id;
            const label =
              scope === "faulty_bus"
                ? `Bus ${(item as BusLeaderboardRow).vehicle_number}`
                : (item as ChargerLeaderboardRow).charger_id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedEntityId(id)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                  selectedEntityId === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 text-muted-foreground"
                }`}
              >
                {label}
                <RiskPill level={item.risk} />
              </button>
            );
          })}
        </div>
      )}

      <GlassPanel className="overflow-hidden border-primary/20 p-0">
        <EnergyFlowDiagram
          totals={displayTotals}
          caption={
            activeEntity
              ? `${activeEntity.entityLabel} · ${activeEntity.depotName} · last 7 days`
              : "Fleet aggregate · last 7 days"
          }
        />

        <div className="grid grid-cols-2 gap-3 border-t border-border/40 bg-card/50 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {absMetrics.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border bg-gradient-to-br ${m.bg} ${m.border} px-4 py-3`}
            >
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {m.label}
              </div>
              <div className={`num mt-1 text-[22px] font-semibold tracking-tight ${m.color}`}>
                {fmt(m.value, m.unit === "%" ? 1 : 0)}
                <span className="ml-1 text-[12px] font-normal text-muted-foreground">{m.unit}</span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{windowLabel}</div>
            </div>
          ))}
        </div>

        {activeEntity && (
          <>
            <LossBreakdown
              lossCharger={activeEntity.totals.lossCharger}
              lossBus={activeEntity.totals.lossBus}
              gap={activeEntity.totals.gap}
              dominant={activeEntity.dominantLoss}
            />
            <WeekDayStrip days={activeEntity.days} />
          </>
        )}

        <div
          className={`mx-4 mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-[12px] ${
            pattern === "stable"
              ? "border-primary/25 bg-primary/5"
              : "border-amber-500/30 bg-amber-500/8"
          }`}
        >
          {pattern !== "stable" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          ) : (
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          )}
          <p>{interpretation}</p>
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold">
              {activeEntity ? "7-day energy trend & loss" : "7-day energy trend"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {activeEntity
                ? "Daily grid, charger output, bus demand — loss bars show where energy disappears"
                : "Grid intake vs charger output vs bus demand"}
            </p>
          </div>
          {scope === "fleet" && (
            <div className="flex rounded-lg border border-border/50 p-0.5">
              {(["daily", "hourly"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-medium capitalize ${
                    granularity === g
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 h-[280px] md:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            {activeEntity ? (
              <ComposedChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={48} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="grid" name="Grid" stroke="#818cf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="output" name="Charger out" stroke="#22d3ee" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="demand" name="Bus demand" stroke="#fbbf24" strokeWidth={2} dot={false} />
                <Bar dataKey="lossCharger" name="Charger loss" stackId="loss" fill="#22d3ee" fillOpacity={0.35} />
                <Bar dataKey="lossBus" name="Bus loss" stackId="loss" fill="#fbbf24" fillOpacity={0.45} />
              </ComposedChart>
            ) : (
              <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={48} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }} formatter={(v: number) => [`${fmt(v, 0)} kWh`, ""]} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="grid" name="Grid intake" stroke="#818cf8" strokeWidth={2.5} dot={false} {...CHART_ENTER} />
                <Line type="monotone" dataKey="output" name="Charger output" stroke="#22d3ee" strokeWidth={2.5} dot={false} {...CHART_ENTER} />
                <Line type="monotone" dataKey="demand" name="Bus demand" stroke="#fbbf24" strokeWidth={2.5} dot={false} {...CHART_ENTER} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
        <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="h-2 w-3 rounded-sm bg-indigo-400" /> Grid
          <ArrowRight className="h-3 w-3" />
          <span className="h-2 w-3 rounded-sm bg-cyan-400" /> Chargers
          <ArrowRight className="h-3 w-3" />
          <span className="h-2 w-3 rounded-sm bg-amber-400" /> Buses
          {activeEntity && (
            <>
              <span className="mx-1">·</span>
              Stacked bars = daily loss by stage
            </>
          )}
        </p>
      </GlassPanel>
    </SectionShell>
  );
}
