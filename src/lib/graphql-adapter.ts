import { KpiSummary } from "./analytics";

export interface FleetKpiRecord {
  companyid: number;
  companyname: string;
  curr_trip_count: number;
  curr_active_drivers: number;
  curr_active_vehicles: number;
  curr_total_net_kwh: number;
  curr_total_gross_kwh: number;
  curr_total_regen_kwh: number;
  curr_total_distance_km: number;
  curr_gross_kwh_per_km: number;
  curr_net_kwh_per_km: number;
  curr_regen_pct: number;
  curr_idle_pct: number;
  curr_soc_drop_per_km: number;
  curr_median_net_kwh_per_km: number;
  curr_median_regen_pct: number;
  curr_median_idle_pct: number;
  curr_median_soc_drop_per_km: number;
  prev_trip_count: number;
  prev_total_net_kwh: number;
  prev_total_gross_kwh: number;
  prev_total_distance_km: number;
  prev_gross_kwh_per_km: number;
  prev_net_kwh_per_km: number;
  prev_regen_pct: number;
  prev_idle_pct: number;
  prev_soc_drop_per_km: number;
  prev_median_net_kwh_per_km: number;
  prev_median_regen_pct: number;
  prev_median_idle_pct: number;
  prev_median_soc_drop_per_km: number;
  current_period_start: string;
  current_period_end: string;
  prev_period_start: string;
  prev_period_end: string;
  snapshot_date: string;
}

export interface DailyTrendRecord {
  companyid: number;
  companyname: string;
  scheduling_date: string;
  gross_kwh_per_km: number;
  net_kwh_per_km: number;
  regen_pct: number;
  total_net_kwh: number;
  total_gross_kwh: number;
  bms_trip_count: number;
  idle_pct: number;
  soc_per_km: number;
  total_trip_count: number;
  snapshot_date: string;
}

export interface FleetKpiMedians {
  kwhPerKm: number;
  regenRatio: number;
  idleShare: number;
  socDropPerKm: number;
}

export interface FleetKpiAggregate {
  current: KpiSummary;
  previous: KpiSummary;
  medians: FleetKpiMedians;
}

const EMPTY_SUMMARY: KpiSummary = {
  netKwh: 0,
  grossKwh: 0,
  grossKwhPerKm: 0,
  kwhPerKm: 0,
  regenRatio: 0,
  socDropPerKm: 0,
  idleSharePct: 0,
  anomalyRatePct: 0,
  totalTrips: 0,
  totalDistance: 0,
};

function buildPeriodSummary(
  totalNetKwh: number,
  totalGrossKwh: number,
  totalTrips: number,
  totalDistance: number,
  sumRegenPctWeighted: number,
  sumIdlePctWeighted: number,
  sumSocWeighted: number,
): KpiSummary {
  if (totalTrips === 0 && totalNetKwh === 0) return { ...EMPTY_SUMMARY };

  return {
    netKwh: totalNetKwh,
    grossKwh: totalGrossKwh,
    grossKwhPerKm: totalDistance > 0 ? totalGrossKwh / totalDistance : 0,
    kwhPerKm: totalDistance > 0 ? totalNetKwh / totalDistance : 0,
    // UI multiplies regenRatio by 100; mart stores regen as percentage
    regenRatio: totalNetKwh > 0 ? sumRegenPctWeighted / totalNetKwh / 100 : 0,
    socDropPerKm: totalDistance > 0 ? sumSocWeighted / totalDistance : 0,
    idleSharePct: totalNetKwh > 0 ? sumIdlePctWeighted / totalNetKwh : 0,
    anomalyRatePct: 0,
    totalTrips,
    totalDistance,
  };
}

/**
 * Aggregates mart_fleet_kpis rows (one per company) into fleet-wide current/previous summaries.
 */
export function aggregateFleetKpis(records: FleetKpiRecord[]): FleetKpiAggregate {
  if (!records?.length) {
    return {
      current: { ...EMPTY_SUMMARY },
      previous: { ...EMPTY_SUMMARY },
      medians: { kwhPerKm: 0, regenRatio: 0, idleShare: 0, socDropPerKm: 0 },
    };
  }

  let currNet = 0;
  let currGross = 0;
  let currTrips = 0;
  let currDistance = 0;
  let currRegenWeighted = 0;
  let currIdleWeighted = 0;
  let currSocWeighted = 0;

  let prevNet = 0;
  let prevGross = 0;
  let prevTrips = 0;
  let prevDistance = 0;
  let prevRegenWeighted = 0;
  let prevIdleWeighted = 0;
  let prevSocWeighted = 0;

  let medianKwhWeighted = 0;
  let medianRegenWeighted = 0;
  let medianIdleWeighted = 0;
  let medianSocWeighted = 0;
  let medianWeight = 0;

  for (const r of records) {
    currNet += r.curr_total_net_kwh;
    currGross += r.curr_total_gross_kwh;
    currTrips += r.curr_trip_count;
    currDistance += r.curr_total_distance_km;
    currRegenWeighted += r.curr_regen_pct * r.curr_total_net_kwh;
    currIdleWeighted += r.curr_idle_pct * r.curr_total_net_kwh;
    currSocWeighted += r.curr_soc_drop_per_km * r.curr_total_distance_km;

    prevNet += r.prev_total_net_kwh;
    prevGross += r.prev_total_gross_kwh;
    prevTrips += r.prev_trip_count;
    prevDistance += r.prev_total_distance_km;
    prevRegenWeighted += r.prev_regen_pct * r.prev_total_net_kwh;
    prevIdleWeighted += r.prev_idle_pct * r.prev_total_net_kwh;
    prevSocWeighted += r.prev_soc_drop_per_km * r.prev_total_distance_km;

    const w = r.curr_trip_count || 1;
    medianKwhWeighted += r.curr_median_net_kwh_per_km * w;
    medianRegenWeighted += r.curr_median_regen_pct * w;
    medianIdleWeighted += r.curr_median_idle_pct * w;
    medianSocWeighted += r.curr_median_soc_drop_per_km * w;
    medianWeight += w;
  }

  return {
    current: buildPeriodSummary(
      currNet,
      currGross,
      currTrips,
      currDistance,
      currRegenWeighted,
      currIdleWeighted,
      currSocWeighted,
    ),
    previous: buildPeriodSummary(
      prevNet,
      prevGross,
      prevTrips,
      prevDistance,
      prevRegenWeighted,
      prevIdleWeighted,
      prevSocWeighted,
    ),
    medians: {
      kwhPerKm: medianWeight > 0 ? medianKwhWeighted / medianWeight : 0,
      regenRatio: medianWeight > 0 ? medianRegenWeighted / medianWeight : 0,
      idleShare: medianWeight > 0 ? medianIdleWeighted / medianWeight : 0,
      socDropPerKm: medianWeight > 0 ? medianSocWeighted / medianWeight : 0,
    },
  };
}
