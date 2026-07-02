import { GRAPHQL_API_URL } from "./config";

function parseSqlQueryResult<T>(result: T[] | { error?: string } | null | undefined): T[] {
  if (!result) return [];
  if (!Array.isArray(result)) {
    throw new Error(result.error || "GraphQL sqlQuery error");
  }
  return result;
}

function sqlStr(v: string): string {
  return `'${String(v).replace(/'/g, "''")}'`;
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const str = (v: unknown): string | null => (v == null || v === "" ? null : String(v));

const TRIP_BEHAVIOR_TABLES = [
  "driver_trip_behavior_fact",
  "glue_catalog.gold_db.driver_trip_behavior_fact",
] as const;

async function runSql<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query DriverTripBehavior($sql: String!) { sqlQuery(sql: $sql) }`,
      variables: { sql },
    }),
  });
  if (!res.ok) throw new Error(`sqlQuery failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "GraphQL query error");
  return parseSqlQueryResult<T>(json.data?.sqlQuery);
}

function isTableMissingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /does not exist|Catalog Error/i.test(msg);
}

/** Daily rollup of trip-level rows from driver_trip_behavior_fact (scoring basis). */
export interface DriverDailyTripRow {
  schedulingDate: string;
  tripCount: number;
  totalDistanceKm: number;
  avgEfficiencyKwhPerKm: number;
  medianEfficiencyKwhPerKm: number;
  avgRouteDifficulty: number;
  dmsEvents: number;
  avgBrakingDensity: number;
  avgOverspeedDensity: number;
  avgDistractionDensity: number;
  avgFatigueDensity: number;
  avgRegenPct: number;
  driverStars: number;
  highRiskTrips: number;
}

/** Single trip row from driver_trip_behavior_fact (no daily rollup). */
export interface DriverTripDetailRow {
  tripId: string;
  schedulingDate: string;
  routeName: string | null;
  routeCode: string | null;
  timeBucket: string | null;
  vehicleSize: string | null;
  vehicleNumber: string | null;
  busCode: string | null;
  tripStartTime: string | null;
  tripEndTime: string | null;
  actualTripStartTime: string | null;
  actualTripEndTime: string | null;
  actualTripDurationMin: number | null;
  actualDistanceKm: number;
  kwhPerKm: number;
  routeDifficultyScore: number;
  totalDmsEvents: number;
  hardBrakingDensity: number;
  overspeedDensity: number;
  distractionDensity: number;
  fatigueDensity: number;
  regenRatio: number;
  driverStarCount: number;
  behaviorRiskFlag: string | null;
}

export interface DriverTripBehaviorFilters {
  fromDate?: string;
  toDate?: string;
}

/** Rolling window length aligned with driver score leaderboard (days inclusive of anchor). */
export const TRIP_BEHAVIOR_WINDOW_DAYS = 30;

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatISODate(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Inclusive [anchor − windowDays, anchor] scheduling_date range. */
export function computeTripBehaviorWindow(
  anchorDate: string,
  windowDays = TRIP_BEHAVIOR_WINDOW_DAYS,
): { fromDate: string; toDate: string } {
  const toDate = formatISODate(parseISODate(anchorDate));
  const from = parseISODate(toDate);
  from.setDate(from.getDate() - windowDays);
  return { fromDate: formatISODate(from), toDate };
}

/** Prefer leaderboard scoring window end, then snapshot date. */
export function pickLeaderboardAnchorDate(extras?: {
  windowEndDate?: string | null;
  snapshotDate?: string | null;
}): string | null {
  const raw = extras?.windowEndDate ?? extras?.snapshotDate ?? null;
  return raw ? raw.slice(0, 10) : null;
}

function buildMaxDateSql(table: string, driverId: string): string {
  return `
    SELECT max(scheduling_date) AS max_date
    FROM ${table}
    WHERE driver_id = ${sqlStr(driverId)}
  `;
}

/** Latest scheduling_date for a driver in driver_trip_behavior_fact, or null. */
export async function fetchDriverMaxSchedulingDate(driverId: string): Promise<string | null> {
  let lastError: unknown;
  for (const table of TRIP_BEHAVIOR_TABLES) {
    try {
      const rows = await runSql<Record<string, unknown>>(buildMaxDateSql(table, driverId));
      const raw = str(rows[0]?.max_date);
      return raw ? raw.slice(0, 10) : null;
    } catch (err) {
      lastError = err;
      if (!isTableMissingError(err)) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Anchor for the daily-trip window: leaderboard window_end_date or snapshot_date,
 * else MAX(scheduling_date) from the fact table, else today (local).
 */
export async function resolveDriverTripBehaviorAnchor(
  driverId: string,
  extras?: { windowEndDate?: string | null; snapshotDate?: string | null },
): Promise<string> {
  const fromLeaderboard = pickLeaderboardAnchorDate(extras);
  if (fromLeaderboard) return fromLeaderboard;
  const maxDate = await fetchDriverMaxSchedulingDate(driverId);
  if (maxDate) return maxDate;
  return formatISODate(new Date());
}

function buildDailySql(table: string, driverId: string, limit: number, filters?: DriverTripBehaviorFilters): string {
  const clauses = [`driver_id = ${sqlStr(driverId)}`];
  if (filters?.fromDate) clauses.push(`scheduling_date >= ${sqlStr(filters.fromDate)}`);
  if (filters?.toDate) clauses.push(`scheduling_date <= ${sqlStr(filters.toDate)}`);

  return `
    SELECT
      scheduling_date,
      count(*) AS trip_count,
      round(sum(distance_km_odo_trip), 1) AS total_distance_km,
      round(avg(kwh_per_km), 4) AS avg_efficiency,
      round(median(kwh_per_km), 4) AS median_efficiency,
      round(avg(route_difficulty_score), 1) AS avg_exposure,
      sum(total_dms_events) AS dms_events,
      round(avg(hard_braking_density_per_100km), 2) AS avg_braking_density,
      round(avg(overspeed_density_per_100km), 2) AS avg_overspeed_density,
      round(avg(distraction_density_per_100km), 2) AS avg_distraction_density,
      round(avg(fatigue_density_per_100km), 2) AS avg_fatigue_density,
      round(avg(regen_ratio) * 100, 1) AS avg_regen_pct,
      sum(coalesce(driver_star_count, 0)) AS driver_stars,
      sum(CASE WHEN behavior_risk_flag = 'HIGH' THEN 1 ELSE 0 END) AS high_risk_trips
    FROM ${table}
    WHERE ${clauses.join(" AND ")}
    GROUP BY scheduling_date
    ORDER BY scheduling_date ASC
    LIMIT ${limit}
  `;
}

function mapDailyRow(row: Record<string, unknown>): DriverDailyTripRow {
  const rawDate = str(row.scheduling_date) ?? "";
  const schedulingDate = rawDate.slice(0, 10);

  return {
    schedulingDate,
    tripCount: Math.round(num(row.trip_count)),
    totalDistanceKm: num(row.total_distance_km),
    avgEfficiencyKwhPerKm: num(row.avg_efficiency),
    medianEfficiencyKwhPerKm: num(row.median_efficiency),
    avgRouteDifficulty: num(row.avg_exposure),
    dmsEvents: Math.round(num(row.dms_events)),
    avgBrakingDensity: num(row.avg_braking_density),
    avgOverspeedDensity: num(row.avg_overspeed_density),
    avgDistractionDensity: num(row.avg_distraction_density),
    avgFatigueDensity: num(row.avg_fatigue_density),
    avgRegenPct: num(row.avg_regen_pct),
    driverStars: Math.round(num(row.driver_stars)),
    highRiskTrips: Math.round(num(row.high_risk_trips)),
  };
}

/**
 * Fetches per-day trip behavior rollups for one driver from driver_trip_behavior_fact.
 * Rows are ordered chronologically (oldest first).
 * Default limit covers a 30-day window plus one spare row.
 */
export async function fetchDriverTripBehavior(
  driverId: string,
  limit = TRIP_BEHAVIOR_WINDOW_DAYS + 1,
  filters?: DriverTripBehaviorFilters,
): Promise<DriverDailyTripRow[]> {
  let lastError: unknown;
  for (const table of TRIP_BEHAVIOR_TABLES) {
    try {
      const sql = buildDailySql(table, driverId, limit, filters);
      const rows = await runSql<Record<string, unknown>>(sql);
      return rows.map(mapDailyRow);
    } catch (err) {
      lastError = err;
      if (!isTableMissingError(err)) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildTripDetailSelect(): string {
  return `
      trip_id,
      scheduling_date,
      route_name,
      route_code,
      time_bucket,
      vehicle_size,
      vehicle_number,
      bus_code,
      trip_start_time,
      trip_end_time,
      actual_trip_start_time,
      actual_trip_end_time,
      actual_trip_duration_min,
      distance_km_odo_trip,
      kwh_per_km,
      route_difficulty_score,
      total_dms_events,
      hard_braking_density_per_100km,
      overspeed_density_per_100km,
      distraction_density_per_100km,
      fatigue_density_per_100km,
      regen_ratio,
      driver_star_count,
      behavior_risk_flag`;
}

function buildTripDetailSql(table: string, driverId: string, schedulingDate: string): string {
  return `
    SELECT${buildTripDetailSelect()}
    FROM ${table}
    WHERE driver_id = ${sqlStr(driverId)}
      AND scheduling_date = ${sqlStr(schedulingDate)}
    ORDER BY coalesce(actual_trip_start_time, trip_start_time) ASC
  `;
}

function buildTripWindowSql(table: string, driverId: string, filters?: DriverTripBehaviorFilters): string {
  const clauses = [`driver_id = ${sqlStr(driverId)}`];
  if (filters?.fromDate) clauses.push(`scheduling_date >= ${sqlStr(filters.fromDate)}`);
  if (filters?.toDate) clauses.push(`scheduling_date <= ${sqlStr(filters.toDate)}`);

  return `
    SELECT${buildTripDetailSelect()}
    FROM ${table}
    WHERE ${clauses.join(" AND ")}
    ORDER BY scheduling_date ASC, coalesce(actual_trip_start_time, trip_start_time) ASC
  `;
}

function mapTripDetailRow(row: Record<string, unknown>): DriverTripDetailRow {
  const rawDate = str(row.scheduling_date) ?? "";
  return {
    tripId: str(row.trip_id) ?? "",
    schedulingDate: rawDate.slice(0, 10),
    routeName: str(row.route_name),
    routeCode: str(row.route_code),
    timeBucket: str(row.time_bucket),
    vehicleSize: str(row.vehicle_size),
    vehicleNumber: str(row.vehicle_number),
    busCode: str(row.bus_code),
    tripStartTime: str(row.trip_start_time),
    tripEndTime: str(row.trip_end_time),
    actualTripStartTime: str(row.actual_trip_start_time),
    actualTripEndTime: str(row.actual_trip_end_time),
    actualTripDurationMin: row.actual_trip_duration_min == null ? null : num(row.actual_trip_duration_min),
    actualDistanceKm: num(row.distance_km_odo_trip),
    kwhPerKm: num(row.kwh_per_km),
    routeDifficultyScore: num(row.route_difficulty_score),
    totalDmsEvents: Math.round(num(row.total_dms_events)),
    hardBrakingDensity: num(row.hard_braking_density_per_100km),
    overspeedDensity: num(row.overspeed_density_per_100km),
    distractionDensity: num(row.distraction_density_per_100km),
    fatigueDensity: num(row.fatigue_density_per_100km),
    regenRatio: num(row.regen_ratio),
    driverStarCount: Math.round(num(row.driver_star_count)),
    behaviorRiskFlag: str(row.behavior_risk_flag),
  };
}

/**
 * Fetches trip-level behavior rows for one driver on a single scheduling_date.
 * Rows are ordered by trip start time (actual when available).
 */
export async function fetchDriverTripsForDay(
  driverId: string,
  schedulingDate: string,
): Promise<DriverTripDetailRow[]> {
  let lastError: unknown;
  for (const table of TRIP_BEHAVIOR_TABLES) {
    try {
      const sql = buildTripDetailSql(table, driverId, schedulingDate);
      const rows = await runSql<Record<string, unknown>>(sql);
      return rows.map(mapTripDetailRow);
    } catch (err) {
      lastError = err;
      if (!isTableMissingError(err)) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Fetches all trip-level behavior rows for one driver within a scheduling_date window.
 * Rows are ordered chronologically by date, then trip start time.
 */
export async function fetchDriverTripDetails(
  driverId: string,
  filters?: DriverTripBehaviorFilters,
): Promise<DriverTripDetailRow[]> {
  let lastError: unknown;
  for (const table of TRIP_BEHAVIOR_TABLES) {
    try {
      const sql = buildTripWindowSql(table, driverId, filters);
      const rows = await runSql<Record<string, unknown>>(sql);
      return rows.map(mapTripDetailRow);
    } catch (err) {
      lastError = err;
      if (!isTableMissingError(err)) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
