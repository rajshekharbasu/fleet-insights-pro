import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bus, PlugZap } from "lucide-react";
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
import {
  classifyPoint,
  explainBottleneck,
  type FlowStage,
  type FlowTrendPoint,
  pointEfficiency,
  snapshotFromTotals,
} from "./energy-flow-sync";
import { EnergyFlowDiagram } from "./EnergyFlowDiagram";
import { EnergyFlowTrendChart } from "./EnergyFlowTrendChart";
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
  snapshot,
  highlightStage,
}: {
  lossCharger: number;
  lossBus: number;
  gap: number;
  dominant: EntityEnergyFlowSummary["dominantLoss"];
  snapshot: FlowTrendPoint | null;
  highlightStage: FlowStage | null;
}) {
  const lc = snapshot?.lossCharger ?? lossCharger;
  const lb = snapshot?.lossBus ?? lossBus;
  const g = snapshot?.gap ?? gap;
  const total = lc + lb + g || 1;

  return (
    <div className="mx-4 mb-4 grid gap-3 sm:grid-cols-3">
      {[
        {
          label: "Charger-stage loss",
          value: lc,
          pct: (lc / total) * 100,
          highlight: dominant === "charger" || highlightStage === "charger" || highlightStage === "grid_charger",
          color: "bg-cyan-500",
        },
        {
          label: "Bus-stage loss",
          value: lb,
          pct: (lb / total) * 100,
          highlight: dominant === "bus" || highlightStage === "bus" || highlightStage === "charger_bus",
          color: "bg-amber-500",
        },
        {
          label: "Unmet demand gap",
          value: g,
          pct: (g / total) * 100,
          highlight: highlightStage === "charger_bus" || (dominant === "balanced" && g > lc),
          color: "bg-red-500",
        },
      ].map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border px-3 py-3 transition-all ${
            item.highlight
              ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
              : "border-border/40 bg-muted/10"
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

function WeekDayStrip({
  days,
  activeIndex,
  onSelectIndex,
}: {
  days: EntityEnergyFlowSummary["days"];
  activeIndex: number | null;
  onSelectIndex: (i: number | null) => void;
}) {
  return (
    <div className="border-t border-border/40 bg-card/30 px-4 py-4">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        7-day flow snapshot · hover to sync
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d, i) => {
          const loss = d.loss_charger_kwh + d.loss_bus_kwh + d.gap;
          const hot = loss > d.grid * 0.15;
          const on = activeIndex === i;
          return (
            <button
              key={d.date}
              type="button"
              onMouseEnter={() => onSelectIndex(i)}
              onMouseLeave={() => onSelectIndex(null)}
              onFocus={() => onSelectIndex(i)}
              className={`rounded-lg border px-1.5 py-2 text-center transition-all ${
                on
                  ? "border-primary bg-primary/15 ring-2 ring-primary/40"
                  : hot
                    ? "border-destructive/35 bg-destructive/8"
                    : "border-border/40 bg-muted/10"
              }`}
            >
              <div className="text-[9px] text-muted-foreground">{d.label}</div>
              <div className="num mt-1 text-[11px] font-semibold">{fmt(d.gap, 0)}</div>
              <div className="text-[8px] text-muted-foreground">gap kWh</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HoverInsightPanel({
  snapshot,
  pattern,
  explanation,
  isLive,
}: {
  snapshot: FlowTrendPoint;
  pattern: string;
  explanation: string;
  isLive: boolean;
}) {
  const hot = pattern !== "stable";
  return (
    <div
      className={`mx-4 mb-3 rounded-xl border px-4 py-3 transition-all ${
        isLive
          ? hot
            ? "border-amber-500/40 bg-amber-500/10 shadow-sm"
            : "border-primary/35 bg-primary/8"
          : "border-border/40 bg-muted/5"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        {isLive ? (
            <span className="inline-flex items-center gap-1 text-primary">
            <span className="cc-energy-sync-live h-1.5 w-1.5 rounded-full bg-primary" />
            Live sync
          </span>
        ) : (
          <span>7-day summary</span>
        )}
        <span className="num font-medium text-foreground">{snapshot.label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
            hot ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-primary/15 text-primary"
          }`}
        >
          {pattern.replace("_", " ")}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-foreground/90">{explanation}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span>
          Grid <span className="num font-medium text-indigo-400">{fmt(snapshot.grid, 0)}</span> kWh
        </span>
        <span>
          Chargers <span className="num font-medium text-cyan-400">{fmt(snapshot.output, 0)}</span> kWh
        </span>
        <span>
          Buses <span className="num font-medium text-amber-400">{fmt(snapshot.demand, 0)}</span> kWh
        </span>
        <span>
          Gap <span className="num font-medium text-destructive">{fmt(snapshot.gap, 0)}</span> kWh
        </span>
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
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverStage, setHoverStage] = useState<FlowStage | null>(null);

  const busLb = useMemo(() => busLeaderboard(buses), [buses]);
  const chargerLb = useMemo(() => chargerLeaderboard(chargers), [chargers]);
  const faultyBuses = useMemo(() => abnormalBusRows(buses, busLb), [buses, busLb]);
  const faultyChargers = useMemo(() => abnormalChargerRows(chargers, chargerLb), [chargers, chargerLb]);

  const busFlows = useMemo(() => faultyBusEnergyFlows(sessions, faultyBuses), [sessions, faultyBuses]);
  const chargerFlows = useMemo(() => faultyChargerEnergyFlows(sessions, faultyChargers), [sessions, faultyChargers]);
  const entityFlows = scope === "faulty_bus" ? busFlows : chargerFlows;

  useEffect(() => {
    if (scope === "fleet") return;
    const list = scope === "faulty_bus" ? faultyBuses : faultyChargers;
    const first = list[0] as unknown as { vehicle_id?: string; charger_id?: string } | undefined;
    const id = scope === "faulty_bus" ? first?.vehicle_id : first?.charger_id;
    setSelectedEntityId(id ?? null);
    setHoverIndex(null);
    setHoverStage(null);
  }, [scope, faultyBuses, faultyChargers]);

  const windowed7d = useMemo(() => applyTrendWindow(flow, "7D"), [flow]);
  const fleetTotals = useMemo(() => sumFlow(windowed7d), [windowed7d]);

  const activeEntity = useMemo(() => {
    if (scope === "fleet" || !selectedEntityId) return null;
    return entityFlows.find((e) => e.entityId === selectedEntityId) ?? entityFlows[0] ?? null;
  }, [scope, selectedEntityId, entityFlows]);

  const trend: FlowTrendPoint[] = useMemo(() => {
    if (activeEntity) return entityFlowToTrend(activeEntity.days);
    const raw = energyFlowDailyTrend(applyTrendWindow(flow, "7D"), granularity);
    return raw.slice(-7).map((r) => ({
      label: r.label,
      grid: r.grid,
      output: r.output,
      demand: r.demand,
      gap: r.gap,
      stress: r.stress,
      efficiency: r.efficiency,
    }));
  }, [activeEntity, flow, granularity]);

  const aggregateSnapshot = useMemo(() => {
    if (activeEntity) {
      const t = activeEntity.totals;
      return snapshotFromTotals({
        gridKwh: t.grid,
        chargerKwh: t.output,
        busKwh: t.demand,
        gapKwh: t.gap,
      });
    }
    return snapshotFromTotals({
      gridKwh: fleetTotals.grid,
      chargerKwh: fleetTotals.charger,
      busKwh: fleetTotals.bus,
      gapKwh: fleetTotals.gap,
    });
  }, [activeEntity, fleetTotals]);

  const activeSnapshot = useMemo(
    () => (hoverIndex != null && trend[hoverIndex] ? trend[hoverIndex]! : aggregateSnapshot),
    [hoverIndex, trend, aggregateSnapshot],
  );

  const pointPattern = useMemo(() => classifyPoint(activeSnapshot), [activeSnapshot]);
  const liveExplanation = useMemo(
    () => explainBottleneck(activeSnapshot, pointPattern, hoverStage),
    [activeSnapshot, pointPattern, hoverStage],
  );

  const fleetInterpretation = useMemo(() => classifyEnergyFlow(trend), [trend]);
  const isHovering = hoverIndex != null || hoverStage != null;

  const absMetrics = useMemo(
    () => [
      {
        id: "grid",
        label: "Grid intake",
        value: activeSnapshot.grid,
        unit: "kWh",
        color: "text-indigo-400",
        border: "border-indigo-500/30",
        bg: "from-indigo-500/10 to-transparent",
        stage: "grid" as const,
      },
      {
        id: "charger",
        label: "Charger output",
        value: activeSnapshot.output,
        unit: "kWh",
        color: "text-cyan-400",
        border: "border-cyan-500/30",
        bg: "from-cyan-500/10 to-transparent",
        stage: "charger" as const,
      },
      {
        id: "bus",
        label: "Bus demand",
        value: activeSnapshot.demand,
        unit: "kWh",
        color: "text-amber-400",
        border: "border-amber-500/30",
        bg: "from-amber-500/10 to-transparent",
        stage: "bus" as const,
      },
      {
        id: "gap",
        label: "Energy gap",
        value: activeSnapshot.gap,
        unit: "kWh",
        color: activeSnapshot.gap > activeSnapshot.grid * 0.1 ? "text-red-400" : "text-slate-400",
        border: activeSnapshot.gap > activeSnapshot.grid * 0.1 ? "border-red-500/30" : "border-border/40",
        bg: "from-red-500/10 to-transparent",
        stage: "charger_bus" as const,
      },
      {
        id: "eff",
        label: "Delivery efficiency",
        value: pointEfficiency(activeSnapshot),
        unit: "%",
        color: pointEfficiency(activeSnapshot) >= 85 ? "text-emerald-400" : "text-amber-400",
        border: "border-emerald-500/30",
        bg: "from-emerald-500/10 to-transparent",
        stage: null,
      },
    ],
    [activeSnapshot],
  );

  const windowLabel =
    hoverIndex != null ? `Period · ${activeSnapshot.label}` : scope === "fleet" ? "7-day fleet total" : "7-day asset total";

  const handleChartHover = (index: number | null) => {
    setHoverIndex(index);
    if (index != null) setHoverStage(null);
  };

  const handleStageHover = (stage: FlowStage | null) => {
    setHoverStage(stage);
  };

  return (
    <SectionShell
      id="energy-flow"
      label="Energy intelligence"
      title="Energy flow"
      description="Trace where energy is lost — hover the diagram or trend chart for synchronized phase and bottleneck detail."
    >
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

      {scope !== "fleet" && (
        <div className="flex flex-wrap gap-2">
          {(scope === "faulty_bus" ? faultyBuses : faultyChargers).map((item) => {
            const id =
              scope === "faulty_bus"
                ? (item as BusLeaderboardRow).vehicle_id
                : (item as ChargerLeaderboardRow).charger_id;
            const label =
              scope === "faulty_bus"
                ? `Bus ${(item as BusLeaderboardRow).vehicle_number}`
                : (item as ChargerLeaderboardRow).charger_id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSelectedEntityId(id);
                  setHoverIndex(null);
                }}
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
          snapshot={activeSnapshot}
          activeStage={hoverStage}
          activeIndex={hoverIndex}
          trendLabels={trend.map((t) => t.label)}
          onStageHover={handleStageHover}
          caption={
            activeEntity
              ? `${activeEntity.entityLabel} · ${activeEntity.depotName} · last 7 days`
              : "Fleet aggregate · last 7 days"
          }
        />

        <HoverInsightPanel
          snapshot={activeSnapshot}
          pattern={isHovering ? pointPattern : fleetInterpretation.pattern}
          explanation={isHovering ? liveExplanation : fleetInterpretation.interpretation}
          isLive={isHovering}
        />

        <div className="grid grid-cols-2 gap-3 border-t border-border/40 bg-card/50 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {absMetrics.map((m) => {
            const lit = m.stage && hoverStage === m.stage;
            return (
              <div
                key={m.id}
                className={`rounded-xl border bg-gradient-to-br ${m.bg} ${m.border} px-4 py-3 transition-all ${
                  lit || (hoverIndex != null && m.id !== "eff")
                    ? "ring-2 ring-primary/35"
                    : ""
                }`}
                onMouseEnter={() => m.stage && handleStageHover(m.stage)}
                onMouseLeave={() => m.stage && handleStageHover(null)}
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
            );
          })}
        </div>

        {activeEntity && (
          <>
            <LossBreakdown
              lossCharger={activeEntity.totals.lossCharger}
              lossBus={activeEntity.totals.lossBus}
              gap={activeEntity.totals.gap}
              dominant={activeEntity.dominantLoss}
              snapshot={hoverIndex != null ? activeSnapshot : null}
              highlightStage={hoverStage}
            />
            <WeekDayStrip
              days={activeEntity.days}
              activeIndex={hoverIndex}
              onSelectIndex={handleChartHover}
            />
          </>
        )}

        {!isHovering && (
          <div
            className={`mx-4 mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-[12px] ${
              fleetInterpretation.pattern === "stable"
                ? "border-primary/25 bg-primary/5"
                : "border-amber-500/30 bg-amber-500/8"
            }`}
          >
            {fleetInterpretation.pattern !== "stable" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            ) : (
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            )}
            <p>{fleetInterpretation.interpretation}</p>
          </div>
        )}
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold">
              {activeEntity ? "7-day energy trend & loss" : "7-day energy trend"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Hover any point — diagram, metrics, and insight panel stay synchronized
            </p>
          </div>
          {scope === "fleet" && (
            <div className="flex rounded-lg border border-border/50 p-0.5">
              {(["daily", "hourly"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setGranularity(g);
                    setHoverIndex(null);
                  }}
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
          <EnergyFlowTrendChart
            data={trend}
            entityMode={!!activeEntity}
            activeIndex={hoverIndex}
            onHoverIndex={handleChartHover}
          />
        </div>
      </GlassPanel>
    </SectionShell>
  );
}
