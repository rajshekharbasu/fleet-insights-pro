import { GRAPHQL_API_URL } from "./config";

const TRANSIENT_STORAGE_ERROR_RE =
  /ExpiredToken|TokenRefreshRequired|RequestTimeout|SlowDown|ServiceUnavailable|ECONNRESET|503|429/i;
const STORAGE_PARTITION_ERROR_RE =
  /ExpiredToken|TokenRefreshRequired|HTTP 400 Bad Request|HTTP GET error reading|Bad Request|S3|IO Error|parquet|partition/i;

function parseSqlQueryResult<T>(result: T[] | { error?: string } | null | undefined): T[] {
  if (!result) return [];
  if (!Array.isArray(result)) {
    throw new Error(result.error || "GraphQL sqlQuery error");
  }
  return result;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function isTransientStorageError(err: unknown): boolean {
  return TRANSIENT_STORAGE_ERROR_RE.test(extractErrorMessage(err));
}

export function isStoragePartitionError(err: unknown): boolean {
  return STORAGE_PARTITION_ERROR_RE.test(extractErrorMessage(err));
}

/** Short, user-facing copy for S3 / partition read failures. */
export function friendlyStorageErrorMessage(err: unknown): string {
  const msg = extractErrorMessage(err);
  if (/ExpiredToken/i.test(msg)) {
    return "Trip data for this day is temporarily unavailable (storage credentials expired). Other days may still load.";
  }
  if (/HTTP 400 Bad Request|S3|parquet|partition/i.test(msg)) {
    return "Trip data for this day could not be read from storage. Other days may still load.";
  }
  return "Trip data for this day could not be loaded.";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

const CONTEXTUAL_SCORE_TABLES = [
  "driver_contextual_score_fact",
  "glue_catalog.gold_db.driver_contextual_score_fact",
] as const;

function contextualScoreJoin(behaviorTable: string, contextualTable: string): string {
  return `LEFT JOIN ${contextualTable} c ON b.trip_id = c.trip_id`;
}

function resolveContextualJoin(behaviorTable: string): string {
  const idx = TRIP_BEHAVIOR_TABLES.indexOf(behaviorTable as (typeof TRIP_BEHAVIOR_TABLES)[number]);
  const contextualTable = CONTEXTUAL_SCORE_TABLES[idx >= 0 ? idx : 0];
  return contextualScoreJoin(behaviorTable, contextualTable);
}

async function runSqlOnce<T = Record<string, unknown>>(sql: string): Promise<T[]> {
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

async function runSql<T = Record<string, unknown>>(sql: string, retries = 2): Promise<T[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await runSqlOnce<T>(sql);
    } catch (err) {
      lastError = err;
      if (attempt < retries && isTransientStorageError(err)) {
        await sleep(350 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
  /** Mean contextual driver score (0–100) across trips that day. */
  avgContextualDriverScore: number;
  /** Mean driving score / peer percentile (0–100) across trips that day. */
  avgDrivingScore: number;
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
  /** Contextual driver score (0–100), route-adjusted. */
  contextualDriverScore: number | null;
  /** Driving score from peer percentile (0–100). */
  drivingScore: number;
  driverScoreBand: string | null;
}

export interface DriverTripBehaviorFilters {
  fromDate?: string;
  toDate?: string;
}

export interface DriverTripBehaviorFetchResult {
  rows: DriverDailyTripRow[];
  partial?: boolean;
  failedDates?: string[];
  warning?: string;
}

export interface DriverTripsForDayResult {
  rows: DriverTripDetailRow[];
  storageError?: boolean;
  message?: string;
}

export interface DriverTripExportResult {
  rows: DriverTripDetailRow[];
  partial?: boolean;
  failedDates?: string[];
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

function enumerateDates(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const cur = parseISODate(fromDate);
  const end = parseISODate(toDate);
  while (cur <= end) {
    dates.push(formatISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
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
  const clauses = [`b.driver_id = ${sqlStr(driverId)}`];
  if (filters?.fromDate) clauses.push(`b.scheduling_date >= ${sqlStr(filters.fromDate)}`);
  if (filters?.toDate) clauses.push(`b.scheduling_date <= ${sqlStr(filters.toDate)}`);

  const contextualJoin = resolveContextualJoin(table);
  const fromClause = `${table} b ${contextualJoin}`;

  return `
    SELECT
      b.scheduling_date,
      count(*) AS trip_count,
      round(sum(b.distance_km_odo_trip), 1) AS total_distance_km,
      round(avg(b.kwh_per_km), 4) AS avg_efficiency,
      round(median(b.kwh_per_km), 4) AS median_efficiency,
      round(avg(b.route_difficulty_score), 1) AS avg_exposure,
      sum(b.total_dms_events) AS dms_events,
      round(avg(b.hard_braking_density_per_100km), 2) AS avg_braking_density,
      round(avg(b.overspeed_density_per_100km), 2) AS avg_overspeed_density,
      round(avg(b.distraction_density_per_100km), 2) AS avg_distraction_density,
      round(avg(b.fatigue_density_per_100km), 2) AS avg_fatigue_density,
      round(avg(b.regen_ratio) * 100, 1) AS avg_regen_pct,
      sum(coalesce(b.driver_star_count, 0)) AS driver_stars,
      sum(CASE WHEN b.behavior_risk_flag = 'HIGH' THEN 1 ELSE 0 END) AS high_risk_trips,
      round(avg(c.contextual_driver_score), 1) AS avg_contextual_driver_score,
      round(avg(b.peer_percentile) * 100, 0) AS avg_driving_score
    FROM ${fromClause}
    WHERE ${clauses.join(" AND ")}
    GROUP BY b.scheduling_date
    ORDER BY b.scheduling_date ASC
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
    avgContextualDriverScore: num(row.avg_contextual_driver_score),
    avgDrivingScore: Math.round(num(row.avg_driving_score)),
  };
}

async function fetchSingleDayDailyRow(
  driverId: string,
  schedulingDate: string,
): Promise<DriverDailyTripRow | null> {
  let lastError: unknown;
  for (const table of TRIP_BEHAVIOR_TABLES) {
    try {
      const sql = buildDailySql(table, driverId, 1, {
        fromDate: schedulingDate,
        toDate: schedulingDate,
      });
      const rows = await runSql<Record<string, unknown>>(sql);
      return rows.length > 0 ? mapDailyRow(rows[0]) : null;
    } catch (err) {
      lastError = err;
      if (!isTableMissingError(err)) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchDriverTripBehaviorByDay(
  driverId: string,
  filters: DriverTripBehaviorFilters,
): Promise<DriverTripBehaviorFetchResult> {
  const fromDate = filters.fromDate;
  const toDate = filters.toDate;
  if (!fromDate || !toDate) {
    return { rows: [] };
  }

  const dates = enumerateDates(fromDate, toDate);
  const rows: DriverDailyTripRow[] = [];
  const failedDates: string[] = [];

  const chunkSize = 5;
  for (let i = 0; i < dates.length; i += chunkSize) {
    const chunk = dates.slice(i, i + chunkSize);
    const batch = await Promise.all(
      chunk.map(async (date) => {
        try {
          const row = await fetchSingleDayDailyRow(driverId, date);
          return { date, row, failed: false as const };
        } catch (err) {
          if (isStoragePartitionError(err)) {
            return { date, row: null, failed: true as const };
          }
          throw err;
        }
      }),
    );

    for (const item of batch) {
      if (item.failed) {
        failedDates.push(item.date);
      } else if (item.row) {
        rows.push(item.row);
      }
    }
  }

  rows.sort((a, b) => a.schedulingDate.localeCompare(b.schedulingDate));

  if (failedDates.length === 0) {
    return { rows };
  }

  const failedLabel =
    failedDates.length <= 3
      ? failedDates.join(", ")
      : `${failedDates.slice(0, 2).join(", ")} and ${failedDates.length - 2} more`;

  return {
    rows,
    partial: true,
    failedDates,
    warning: `Some days could not be loaded (${failedLabel}). Showing ${rows.length} of ${dates.length} days.`,
  };
}

/**
 * Fetches per-day trip behavior rollups for one driver from driver_trip_behavior_fact.
 * Rows are ordered chronologically (oldest first).
 * Default limit covers a 30-day window plus one spare row.
 * Falls back to per-day queries when a multi-partition scan fails.
 */
export async function fetchDriverTripBehavior(
  driverId: string,
  limit = TRIP_BEHAVIOR_WINDOW_DAYS + 1,
  filters?: DriverTripBehaviorFilters,
): Promise<DriverTripBehaviorFetchResult> {
  let lastError: unknown;
  for (const table of TRIP_BEHAVIOR_TABLES) {
    try {
      const sql = buildDailySql(table, driverId, limit, filters);
      const rows = await runSql<Record<string, unknown>>(sql);
      return { rows: rows.map(mapDailyRow) };
    } catch (err) {
      lastError = err;
      if (isTableMissingError(err)) continue;
      if (isStoragePartitionError(err) && filters?.fromDate && filters?.toDate) {
        return fetchDriverTripBehaviorByDay(driverId, filters);
      }
      throw err;
    }
  }

  if (isStoragePartitionError(lastError) && filters?.fromDate && filters?.toDate) {
    return fetchDriverTripBehaviorByDay(driverId, filters);
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildTripDetailSelect(): string {
  return `
      b.trip_id,
      b.scheduling_date,
      b.route_name,
      b.route_code,
      b.time_bucket,
      b.vehicle_size,
      b.vehicle_number,
      b.bus_code,
      b.trip_start_time,
      b.trip_end_time,
      b.actual_trip_start_time,
      b.actual_trip_end_time,
      b.actual_trip_duration_min,
      b.distance_km_odo_trip,
      b.kwh_per_km,
      b.route_difficulty_score,
      b.total_dms_events,
      b.hard_braking_density_per_100km,
      b.overspeed_density_per_100km,
      b.distraction_density_per_100km,
      b.fatigue_density_per_100km,
      b.regen_ratio,
      b.driver_star_count,
      b.behavior_risk_flag,
      b.peer_percentile,
      b.driver_score_band,
      c.contextual_driver_score`;
}

function buildTripDetailFrom(table: string): string {
  return `${table} b ${resolveContextualJoin(table)}`;
}

function buildTripDetailSql(table: string, driverId: string, schedulingDate: string): string {
  return `
    SELECT${buildTripDetailSelect()}
    FROM ${buildTripDetailFrom(table)}
    WHERE b.driver_id = ${sqlStr(driverId)}
      AND b.scheduling_date = ${sqlStr(schedulingDate)}
    ORDER BY coalesce(b.actual_trip_start_time, b.trip_start_time) ASC
  `;
}

function buildTripWindowSql(table: string, driverId: string, filters?: DriverTripBehaviorFilters): string {
  const clauses = [`b.driver_id = ${sqlStr(driverId)}`];
  if (filters?.fromDate) clauses.push(`b.scheduling_date >= ${sqlStr(filters.fromDate)}`);
  if (filters?.toDate) clauses.push(`b.scheduling_date <= ${sqlStr(filters.toDate)}`);

  return `
    SELECT${buildTripDetailSelect()}
    FROM ${buildTripDetailFrom(table)}
    WHERE ${clauses.join(" AND ")}
    ORDER BY b.scheduling_date ASC, coalesce(b.actual_trip_start_time, b.trip_start_time) ASC
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
    contextualDriverScore:
      row.contextual_driver_score == null ? null : +num(row.contextual_driver_score).toFixed(1),
    drivingScore: Math.round(num(row.peer_percentile) * 100),
    driverScoreBand: str(row.driver_score_band),
  };
}

/**
 * Fetches trip-level behavior rows for one driver on a single scheduling_date.
 * Rows are ordered by trip start time (actual when available).
 * Storage/partition failures return an empty row set with a user-facing message.
 */
export async function fetchDriverTripsForDay(
  driverId: string,
  schedulingDate: string,
): Promise<DriverTripsForDayResult> {
  let lastError: unknown;
  for (const table of TRIP_BEHAVIOR_TABLES) {
    try {
      const sql = buildTripDetailSql(table, driverId, schedulingDate);
      const rows = await runSql<Record<string, unknown>>(sql);
      return { rows: rows.map(mapTripDetailRow) };
    } catch (err) {
      lastError = err;
      if (isTableMissingError(err)) continue;
      if (isStoragePartitionError(err)) {
        return {
          rows: [],
          storageError: true,
          message: friendlyStorageErrorMessage(err),
        };
      }
      throw err;
    }
  }

  if (isStoragePartitionError(lastError)) {
    return {
      rows: [],
      storageError: true,
      message: friendlyStorageErrorMessage(lastError),
    };
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

function sortTripDetails(rows: DriverTripDetailRow[]): DriverTripDetailRow[] {
  return [...rows].sort((a, b) => {
    const dateCmp = a.schedulingDate.localeCompare(b.schedulingDate);
    if (dateCmp !== 0) return dateCmp;
    return (a.actualTripStartTime ?? a.tripStartTime ?? "").localeCompare(
      b.actualTripStartTime ?? b.tripStartTime ?? "",
    );
  });
}

/**
 * Fetches trip rows for export by querying one scheduling_date at a time.
 * This matches the in-app day expand path and avoids brittle multi-partition window scans.
 */
export async function fetchDriverTripDetailsForExport(
  driverId: string,
  dailyRows: DriverDailyTripRow[],
  window?: DriverTripBehaviorFilters,
): Promise<DriverTripExportResult> {
  const dates = [...new Set(dailyRows.map((r) => r.schedulingDate))].sort();
  const collected: DriverTripDetailRow[] = [];
  const failedDates: string[] = [];

  const chunkSize = 5;
  for (let i = 0; i < dates.length; i += chunkSize) {
    const chunk = dates.slice(i, i + chunkSize);
    const batch = await Promise.all(
      chunk.map(async (date) => {
        try {
          const result = await fetchDriverTripsForDay(driverId, date);
          if (result.storageError) {
            failedDates.push(date);
            return [] as DriverTripDetailRow[];
          }
          return result.rows;
        } catch (err) {
          if (isStoragePartitionError(err)) {
            failedDates.push(date);
            return [] as DriverTripDetailRow[];
          }
          throw err;
        }
      }),
    );
    collected.push(...batch.flat());
  }

  if (collected.length > 0) {
    return {
      rows: sortTripDetails(collected),
      partial: failedDates.length > 0,
      failedDates: failedDates.length > 0 ? failedDates : undefined,
    };
  }

  if (window) {
    try {
      const rows = await fetchDriverTripDetails(driverId, window);
      return { rows };
    } catch (err) {
      if (isStoragePartitionError(err)) {
        return { rows: [], partial: true, failedDates: dates };
      }
      throw err;
    }
  }

  return { rows: [], partial: failedDates.length > 0, failedDates };
}
