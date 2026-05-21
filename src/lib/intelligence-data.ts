// Explainable Charger Intelligence — synthetic gold-table data.
// gold_charging_curve_analytics · gold_energy_flow_intelligence_daily
import {
  BUS_HEALTH_DAILY,
  CHARGER_HEALTH_DAILY,
  DEPOT_ENERGY_DAILY,
  DEPOTS,
  TRANSFORMERS,
  type BusOperationalHealthDaily,
  type ChargerHealthDaily,
  type DepotEnergyDaily,
  type RiskLevel,
} from "@/lib/charger-data";

function seeded(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// -------- Charging curve analytics --------
export interface CurvePoint {
  soc: number;
  power_kw: number;
  current_a: number;
  voltage_v: number;
  temp_c: number;
  phase: "CC" | "CV" | "TAPER";
}
export interface ChargingCurveSession {
  session_id: string;
  vehicle_number: string;
  charger_id: string;
  depot_name: string;
  date: string;
  soc_start: number;
  soc_end: number;
  cc_duration_min: number;
  cv_duration_min: number;
  cv_entry_soc: number;
  taper_rate: number; // kW/SOC% drop after CV
  charge_acceptance: number; // 0-100
  peak_power: number;
  peak_current: number;
  peak_voltage: number;
  thermal_rise: number; // °C end - start
  curve_stability: number; // 0-100
  curve_abnormality: number; // 0-100
  curve: CurvePoint[];
}

function genCurve(
  seed: number,
  opts: { degraded: boolean; thermal: number; peakPower: number; cvEntry: number },
): CurvePoint[] {
  const r = seeded(seed);
  const points: CurvePoint[] = [];
  const startSoc = 12 + Math.floor(r() * 8);
  const endSoc = 92 + Math.floor(r() * 6);
  const cvEntry = opts.cvEntry;
  const tempStart = 28 + r() * 6;
  for (let soc = startSoc; soc <= endSoc; soc += 1) {
    let phase: CurvePoint["phase"];
    let power: number;
    if (soc < cvEntry) {
      phase = "CC";
      power = opts.peakPower * (0.92 + r() * 0.08);
    } else if (soc < cvEntry + 18) {
      phase = "CV";
      const t = (soc - cvEntry) / 18;
      power = opts.peakPower * (1 - t * (opts.degraded ? 0.55 : 0.35));
    } else {
      phase = "TAPER";
      const t = (soc - cvEntry - 18) / Math.max(endSoc - cvEntry - 18, 1);
      power = opts.peakPower * (0.45 - t * 0.35) * (opts.degraded ? 0.85 : 1);
    }
    power = clamp(power + (r() - 0.5) * 4, 6, opts.peakPower * 1.05);
    const voltage = clamp(540 + (soc / 100) * 80 + (r() - 0.5) * 6, 520, 660);
    const current = clamp((power * 1000) / voltage, 8, 320);
    const tempRise = (soc - startSoc) * (opts.thermal / 80) * (opts.degraded ? 1.25 : 1);
    const temp = clamp(tempStart + tempRise + (r() - 0.5) * 1.6, 22, 78);
    points.push({
      soc,
      power_kw: +power.toFixed(1),
      current_a: +current.toFixed(0),
      voltage_v: +voltage.toFixed(0),
      temp_c: +temp.toFixed(1),
      phase,
    });
  }
  return points;
}

const _cache = new Map<string, ChargingCurveSession[]>();
export function curveSessionsForVehicle(vehicle_number: string): ChargingCurveSession[] {
  if (_cache.has(vehicle_number)) return _cache.get(vehicle_number)!;
  const busRows = BUS_HEALTH_DAILY.filter((b) => b.vehicle_number === vehicle_number);
  if (!busRows.length) return [];
  const recent = busRows.slice(-10);
  const sessions: ChargingCurveSession[] = [];
  recent.forEach((b, i) => {
    const seed = parseInt(vehicle_number, 10) * 31 + i * 7 + 11;
    const degraded = b.is_abnormal || b.operational_health_score < 60;
    const cvEntry = clamp(78 - (degraded ? 14 : 0) - i * 0.3, 52, 82);
    const peak = clamp(b.avg_charging_power_kw * 1.35, 60, 180);
    const curve = genCurve(seed, {
      degraded,
      thermal: b.thermal_stress,
      peakPower: peak,
      cvEntry,
    });
    const ccPts = curve.filter((p) => p.phase === "CC");
    const cvPts = curve.filter((p) => p.phase === "CV");
    const tpPts = curve.filter((p) => p.phase === "TAPER");
    const peakPower = Math.max(...curve.map((p) => p.power_kw));
    const peakCurrent = Math.max(...curve.map((p) => p.current_a));
    const peakVoltage = Math.max(...curve.map((p) => p.voltage_v));
    const thermalRise = curve[curve.length - 1].temp_c - curve[0].temp_c;
    const taperRate = tpPts.length > 1
      ? +((tpPts[0].power_kw - tpPts[tpPts.length - 1].power_kw) / Math.max(tpPts.length, 1)).toFixed(2)
      : 0;
    const charger_id = `TV-${(b.depot_name).slice(0, 3).toUpperCase()}-${String((i % 8) + 1).padStart(2, "0")}`;
    sessions.push({
      session_id: `${vehicle_number}-${b.date}`,
      vehicle_number,
      charger_id,
      depot_name: b.depot_name,
      date: b.date,
      soc_start: curve[0].soc,
      soc_end: curve[curve.length - 1].soc,
      cc_duration_min: ccPts.length * 1.1,
      cv_duration_min: cvPts.length * 1.4,
      cv_entry_soc: cvEntry,
      taper_rate: taperRate,
      charge_acceptance: b.charge_acceptance_rate,
      peak_power: +peakPower.toFixed(1),
      peak_current: +peakCurrent.toFixed(0),
      peak_voltage: +peakVoltage.toFixed(0),
      thermal_rise: +thermalRise.toFixed(1),
      curve_stability: b.charging_consistency,
      curve_abnormality: b.abnormality_score,
      curve,
    });
  });
  _cache.set(vehicle_number, sessions);
  return sessions;
}

export interface CurveAggregate {
  scope: "fleet" | "charger";
  label: string;
  curve: CurvePoint[];
}
export function fleetAverageCurve(): CurvePoint[] {
  // Average across first 12 buses for an indicative fleet baseline.
  const vehicles = Array.from(new Set(BUS_HEALTH_DAILY.map((b) => b.vehicle_number))).slice(0, 12);
  const all = vehicles.flatMap((v) => curveSessionsForVehicle(v).map((s) => s.curve));
  const bySoc = new Map<number, { power: number; temp: number; current: number; voltage: number; n: number }>();
  all.flat().forEach((p) => {
    const e = bySoc.get(p.soc) ?? { power: 0, temp: 0, current: 0, voltage: 0, n: 0 };
    e.power += p.power_kw;
    e.temp += p.temp_c;
    e.current += p.current_a;
    e.voltage += p.voltage_v;
    e.n += 1;
    bySoc.set(p.soc, e);
  });
  return [...bySoc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([soc, e]) => ({
      soc,
      power_kw: +(e.power / e.n).toFixed(1),
      temp_c: +(e.temp / e.n).toFixed(1),
      current_a: +(e.current / e.n).toFixed(0),
      voltage_v: +(e.voltage / e.n).toFixed(0),
      phase: soc < 70 ? "CC" : soc < 88 ? "CV" : "TAPER",
    }));
}

export function chargerAverageCurve(charger_id: string): CurvePoint[] {
  const vehicles = Array.from(new Set(BUS_HEALTH_DAILY.map((b) => b.vehicle_number)));
  const all = vehicles
    .flatMap((v) => curveSessionsForVehicle(v))
    .filter((s) => s.charger_id === charger_id);
  if (!all.length) return fleetAverageCurve();
  const bySoc = new Map<number, { power: number; n: number; temp: number; current: number; voltage: number }>();
  all.forEach((s) =>
    s.curve.forEach((p) => {
      const e = bySoc.get(p.soc) ?? { power: 0, n: 0, temp: 0, current: 0, voltage: 0 };
      e.power += p.power_kw;
      e.temp += p.temp_c;
      e.current += p.current_a;
      e.voltage += p.voltage_v;
      e.n += 1;
      bySoc.set(p.soc, e);
    }),
  );
  return [...bySoc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([soc, e]) => ({
      soc,
      power_kw: +(e.power / e.n).toFixed(1),
      temp_c: +(e.temp / e.n).toFixed(1),
      current_a: +(e.current / e.n).toFixed(0),
      voltage_v: +(e.voltage / e.n).toFixed(0),
      phase: soc < 70 ? "CC" : soc < 88 ? "CV" : "TAPER",
    }));
}

// -------- Energy flow intelligence --------
export interface EnergyFlowDaily {
  date: string;
  grid_intake_kwh: number;
  charger_output_kwh: number;
  bus_demand_kwh: number;
  delivery_efficiency: number;
  infra_stress: number;
  energy_gap_kwh: number;
}

export function energyFlowDaily(depots: DepotEnergyDaily[]): EnergyFlowDaily[] {
  const byDate = new Map<string, number>();
  depots.forEach((d) => byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.total_energy_kwh));
  const out: EnergyFlowDaily[] = [];
  let i = 0;
  [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([date, charger]) => {
    const r = seeded(parseInt(date.replace(/-/g, ""), 10) + 17);
    const gridLoss = 0.04 + r() * 0.04;
    const grid = charger / (1 - gridLoss);
    const cap = 0.92 + r() * 0.08;
    const bus = charger * (cap - (i > 22 ? 0.06 : 0));
    const efficiency = (bus / grid) * 100;
    const stress = clamp(45 + (1 - cap) * 220 + r() * 18, 22, 96);
    out.push({
      date,
      grid_intake_kwh: +grid.toFixed(0),
      charger_output_kwh: +charger.toFixed(0),
      bus_demand_kwh: +bus.toFixed(0),
      delivery_efficiency: +efficiency.toFixed(1),
      infra_stress: +stress.toFixed(1),
      energy_gap_kwh: +(charger - bus).toFixed(0),
    });
    i += 1;
  });
  return out;
}

export interface HourlyFlow {
  hour: number;
  grid: number;
  charger: number;
  bus: number;
}
export function energyFlowHourly(): HourlyFlow[] {
  const out: HourlyFlow[] = [];
  for (let h = 0; h < 24; h++) {
    const r = seeded(h * 131 + 5);
    const peak = h >= 7 && h <= 10 ? 1.6 : h >= 17 && h <= 21 ? 1.8 : h >= 0 && h <= 4 ? 1.2 : 0.7;
    const base = 380 * peak;
    const grid = base + r() * 80;
    const charger = grid * (0.92 + r() * 0.05);
    const congested = peak > 1.5 && r() > 0.5;
    const bus = charger * (congested ? 0.82 + r() * 0.04 : 0.94 + r() * 0.04);
    out.push({
      hour: h,
      grid: +grid.toFixed(0),
      charger: +charger.toFixed(0),
      bus: +bus.toFixed(0),
    });
  }
  return out;
}

// -------- Infrastructure stress topology --------
export interface TransformerNode {
  id: string;
  load_pct: number;
  chargers: number;
  severity: RiskLevel;
}
export function transformerLoad(chargers: ChargerHealthDaily[]): TransformerNode[] {
  const lastDate = chargers[chargers.length - 1]?.date;
  const today = chargers.filter((c) => c.date === lastDate);
  return TRANSFORMERS.map((tx, i) => {
    const r = seeded(i * 313 + 7);
    const list = today.filter((c) => c.transformer_id === tx);
    const util = list.length ? list.reduce((s, c) => s + c.utilization_pct, 0) / list.length : 0;
    const load = clamp(util + r() * 18 - 4, 18, 99);
    const severity: RiskLevel = load > 86 ? "critical" : load > 70 ? "warning" : "healthy";
    return { id: tx, load_pct: +load.toFixed(0), chargers: list.length, severity };
  });
}

// -------- Operational narratives / predictive intelligence --------
export interface OpsNarrative {
  id: string;
  severity: RiskLevel;
  entity: string;
  message: string;
  driver: string;
}

export function operationalNarratives(
  buses: BusOperationalHealthDaily[],
  chargers: ChargerHealthDaily[],
  flow: EnergyFlowDaily[],
): OpsNarrative[] {
  const out: OpsNarrative[] = [];
  const lastDate = buses[buses.length - 1]?.date;
  const today = buses.filter((b) => b.date === lastDate);
  const worstBus = [...today].sort((a, b) => b.abnormality_score - a.abnormality_score)[0];
  if (worstBus) {
    out.push({
      id: `bus-${worstBus.vehicle_number}`,
      severity: worstBus.abnormality_score > 70 ? "critical" : "warning",
      entity: `Bus ${worstBus.vehicle_number}`,
      message: `Operational health at ${worstBus.operational_health_score.toFixed(0)} — taper onset shifted earlier`,
      driver: `Thermal rise ${worstBus.thermal_rise_per_kwh.toFixed(2)}°C/kWh · acceptance ${worstBus.charge_acceptance_rate.toFixed(0)}%`,
    });
  }
  const chToday = chargers.filter((c) => c.date === lastDate);
  const worstCharger = [...chToday].sort((a, b) => b.abnormality_score - a.abnormality_score)[0];
  if (worstCharger) {
    out.push({
      id: `chg-${worstCharger.charger_id}`,
      severity: worstCharger.abnormality_score > 70 ? "critical" : "warning",
      entity: worstCharger.charger_id,
      message: `Charger showing declining charge acceptance — utilization ${worstCharger.utilization_pct.toFixed(0)}%`,
      driver: `${worstCharger.disconnect_sessions} disconnects · avg power ${worstCharger.avg_power_kw.toFixed(0)} kW`,
    });
  }
  const latest = flow[flow.length - 1];
  if (latest && latest.delivery_efficiency < 88) {
    out.push({
      id: "infra-flow",
      severity: latest.delivery_efficiency < 82 ? "critical" : "warning",
      entity: "Infrastructure",
      message: `Energy delivery efficiency at ${latest.delivery_efficiency.toFixed(1)}% — demand exceeding output during peak windows`,
      driver: `${latest.energy_gap_kwh.toFixed(0)} kWh delivery gap · stress ${latest.infra_stress.toFixed(0)}/100`,
    });
  }
  return out;
}

export interface PredictiveInsight {
  id: string;
  entity: string;
  horizon: string;
  confidence: number;
  prediction: string;
  recommended: string;
  severity: RiskLevel;
}

export function predictiveInsights(
  buses: BusOperationalHealthDaily[],
  chargers: ChargerHealthDaily[],
): PredictiveInsight[] {
  // Compute degradation slopes on operational_health_score for buses
  const byBus = new Map<string, BusOperationalHealthDaily[]>();
  buses.forEach((b) => {
    const arr = byBus.get(b.vehicle_number) ?? [];
    arr.push(b);
    byBus.set(b.vehicle_number, arr);
  });
  const insights: PredictiveInsight[] = [];
  byBus.forEach((rows, vn) => {
    if (rows.length < 7) return;
    const recent = rows.slice(-14);
    const first = recent[0].operational_health_score;
    const last = recent[recent.length - 1].operational_health_score;
    const slope = last - first;
    if (slope < -6) {
      insights.push({
        id: `pi-bus-${vn}`,
        entity: `Bus ${vn}`,
        horizon: "Next 7 days",
        confidence: clamp(60 + Math.abs(slope) * 2, 60, 95),
        prediction: `Health trajectory declining ${slope.toFixed(1)} pts — projected to enter abnormal band`,
        recommended: "Schedule BMS diagnostic & thermal inspection",
        severity: slope < -12 ? "critical" : "warning",
      });
    }
  });
  // Chargers — pick worst 2 by abnormality
  const byCh = new Map<string, ChargerHealthDaily[]>();
  chargers.forEach((c) => {
    const arr = byCh.get(c.charger_id) ?? [];
    arr.push(c);
    byCh.set(c.charger_id, arr);
  });
  const chRanks: { id: string; abn: number; util: number }[] = [];
  byCh.forEach((rows, id) => {
    const recent = rows.slice(-7);
    const abn = recent.reduce((s, r) => s + r.abnormality_score, 0) / recent.length;
    const util = recent.reduce((s, r) => s + r.utilization_pct, 0) / recent.length;
    chRanks.push({ id, abn, util });
  });
  chRanks
    .sort((a, b) => b.abn - a.abn)
    .slice(0, 3)
    .forEach((c) => {
      if (c.abn < 55) return;
      insights.push({
        id: `pi-chg-${c.id}`,
        entity: c.id,
        horizon: "Next 48 hours",
        confidence: clamp(55 + c.abn * 0.4, 55, 92),
        prediction: `Likely to become operationally unstable — ${c.util.toFixed(0)}% utilization with rising abnormality`,
        recommended: "Re-balance load to peer chargers & flag for inspection",
        severity: c.abn > 75 ? "critical" : "warning",
      });
    });
  // Depot
  const depots = DEPOTS.map((d) => d.name);
  depots.forEach((name, i) => {
    if (i > 1) return;
    insights.push({
      id: `pi-depot-${name}`,
      entity: `Depot ${name}`,
      horizon: "Tomorrow peak",
      confidence: 78 - i * 6,
      prediction: `Charging congestion expected — projected ${82 - i * 4}% concurrent utilization`,
      recommended: "Pre-stage low-priority charging to off-peak window",
      severity: i === 0 ? "warning" : "healthy",
    });
  });
  return insights.slice(0, 6);
}

// -------- Live operational feed --------
export interface LiveEvent {
  id: string;
  ts: string;
  severity: RiskLevel;
  entity: string;
  message: string;
}
export function liveOpsFeed(seed = 13): LiveEvent[] {
  const r = seeded(seed);
  const templates = [
    { s: "warning" as RiskLevel, t: (e: string) => `${e} taper onset shifted earlier by ${(8 + r() * 14).toFixed(0)}%` },
    { s: "critical" as RiskLevel, t: (e: string) => `${e} showing abnormal thermal behavior — rise ${(38 + r() * 22).toFixed(0)}°C` },
    { s: "warning" as RiskLevel, t: (e: string) => `Depot ${e} experiencing charger congestion` },
    { s: "critical" as RiskLevel, t: (e: string) => `Transformer ${e} stress exceeding operational threshold` },
    { s: "healthy" as RiskLevel, t: (e: string) => `${e} returned to normal charging profile` },
    { s: "warning" as RiskLevel, t: (e: string) => `${e} charge acceptance dropped below 70%` },
  ];
  const entities = ["Bus 0321", "TV-KHA-08", "TV-KHA-12", "Khapri", "TX-02", "Bus 1207", "TV-WAD-04", "Bus 1102", "MIHAN"];
  const out: LiveEvent[] = [];
  for (let i = 0; i < 14; i++) {
    const tpl = templates[Math.floor(r() * templates.length)];
    const ent = entities[Math.floor(r() * entities.length)];
    const minsAgo = Math.floor(i * 3 + r() * 4);
    out.push({
      id: `ev-${i}`,
      ts: `${minsAgo}m`,
      severity: tpl.s,
      entity: ent,
      message: tpl.t(ent),
    });
  }
  return out;
}

// -------- Charger-bus compatibility --------
export interface CompatibilityCell {
  charger_id: string;
  vehicle_number: string;
  depot_name: string;
  sessions: number;
  taper_delta_pct: number; // negative = earlier taper than fleet
  thermal_delta_pct: number; // positive = warmer
  acceptance_delta_pct: number;
  severity: RiskLevel;
  note: string;
}
export function compatibilityMatrix(): CompatibilityCell[] {
  const busesByDepot = new Map<string, string[]>();
  BUS_HEALTH_DAILY.forEach((b) => {
    const arr = busesByDepot.get(b.depot_name) ?? [];
    if (!arr.includes(b.vehicle_number)) arr.push(b.vehicle_number);
    busesByDepot.set(b.depot_name, arr);
  });
  const chgByDepot = new Map<string, string[]>();
  CHARGER_HEALTH_DAILY.forEach((c) => {
    const arr = chgByDepot.get(c.depot_name) ?? [];
    if (!arr.includes(c.charger_id)) arr.push(c.charger_id);
    chgByDepot.set(c.depot_name, arr);
  });
  const out: CompatibilityCell[] = [];
  DEPOTS.forEach((d, di) => {
    const buses = (busesByDepot.get(d.name) ?? []).slice(0, 6);
    const chgs = (chgByDepot.get(d.name) ?? []).slice(0, 5);
    buses.forEach((bn, bi) => {
      chgs.forEach((cid, ci) => {
        const r = seeded(di * 1001 + bi * 53 + ci * 11);
        const taperDelta = +(((r() - 0.5) * 30) - (bi === 0 && ci === 1 ? 18 : 0)).toFixed(1);
        const thermalDelta = +(((r() - 0.4) * 35) + (ci === 0 ? 12 : 0)).toFixed(1);
        const accept = +(((r() - 0.4) * 20)).toFixed(1);
        const sev: RiskLevel =
          taperDelta < -12 || thermalDelta > 25 ? "critical" :
          taperDelta < -6 || thermalDelta > 12 ? "warning" : "healthy";
        out.push({
          charger_id: cid,
          vehicle_number: bn,
          depot_name: d.name,
          sessions: Math.floor(2 + r() * 9),
          taper_delta_pct: taperDelta,
          thermal_delta_pct: thermalDelta,
          acceptance_delta_pct: accept,
          severity: sev,
          note:
            sev === "critical"
              ? `Bus ${bn} enters CV phase early only on ${cid}`
              : sev === "warning"
                ? `Charger ${cid} causes elevated thermal rise for ${bn}`
                : "Stable pairing",
        });
      });
    });
  });
  return out;
}

// -------- Convenience selectors --------
export function vehicleListByDepot(): { depot: string; vehicles: string[] }[] {
  const map = new Map<string, Set<string>>();
  BUS_HEALTH_DAILY.forEach((b) => {
    if (!map.has(b.depot_name)) map.set(b.depot_name, new Set());
    map.get(b.depot_name)!.add(b.vehicle_number);
  });
  return [...map.entries()].map(([depot, set]) => ({ depot, vehicles: [...set].sort() }));
}

export function busLatest(vehicle_number: string): BusOperationalHealthDaily | undefined {
  const rows = BUS_HEALTH_DAILY.filter((b) => b.vehicle_number === vehicle_number);
  return rows[rows.length - 1];
}
export function busPrevious(vehicle_number: string): BusOperationalHealthDaily | undefined {
  const rows = BUS_HEALTH_DAILY.filter((b) => b.vehicle_number === vehicle_number);
  return rows[rows.length - 2];
}
export function busTrend(vehicle_number: string): { date: string; health: number; abn: number }[] {
  return BUS_HEALTH_DAILY.filter((b) => b.vehicle_number === vehicle_number).map((b) => ({
    date: b.date.slice(5),
    health: b.operational_health_score,
    abn: b.abnormality_score,
  }));
}

export { DEPOT_ENERGY_DAILY };
