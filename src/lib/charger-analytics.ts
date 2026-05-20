import { median } from "@/lib/analytics";
import type {
  AbnormalityEvent,
  BusOperationalHealthDaily,
  ChargerHealthDaily,
  ChargingSession,
  DepotEnergyDaily,
  RiskLevel,
  TrendWindow,
} from "@/lib/charger-data";
import {
  ABNORMALITY_EVENTS,
  BUS_HEALTH_DAILY,
  CHARGER_HEALTH_DAILY,
  DEPOT_ENERGY_DAILY,
} from "@/lib/charger-data";

export interface ChargerFilters {
  from: string;
  to: string;
  depotIds: string[];
  chargerIds: string[];
  vehicleIds: string[];
  transformers: string[];
  severity: RiskLevel | "all";
  trendWindow: TrendWindow;
}

export const DEFAULT_CHARGER_FILTERS: ChargerFilters = {
  from: BUS_HEALTH_DAILY[BUS_HEALTH_DAILY.length - 30]?.date ?? new Date().toISOString().slice(0, 10),
  to: BUS_HEALTH_DAILY[BUS_HEALTH_DAILY.length - 1]?.date ?? new Date().toISOString().slice(0, 10),
  depotIds: [],
  chargerIds: [],
  vehicleIds: [],
  transformers: [],
  severity: "all",
  trendWindow: "30D",
};

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

export function filterBusRows(rows: BusOperationalHealthDaily[], f: ChargerFilters) {
  return rows.filter((r) => {
    if (!inRange(r.date, f.from, f.to)) return false;
    if (f.depotIds.length && !f.depotIds.includes(r.depot_id)) return false;
    if (f.vehicleIds.length && !f.vehicleIds.includes(r.vehicle_id)) return false;
    return true;
  });
}

export function filterChargerRows(rows: ChargerHealthDaily[], f: ChargerFilters) {
  return rows.filter((r) => {
    if (!inRange(r.date, f.from, f.to)) return false;
    if (f.depotIds.length && !f.depotIds.includes(r.depot_id)) return false;
    if (f.chargerIds.length && !f.chargerIds.includes(r.charger_id)) return false;
    if (f.transformers.length && !f.transformers.includes(r.transformer_id)) return false;
    return true;
  });
}

export function filterDepotRows(rows: DepotEnergyDaily[], f: ChargerFilters) {
  return rows.filter((r) => {
    if (!inRange(r.date, f.from, f.to)) return false;
    if (f.depotIds.length && !f.depotIds.includes(r.depot_id)) return false;
    return true;
  });
}

export interface ExecutiveKpis {
  totalEnergyKwh: number;
  activeChargers: number;
  avgChargerHealth: number;
  avgFleetHealth: number;
  abnormalChargers: number;
  abnormalBuses: number;
  dailySessions: number;
  disconnectRate: number;
  avgChargingPower: number;
  depotOperationalScore: number;
  energyDeltaPct: number;
  healthDeltaPct: number;
  sparkEnergy: { v: number }[];
  sparkHealth: { v: number }[];
  sparkSessions: { v: number }[];
}

export function executiveKpis(
  buses: BusOperationalHealthDaily[],
  chargers: ChargerHealthDaily[],
  depots: DepotEnergyDaily[],
): ExecutiveKpis {
  const lastDate = depots[depots.length - 1]?.date;
  const prevDate = depots[depots.length - 2]?.date;
  const todayDepots = depots.filter((d) => d.date === lastDate);
  const prevDepots = depots.filter((d) => d.date === prevDate);
  const todayChargers = chargers.filter((c) => c.date === lastDate);
  const todayBuses = buses.filter((b) => b.date === lastDate);

  const totalEnergyKwh = buses.reduce((s, b) => s + b.total_energy_kwh, 0);
  const prevEnergy = prevDepots.reduce((s, d) => s + d.total_energy_kwh, 0);
  const todayEnergy = todayDepots.reduce((s, d) => s + d.total_energy_kwh, 0);

  const dailyByDate = new Map<string, number>();
  depots.forEach((d) => dailyByDate.set(d.date, (dailyByDate.get(d.date) ?? 0) + d.total_energy_kwh));
  const sparkEnergy = [...dailyByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([, v]) => ({ v }));

  const healthByDate = new Map<string, number[]>();
  buses.forEach((b) => {
    const arr = healthByDate.get(b.date) ?? [];
    arr.push(b.operational_health_score);
    healthByDate.set(b.date, arr);
  });
  const sparkHealth = [...healthByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([, arr]) => ({ v: arr.reduce((s, x) => s + x, 0) / arr.length }));

  const sessionsByDate = new Map<string, number>();
  depots.forEach((d) => sessionsByDate.set(d.date, (sessionsByDate.get(d.date) ?? 0) + d.sessions));
  const sparkSessions = [...sessionsByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([, v]) => ({ v }));

  const avgFleetHealth = buses.length
    ? buses.reduce((s, b) => s + b.operational_health_score, 0) / buses.length
    : 0;
  const prevBusHealth = buses.filter((b) => b.date === prevDate);
  const prevAvgHealth = prevBusHealth.length
    ? prevBusHealth.reduce((s, b) => s + b.operational_health_score, 0) / prevBusHealth.length
    : avgFleetHealth;

  const totalSessions = depots.reduce((s, d) => s + d.sessions, 0);
  const totalDisconnects = chargers.reduce((s, c) => s + c.disconnect_sessions, 0);
  const totalChargerSessions = chargers.reduce((s, c) => s + c.sessions, 0);

  return {
    totalEnergyKwh,
    activeChargers: new Set(todayChargers.map((c) => c.charger_id)).size,
    avgChargerHealth: chargers.length
      ? chargers.reduce((s, c) => s + c.health_score, 0) / chargers.length
      : 0,
    avgFleetHealth,
    abnormalChargers: new Set(chargers.filter((c) => c.is_abnormal).map((c) => c.charger_id)).size,
    abnormalBuses: new Set(buses.filter((b) => b.is_abnormal).map((b) => b.vehicle_id)).size,
    dailySessions: todayDepots.reduce((s, d) => s + d.sessions, 0),
    disconnectRate: totalChargerSessions ? totalDisconnects / totalChargerSessions : 0,
    avgChargingPower: buses.length
      ? buses.reduce((s, b) => s + b.avg_charging_power_kw, 0) / buses.length
      : 0,
    depotOperationalScore: todayDepots.length
      ? todayDepots.reduce((s, d) => s + d.operational_score, 0) / todayDepots.length
      : 0,
    energyDeltaPct: prevEnergy ? ((todayEnergy - prevEnergy) / prevEnergy) * 100 : 0,
    healthDeltaPct: prevAvgHealth ? ((avgFleetHealth - prevAvgHealth) / prevAvgHealth) * 100 : 0,
    sparkEnergy,
    sparkHealth,
    sparkSessions,
  };
}

export interface BusLeaderboardRow {
  vehicle_id: string;
  vehicle_number: string;
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
  risk: RiskLevel;
  trend: number[];
}

export function busLeaderboard(rows: BusOperationalHealthDaily[]): BusLeaderboardRow[] {
  const byBus = new Map<string, BusOperationalHealthDaily[]>();
  rows.forEach((r) => {
    const arr = byBus.get(r.vehicle_id) ?? [];
    arr.push(r);
    byBus.set(r.vehicle_id, arr);
  });

  return [...byBus.entries()].map(([id, days]) => {
    const latest = days[days.length - 1];
    const sessions = days.reduce((s, d) => s + d.sessions, 0);
    const trend = days.slice(-14).map((d) => d.operational_health_score);
    const abnormality_score =
      days.reduce((s, d) => s + d.abnormality_score, 0) / days.length;
    const operational_health_score =
      days.reduce((s, d) => s + d.operational_health_score, 0) / days.length;

    let risk: RiskLevel = "healthy";
    if (abnormality_score >= 72 || operational_health_score < 45) risk = "critical";
    else if (abnormality_score >= 48 || operational_health_score < 62) risk = "warning";

    return {
      vehicle_id: id,
      vehicle_number: latest.vehicle_number,
      depot_name: latest.depot_name,
      vehicle_model: latest.vehicle_model,
      sessions,
      avg_charging_power_kw: days.reduce((s, d) => s + d.avg_charging_power_kw, 0) / days.length,
      avg_soc_delta: days.reduce((s, d) => s + d.avg_soc_delta, 0) / days.length,
      thermal_stress: days.reduce((s, d) => s + d.thermal_stress, 0) / days.length,
      disconnect_sessions: days.reduce((s, d) => s + d.disconnect_sessions, 0),
      operational_health_score,
      abnormality_score,
      total_energy_kwh: days.reduce((s, d) => s + d.total_energy_kwh, 0),
      risk,
      trend,
    };
  });
}

export interface ChargerLeaderboardRow {
  charger_id: string;
  depot_name: string;
  transformer_id: string;
  sessions: number;
  unique_buses: number;
  total_energy_kwh: number;
  avg_power_kw: number;
  disconnect_sessions: number;
  health_score: number;
  abnormality_score: number;
  trend: number[];
  risk: RiskLevel;
}

export function chargerLeaderboard(rows: ChargerHealthDaily[]): ChargerLeaderboardRow[] {
  const byCharger = new Map<string, ChargerHealthDaily[]>();
  rows.forEach((r) => {
    const arr = byCharger.get(r.charger_id) ?? [];
    arr.push(r);
    byCharger.set(r.charger_id, arr);
  });

  return [...byCharger.entries()].map(([id, days]) => {
    const latest = days[days.length - 1];
    const health_score = days.reduce((s, d) => s + d.health_score, 0) / days.length;
    const abnormality_score = days.reduce((s, d) => s + d.abnormality_score, 0) / days.length;
    let risk: RiskLevel = "healthy";
    if (abnormality_score >= 72 || health_score < 45) risk = "critical";
    else if (abnormality_score >= 48 || health_score < 62) risk = "warning";

    return {
      charger_id: id,
      depot_name: latest.depot_name,
      transformer_id: latest.transformer_id,
      sessions: days.reduce((s, d) => s + d.sessions, 0),
      unique_buses: Math.max(...days.map((d) => d.unique_buses)),
      total_energy_kwh: days.reduce((s, d) => s + d.total_energy_kwh, 0),
      avg_power_kw: days.reduce((s, d) => s + d.avg_power_kw, 0) / days.length,
      disconnect_sessions: days.reduce((s, d) => s + d.disconnect_sessions, 0),
      health_score,
      abnormality_score,
      trend: days.slice(-14).map((d) => d.health_score),
      risk,
    };
  });
}

export function dailyFleetTrends(buses: BusOperationalHealthDaily[], depots: DepotEnergyDaily[]) {
  const dates = [...new Set([...buses.map((b) => b.date), ...depots.map((d) => d.date)])].sort();
  return dates.map((date) => {
    const dayBuses = buses.filter((b) => b.date === date);
    const dayDepots = depots.filter((d) => d.date === date);
    return {
      date: date.slice(5),
      abnormalBuses: new Set(dayBuses.filter((b) => b.is_abnormal).map((b) => b.vehicle_id)).size,
      operationalHealth:
        dayBuses.length
          ? dayBuses.reduce((s, b) => s + b.operational_health_score, 0) / dayBuses.length
          : 0,
      disconnects: dayBuses.reduce((s, b) => s + b.disconnect_sessions, 0),
      thermalStress:
        dayBuses.length
          ? dayBuses.reduce((s, b) => s + b.thermal_stress, 0) / dayBuses.length
          : 0,
      abnormalityScore:
        dayBuses.length
          ? dayBuses.reduce((s, b) => s + b.abnormality_score, 0) / dayBuses.length
          : 0,
      sessions: dayDepots.reduce((s, d) => s + d.sessions, 0),
    };
  });
}

export function busPeerScatter(rows: BusOperationalHealthDaily[]) {
  const byBus = busLeaderboard(rows);
  return byBus.map((b) => ({
    vehicle: b.vehicle_number,
    avgPower: +b.avg_charging_power_kw.toFixed(1),
    thermal: +b.thermal_stress.toFixed(1),
    energy: +b.total_energy_kwh.toFixed(0),
    health: +b.operational_health_score.toFixed(1),
    risk: b.risk,
  }));
}

export function busThermalHeatmap(rows: BusOperationalHealthDaily[], maxBuses = 12) {
  const byBus = new Map<string, { label: string; days: { date: string; thermal: number }[] }>();
  rows.forEach((r) => {
    if (!byBus.has(r.vehicle_id)) {
      byBus.set(r.vehicle_id, { label: r.vehicle_number, days: [] });
    }
    byBus.get(r.vehicle_id)!.days.push({ date: r.date.slice(5), thermal: r.thermal_stress });
  });
  return [...byBus.values()]
    .sort((a, b) => {
      const avgA = a.days.reduce((s, d) => s + d.thermal, 0) / a.days.length;
      const avgB = b.days.reduce((s, d) => s + d.thermal, 0) / b.days.length;
      return avgB - avgA;
    })
    .slice(0, maxBuses);
}

export function chargerDailyTrends(chargers: ChargerHealthDaily[]) {
  const byDate = new Map<string, ChargerHealthDaily[]>();
  chargers.forEach((c) => {
    const arr = byDate.get(c.date) ?? [];
    arr.push(c);
    byDate.set(c.date, arr);
  });
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => ({
      date: date.slice(5),
      sessions: day.reduce((s, c) => s + c.sessions, 0),
      energy: +day.reduce((s, c) => s + c.total_energy_kwh, 0).toFixed(0),
      avgDuration:
        day.reduce((s, c) => s + c.avg_duration_min, 0) / day.length,
      disconnects: day.reduce((s, c) => s + c.disconnect_sessions, 0),
    }));
}

export function depotComparison(depots: DepotEnergyDaily[]) {
  const byDepot = new Map<string, DepotEnergyDaily[]>();
  depots.forEach((d) => {
    const arr = byDepot.get(d.depot_id) ?? [];
    arr.push(d);
    byDepot.set(d.depot_id, arr);
  });
  return [...byDepot.entries()].map(([id, days]) => {
    const latest = days[days.length - 1];
    return {
      depot: latest.depot_name,
      depot_id: id,
      energy: days.reduce((s, d) => s + d.total_energy_kwh, 0),
      sessions: days.reduce((s, d) => s + d.sessions, 0),
      operational_score: days.reduce((s, d) => s + d.operational_score, 0) / days.length,
      anomalies: days.reduce((s, d) => s + d.abnormality_count, 0),
      avg_power: days.reduce((s, d) => s + d.avg_charging_power_kw, 0) / days.length,
      expected_expense: days.reduce((s, d) => s + d.estimated_expense_inr, 0),
      disconnect_rate: days.reduce((s, d) => s + d.disconnect_rate, 0) / days.length,
    };
  });
}

export function transformerStress(depots: DepotEnergyDaily[]) {
  return depots.map((d) => ({
    date: d.date.slice(5),
    depot: d.depot_name,
    peak: d.peak_current_a,
    threshold: 380,
  }));
}

export function fleetMedians(buses: BusOperationalHealthDaily[], chargers: ChargerHealthDaily[]) {
  const busLb = busLeaderboard(buses);
  const chLb = chargerLeaderboard(chargers);
  return {
    busPower: median(busLb.map((b) => b.avg_charging_power_kw)),
    busThermal: median(busLb.map((b) => b.thermal_stress)),
    busHealth: median(busLb.map((b) => b.operational_health_score)),
    chargerPower: median(chLb.map((c) => c.avg_power_kw)),
    chargerHealth: median(chLb.map((c) => c.health_score)),
    chargerAbnormality: median(chLb.map((c) => c.abnormality_score)),
  };
}

export function filterEvents(events: AbnormalityEvent[], f: ChargerFilters) {
  if (f.severity === "all") return events;
  return events.filter((e) => e.severity === f.severity);
}

export function criticalRisks(
  buses: BusLeaderboardRow[],
  chargers: ChargerLeaderboardRow[],
  depots: ReturnType<typeof depotComparison>,
) {
  return {
    buses: [...buses].sort((a, b) => b.abnormality_score - a.abnormality_score).slice(0, 5),
    chargers: [...chargers].sort((a, b) => b.abnormality_score - a.abnormality_score).slice(0, 5),
    depots: [...depots].sort((a, b) => b.anomalies - a.anomalies).slice(0, 5),
  };
}

export function applyTrendWindow<T extends { date: string }>(
  rows: T[],
  window: TrendWindow,
): T[] {
  const days = window === "1D" ? 1 : window === "7D" ? 7 : 30;
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const cutoff = dates[dates.length - days] ?? dates[0];
  return rows.filter((r) => r.date >= cutoff);
}

export type ChargerKpiMetric =
  | "energy"
  | "soc_delta"
  | "charge_power"
  | "sessions"
  | "abnormality"
  | "disconnect_rate"
  | "duration";

export const KPI_METRIC_META: Record<
  ChargerKpiMetric,
  { label: string; unit: string; lowerIsBetter: boolean }
> = {
  energy: { label: "Energy delivered", unit: "kWh", lowerIsBetter: false },
  soc_delta: { label: "SOC gained", unit: "%", lowerIsBetter: false },
  charge_power: { label: "Avg charge power", unit: "kW", lowerIsBetter: false },
  sessions: { label: "Charging sessions", unit: "", lowerIsBetter: false },
  abnormality: { label: "Abnormality score", unit: "/100", lowerIsBetter: true },
  disconnect_rate: { label: "Disconnect rate", unit: "%", lowerIsBetter: true },
  duration: { label: "Avg session duration", unit: "min", lowerIsBetter: false },
};

export function filterSessions(sessions: ChargingSession[], f: ChargerFilters) {
  return sessions.filter((s) => {
    if (!inRange(s.date, f.from, f.to)) return false;
    if (f.depotIds.length && !f.depotIds.includes(s.depot_id)) return false;
    if (f.vehicleIds.length && !f.vehicleIds.includes(s.vehicle_id)) return false;
    if (f.chargerIds.length && !f.chargerIds.includes(s.charger_id)) return false;
    return true;
  });
}

export function applySessionTrendWindow(sessions: ChargingSession[], window: TrendWindow) {
  return applyTrendWindow(sessions, window);
}

function avg(nums: number[]) {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}

/** Daily KPI trend with fleet average & abnormal-day overlay. */
export function kpiTrendByDay(
  buses: BusOperationalHealthDaily[],
  chargers: ChargerHealthDaily[],
  depots: DepotEnergyDaily[],
  sessions: ChargingSession[],
  metric: ChargerKpiMetric,
) {
  const dates = [...new Set([
    ...buses.map((b) => b.date),
    ...chargers.map((c) => c.date),
    ...sessions.map((s) => s.date),
  ])].sort();

  return dates.map((date) => {
    const dayBuses = buses.filter((b) => b.date === date);
    const dayChargers = chargers.filter((c) => c.date === date);
    const daySessions = sessions.filter((s) => s.date === date);
    const dayDepots = depots.filter((d) => d.date === date);

    let value = 0;
    switch (metric) {
      case "energy":
        value = daySessions.length
          ? daySessions.reduce((s, x) => s + x.energy_kwh, 0)
          : dayBuses.reduce((s, b) => s + b.total_energy_kwh, 0);
        break;
      case "soc_delta":
        value = daySessions.length
          ? avg(daySessions.map((s) => s.soc_delta))
          : avg(dayBuses.map((b) => b.avg_soc_delta));
        break;
      case "charge_power":
        value = daySessions.length
          ? avg(daySessions.map((s) => s.avg_power_kw))
          : avg(dayBuses.map((b) => b.avg_charging_power_kw));
        break;
      case "sessions":
        value = daySessions.length || dayDepots.reduce((s, d) => s + d.sessions, 0);
        break;
      case "abnormality":
        value = dayBuses.length
          ? avg(dayBuses.map((b) => b.abnormality_score))
          : avg(dayChargers.map((c) => c.abnormality_score));
        break;
      case "disconnect_rate":
        value = daySessions.length
          ? (daySessions.filter((s) => s.disconnect).length / daySessions.length) * 100
          : dayChargers.length
            ? (dayChargers.reduce((s, c) => s + c.disconnect_sessions, 0) /
                Math.max(dayChargers.reduce((s, c) => s + c.sessions, 0), 1)) *
              100
            : 0;
        break;
      case "duration":
        value = daySessions.length
          ? avg(daySessions.map((s) => s.duration_min))
          : avg(dayChargers.map((c) => c.avg_duration_min));
        break;
    }

    const abnormalCount = daySessions.filter((s) => s.is_abnormal).length;

    return {
      date: date.slice(5),
      value: +value.toFixed(2),
      abnormalSessions: abnormalCount,
      abnormalBuses: new Set(dayBuses.filter((b) => b.is_abnormal).map((b) => b.vehicle_id)).size,
    };
  });
}

/** Hour-of-day profile for selected KPI (fleet average per hour). */
export function kpiTrendByHour(sessions: ChargingSession[], metric: ChargerKpiMetric) {
  const hours = Array.from({ length: 24 }, (_, hour) => {
    const hourSessions = sessions.filter((s) => s.hour === hour);
    let value = 0;
    if (!hourSessions.length) return { hour: `${hour}:00`, value: 0, abnormal: 0, sessions: 0 };

    switch (metric) {
      case "energy":
        value = hourSessions.reduce((s, x) => s + x.energy_kwh, 0);
        break;
      case "soc_delta":
        value = avg(hourSessions.map((s) => s.soc_delta));
        break;
      case "charge_power":
        value = avg(hourSessions.map((s) => s.avg_power_kw));
        break;
      case "sessions":
        value = hourSessions.length;
        break;
      case "abnormality":
        value = (hourSessions.filter((s) => s.is_abnormal).length / hourSessions.length) * 100;
        break;
      case "disconnect_rate":
        value = (hourSessions.filter((s) => s.disconnect).length / hourSessions.length) * 100;
        break;
      case "duration":
        value = avg(hourSessions.map((s) => s.duration_min));
        break;
    }

    return {
      hour: `${String(hour).padStart(2, "0")}:00`,
      value: +value.toFixed(2),
      abnormal: hourSessions.filter((s) => s.is_abnormal).length,
      sessions: hourSessions.length,
    };
  });
  return hours;
}

/** Energy vs SOC — each point is a session; color by abnormal. */
export function energyVsSocScatter(sessions: ChargingSession[]) {
  return sessions.map((s) => ({
    socStart: s.soc_start,
    socDelta: s.soc_delta,
    energy: s.energy_kwh,
    power: s.avg_power_kw,
    vehicle: s.vehicle_number,
    abnormal: s.is_abnormal,
    hour: s.hour,
  }));
}

export interface AbnormalityDriver {
  entity: string;
  entityType: "bus" | "charger";
  depot: string;
  abnormalityScore: number;
  drivers: {
    kpi: string;
    value: number;
    fleetAvg: number;
    unit: string;
    pctVsAvg: number;
    triggered: boolean;
  }[];
}

/** Explain abnormality using KPI deviations from fleet average. */
export function abnormalityDrivers(
  buses: BusLeaderboardRow[],
  chargers: ChargerLeaderboardRow[],
  sessions: ChargingSession[],
): AbnormalityDriver[] {
  const fleetEnergyPerSession = avg(sessions.map((s) => s.energy_kwh)) || 1;
  const fleetSoc = avg(sessions.map((s) => s.soc_delta)) || 1;
  const fleetPower = avg(sessions.map((s) => s.avg_power_kw)) || 1;
  const fleetDuration = avg(sessions.map((s) => s.duration_min)) || 1;

  const busDrivers: AbnormalityDriver[] = buses
    .filter((b) => b.risk !== "healthy")
    .slice(0, 8)
    .map((b) => {
      const busSessions = sessions.filter((s) => s.vehicle_number === b.vehicle_number);
      const energy = avg(busSessions.map((s) => s.energy_kwh));
      const soc = avg(busSessions.map((s) => s.soc_delta)) || b.avg_soc_delta;
      const power = avg(busSessions.map((s) => s.avg_power_kw)) || b.avg_charging_power_kw;
      const duration = avg(busSessions.map((s) => s.duration_min));
      const discRate = busSessions.length
        ? (busSessions.filter((s) => s.disconnect).length / busSessions.length) * 100
        : 0;

      const mk = (kpi: string, value: number, fleetAvg: number, unit: string, lowerBad: boolean) => {
        const pctVsAvg = ((value - fleetAvg) / fleetAvg) * 100;
        const triggered = lowerBad ? pctVsAvg > 15 : pctVsAvg < -15;
        return { kpi, value, fleetAvg, unit, pctVsAvg, triggered };
      };

      return {
        entity: `Bus ${b.vehicle_number}`,
        entityType: "bus" as const,
        depot: b.depot_name,
        abnormalityScore: b.abnormality_score,
        drivers: [
          mk("Energy / session", energy, fleetEnergyPerSession, "kWh", false),
          mk("SOC gained", soc, fleetSoc, "%", false),
          mk("Charge power", power, fleetPower, "kW", false),
          mk("Session duration", duration, fleetDuration, "min", false),
          mk("Disconnect rate", discRate, 8, "%", true),
          mk("Thermal stress", b.thermal_stress, 42, "/100", true),
        ],
      };
    });

  const chargerDrivers: AbnormalityDriver[] = chargers
    .filter((c) => c.risk !== "healthy")
    .slice(0, 5)
    .map((c) => {
      const mk = (kpi: string, value: number, fleetAvg: number, unit: string, lowerBad: boolean) => {
        const pctVsAvg = ((value - fleetAvg) / fleetAvg) * 100;
        const triggered = lowerBad ? pctVsAvg > 15 : pctVsAvg < -15;
        return { kpi, value, fleetAvg, unit, pctVsAvg, triggered };
      };
      return {
        entity: c.charger_id,
        entityType: "charger" as const,
        depot: c.depot_name,
        abnormalityScore: c.abnormality_score,
        drivers: [
          mk("Health score", c.health_score, 78, "/100", false),
          mk("Avg power", c.avg_power_kw, fleetPower, "kW", false),
          mk("Disconnects", c.disconnect_sessions, 4, "count", true),
          mk("Energy delivered", c.total_energy_kwh, 1200, "kWh", false),
        ],
      };
    });

  return [...busDrivers, ...chargerDrivers].sort((a, b) => b.abnormalityScore - a.abnormalityScore);
}

export interface ChargerStory {
  headline: string;
  bullets: string[];
  tone: "good" | "warning" | "critical";
}

export function buildChargerStory(
  kpis: ExecutiveKpis,
  trend: ReturnType<typeof kpiTrendByDay>,
  drivers: AbnormalityDriver[],
  metric: ChargerKpiMetric,
): ChargerStory {
  const meta = KPI_METRIC_META[metric];
  const recent = trend.slice(-7);
  const trendUp = recent.length >= 2 && recent[recent.length - 1].value > recent[0].value;
  const abnormalEntities = drivers.length;

  let headline = `Fleet delivered ${kpis.totalEnergyKwh.toLocaleString()} kWh with avg ${kpis.avgChargingPower.toFixed(0)} kW charge power.`;
  let tone: ChargerStory["tone"] = "good";

  if (kpis.abnormalBuses > 5 || kpis.disconnectRate > 0.12) {
    tone = "critical";
    headline = `${kpis.abnormalBuses} buses and ${kpis.abnormalChargers} chargers are abnormal — disconnect rate ${(kpis.disconnectRate * 100).toFixed(1)}% exceeds target.`;
  } else if (kpis.abnormalBuses > 2) {
    tone = "warning";
    headline = `Elevated abnormality: ${kpis.abnormalBuses} buses flagged; ${meta.label} ${trendUp ? "trending up" : "trending down"} over 7 days.`;
  }

  const bullets = [
    `${meta.label} in view: latest daily ${recent[recent.length - 1]?.value ?? "—"} ${meta.unit} (fleet window ${kpis.sparkEnergy.length}d).`,
    `Fleet health ${kpis.avgFleetHealth.toFixed(0)}/100 · charger health ${kpis.avgChargerHealth.toFixed(0)}/100 (${kpis.healthDeltaPct >= 0 ? "+" : ""}${kpis.healthDeltaPct.toFixed(1)}% vs prior period).`,
    abnormalEntities > 0
      ? `${abnormalEntities} entities have KPI drivers linked to abnormality — see breakdown below.`
      : "No major KPI drivers breaching fleet averages in the current filter.",
    `Peak charging pressure: review hour-of-day chart for overnight vs daytime energy & SOC patterns.`,
  ];

  return { headline, bullets, tone };
}

export function trendSummaryStats(trend: ReturnType<typeof kpiTrendByDay>) {
  const values = trend.map((t) => t.value);
  return {
    average: avg(values),
    median: median(values),
    peak: Math.max(...values, 0),
    latest: values[values.length - 1] ?? 0,
  };
}

export interface CommandKpiCard {
  id: string;
  label: string;
  value: string;
  unit?: string;
  delta: number;
  positiveIsGood: boolean;
  severity: RiskLevel | "neutral";
  spark: { v: number }[];
  insight: string;
}

export type BusBehaviorMetric =
  | "energy_per_soc"
  | "charge_acceptance"
  | "thermal_per_kwh"
  | "charge_power"
  | "disconnect_rate"
  | "consistency"
  | "abnormality";

export const BUS_BEHAVIOR_META: Record<
  BusBehaviorMetric,
  { label: string; unit: string; lowerIsBetter: boolean }
> = {
  energy_per_soc: { label: "Energy per SOC%", unit: "kWh/%", lowerIsBetter: true },
  charge_acceptance: { label: "Charge acceptance", unit: "%", lowerIsBetter: false },
  thermal_per_kwh: { label: "Thermal rise / kWh", unit: "", lowerIsBetter: true },
  charge_power: { label: "Charging speed", unit: "kW", lowerIsBetter: false },
  disconnect_rate: { label: "Disconnect rate", unit: "%", lowerIsBetter: true },
  consistency: { label: "Session stability", unit: "%", lowerIsBetter: false },
  abnormality: { label: "Abnormality score", unit: "/100", lowerIsBetter: true },
};

export function busBehaviorTrend(
  buses: BusOperationalHealthDaily[],
  metric: BusBehaviorMetric,
) {
  const dates = [...new Set(buses.map((b) => b.date))].sort();
  return dates.map((date) => {
    const day = buses.filter((b) => b.date === date);
    let value = 0;
    switch (metric) {
      case "energy_per_soc":
        value = avg(day.map((b) => b.energy_per_soc_pct));
        break;
      case "charge_acceptance":
        value = avg(day.map((b) => b.charge_acceptance_rate));
        break;
      case "thermal_per_kwh":
        value = avg(day.map((b) => b.thermal_rise_per_kwh));
        break;
      case "charge_power":
        value = avg(day.map((b) => b.avg_charging_power_kw));
        break;
      case "disconnect_rate":
        value = day.length
          ? (day.reduce((s, b) => s + b.disconnect_sessions, 0) /
              day.reduce((s, b) => s + b.sessions, 0)) *
            100
          : 0;
        break;
      case "consistency":
        value = avg(day.map((b) => b.charging_consistency));
        break;
      case "abnormality":
        value = avg(day.map((b) => b.abnormality_score));
        break;
    }
    return {
      date: date.slice(5),
      value: +value.toFixed(2),
      fleetAvg: value,
    };
  });
}

export function commandRibbonKpis(
  buses: BusOperationalHealthDaily[],
  chargers: ChargerHealthDaily[],
  depots: DepotEnergyDaily[],
  base: ExecutiveKpis,
): CommandKpiCard[] {
  const totalExpense = depots.reduce((s, d) => s + d.estimated_expense_inr, 0);
  const energyPerSoc = buses.length
    ? avg(buses.map((b) => b.energy_per_soc_pct))
    : 0;
  const prevExpense = depots.filter((d) => d.date === depots[depots.length - 2]?.date).reduce(
    (s, d) => s + d.estimated_expense_inr,
    0,
  );
  const expenseDelta = prevExpense ? ((totalExpense - prevExpense) / prevExpense) * 100 : 0;

  const sev = (v: number, warn: number, crit: number, invert = false): RiskLevel | "neutral" => {
    const x = invert ? 100 - v : v;
    if (x >= crit) return "critical";
    if (x >= warn) return "warning";
    return "neutral";
  };

  return [
    {
      id: "energy",
      label: "Total energy",
      value: base.totalEnergyKwh.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      unit: "kWh",
      delta: base.energyDeltaPct,
      positiveIsGood: true,
      severity: "neutral",
      spark: base.sparkEnergy,
      insight: `Fleet delivered ${base.totalEnergyKwh.toLocaleString()} kWh in window — ${base.energyDeltaPct >= 0 ? "up" : "down"} ${Math.abs(base.energyDeltaPct).toFixed(1)}% vs prior day aggregate.`,
    },
    {
      id: "fleet_health",
      label: "Fleet ops health",
      value: base.avgFleetHealth.toFixed(0),
      unit: "/100",
      delta: base.healthDeltaPct,
      positiveIsGood: true,
      severity: sev(base.avgFleetHealth, 62, 48, false),
      spark: base.sparkHealth,
      insight: `Composite bus operational score — ${base.abnormalBuses} buses flagged abnormal.`,
    },
    {
      id: "charger_health",
      label: "Charger health",
      value: base.avgChargerHealth.toFixed(0),
      unit: "/100",
      delta: base.healthDeltaPct * 0.8,
      positiveIsGood: true,
      severity: sev(base.avgChargerHealth, 65, 50, false),
      spark: base.sparkHealth,
      insight: `Infrastructure health index across ${base.activeChargers} active chargers.`,
    },
    {
      id: "active_chargers",
      label: "Active chargers",
      value: String(base.activeChargers),
      delta: 2.1,
      positiveIsGood: true,
      severity: "neutral",
      spark: base.sparkSessions,
      insight: "Chargers reporting sessions in the latest operational day.",
    },
    {
      id: "sessions",
      label: "Daily sessions",
      value: base.dailySessions.toLocaleString(),
      delta: 4.2,
      positiveIsGood: true,
      severity: "neutral",
      spark: base.sparkSessions,
      insight: "Depot-aggregated charging sessions for the latest day in filter.",
    },
    {
      id: "abnormal_buses",
      label: "Abnormal buses",
      value: String(base.abnormalBuses),
      delta: -3,
      positiveIsGood: false,
      severity: base.abnormalBuses > 5 ? "critical" : base.abnormalBuses > 2 ? "warning" : "neutral",
      spark: base.sparkHealth,
      insight: "Buses breaching abnormality thresholds on thermal, disconnect, or efficiency KPIs.",
    },
    {
      id: "abnormal_chargers",
      label: "Abnormal chargers",
      value: String(base.abnormalChargers),
      delta: 1.2,
      positiveIsGood: false,
      severity: base.abnormalChargers > 4 ? "critical" : base.abnormalChargers > 2 ? "warning" : "neutral",
      spark: base.sparkSessions,
      insight: "Chargers with elevated disconnect or declining throughput.",
    },
    {
      id: "depot_score",
      label: "Depot ops score",
      value: base.depotOperationalScore.toFixed(0),
      unit: "/100",
      delta: 1.8,
      positiveIsGood: true,
      severity: sev(base.depotOperationalScore, 68, 55, false),
      spark: base.sparkEnergy,
      insight: "Weighted depot operational stability for selected filters.",
    },
    {
      id: "disconnect",
      label: "Disconnect rate",
      value: (base.disconnectRate * 100).toFixed(1),
      unit: "%",
      delta: -0.4,
      positiveIsGood: false,
      severity: base.disconnectRate > 0.12 ? "critical" : base.disconnectRate > 0.08 ? "warning" : "neutral",
      spark: base.sparkSessions,
      insight: "Session-level disconnect frequency across charger infrastructure.",
    },
    {
      id: "expected_expense",
      label: "Expected expense",
      value: `₹${(totalExpense / 100000).toFixed(2)}L`,
      delta: expenseDelta,
      positiveIsGood: false,
      severity: expenseDelta > 8 ? "warning" : "neutral",
      spark: base.sparkEnergy,
      insight: `Tariff-modeled depot charging cost before bill reconciliation — watch leaks vs utility invoice (${expenseDelta >= 0 ? "+" : ""}${expenseDelta.toFixed(1)}% vs prior day).`,
    },
    {
      id: "power",
      label: "Avg charge power",
      value: base.avgChargingPower.toFixed(1),
      unit: "kW",
      delta: 0.9,
      positiveIsGood: true,
      severity: "neutral",
      spark: base.sparkHealth,
      insight: "Mean delivery power — proxy for charging speed fleet-wide.",
    },
    {
      id: "energy_soc",
      label: "Energy / SOC%",
      value: energyPerSoc.toFixed(2),
      unit: "kWh/%",
      delta: -1.2,
      positiveIsGood: false,
      severity: energyPerSoc > 2.8 ? "warning" : "neutral",
      spark: base.sparkEnergy,
      insight: "Efficiency of energy delivered per percent state-of-charge gained.",
    },
  ];
}

export function chargerLeaderboardExtended(rows: ChargerHealthDaily[]): (ChargerLeaderboardRow & {
  utilization_pct: number;
  estimated_expense_inr: number;
})[] {
  return chargerLeaderboard(rows).map((c) => {
    const days = rows.filter((r) => r.charger_id === c.charger_id);
    return {
      ...c,
      utilization_pct: avg(days.map((d) => d.utilization_pct)),
      estimated_expense_inr: days.reduce((s, d) => s + d.estimated_expense_inr, 0),
    };
  });
}

export function busLeaderboardExtended(rows: BusOperationalHealthDaily[]): (BusLeaderboardRow & {
  energy_per_soc_pct: number;
  charge_acceptance_rate: number;
  thermal_rise_per_kwh: number;
  charging_consistency: number;
})[] {
  return busLeaderboard(rows).map((b) => {
    const days = rows.filter((r) => r.vehicle_id === b.vehicle_id);
    return {
      ...b,
      energy_per_soc_pct: avg(days.map((d) => d.energy_per_soc_pct)),
      charge_acceptance_rate: avg(days.map((d) => d.charge_acceptance_rate)),
      thermal_rise_per_kwh: avg(days.map((d) => d.thermal_rise_per_kwh)),
      charging_consistency: avg(days.map((d) => d.charging_consistency)),
    };
  });
}

/** KPIs plotted for unhealthy buses — 30-day daily series from bus_operational_health_daily. */
export type BusKpiTrendKey =
  | "total_energy_kwh"
  | "total_duration_mins"
  | "avg_power_kw"
  | "avg_soc_delta"
  | "avg_thermal_rise_c"
  | "operational_health_score"
  | "abnormality_score";

export const BUS_KPI_TREND_KEYS: BusKpiTrendKey[] = [
  "total_energy_kwh",
  "total_duration_mins",
  "avg_power_kw",
  "avg_soc_delta",
  "avg_thermal_rise_c",
  "operational_health_score",
  "abnormality_score",
];

export const BUS_KPI_TREND_META: Record<
  BusKpiTrendKey,
  { label: string; unit: string; lowerIsBetter: boolean; pick: (b: BusOperationalHealthDaily) => number }
> = {
  total_energy_kwh: {
    label: "Total energy",
    unit: "kWh",
    lowerIsBetter: false,
    pick: (b) => b.total_energy_kwh,
  },
  total_duration_mins: {
    label: "Total duration",
    unit: "min",
    lowerIsBetter: false,
    pick: (b) => b.total_duration_mins,
  },
  avg_power_kw: {
    label: "Avg power",
    unit: "kW",
    lowerIsBetter: false,
    pick: (b) => b.avg_charging_power_kw,
  },
  avg_soc_delta: {
    label: "Avg SOC delta",
    unit: "%",
    lowerIsBetter: false,
    pick: (b) => b.avg_soc_delta,
  },
  avg_thermal_rise_c: {
    label: "Avg thermal rise",
    unit: "°C",
    lowerIsBetter: true,
    pick: (b) => b.thermal_stress,
  },
  operational_health_score: {
    label: "Operational health",
    unit: "/100",
    lowerIsBetter: false,
    pick: (b) => b.operational_health_score,
  },
  abnormality_score: {
    label: "Abnormality (30D)",
    unit: "/100",
    lowerIsBetter: true,
    pick: (b) => b.abnormality_score,
  },
};

export interface BusKpiTrendPoint {
  date: string;
  value: number;
  fleetMedian: number;
}

export function busKpiTrend30d(
  rows: BusOperationalHealthDaily[],
  vehicleId: string,
  metric: BusKpiTrendKey,
  dayLimit = 30,
): BusKpiTrendPoint[] {
  const pick = BUS_KPI_TREND_META[metric].pick;
  const dates = [...new Set(rows.map((b) => b.date))].sort().slice(-dayLimit);

  return dates.map((date) => {
    const dayFleet = rows.filter((b) => b.date === date);
    const busDay = dayFleet.find((b) => b.vehicle_id === vehicleId);
    const fleetValues = dayFleet.map(pick);
    return {
      date: date.slice(5),
      value: busDay ? +pick(busDay).toFixed(2) : 0,
      fleetMedian: fleetValues.length ? +median(fleetValues).toFixed(2) : 0,
    };
  });
}

export function busKpiTrends30d(
  rows: BusOperationalHealthDaily[],
  vehicleId: string,
  dayLimit = 30,
): Record<BusKpiTrendKey, BusKpiTrendPoint[]> {
  return Object.fromEntries(
    BUS_KPI_TREND_KEYS.map((k) => [k, busKpiTrend30d(rows, vehicleId, k, dayLimit)]),
  ) as Record<BusKpiTrendKey, BusKpiTrendPoint[]>;
}

/** Buses flagged abnormal in data or breaching health thresholds in the leaderboard. */
export function abnormalBusRows(
  daily: BusOperationalHealthDaily[],
  leaderboard: BusLeaderboardRow[],
): BusLeaderboardRow[] {
  const abnormalIds = new Set(
    daily.filter((b) => b.is_abnormal).map((b) => b.vehicle_id),
  );
  return [...leaderboard]
    .filter((b) => b.risk !== "healthy" || abnormalIds.has(b.vehicle_id))
    .sort((a, b) => b.abnormality_score - a.abnormality_score);
}

/** KPIs plotted for unhealthy chargers — 30-day daily series from gold_charger_health_daily. */
export type ChargerKpiTrendKey =
  | "total_energy_kwh"
  | "avg_power_kw"
  | "avg_duration_mins"
  | "disconnect_sessions"
  | "charger_health_score"
  | "abnormality_score";

export const CHARGER_KPI_TREND_KEYS: ChargerKpiTrendKey[] = [
  "total_energy_kwh",
  "avg_power_kw",
  "avg_duration_mins",
  "disconnect_sessions",
  "charger_health_score",
  "abnormality_score",
];

export const CHARGER_KPI_TREND_META: Record<
  ChargerKpiTrendKey,
  { label: string; unit: string; lowerIsBetter: boolean; pick: (c: ChargerHealthDaily) => number }
> = {
  total_energy_kwh: {
    label: "Total energy",
    unit: "kWh",
    lowerIsBetter: false,
    pick: (c) => c.total_energy_kwh,
  },
  avg_power_kw: {
    label: "Avg power",
    unit: "kW",
    lowerIsBetter: false,
    pick: (c) => c.avg_power_kw,
  },
  avg_duration_mins: {
    label: "Avg duration",
    unit: "min",
    lowerIsBetter: false,
    pick: (c) => c.avg_duration_min,
  },
  disconnect_sessions: {
    label: "Disconnects",
    unit: "sessions",
    lowerIsBetter: true,
    pick: (c) => c.disconnect_sessions,
  },
  charger_health_score: {
    label: "Charger health",
    unit: "/100",
    lowerIsBetter: false,
    pick: (c) => c.health_score,
  },
  abnormality_score: {
    label: "Abnormality (30D)",
    unit: "/100",
    lowerIsBetter: true,
    pick: (c) => c.abnormality_score,
  },
};

export interface ChargerKpiTrendPoint {
  date: string;
  value: number;
  fleetMedian: number;
}

export function chargerKpiTrend30d(
  rows: ChargerHealthDaily[],
  chargerId: string,
  metric: ChargerKpiTrendKey,
  dayLimit = 30,
): ChargerKpiTrendPoint[] {
  const pick = CHARGER_KPI_TREND_META[metric].pick;
  const dates = [...new Set(rows.map((c) => c.date))].sort().slice(-dayLimit);

  return dates.map((date) => {
    const dayFleet = rows.filter((c) => c.date === date);
    const chargerDay = dayFleet.find((c) => c.charger_id === chargerId);
    const fleetValues = dayFleet.map(pick);
    return {
      date: date.slice(5),
      value: chargerDay ? +pick(chargerDay).toFixed(2) : 0,
      fleetMedian: fleetValues.length ? +median(fleetValues).toFixed(2) : 0,
    };
  });
}

export function chargerKpiTrends30d(
  rows: ChargerHealthDaily[],
  chargerId: string,
  dayLimit = 30,
): Record<ChargerKpiTrendKey, ChargerKpiTrendPoint[]> {
  return Object.fromEntries(
    CHARGER_KPI_TREND_KEYS.map((k) => [k, chargerKpiTrend30d(rows, chargerId, k, dayLimit)]),
  ) as Record<ChargerKpiTrendKey, ChargerKpiTrendPoint[]>;
}

/** Chargers flagged abnormal in data or breaching health thresholds in the leaderboard. */
export function abnormalChargerRows(
  daily: ChargerHealthDaily[],
  leaderboard: ChargerLeaderboardRow[],
): ChargerLeaderboardRow[] {
  const abnormalIds = new Set(
    daily.filter((c) => c.is_abnormal).map((c) => c.charger_id),
  );
  return [...leaderboard]
    .filter((c) => c.risk !== "healthy" || abnormalIds.has(c.charger_id))
    .sort((a, b) => b.abnormality_score - a.abnormality_score);
}
