/**
 * GraphQL access for `mart_segment_risk_map` — per-segment spatial risk grid.
 *
 * Each row is a ~100m lat/lon bin on a route, scored for operational risk
 * (difficulty, DMS events, hard braking). Rows carry real coordinates
 * (`segment_lat_bin` / `segment_lon_bin`) plus a `segment_geojson` Polygon
 * footprint, so the data can be plotted directly on the Leaflet map.
 *
 * All access goes through the backend `sqlQuery` resolver (raw SQL over the
 * analytics DB), mirroring the cycle/route/driver fetchers.
 */
import { GRAPHQL_API_URL } from "./config";

function parseSqlQueryResult<T>(result: T[] | { error?: string } | null | undefined): T[] {
  if (!result) return [];
  if (!Array.isArray(result)) {
    throw new Error((result as { error?: string }).error || "GraphQL sqlQuery error");
  }
  return result;
}

async function runSql<T = Record<string, unknown>>(sql: string, opName = "SegmentRiskMapQuery"): Promise<T[]> {
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

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

/** Categorical risk band for a segment. */
export type SegmentRiskLevel = "low" | "medium" | "high" | "critical";

/** Route difficulty context band. */
export type RouteContextBand = "easy" | "medium" | "hard";

export interface SegmentRiskMapRow {
  company_id: string;
  route_id: number;
  route_name: string;
  route_code: string;
  segment_id: string;
  /** Real latitude of the segment bin centroid. */
  segment_lat_bin: number;
  /** Real longitude of the segment bin centroid. */
  segment_lon_bin: number;
  /** GeoJSON Polygon footprint of the bin, as [lng, lat] rings. */
  segment_polygon: [number, number][];
  segment_snapshot_date: string;
  geo_point_count: number;
  avg_speed: number;
  speed_variability: number;
  stop_ratio: number;
  avg_altitude: number;
  dms_event_count: number;
  hard_braking_count: number;
  severity_2_count: number;
  /** Primary risk score for the segment (0–100ish). */
  segment_difficulty_score: number;
  prev_period_difficulty_score: number | null;
  difficulty_change_pct: number | null;
  trend_direction: string;
  route_difficulty_score: number;
  route_context_label: string;
  risk_level: string;
  snapshot_date: string;
}

export interface SegmentRiskMapFilters {
  /** Filter by company id (string in the source table). */
  company?: string;
  /** One or more risk bands (low/medium/high/critical). */
  riskLevels?: SegmentRiskLevel[];
  /** Route difficulty context band (easy/medium/hard). */
  routeContext?: RouteContextBand;
  /** Restrict to a single route. */
  routeId?: number;
  /** Minimum segment difficulty (risk) score. */
  minRiskScore?: number;
  /** Max rows to return. */
  limit?: number;
}

const SEGMENT_RISK_COLS = [
  "company_id",
  "route_id",
  "route_name",
  "route_code",
  "segment_id",
  "segment_lat_bin",
  "segment_lon_bin",
  "segment_geojson",
  "segment_snapshot_date",
  "geo_point_count",
  "avg_speed",
  "speed_variability",
  "stop_ratio",
  "avg_altitude",
  "dms_event_count",
  "hard_braking_count",
  "severity_2_count",
  "segment_difficulty_score",
  "prev_period_difficulty_score",
  "difficulty_change_pct",
  "trend_direction",
  "route_difficulty_score",
  "route_context_label",
  "risk_level",
  "snapshot_date",
].join(", ");

/** Parses segment_geojson (a JSON-encoded Polygon) into a [lng, lat] outer ring. */
function parsePolygon(raw: unknown): [number, number][] {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const geom = obj as { coordinates?: unknown } | null;
  const rings = geom?.coordinates as unknown;
  if (!Array.isArray(rings) || !Array.isArray(rings[0])) return [];
  const out: [number, number][] = [];
  for (const c of rings[0] as unknown[]) {
    if (Array.isArray(c) && c.length >= 2) {
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      if (Number.isFinite(lng) && Number.isFinite(lat)) out.push([lng, lat]);
    }
  }
  return out;
}

function buildWhereClause(filters?: SegmentRiskMapFilters): string {
  if (!filters) return "";
  const conds: string[] = [];

  if (filters.company && filters.company !== "ALL") {
    conds.push(`lower(company_id) = lower(${sqlStr(filters.company)})`);
  }
  if (filters.riskLevels && filters.riskLevels.length > 0) {
    const list = filters.riskLevels.map((r) => `lower(${sqlStr(r)})`).join(", ");
    conds.push(`lower(risk_level) IN (${list})`);
  }
  if (filters.routeContext) {
    conds.push(`lower(route_context_label) = lower(${sqlStr(filters.routeContext)})`);
  }
  if (typeof filters.routeId === "number" && Number.isFinite(filters.routeId)) {
    conds.push(`route_id = ${Math.trunc(filters.routeId)}`);
  }
  if (typeof filters.minRiskScore === "number" && filters.minRiskScore > 0) {
    conds.push(`segment_difficulty_score >= ${filters.minRiskScore}`);
  }

  return conds.length ? `WHERE ${conds.join(" AND ")}` : "";
}

function mapRow(r: Record<string, unknown>): SegmentRiskMapRow {
  return {
    company_id: str(r.company_id),
    route_id: num(r.route_id),
    route_name: str(r.route_name),
    route_code: str(r.route_code),
    segment_id: str(r.segment_id),
    segment_lat_bin: num(r.segment_lat_bin),
    segment_lon_bin: num(r.segment_lon_bin),
    segment_polygon: parsePolygon(r.segment_geojson),
    segment_snapshot_date: str(r.segment_snapshot_date),
    geo_point_count: num(r.geo_point_count),
    avg_speed: num(r.avg_speed),
    speed_variability: num(r.speed_variability),
    stop_ratio: num(r.stop_ratio),
    avg_altitude: num(r.avg_altitude),
    dms_event_count: num(r.dms_event_count),
    hard_braking_count: num(r.hard_braking_count),
    severity_2_count: num(r.severity_2_count),
    segment_difficulty_score: num(r.segment_difficulty_score),
    prev_period_difficulty_score: numOrNull(r.prev_period_difficulty_score),
    difficulty_change_pct: numOrNull(r.difficulty_change_pct),
    trend_direction: str(r.trend_direction),
    route_difficulty_score: num(r.route_difficulty_score),
    route_context_label: str(r.route_context_label),
    risk_level: str(r.risk_level),
    snapshot_date: str(r.snapshot_date),
  };
}

/**
 * Collapses raw bin rows to one row per `segment_id`, keeping the highest-risk
 * row, then returns them sorted by risk score (highest first). The source table
 * carries multiple route-join rows per ~100m spatial bin, so this is required
 * to surface distinct real segments rather than duplicate bins.
 */
function dedupeBySegment(rows: Record<string, unknown>[]): SegmentRiskMapRow[] {
  const bySegment = new Map<string, SegmentRiskMapRow>();
  for (const raw of rows) {
    const row = mapRow(raw);
    const key = row.segment_id || `${row.route_id}_${row.segment_lat_bin}_${row.segment_lon_bin}`;
    const existing = bySegment.get(key);
    if (!existing || row.segment_difficulty_score > existing.segment_difficulty_score) {
      bySegment.set(key, row);
    }
  }
  return [...bySegment.values()].sort(
    (a, b) => b.segment_difficulty_score - a.segment_difficulty_score,
  );
}

/**
 * Fetches segment risk rows from `mart_segment_risk_map`, applying an optional
 * WHERE clause built from the supplied filters. Results are ordered by risk
 * score (highest first) and deduped to one row per segment (keeping the
 * highest-scoring row), since the table can carry multiple route-join rows per
 * spatial bin.
 */
export async function fetchSegmentRiskMap(filters?: SegmentRiskMapFilters): Promise<SegmentRiskMapRow[]> {
  const where = buildWhereClause(filters);
  const limit = filters?.limit && filters.limit > 0 ? Math.trunc(filters.limit) : 4000;
  const sql = `
    SELECT ${SEGMENT_RISK_COLS}
    FROM mart_segment_risk_map
    ${where}
    ORDER BY segment_difficulty_score DESC
    LIMIT ${limit}
  `;
  const rows = await runSql<Record<string, unknown>>(sql, "GetSegmentRiskMap");
  return dedupeBySegment(rows);
}

/**
 * Dedicated query for the "Top dangerous segments" panel. Returns the N most
 * dangerous *distinct* segments (by `segment_difficulty_score`) with the detail
 * fields that panel/drawer renders. Reuses the sanitized WHERE-builder and the
 * per-segment dedupe so duplicate bin rows don't crowd out real segments; over-
 * fetches before deduping, then slices to `topN`.
 */
export async function fetchTopDangerousSegments(
  filters?: SegmentRiskMapFilters,
  topN = 10,
): Promise<SegmentRiskMapRow[]> {
  const where = buildWhereClause(filters);
  // Over-fetch: the table has ~5 bin rows per segment, so pull a generous slice
  // of the highest-scoring rows to guarantee enough distinct segments post-dedupe.
  const overFetch = Math.max(500, topN * 60);
  const sql = `
    SELECT ${SEGMENT_RISK_COLS}
    FROM mart_segment_risk_map
    ${where}
    ORDER BY segment_difficulty_score DESC
    LIMIT ${overFetch}
  `;
  const rows = await runSql<Record<string, unknown>>(sql, "GetTopDangerousSegments");
  return dedupeBySegment(rows).slice(0, Math.max(1, Math.trunc(topN)));
}

/** Trend labels that indicate risk is increasing (higher score = worse). */
const WORSENING_TRENDS = ["up", "worsening", "increasing", "rising"] as const;

/** Trend labels that indicate risk is decreasing (lower score = better). */
const IMPROVING_TRENDS = ["down", "improving", "decreasing", "falling"] as const;

export type SegmentTrendMode = "improving" | "worsening";

function sqlTrendList(trends: readonly string[]): string {
  return trends.map((t) => `lower(${sqlStr(t)})`).join(", ");
}

function buildTrendWhereClause(mode: SegmentTrendMode, filters?: SegmentRiskMapFilters): string {
  const conds: string[] = [];
  const filterWhere = buildWhereClause(filters);
  if (filterWhere) conds.push(filterWhere.replace(/^WHERE\s+/i, ""));

  if (mode === "worsening") {
    conds.push(
      `(lower(trend_direction) IN (${sqlTrendList(WORSENING_TRENDS)}) OR difficulty_change_pct > 0)`,
    );
  } else {
    conds.push(
      `(lower(trend_direction) IN (${sqlTrendList(IMPROVING_TRENDS)}) OR difficulty_change_pct < 0)`,
    );
  }

  return `WHERE ${conds.join(" AND ")}`;
}

function sortTrendRows(rows: SegmentRiskMapRow[], mode: SegmentTrendMode): SegmentRiskMapRow[] {
  return [...rows].sort((a, b) => {
    const aPct = a.difficulty_change_pct;
    const bPct = b.difficulty_change_pct;
    if (aPct !== null && bPct !== null && aPct !== bPct) {
      return mode === "worsening" ? bPct - aPct : aPct - bPct;
    }
    if (aPct !== null && bPct === null) return -1;
    if (aPct === null && bPct !== null) return 1;
    return mode === "worsening"
      ? b.segment_difficulty_score - a.segment_difficulty_score
      : a.segment_difficulty_score - b.segment_difficulty_score;
  });
}

/**
 * Fetches segments whose risk is trending up or down. Matches rows where
 * `trend_direction` is a known improving/worsening label **or** period-over-period
 * `difficulty_change_pct` moved in that direction. Deduped per segment, then
 * sorted by largest change (or current score when pct is null).
 */
async function fetchTrendingSegments(
  mode: SegmentTrendMode,
  filters?: SegmentRiskMapFilters,
  topN = 6,
): Promise<SegmentRiskMapRow[]> {
  const where = buildTrendWhereClause(mode, filters);
  const overFetch = Math.max(500, topN * 60);
  const order =
    mode === "worsening"
      ? "difficulty_change_pct DESC NULLS LAST, segment_difficulty_score DESC"
      : "difficulty_change_pct ASC NULLS LAST, segment_difficulty_score ASC";
  const sql = `
    SELECT ${SEGMENT_RISK_COLS}
    FROM mart_segment_risk_map
    ${where}
    ORDER BY ${order}
    LIMIT ${overFetch}
  `;
  const opName = mode === "worsening" ? "GetWorseningSegments" : "GetImprovingSegments";
  const rows = await runSql<Record<string, unknown>>(sql, opName);
  return sortTrendRows(dedupeBySegment(rows), mode).slice(0, Math.max(1, Math.trunc(topN)));
}

/** Segments with worsening trend or positive difficulty change. */
export function fetchWorseningSegments(
  filters?: SegmentRiskMapFilters,
  topN = 6,
): Promise<SegmentRiskMapRow[]> {
  return fetchTrendingSegments("worsening", filters, topN);
}

/** Segments with improving trend or negative difficulty change. */
export function fetchImprovingSegments(
  filters?: SegmentRiskMapFilters,
  topN = 6,
): Promise<SegmentRiskMapRow[]> {
  return fetchTrendingSegments("improving", filters, topN);
}

export interface SegmentRiskRouteOption {
  route_id: number;
  route_code: string;
  route_name: string;
}

/**
 * Fetches distinct routes present in the risk map, for populating a route
 * dropdown. Falls back gracefully to an empty list on error at the call site.
 */
export async function fetchSegmentRiskRoutes(): Promise<SegmentRiskRouteOption[]> {
  const sql = `
    SELECT route_id, route_code, route_name, count(*) AS c
    FROM mart_segment_risk_map
    GROUP BY route_id, route_code, route_name
    ORDER BY c DESC
  `;
  const rows = await runSql<Record<string, unknown>>(sql, "GetSegmentRiskRoutes");
  const seen = new Set<number>();
  const out: SegmentRiskRouteOption[] = [];
  for (const r of rows) {
    const id = num(r.route_id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ route_id: id, route_code: str(r.route_code), route_name: str(r.route_name) });
  }
  return out;
}

/**
 * Fetches distinct company ids present in the risk map, for populating a
 * company dropdown. The source table carries no `company_name`, so only the id
 * is returned. Falls back gracefully to an empty list on error at the call site.
 */
export async function fetchSegmentRiskCompanies(): Promise<string[]> {
  const sql = `
    SELECT company_id, count(*) AS c
    FROM mart_segment_risk_map
    GROUP BY company_id
    ORDER BY c DESC
  `;
  const rows = await runSql<Record<string, unknown>>(sql, "GetSegmentRiskCompanies");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const id = str(r.company_id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Fixed risk-level ordering (ascending severity) for legends and selects. */
export const RISK_LEVEL_ORDER: SegmentRiskLevel[] = ["low", "medium", "high", "critical"];

/** Brand-aligned color per risk band, used for markers and chips. */
export const RISK_LEVEL_COLOR: Record<SegmentRiskLevel, string> = {
  low: "#2dd4bf",
  medium: "#fbbf24",
  high: "#fb923c",
  critical: "#f87171",
};

/** Normalizes a raw risk_level string to a known band (defaults to "low"). */
export function normalizeRiskLevel(level: string): SegmentRiskLevel {
  const l = level.toLowerCase();
  return (RISK_LEVEL_ORDER as string[]).includes(l) ? (l as SegmentRiskLevel) : "low";
}
