/**
 * GraphQL access for the HV battery discharge-cycle analytics tables:
 *   - `cycle`        — monthly per-bus summary (drives the whole dashboard)
 *   - `cycle_daily`  — per-bus per-day detail (drives the drill-down trend)
 *   - `cycle_trip`   — per-trip segments (drives the drill-down trip list)
 *
 * All access goes through the backend `sqlQuery` resolver (raw SQL over the
 * analytics DB), mirroring the pattern used by the driver/route fetchers.
 */
import { GRAPHQL_API_URL } from "./config";

function parseSqlQueryResult<T>(result: T[] | { error?: string } | null | undefined): T[] {
  if (!result) return [];
  if (!Array.isArray(result)) {
    throw new Error((result as { error?: string }).error || "GraphQL sqlQuery error");
  }
  return result;
}

async function runSql<T = Record<string, unknown>>(sql: string, opName = "CycleQuery"): Promise<T[]> {
  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query ${opName}($sql: String!) { sqlQuery(sql: $sql) }`,
      variables: { sql },
    }),
  });
  if (!res.ok) throw new Error(`sqlQuery failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "GraphQL query error");
  return parseSqlQueryResult<T>(json.data?.sqlQuery);
}

/** Escape a string literal for safe interpolation into raw SQL. */
function sqlStr(v: string): string {
  return `'${String(v).replace(/'/g, "''")}'`;
}

/* ------------------------------------------------------------------ *
 * cycle — monthly per-bus summary                                    *
 * ------------------------------------------------------------------ */
export interface CycleRow {
  report_month: string;
  depot: string | null;
  spv: string | null;
  registration_number: string;
  vehicle_type: string | null;
  bus_code: string | null;
  active_days: number | null;
  total_trips: number | null;
  flagged_trips: number | null;
  total_gross_discharge_kwh: number | null;
  total_charged_kwh: number | null;
  efc_gross: number | null;
  efc_net: number | null;
  efc_gross_annual: number | null;
  regen_pct: number | null;
  idle_aux_pct: number | null;
  avg_daily_rte_pct: number | null;
  avg_cell_spread_mv: number | null;
  avg_peak_temp_c: number | null;
  subzero_days: number | null;
  health_score: number | null;
  health_band: string | null;
}

const CYCLE_COLS = [
  "report_month",
  "depot",
  "spv",
  "registration_number",
  "vehicle_type",
  "bus_code",
  "active_days",
  "total_trips",
  "flagged_trips",
  "total_gross_discharge_kwh",
  "total_charged_kwh",
  "efc_gross",
  "efc_net",
  "efc_gross_annual",
  "regen_pct",
  "idle_aux_pct",
  "avg_daily_rte_pct",
  "avg_cell_spread_mv",
  "avg_peak_temp_c",
  "subzero_days",
  "health_score",
  "health_band",
].join(", ");

/** Pull the full monthly per-bus cycle table (one row per bus × month). */
export async function fetchCycleRows(limit = 20000): Promise<CycleRow[]> {
  const sql = `SELECT ${CYCLE_COLS} FROM cycle ORDER BY report_month, spv, registration_number LIMIT ${limit}`;
  const rows = await runSql(sql, "GetCycle");
  return rows as unknown as CycleRow[];
}

/* ------------------------------------------------------------------ *
 * cycle_daily — per-bus per-day detail                               *
 * ------------------------------------------------------------------ */
export interface CycleDailyRow {
  session_date: string;
  trip_count: number | null;
  charge_session_count: number | null;
  gross_discharge_kwh: number | null;
  net_discharge_kwh: number | null;
  total_charged_kwh: number | null;
  daily_efc_gross: number | null;
  regen_pct: number | null;
  idle_aux_pct: number | null;
  daily_rte_pct: number | null;
  rte_reliable: string | null;
  min_soc_day: number | null;
  max_soc_day: number | null;
  max_temp_c: number | null;
  avg_temp_c: number | null;
  max_cell_spread_mv: number | null;
  thermal_flag: string | null;
  cell_spread_flag: string | null;
  cold_flag: string | null;
}

/** Daily rows for a single bus within a report month, ordered by date. */
export async function fetchCycleDaily(reg: string, reportMonth: string): Promise<CycleDailyRow[]> {
  const sql = `
    SELECT session_date, trip_count, charge_session_count, gross_discharge_kwh, net_discharge_kwh,
           total_charged_kwh, daily_efc_gross, regen_pct, idle_aux_pct, daily_rte_pct, rte_reliable,
           min_soc_day, max_soc_day, max_temp_c, avg_temp_c, max_cell_spread_mv,
           thermal_flag, cell_spread_flag, cold_flag
    FROM cycle_daily
    WHERE registration_number = ${sqlStr(reg)} AND report_month = ${sqlStr(reportMonth)}
    ORDER BY session_date
  `;
  const rows = await runSql(sql, "GetCycleDaily");
  return rows as unknown as CycleDailyRow[];
}

/* ------------------------------------------------------------------ *
 * cycle_trip — per-trip segments                                     *
 * ------------------------------------------------------------------ */
export interface CycleTripRow {
  segment_id: string | null;
  segment_type: string | null;
  segment_flag: string | null;
  trip_date: string | null;
  trip_start: string | null;
  trip_end: string | null;
  duration_min: number | null;
  gross_discharge_kwh: number | null;
  net_discharge_kwh: number | null;
  regen_kwh: number | null;
  efc_gross_trip: number | null;
  regen_pct: number | null;
  soc_max: number | null;
  soc_min: number | null;
  max_temp_c: number | null;
  max_cell_spread_mv: number | null;
}

/* ------------------------------------------------------------------ *
 * cycle_daily — company/fleet daily aggregate (for the Trends screen) *
 * ------------------------------------------------------------------ */
export interface DailyTrendPoint {
  session_date: string;
  buses: number;
  gross_kwh: number;
  rte_pct: number | null;
  regen_pct: number | null;
}

/**
 * Daily fleet aggregate for a report month, optionally scoped to one company
 * (spv). Aggregated server-side so the payload is one row per day.
 */
export async function fetchDailyTrend(company: string | null, reportMonth: string): Promise<DailyTrendPoint[]> {
  const scope = company && company !== "ALL" ? `AND spv = ${sqlStr(company)}` : "";
  const sql = `
    SELECT session_date,
           count(DISTINCT registration_number) AS buses,
           sum(gross_discharge_kwh) AS gross_kwh,
           avg(daily_rte_pct) AS rte_pct,
           avg(regen_pct) AS regen_pct
    FROM cycle_daily
    WHERE report_month = ${sqlStr(reportMonth)} ${scope}
    GROUP BY session_date
    ORDER BY session_date
  `;
  const rows = await runSql(sql, "GetDailyTrend");
  return rows as unknown as DailyTrendPoint[];
}

/** Trip segments for a single bus within a report month, ordered by start time. */
export async function fetchCycleTrips(reg: string, reportMonth: string, limit = 2000): Promise<CycleTripRow[]> {
  const sql = `
    SELECT segment_id, segment_type, segment_flag, trip_date, trip_start, trip_end, duration_min,
           gross_discharge_kwh, net_discharge_kwh, regen_kwh, efc_gross_trip, regen_pct,
           soc_max, soc_min, max_temp_c, max_cell_spread_mv
    FROM cycle_trip
    WHERE registration_number = ${sqlStr(reg)} AND report_month = ${sqlStr(reportMonth)}
    ORDER BY trip_start
    LIMIT ${limit}
  `;
  const rows = await runSql(sql, "GetCycleTrips");
  return rows as unknown as CycleTripRow[];
}
