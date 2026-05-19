// Gold-table mock data — swap with API / Redshift when wired.
// bus_operational_health_daily · gold_charger_health_daily · gold_depot_energy_daily

export type RiskLevel = "healthy" | "warning" | "critical";
export type TrendWindow = "1D" | "7D" | "30D";

export const DEPOTS = [
  { id: "dep_khapri", name: "Khapri", city: "Nagpur" },
  { id: "dep_wadi", name: "Wadi", city: "Nagpur" },
  { id: "dep_mihan", name: "MIHAN", city: "Nagpur" },
  { id: "dep_bkc", name: "BKC Mumbai", city: "Mumbai" },
  { id: "dep_andheri", name: "Andheri", city: "Mumbai" },
] as const;

export const TRANSFORMERS = ["TX-01", "TX-02", "TX-03", "TX-04", "TX-05"] as const;

export interface BusOperationalHealthDaily {
  date: string;
  vehicle_id: string;
  vehicle_number: string;
  depot_id: string;
  depot_name: string;
  vehicle_model: string;
  sessions: number;
  avg_charging_power_kw: number;
  avg_soc_delta: number;
  thermal_stress: number;
  disconnect_sessions: number;
  operational_health_score: number;
  abnormality_score: number;
  total_energy_kwh: number;
  is_abnormal: boolean;
  /** kWh delivered per 1% SOC gained */
  energy_per_soc_pct: number;
  /** 0–100 — BMS charge acceptance vs fleet norm */
  charge_acceptance_rate: number;
  /** Thermal intensity normalized per kWh */
  thermal_rise_per_kwh: number;
  /** 0–100 session-to-session stability */
  charging_consistency: number;
}

export interface ChargerHealthDaily {
  date: string;
  charger_id: string;
  depot_id: string;
  depot_name: string;
  transformer_id: string;
  sessions: number;
  unique_buses: number;
  total_energy_kwh: number;
  avg_power_kw: number;
  disconnect_sessions: number;
  health_score: number;
  abnormality_score: number;
  avg_duration_min: number;
  is_abnormal: boolean;
  utilization_pct: number;
  estimated_expense_inr: number;
}

export interface DepotEnergyDaily {
  date: string;
  depot_id: string;
  depot_name: string;
  total_energy_kwh: number;
  peak_current_a: number;
  active_chargers: number;
  sessions: number;
  operational_score: number;
  disconnect_rate: number;
  abnormality_count: number;
  avg_charging_power_kw: number;
  estimated_expense_inr: number;
}

export interface AbnormalityEvent {
  id: string;
  timestamp: string;
  severity: RiskLevel;
  entity_type: "bus" | "charger" | "depot";
  entity_id: string;
  entity_label: string;
  depot_name: string;
  message: string;
  recommended_action: string;
}

export interface MaintenanceRecommendation {
  id: string;
  severity: RiskLevel;
  vehicle_number: string;
  depot_name: string;
  title: string;
  root_cause: string;
  action: string;
  impact: string;
  urgency: "immediate" | "this_week" | "scheduled";
  trend: string;
}

export interface ChargerBusCompatibility {
  charger_id: string;
  vehicle_number: string;
  depot_name: string;
  performance_delta_pct: number;
  disconnect_rate_pct: number;
  is_anomaly: boolean;
  note: string;
}

/** Session-level grain for SOC × time × energy trends. */
export interface ChargingSession {
  session_id: string;
  date: string;
  hour: number;
  vehicle_id: string;
  vehicle_number: string;
  charger_id: string;
  depot_id: string;
  depot_name: string;
  soc_start: number;
  soc_end: number;
  soc_delta: number;
  energy_kwh: number;
  avg_power_kw: number;
  duration_min: number;
  disconnect: boolean;
  is_abnormal: boolean;
}

const MODELS = ["Tata Ultra EV", "BYD e6", "Olectra K9", "Switch EiV12"] as const;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function riskFromScore(abnormality: number, health: number): RiskLevel {
  if (abnormality >= 72 || health < 45) return "critical";
  if (abnormality >= 48 || health < 62) return "warning";
  return "healthy";
}

function generateBuses() {
  const buses: { id: string; number: string; depot_id: string; model: string }[] = [];
  DEPOTS.forEach((d, di) => {
    const count = di < 3 ? 8 : 5;
    for (let i = 0; i < count; i++) {
      buses.push({
        id: `bus_${d.id}_${i}`,
        number: String(1000 + di * 100 + i).padStart(4, "0"),
        depot_id: d.id,
        model: MODELS[i % MODELS.length],
      });
    }
  });
  return buses;
}

function generateChargers() {
  const chargers: { id: string; depot_id: string; transformer: string }[] = [];
  DEPOTS.forEach((d, di) => {
    const count = di < 3 ? 10 : 6;
    for (let i = 0; i < count; i++) {
      chargers.push({
        id: `TV-${d.name.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(2, "0")}`,
        depot_id: d.id,
        transformer: TRANSFORMERS[i % TRANSFORMERS.length],
      });
    }
  });
  return chargers;
}

const BUSES = generateBuses();
const CHARGERS = generateChargers();

function datesLastNDays(n: number): string[] {
  const out: string[] = [];
  const end = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const DATES_30 = datesLastNDays(30);

function buildBusHealth(): BusOperationalHealthDaily[] {
  const rows: BusOperationalHealthDaily[] = [];
  let seed = 42;
  BUSES.forEach((bus, bi) => {
    const depot = DEPOTS.find((d) => d.id === bus.depot_id)!;
    const r = seeded(seed + bi * 97);
    const stressBias = bi % 7 === 0 ? 18 : 0;
    const disconnectBias = bi % 11 === 0 ? 2 : 0;

    DATES_30.forEach((date, di) => {
      const sessions = Math.round(1 + r() * 3);
      const avgPower = clamp(42 + r() * 28 - stressBias * 0.2, 28, 78);
      const thermal = clamp(22 + r() * 45 + stressBias + (di > 22 ? r() * 12 : 0), 8, 98);
      const disconnects = Math.round(r() * 2 + disconnectBias * (r() > 0.6 ? 1 : 0));
      const health = clamp(88 - thermal * 0.35 - disconnects * 8 - stressBias * 0.5 + r() * 10, 22, 99);
      const abnormality = clamp(100 - health + r() * 15 + disconnects * 6, 5, 99);
      const is_abnormal = abnormality >= 55 || disconnects >= 2 || thermal >= 70;

      const socDelta = +clamp(35 + r() * 40 - (stressBias ? 8 : 0), 20, 85).toFixed(1);
      const energy = +(sessions * avgPower * (0.8 + r() * 0.6)).toFixed(1);
      const energyPerSoc = energy / Math.max(socDelta, 1);
      const acceptRate = clamp(55 + (avgPower / 78) * 40 - stressBias, 25, 99);
      const thermalPerKwh = thermal / Math.max(energy / 100, 0.5);
      const consistency = clamp(92 - disconnects * 12 - stressBias * 0.4, 35, 99);

      rows.push({
        date,
        vehicle_id: bus.id,
        vehicle_number: bus.number,
        depot_id: bus.depot_id,
        depot_name: depot.name,
        vehicle_model: bus.model,
        sessions,
        avg_charging_power_kw: +avgPower.toFixed(1),
        avg_soc_delta: socDelta,
        thermal_stress: +thermal.toFixed(1),
        disconnect_sessions: disconnects,
        operational_health_score: +health.toFixed(1),
        abnormality_score: +abnormality.toFixed(1),
        total_energy_kwh: energy,
        is_abnormal,
        energy_per_soc_pct: +energyPerSoc.toFixed(2),
        charge_acceptance_rate: +acceptRate.toFixed(1),
        thermal_rise_per_kwh: +thermalPerKwh.toFixed(2),
        charging_consistency: +consistency.toFixed(1),
      });
    });
  });
  return rows;
}

function buildChargerHealth(): ChargerHealthDaily[] {
  const rows: ChargerHealthDaily[] = [];
  let seed = 1337;
  CHARGERS.forEach((ch, ci) => {
    const depot = DEPOTS.find((d) => d.id === ch.depot_id)!;
    const r = seeded(seed + ci * 53);
    const unstable = ci % 9 === 0;

    DATES_30.forEach((date) => {
      const sessions = Math.round(4 + r() * 14);
      const avgPower = clamp(48 + r() * 22 - (unstable ? 8 : 0), 32, 85);
      const disconnects = Math.round(r() * (unstable ? 4 : 2));
      const health = clamp(92 - disconnects * 10 - (unstable ? 12 : 0) + r() * 8, 30, 99);
      const abnormality = clamp(100 - health + r() * 12, 8, 95);
      const energy = sessions * avgPower * (0.65 + r() * 0.35);

      const util = clamp((sessions / 18) * 100 - (unstable ? 15 : 0), 12, 98);
      const expense = Math.round(energy * (8.5 + r() * 1.2));

      rows.push({
        date,
        charger_id: ch.id,
        depot_id: ch.depot_id,
        depot_name: depot.name,
        transformer_id: ch.transformer,
        sessions,
        unique_buses: Math.round(sessions * (0.55 + r() * 0.35)),
        total_energy_kwh: +energy.toFixed(1),
        avg_power_kw: +avgPower.toFixed(1),
        disconnect_sessions: disconnects,
        health_score: +health.toFixed(1),
        abnormality_score: +abnormality.toFixed(1),
        avg_duration_min: +clamp(45 + r() * 90, 25, 180).toFixed(0),
        is_abnormal: abnormality >= 52 || disconnects >= 3,
        utilization_pct: +util.toFixed(1),
        estimated_expense_inr: expense,
      });
    });
  });
  return rows;
}

function buildDepotEnergy(): DepotEnergyDaily[] {
  const rows: DepotEnergyDaily[] = [];
  let seed = 9001;
  DEPOTS.forEach((depot, di) => {
    const r = seeded(seed + di * 31);
    DATES_30.forEach((date, dayi) => {
      const sessions = Math.round(40 + r() * 80 + di * 8);
      const energy = sessions * (52 + r() * 18);
      const peak = clamp(180 + r() * 120 + di * 15 + (dayi % 7 === 0 ? 40 : 0), 120, 420);
      const active = Math.round(6 + r() * 8);
      const opScore = clamp(75 + r() * 20 - (peak > 350 ? 12 : 0), 45, 99);
      const discRate = clamp(0.02 + r() * 0.08 + (di === 0 ? 0.03 : 0), 0.01, 0.22);

      rows.push({
        date,
        depot_id: depot.id,
        depot_name: depot.name,
        total_energy_kwh: +energy.toFixed(0),
        peak_current_a: +peak.toFixed(0),
        active_chargers: active,
        sessions,
        operational_score: +opScore.toFixed(1),
        disconnect_rate: +discRate.toFixed(3),
        abnormality_count: Math.round(r() * 6 + (discRate > 0.1 ? 3 : 0)),
        avg_charging_power_kw: +(energy / Math.max(sessions, 1) / 1.1).toFixed(1),
        estimated_expense_inr: Math.round(energy * (8.2 + r() * 1.4)),
      });
    });
  });
  return rows;
}

function buildEvents(): AbnormalityEvent[] {
  const events: AbnormalityEvent[] = [];
  const now = Date.now();
  const samples = [
    { type: "charger" as const, id: "TV-KHA-12", label: "Charger TV-KHA-12", depot: "Khapri", msg: "Disconnect spike detected (+340% vs 7d median)", action: "Inspect CCS connector and comms module" },
    { type: "bus" as const, id: "1107", label: "Bus 1107", depot: "Wadi", msg: "Thermal rise above threshold for 3 consecutive days", action: "Schedule battery thermal inspection" },
    { type: "depot" as const, id: "dep_khapri", label: "Depot Khapri", depot: "Khapri", msg: "Anomaly frequency increased 22% vs fleet median", action: "Review transformer load balancing" },
    { type: "charger" as const, id: "TV-MIH-08", label: "Charger TV-MIH-08", depot: "MIHAN", msg: "Persistent disconnect instability", action: "Replace charge controller firmware" },
    { type: "bus" as const, id: "1203", label: "Bus 1203", depot: "BKC Mumbai", msg: "Charging 28% slower than depot peers", action: "Check BMS charge acceptance curve" },
  ];
  samples.forEach((s, i) => {
    events.push({
      id: `evt_${i}`,
      timestamp: new Date(now - i * 3600_000 * (2 + i)).toISOString(),
      severity: i < 2 ? "critical" : i < 4 ? "warning" : "healthy",
      entity_type: s.type,
      entity_id: s.id,
      entity_label: s.label,
      depot_name: s.depot,
      message: s.msg,
      recommended_action: s.action,
    });
  });
  return events;
}

function buildMaintenance(): MaintenanceRecommendation[] {
  return [
    { id: "m1", severity: "critical", vehicle_number: "1107", depot_name: "Wadi", title: "Bus charging 34% slower than fleet peers", root_cause: "BMS charge acceptance declining · CCS handshake failures", action: "Inspect connector pins and run BMS diagnostic", impact: "High downtime risk on morning blocks", urgency: "immediate", trend: "↓ 18% charge acceptance over 14d" },
    { id: "m2", severity: "critical", vehicle_number: "1004", depot_name: "Khapri", title: "Thermal rise increased 18% over 30 days", root_cause: "Cell imbalance under sustained fast charge", action: "Thermal imaging + pack balance check", impact: "Battery degradation acceleration", urgency: "this_week", trend: "↑ thermal/kWh weekly" },
    { id: "m3", severity: "warning", vehicle_number: "1203", depot_name: "BKC Mumbai", title: "Charging consistency deteriorating", root_cause: "Session stability variance vs depot norm", action: "Recalibrate charge profile on TV-BKC-04", impact: "Energy per SOC% 22% above fleet", urgency: "this_week", trend: "Consistency 62 → 48" },
    { id: "m4", severity: "warning", vehicle_number: "1302", depot_name: "Andheri", title: "Repeated disconnect instability", root_cause: "Intermittent comms on specific charger pair", action: "Firmware sync on TV-AND-08", impact: "3.2× disconnect rate vs median", urgency: "scheduled", trend: "Stable last 48h after patch trial" },
  ];
}

function buildCompatibility(): ChargerBusCompatibility[] {
  const pairs: ChargerBusCompatibility[] = [];
  let seed = 777;
  const r = seeded(seed);
  const badCharger = CHARGERS.find((c) => c.id.includes("KHA-12"))?.id ?? "TV-KHA-12";
  const badBus = BUSES.find((b) => b.number === "1107")?.number ?? "1107";

  CHARGERS.slice(0, 15).forEach((ch, ci) => {
    const depot = DEPOTS.find((d) => d.id === ch.depot_id)!;
    const buses = BUSES.filter((b) => b.depot_id === ch.depot_id).slice(0, 3);
    buses.forEach((bus, bi) => {
      const isBad = ch.id === badCharger && bus.number === badBus;
      pairs.push({
        charger_id: ch.id,
        vehicle_number: bus.number,
        depot_name: depot.name,
        performance_delta_pct: +(isBad ? -28 - r() * 8 : (r() - 0.5) * 16).toFixed(0),
        disconnect_rate_pct: +(isBad ? 14 + r() * 6 : r() * 6).toFixed(1),
        is_anomaly: isBad || (ci % 11 === 0 && bi === 0),
        note: isBad
          ? "Bus consistently underperforms on this charger"
          : ci % 11 === 0
            ? "Elevated disconnects across multiple buses"
            : "Within fleet compatibility norms",
      });
    });
  });
  return pairs.filter((p) => p.is_anomaly || p.performance_delta_pct < -12);
}

function buildChargingSessions(): ChargingSession[] {
  const sessions: ChargingSession[] = [];
  let seed = 4242;
  const r = seeded(seed);

  BUSES.forEach((bus, bi) => {
    const depot = DEPOTS.find((d) => d.id === bus.depot_id)!;
    const depotChargers = CHARGERS.filter((c) => c.depot_id === bus.depot_id);
    const abnormalBus = bi % 7 === 0;

    DATES_30.forEach((date) => {
      const daySessions = Math.round(1 + r() * 3);
      for (let s = 0; s < daySessions; s++) {
        const hour = Math.floor(r() * 24);
        const socStart = clamp(18 + r() * 55, 12, 78);
        const socDelta = clamp(22 + r() * 48 - (abnormalBus ? 12 : 0), 8, 72);
        const socEnd = clamp(socStart + socDelta, socStart + 5, 98);
        const duration = clamp(35 + r() * 100, 20, 180);
        const power = clamp(38 + r() * 35 - (abnormalBus ? 10 : 0), 25, 82);
        const energy = (power * duration) / 60;
        const disconnect = r() < (abnormalBus ? 0.18 : 0.06);
        const is_abnormal =
          disconnect || socDelta < 25 || power < 40 || (abnormalBus && r() > 0.7);

        sessions.push({
          session_id: `sess_${bus.id}_${date}_${s}`,
          date,
          hour,
          vehicle_id: bus.id,
          vehicle_number: bus.number,
          charger_id: depotChargers[s % depotChargers.length]?.id ?? "TV-UNK-01",
          depot_id: bus.depot_id,
          depot_name: depot.name,
          soc_start: +socStart.toFixed(1),
          soc_end: +socEnd.toFixed(1),
          soc_delta: +socDelta.toFixed(1),
          energy_kwh: +energy.toFixed(1),
          avg_power_kw: +power.toFixed(1),
          duration_min: Math.round(duration),
          disconnect,
          is_abnormal,
        });
      }
    });
  });
  return sessions;
}

export const BUS_HEALTH_DAILY = buildBusHealth();
export const CHARGER_HEALTH_DAILY = buildChargerHealth();
export const DEPOT_ENERGY_DAILY = buildDepotEnergy();
export const CHARGING_SESSIONS = buildChargingSessions();
export const ABNORMALITY_EVENTS = buildEvents();
export const MAINTENANCE_RECOMMENDATIONS = buildMaintenance();
export const CHARGER_BUS_COMPATIBILITY = buildCompatibility();

export function busRiskLevel(row: { abnormality_score: number; operational_health_score: number }): RiskLevel {
  return riskFromScore(row.abnormality_score, row.operational_health_score);
}

export const CHARGER_FILTER_OPTIONS = {
  depots: DEPOTS.map((d) => ({ id: d.id, name: d.name })),
  chargers: CHARGERS.map((c) => ({
    id: c.id,
    depot_id: c.depot_id,
    label: c.id,
  })),
  vehicles: BUSES.map((b) => ({
    id: b.id,
    number: b.number,
    depot_id: b.depot_id,
  })),
  transformers: [...TRANSFORMERS],
};
