export interface DailyKpiRecord {
  company_id: string;
  company_name: string;
  scheduling_date: string;
  kwh_per_km: number;
  regen_ratio: number;
  idle_ratio: number;
  soc_per_km: number;
  total_kwh: number;
  trip_count: number;
  anomaly_count: number;
  anomaly_rate_pct: number;
  avg_route_difficulty: number;
  snapshot_date: string;
}

import { KpiSummary } from "./analytics";

/**
 * Aggregates an array of daily GraphQL KPI records into a single KpiSummary
 * that the dashboard Overview section can use.
 */
export function aggregateGraphQlKpis(records: DailyKpiRecord[]): KpiSummary {
  if (!records || records.length === 0) {
    return {
      netKwh: 0,
      kwhPerKm: 0,
      regenRatio: 0,
      socDropPerKm: 0,
      idleSharePct: 0,
      anomalyRatePct: 0,
      totalTrips: 0,
      totalDistance: 0,
    };
  }

  let totalNetKwh = 0;
  let totalTrips = 0;
  let totalAnomalies = 0;
  let totalDistance = 0;

  let sumRegenRatioWeighted = 0;
  let sumIdleRatioWeighted = 0;
  let sumSocPerKmWeighted = 0;

  for (const r of records) {
    totalNetKwh += r.total_kwh;
    totalTrips += r.trip_count;
    totalAnomalies += r.anomaly_count;

    // Approximate distance since distance isn't directly provided:
    // total_kwh = kwh_per_km * distance  =>  distance = total_kwh / kwh_per_km
    const distance = r.kwh_per_km > 0 ? r.total_kwh / r.kwh_per_km : 0;
    totalDistance += distance;

    // Weighting ratios by distance or trips to get an accurate overall average
    sumRegenRatioWeighted += (r.regen_ratio / 100) * r.total_kwh; // assuming regen_ratio is e.g., 21.6 for 21.6%
    sumIdleRatioWeighted += r.idle_ratio * r.total_kwh; // assuming idle_ratio is e.g., 0.4 for 0.4%
    sumSocPerKmWeighted += r.soc_per_km * distance;
  }

  return {
    netKwh: totalNetKwh,
    kwhPerKm: totalDistance > 0 ? totalNetKwh / totalDistance : 0,
    // The UI multiplies regenRatio by 100, so we store it as a decimal (e.g. 0.21)
    regenRatio: totalNetKwh > 0 ? sumRegenRatioWeighted / totalNetKwh : 0,
    socDropPerKm: totalDistance > 0 ? sumSocPerKmWeighted / totalDistance : 0,
    // The UI displays idleSharePct directly (so 0.4 should remain 0.4)
    idleSharePct: totalNetKwh > 0 ? sumIdleRatioWeighted / totalNetKwh : 0,
    anomalyRatePct: totalTrips > 0 ? (totalAnomalies / totalTrips) * 100 : 0,
    totalTrips,
    totalDistance,
  };
}
