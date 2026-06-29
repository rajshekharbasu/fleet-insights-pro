import { TRIPS, type Trip } from "./mock-data";

export interface Filters {
  drivers: string[];
  companies: string[];
  routes: string[];
  vehicles: string[];
  trips: string[];
  from: string; // ISO date
  to: string;   // ISO date
  /** Free-text search applied client-side (e.g. route name/code/company). Optional for backward compatibility. */
  search?: string;
}

export const DEFAULT_FILTERS: Filters = {
  drivers: [],
  companies: [],
  routes: [],
  vehicles: [],
  trips: [],
  from: new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
  search: "",
};

export function applyFilters(trips: Trip[], f: Filters): Trip[] {
  return trips.filter((t) => {
    if (t.scheduling_date < f.from || t.scheduling_date > f.to) return false;
    if (f.drivers.length && !f.drivers.includes(t.driver_name)) return false;
    if (f.companies.length && !f.companies.includes(t.company_name)) return false;
    if (f.routes.length && !f.routes.includes(t.route_code)) return false;
    if (f.vehicles.length && !f.vehicles.includes(t.vehiclenumber)) return false;
    if (f.trips.length && !f.trips.includes(t.trip_id)) return false;
    return true;
  });
}

export function previousPeriod(f: Filters): Filters {
  const from = new Date(f.from).getTime();
  const to = new Date(f.to).getTime();
  const span = to - from;
  return {
    ...f,
    from: new Date(from - span - 86400_000).toISOString().slice(0, 10),
    to: new Date(from - 86400_000).toISOString().slice(0, 10),
  };
}

export interface KpiSummary {
  netKwh: number;
  grossKwh: number;
  grossKwhPerKm: number;
  kwhPerKm: number;
  regenRatio: number;
  socDropPerKm: number;
  idleSharePct: number;
  anomalyRatePct: number;
  totalTrips: number;
  totalDistance: number;
}

export function summarize(trips: Trip[]): KpiSummary {
  if (!trips.length) {
    return { netKwh: 0, grossKwh: 0, grossKwhPerKm: 0, kwhPerKm: 0, regenRatio: 0, socDropPerKm: 0, idleSharePct: 0, anomalyRatePct: 0, totalTrips: 0, totalDistance: 0 };
  }
  const netKwh = trips.reduce((s, t) => s + t.net_kwh_consumed, 0);
  const totalDistance = trips.reduce((s, t) => s + t.trip_distance_km, 0);
  const grossDischarge = trips.reduce((s, t) => s + t.gross_discharge_kwh, 0);
  const regen = trips.reduce((s, t) => s + t.regen_kwh, 0);
  const idleKwh = trips.reduce((s, t) => s + t.idle_energy_kwh, 0);
  const socDrop = trips.reduce((s, t) => s + (t.battery_pack_state_of_charge_start - t.battery_pack_state_of_charge_end), 0);
  const anomalies = trips.filter((t) => t.efficiency_anomaly_flag).length;

  return {
    netKwh,
    grossKwh: grossDischarge,
    grossKwhPerKm: totalDistance > 0 ? grossDischarge / totalDistance : 0,
    kwhPerKm: netKwh / totalDistance,
    regenRatio: regen / grossDischarge,
    socDropPerKm: socDrop / totalDistance,
    idleSharePct: (idleKwh / netKwh) * 100,
    anomalyRatePct: (anomalies / trips.length) * 100,
    totalTrips: trips.length,
    totalDistance,
  };
}

export function trendByDay(trips: Trip[]) {
  const map = new Map<string, Trip[]>();
  for (const t of trips) {
    const arr = map.get(t.scheduling_date) ?? [];
    arr.push(t);
    map.set(t.scheduling_date, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayTrips]) => {
      const s = summarize(dayTrips);
      return {
        date,
        kwhPerKm: +s.kwhPerKm.toFixed(3),
        grossKwhPerKm: +s.grossKwhPerKm.toFixed(3),
        regenRatio: +(s.regenRatio * 100).toFixed(2),
        netKwh: +s.netKwh.toFixed(1),
        grossKwh: +s.grossKwh.toFixed(1),
        socDropPerKm: +s.socDropPerKm.toFixed(3),
        idleShare: +s.idleSharePct.toFixed(2),
        trips: s.totalTrips,
      };
    });
}

export type PivotDim = "driver_name" | "route_code" | "vehiclenumber" | "company_name" | "scheduling_date";

export interface PivotRow {
  key: string;
  label: string;
  trips: number;
  distance: number;
  netKwh: number;
  kwhPerKm: number;
  regenRatio: number;
  idleShare: number;
  anomalies: number;
}

/** Median of numeric samples (even count averages the two middle values). */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface PivotMedians {
  kwhPerKm: number;
  regenRatio: number;
  idleShare: number;
  anomalies: number;
  netKwh: number;
  trips: number;
  distance: number;
}

export function computePivotMedians(rows: PivotRow[]): PivotMedians {
  if (!rows.length) {
    return {
      kwhPerKm: 0,
      regenRatio: 0,
      idleShare: 0,
      anomalies: 0,
      netKwh: 0,
      trips: 0,
      distance: 0,
    };
  }
  return {
    kwhPerKm: +median(rows.map((r) => r.kwhPerKm)).toFixed(3),
    regenRatio: +median(rows.map((r) => r.regenRatio)).toFixed(2),
    idleShare: +median(rows.map((r) => r.idleShare)).toFixed(2),
    anomalies: +median(rows.map((r) => r.anomalies)).toFixed(1),
    netKwh: +median(rows.map((r) => r.netKwh)).toFixed(1),
    trips: +median(rows.map((r) => r.trips)).toFixed(0),
    distance: +median(rows.map((r) => r.distance)).toFixed(1),
  };
}

export function pivot(trips: Trip[], dim: PivotDim): PivotRow[] {
  const buckets = new Map<string, Trip[]>();
  for (const t of trips) {
    const k = String(t[dim]);
    const arr = buckets.get(k) ?? [];
    arr.push(t);
    buckets.set(k, arr);
  }
  return Array.from(buckets.entries()).map(([key, group]) => {
    const s = summarize(group);
    return {
      key,
      label: key,
      trips: s.totalTrips,
      distance: +s.totalDistance.toFixed(1),
      netKwh: +s.netKwh.toFixed(1),
      kwhPerKm: +s.kwhPerKm.toFixed(3),
      regenRatio: +(s.regenRatio * 100).toFixed(2),
      idleShare: +s.idleSharePct.toFixed(2),
      anomalies: group.filter((t) => t.efficiency_anomaly_flag).length,
    };
  });
}

export const ALL_TRIPS = TRIPS;
