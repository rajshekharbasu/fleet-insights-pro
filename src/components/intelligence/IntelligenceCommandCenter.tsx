import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bus, Radio } from "lucide-react";
import { Activity, AlertTriangle, BatteryCharging, Bolt, Flame, Gauge, ShieldCheck, Waves, Zap } from "lucide-react";
import { OperationalRibbon, type RibbonKpi } from "./OperationalRibbon";
import { BusHealthStory } from "./BusHealthStory";
import { ChargingCurveHero } from "./ChargingCurveHero";
import { CurveExplainability } from "./CurveExplainability";
import { ThermalIntelligence } from "./ThermalIntelligence";
import { CompatibilityMatrix } from "./CompatibilityMatrix";
import { EnergyFlowArchitecture } from "./EnergyFlowArchitecture";
import { TripleSyncTrend } from "./TripleSyncTrend";
import { InfrastructureStress } from "./InfrastructureStress";
import { LiveOpsFeed } from "./LiveOpsFeed";
import { RiskRanking } from "./RiskRanking";
import { PredictiveCards } from "./PredictiveCards";
import { OperationalNarratives } from "./OperationalNarratives";
import {
  energyFlowDaily,
  operationalNarratives,
  predictiveInsights,
  vehicleListByDepot,
} from "@/lib/intelligence-data";
import {
  BUS_HEALTH_DAILY,
  CHARGER_HEALTH_DAILY,
  DEPOT_ENERGY_DAILY,
} from "@/lib/charger-data";

function sparkFromMap(map: Map<string, number>) {
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([, v]) => ({ v }));
}

function buildRibbon(): RibbonKpi[] {
  const buses = BUS_HEALTH_DAILY;
  const chargers = CHARGER_HEALTH_DAILY;
  const depots = DEPOT_ENERGY_DAILY;
  const lastDate = depots[depots.length - 1]?.date;
  const prevDate = depots[depots.length - 2]?.date;
  const todayB = buses.filter((b) => b.date === lastDate);
  const todayC = chargers.filter((c) => c.date === lastDate);
  const todayD = depots.filter((d) => d.date === lastDate);
  const prevB = buses.filter((b) => b.date === prevDate);
  const prevC = chargers.filter((c) => c.date === prevDate);

  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);

  const fleetHealth = avg(todayB.map((b) => b.operational_health_score));
  const fleetPrev = avg(prevB.map((b) => b.operational_health_score));
  const chgHealth = avg(todayC.map((c) => c.health_score));
  const chgPrev = avg(prevC.map((c) => c.health_score));
  const depotScore = avg(todayD.map((d) => d.operational_score));

  const activeChg = todayC.length;
  const abnChg = todayC.filter((c) => c.is_abnormal).length;
  const abnBus = todayB.filter((b) => b.is_abnormal).length;
  const stability = avg(todayB.map((b) => b.charging_consistency));
  const efficiency = avg(todayB.map((b) => b.energy_per_soc_pct)) * 18; // scaled %
  const thermal = 100 - avg(todayB.map((b) => b.thermal_rise_per_kwh)) * 18;
  const flow = energyFlowDaily(depots);
  const lastFlow = flow[flow.length - 1];

  const sparkH = new Map<string, number>();
  buses.forEach((b) => sparkH.set(b.date, (sparkH.get(b.date) ?? 0) + b.operational_health_score / 1));
  const sparkC = new Map<string, number>();
  chargers.forEach((c) => sparkC.set(c.date, (sparkC.get(c.date) ?? 0) + c.health_score / 1));
  const sparkD = new Map<string, number>();
  depots.forEach((d) => sparkD.set(d.date, (sparkD.get(d.date) ?? 0) + d.operational_score / 1));
  const sparkAbnC = new Map<string, number>();
  chargers.forEach((c) => sparkAbnC.set(c.date, (sparkAbnC.get(c.date) ?? 0) + (c.is_abnormal ? 1 : 0)));
  const sparkAbnB = new Map<string, number>();
  buses.forEach((b) => sparkAbnB.set(b.date, (sparkAbnB.get(b.date) ?? 0) + (b.is_abnormal ? 1 : 0)));
  const sparkStab = new Map<string, number>();
  buses.forEach((b) => sparkStab.set(b.date, (sparkStab.get(b.date) ?? 0) + b.charging_consistency));
  const sparkEff = new Map<string, number>();
  buses.forEach((b) => sparkEff.set(b.date, (sparkEff.get(b.date) ?? 0) + b.energy_per_soc_pct));
  const sparkTh = new Map<string, number>();
  buses.forEach((b) => sparkTh.set(b.date, (sparkTh.get(b.date) ?? 0) + b.thermal_rise_per_kwh));
  const sparkDel = new Map<string, number>();
  flow.forEach((f) => sparkDel.set(f.date, f.delivery_efficiency));

  const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);

  return [
    {
      id: "fleet", label: "Fleet operational health", value: fleetHealth.toFixed(0), unit: "/100",
      delta: pct(fleetHealth, fleetPrev),
      severity: fleetHealth > 75 ? "healthy" : fleetHealth > 60 ? "warning" : "critical",
      spark: sparkFromMap(sparkH), icon: ShieldCheck,
      insight: `${abnBus} buses flagged · driven by taper aggressiveness`,
    },
    {
      id: "charger", label: "Charger health", value: chgHealth.toFixed(0), unit: "/100",
      delta: pct(chgHealth, chgPrev),
      severity: chgHealth > 75 ? "healthy" : chgHealth > 60 ? "warning" : "critical",
      spark: sparkFromMap(sparkC), icon: Bolt,
      insight: `${activeChg} active · ${abnChg} abnormal in last 24h`,
    },
    {
      id: "depot", label: "Depot operational score", value: depotScore.toFixed(0), unit: "/100",
      severity: depotScore > 75 ? "healthy" : depotScore > 60 ? "warning" : "critical",
      spark: sparkFromMap(sparkD), icon: Activity,
      insight: "Khapri leading · BKC under congestion",
    },
    {
      id: "active", label: "Active chargers", value: String(activeChg),
      severity: "healthy", spark: sparkFromMap(sparkC), icon: BatteryCharging,
      insight: "All depots reporting telemetry",
    },
    {
      id: "abChg", label: "Abnormal chargers", value: String(abnChg),
      severity: abnChg > 5 ? "critical" : abnChg > 2 ? "warning" : "healthy",
      spark: sparkFromMap(sparkAbnC), icon: AlertTriangle,
      insight: "Driven by declining acceptance & thermal rise",
    },
    {
      id: "abBus", label: "Abnormal buses", value: String(abnBus),
      severity: abnBus > 8 ? "critical" : abnBus > 4 ? "warning" : "healthy",
      spark: sparkFromMap(sparkAbnB), icon: AlertTriangle,
      insight: "Early-CV onset detected on 3 vehicles",
    },
    {
      id: "stab", label: "Charging curve stability", value: stability.toFixed(0), unit: "/100",
      severity: stability > 78 ? "healthy" : stability > 65 ? "warning" : "critical",
      spark: sparkFromMap(sparkStab), icon: Waves,
      insight: "Deteriorated 8% — increased taper aggressiveness",
    },
    {
      id: "eff", label: "Charging efficiency", value: efficiency.toFixed(0), unit: "%",
      severity: efficiency > 80 ? "healthy" : efficiency > 70 ? "warning" : "critical",
      spark: sparkFromMap(sparkEff), icon: Gauge,
      insight: "Energy delivered per SOC point — within band",
    },
    {
      id: "thermal", label: "Thermal stability", value: thermal.toFixed(0), unit: "/100",
      severity: thermal > 75 ? "healthy" : thermal > 60 ? "warning" : "critical",
      spark: sparkFromMap(sparkTh).map((p) => ({ v: 100 - p.v })), icon: Flame,
      insight: "CV-phase thermal rise increasing fleet-wide",
    },
    {
      id: "deliv", label: "Energy delivery stability", value: lastFlow?.delivery_efficiency.toFixed(1) ?? "0", unit: "%",
      severity: (lastFlow?.delivery_efficiency ?? 0) > 90 ? "healthy" : (lastFlow?.delivery_efficiency ?? 0) > 85 ? "warning" : "critical",
      spark: sparkFromMap(sparkDel), icon: Zap,
      insight: `${lastFlow?.energy_gap_kwh.toFixed(0) ?? 0} kWh delivery gap at peak`,
    },
  ];
}

export function IntelligenceCommandCenter() {
  const ribbon = useMemo(() => buildRibbon(), []);
  const vehicleGroups = useMemo(() => vehicleListByDepot(), []);
  const defaultVehicle = vehicleGroups[0]?.vehicles[0];
  const [vehicle, setVehicle] = useState<string>(defaultVehicle ?? "");

  const flow = useMemo(() => energyFlowDaily(DEPOT_ENERGY_DAILY), []);
  const latestFlow = flow[flow.length - 1];
  const narratives = useMemo(
    () => operationalNarratives(BUS_HEALTH_DAILY, CHARGER_HEALTH_DAILY, flow),
    [flow],
  );
  const predictive = useMemo(
    () => predictiveInsights(BUS_HEALTH_DAILY, CHARGER_HEALTH_DAILY),
    [],
  );

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-border/50 px-6 py-8"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--primary) 10%, var(--card)) 0%, var(--card) 60%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: "radial-gradient(circle at 12% 20%, color-mix(in oklab, var(--primary) 30%, transparent), transparent 55%)" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary">
              <Radio className="h-3 w-3" /> Explainable charger intelligence
            </div>
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight md:text-[34px]">
              Charging Intelligence Command Center
            </h1>
            <p className="mt-2 max-w-xl text-[13px] text-muted-foreground">
              Operationally alive war-room — explains <em>why</em> bus health drops, why curves degrade, why
              energy delivery stalls, and what to do about it.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
                <span className="relative h-2 w-2 rounded-full bg-success" />
              </span>
              Gold tables streaming · default 30D window
            </div>
            <VehicleSelector value={vehicle} onChange={setVehicle} groups={vehicleGroups} />
          </div>
        </div>
      </motion.header>

      {/* Ribbon */}
      <section>
        <div className="mb-3 text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Operational health command layer
        </div>
        <OperationalRibbon kpis={ribbon} />
      </section>

      {/* Section 1 — Explainable Bus Health */}
      <section className="space-y-4">
        <SectionTitle eyebrow="Section 01" title="Explainable bus health intelligence" />
        <BusHealthStory vehicle_number={vehicle} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
          <ChargingCurveHero vehicle_number={vehicle} />
          <CurveExplainability vehicle_number={vehicle} />
        </div>
        <ThermalIntelligence vehicle_number={vehicle} />
        <CompatibilityMatrix />
      </section>

      {/* Section 2 — Energy Flow Intelligence */}
      <section className="space-y-4">
        <SectionTitle eyebrow="Section 02" title="Energy flow intelligence" />
        {latestFlow && <EnergyFlowArchitecture latest={latestFlow} />}
        <TripleSyncTrend depots={DEPOT_ENERGY_DAILY} />
        <InfrastructureStress chargers={CHARGER_HEALTH_DAILY} />
        <OperationalNarratives narratives={narratives} />
      </section>

      {/* Section 3 — Live Operational Intelligence */}
      <section className="space-y-4">
        <SectionTitle eyebrow="Section 03" title="Live operational intelligence" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <LiveOpsFeed />
          <RiskRanking buses={BUS_HEALTH_DAILY} chargers={CHARGER_HEALTH_DAILY} depots={DEPOT_ENERGY_DAILY} />
        </div>
        <PredictiveCards insights={predictive} />
      </section>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border/40 pb-2">
      <div>
        <div className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-primary">{eyebrow}</div>
        <h2 className="mt-0.5 text-[18px] font-semibold tracking-tight">{title}</h2>
      </div>
    </div>
  );
}

function VehicleSelector({
  value,
  onChange,
  groups,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: { depot: string; vehicles: string[] }[];
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-[11.5px]">
      <Bus className="h-3.5 w-3.5 text-primary" />
      <label className="text-muted-foreground">Investigate</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[11.5px] font-medium focus:outline-none"
      >
        {groups.map((g) => (
          <optgroup key={g.depot} label={g.depot}>
            {g.vehicles.map((v) => (
              <option key={v} value={v}>
                Bus {v}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
