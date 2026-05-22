import { useCallback, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { ChargerFilterBar } from "@/components/charger/ChargerFilterBar";
import { CommandRibbon } from "@/components/charger/command/CommandRibbon";
import { EnergyFlowSection } from "@/components/charger/command/EnergyFlowSection";
import {
  SectionBus,
  SectionCharger,
  SectionWarRoom,
} from "@/components/charger/command/CommandSections";
import { LivePulse } from "@/components/charger/command/primitives";
import type { ChargerFilters } from "@/lib/charger-analytics";
import {
  applyTrendWindow,
  busLeaderboard,
  chargerLeaderboard,
  commandRibbonKpis,
  criticalRisks,
  depotComparison,
  executiveKpis,
  filterBusRows,
  filterChargerRows,
  filterDepotRows,
  filterEvents,
} from "@/lib/charger-analytics";
import { filterEnergyFlowRows } from "@/lib/charger-explainability";
import {
  fleetDrillFromEvent,
  scrollToFleetDrill,
} from "@/lib/fleet-drill";
import type { AbnormalityEvent } from "@/lib/charger-data";
import {
  ABNORMALITY_EVENTS,
  BUS_HEALTH_DAILY,
  CHARGER_BUS_COMPATIBILITY,
  CHARGER_HEALTH_DAILY,
  CHARGING_SESSIONS,
  DEPOT_ENERGY_DAILY,
  ENERGY_FLOW_INTELLIGENCE,
  MAINTENANCE_RECOMMENDATIONS,
} from "@/lib/charger-data";

/** Simple 3-tab navigation — energy flow is the hero */
const NAV = [
  { id: "energy-flow", label: "Energy flow" },
  { id: "fleet", label: "Fleet health" },
  { id: "alerts", label: "Alerts" },
] as const;

export function ChargerCommandCenter({
  filters,
  onFiltersChange,
}: {
  filters: ChargerFilters;
  onFiltersChange: (f: ChargerFilters) => void;
}) {
  const busesRaw = useMemo(() => filterBusRows(BUS_HEALTH_DAILY, filters), [filters]);
  const chargersRaw = useMemo(() => filterChargerRows(CHARGER_HEALTH_DAILY, filters), [filters]);
  const depotsRaw = useMemo(() => filterDepotRows(DEPOT_ENERGY_DAILY, filters), [filters]);
  const flowRaw = useMemo(
    () => filterEnergyFlowRows(ENERGY_FLOW_INTELLIGENCE, filters),
    [filters],
  );

  const buses = useMemo(
    () => applyTrendWindow(busesRaw, filters.trendWindow),
    [busesRaw, filters.trendWindow],
  );
  const chargers = useMemo(
    () => applyTrendWindow(chargersRaw, filters.trendWindow),
    [chargersRaw, filters.trendWindow],
  );
  const depots = useMemo(
    () => applyTrendWindow(depotsRaw, filters.trendWindow),
    [depotsRaw, filters.trendWindow],
  );
  const flow = useMemo(
    () => applyTrendWindow(flowRaw, filters.trendWindow),
    [flowRaw, filters.trendWindow],
  );

  const baseKpis = useMemo(() => executiveKpis(buses, chargers, depots), [buses, chargers, depots]);
  const ribbonKpis = useMemo(
    () => commandRibbonKpis(buses, chargers, depots, baseKpis),
    [buses, chargers, depots, baseKpis],
  );
  const busLb = useMemo(() => busLeaderboard(buses), [buses]);
  const chargerLb = useMemo(() => chargerLeaderboard(chargers), [chargers]);
  const depotAgg = useMemo(() => depotComparison(depots), [depots]);
  const events = useMemo(() => filterEvents(ABNORMALITY_EVENTS, filters), [filters]);
  const risks = useMemo(
    () => criticalRisks(busLb, chargerLb, depotAgg),
    [busLb, chargerLb, depotAgg],
  );

  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null);
  const [highlightDrillBusId, setHighlightDrillBusId] = useState<string | null>(null);
  const [highlightDrillChargerId, setHighlightDrillChargerId] = useState<string | null>(null);

  const drillToBus = useCallback((vehicleId: string) => {
    setSelectedChargerId(null);
    setHighlightDrillChargerId(null);
    setSelectedBusId(vehicleId);
    setHighlightDrillBusId(vehicleId);
    scrollToFleetDrill({ type: "bus", vehicleId });
  }, []);

  const drillToCharger = useCallback((chargerId: string) => {
    setSelectedBusId(null);
    setHighlightDrillBusId(null);
    setSelectedChargerId(chargerId);
    setHighlightDrillChargerId(chargerId);
    scrollToFleetDrill({ type: "charger", chargerId });
  }, []);

  const drillFromEvent = useCallback(
    (event: AbnormalityEvent) => {
      const target = fleetDrillFromEvent(event, buses);
      if (!target) return;
      if (target.type === "bus") drillToBus(target.vehicleId);
      else drillToCharger(target.chargerId);
    },
    [buses, drillToBus, drillToCharger],
  );

  const selectBus = useCallback((vehicleId: string | null) => {
    setHighlightDrillBusId(null);
    setSelectedBusId(vehicleId);
    if (vehicleId) setSelectedChargerId(null);
  }, []);

  const selectCharger = useCallback((chargerId: string | null) => {
    setHighlightDrillChargerId(null);
    setSelectedChargerId(chargerId);
    if (chargerId) setSelectedBusId(null);
  }, []);

  return (
    <div className="command-center space-y-6">
      <header className="cc-hero relative overflow-hidden rounded-2xl border border-border/40 px-5 py-6">
        <div className="cc-hero-grid pointer-events-none absolute inset-0" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary">
              <LivePulse />
              Charger command center
            </div>
            <h1 className="mt-1 text-[24px] font-semibold tracking-tight md:text-[28px]">
              EV charging operations
            </h1>
            <p className="mt-1 max-w-lg text-[12px] text-muted-foreground">
              Start with energy flow, then drill into fleet health or live alerts.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1 text-[11px] text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-primary" />
            {filters.trendWindow} · {filters.from} → {filters.to}
          </div>
        </div>
      </header>

      <ChargerFilterBar filters={filters} onChange={onFiltersChange} />

      <nav className="sticky top-[3.25rem] z-30 flex gap-1 rounded-xl border border-border/40 bg-background/90 p-1 backdrop-blur-xl">
        {NAV.map((n, i) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className={`flex-1 rounded-lg px-4 py-2.5 text-center text-[12px] font-medium transition-colors ${
              i === 0
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {n.label}
          </a>
        ))}
      </nav>

      <section className="cc-ribbon-wrap rounded-2xl border border-border/30 bg-background/85 p-3">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Key metrics
        </div>
        <CommandRibbon kpis={ribbonKpis.slice(0, 8)} />
      </section>

      {/* 1 — Energy flow hero (first thing operators see) */}
      <EnergyFlowSection
        flow={flow}
        buses={buses}
        chargers={chargers}
        sessions={CHARGING_SESSIONS}
      />

      {/* 2 — Fleet: buses + chargers in one scroll section */}
      <div id="fleet" className="scroll-mt-28 space-y-6">
        <SectionBus
          buses={buses}
          maintenance={MAINTENANCE_RECOMMENDATIONS}
          compatibility={CHARGER_BUS_COMPATIBILITY}
          selectedBusId={selectedBusId}
          onSelectBus={selectBus}
          highlightDrillBusId={highlightDrillBusId}
        />
        <SectionCharger
          chargers={chargers}
          compatibility={CHARGER_BUS_COMPATIBILITY}
          selectedChargerId={selectedChargerId}
          onSelectCharger={selectCharger}
          highlightDrillChargerId={highlightDrillChargerId}
        />
      </div>

      {/* 3 — Alerts */}
      <div id="alerts" className="scroll-mt-28">
        <SectionWarRoom
          events={events}
          buses={buses}
          depots={depots}
          busRisks={risks.buses}
          chargerRisks={risks.chargers}
          depotRisks={risks.depots}
          predictive={[]}
          onDrillBus={drillToBus}
          onDrillCharger={drillToCharger}
          onDrillFromEvent={drillFromEvent}
        />
      </div>
    </div>
  );
}
