import { useMemo } from "react";
import { Radio } from "lucide-react";
import { ChargerFilterBar } from "@/components/charger/ChargerFilterBar";
import { CommandRibbon } from "@/components/charger/command/CommandRibbon";
import {
  SectionBus,
  SectionCharger,
  SectionDepot,
  SectionExecutive,
  SectionWarRoom,
} from "@/components/charger/command/CommandSections";
import { LivePulse } from "@/components/charger/command/primitives";
import type { ChargerFilters } from "@/lib/charger-analytics";
import {
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
import {
  ABNORMALITY_EVENTS,
  BUS_HEALTH_DAILY,
  CHARGER_BUS_COMPATIBILITY,
  CHARGER_HEALTH_DAILY,
  DEPOT_ENERGY_DAILY,
  MAINTENANCE_RECOMMENDATIONS,
} from "@/lib/charger-data";

const NAV = [
  { id: "bus-intel", label: "Fleet" },
  { id: "charger-infra", label: "Chargers" },
  { id: "depot-ops", label: "Depots" },
  { id: "war-room", label: "War room" },
  { id: "executive", label: "Executive" },
] as const;

export function ChargerCommandCenter({
  filters,
  onFiltersChange,
}: {
  filters: ChargerFilters;
  onFiltersChange: (f: ChargerFilters) => void;
}) {
  const buses = useMemo(() => filterBusRows(BUS_HEALTH_DAILY, filters), [filters]);
  const chargers = useMemo(() => filterChargerRows(CHARGER_HEALTH_DAILY, filters), [filters]);
  const depots = useMemo(() => filterDepotRows(DEPOT_ENERGY_DAILY, filters), [filters]);

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

  return (
    <div className="command-center space-y-8">
      <header className="cc-hero relative overflow-hidden rounded-3xl border border-border/40 px-6 py-8">
        <div className="cc-hero-grid pointer-events-none absolute inset-0" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary">
              <LivePulse />
              Charger intelligence command center
            </div>
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight md:text-[32px]">
              EV fleet energy operations
            </h1>
            <p className="mt-2 max-w-xl text-[13px] text-muted-foreground">
              Real-time charging war-room — bus behavioral intelligence, infrastructure health, depot
              economics, and live abnormality command.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-[11px] text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-primary" />
            Gold tables · {filters.from} → {filters.to}
          </div>
        </div>
      </header>

      <ChargerFilterBar filters={filters} onChange={onFiltersChange} />

      <nav className="sticky top-[3.25rem] z-30 -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-border/40 bg-background/80 p-1 backdrop-blur-xl">
        {NAV.map((n) => (
          <a
            key={n.id}
            href={`#${n.id}`}
            className="shrink-0 rounded-lg px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {n.label}
          </a>
        ))}
      </nav>

      <section className="cc-ribbon-wrap sticky top-[5.5rem] z-20 rounded-2xl border border-border/30 bg-background/85 p-3 backdrop-blur-xl">
        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Global command ribbon
        </div>
        <CommandRibbon kpis={ribbonKpis} />
      </section>

      <SectionBus buses={buses} maintenance={MAINTENANCE_RECOMMENDATIONS} />
      <SectionCharger chargers={chargers} compatibility={CHARGER_BUS_COMPATIBILITY} />
      <SectionDepot depots={depots} />
      <SectionWarRoom
        events={events}
        buses={buses}
        depots={depots}
        busRisks={risks.buses}
        chargerRisks={risks.chargers}
        depotRisks={risks.depots}
      />
      <SectionExecutive kpis={ribbonKpis} busLb={busLb} chargerLb={chargerLb} depotAgg={depotAgg} />
    </div>
  );
}
