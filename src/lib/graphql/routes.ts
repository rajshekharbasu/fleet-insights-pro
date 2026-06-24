import { GRAPHQL_API_URL } from "./config";
import type { Filters } from "../analytics";

function parseSqlQueryResult<T>(result: T[] | { error?: string } | null | undefined): T[] {
  if (!result) return [];
  if (!Array.isArray(result)) {
    throw new Error(result.error || "GraphQL sqlQuery error");
  }
  return result;
}

export interface RouteLeaderboardRow {
  company_id: string;
  company_name: string;
  route_id: number;
  route_code: string;
  route_name: string;
  dominant_vehicle_size: string;
  trip_count: number;
  avg_kwh_per_km: number;
  avg_stops_per_km: number;
  avg_congestion_score: number;
  avg_altitude_gain: number;
  avg_dms_per_100km: number;
  peak_difficulty_score: number;
  peak_kwh_per_km: number;
  base_kwh_per_km: number;
  peak_delta_pct: number;
  peak_time_bucket: string;
  energy_leakage_kwh_30d: number;
  fleet_median_kwh_per_km: number;
  difficulty_rank: number;
  snapshot_date: string;
}

export type RouteDifficultyLabel = "easy" | "medium" | "hard";

/**
 * Derives a difficulty tier from the peak difficulty score. Replaces the
 * `peak_context_label` column that was removed from mart_route_leaderboard.
 * Thresholds align with the high-risk cutoff used in the aggregate (>= 40).
 */
export function routeDifficultyLabel(peakDifficultyScore: number): RouteDifficultyLabel {
  if (peakDifficultyScore >= 40) return "hard";
  if (peakDifficultyScore >= 20) return "medium";
  return "easy";
}

export interface RouteLeaderboardAggregate {
  routeCount: number;
  totalTrips: number;
  hardest: RouteLeaderboardRow | null;
  easiest: RouteLeaderboardRow | null;
  avgKwhPerKm: number;
  avgCongestion: number;
  avgDifficulty: number;
  avgDmsPer100km: number;
  avgPeakDeltaPct: number;
  totalLeakageKwh: number;
  highRiskRoutes: number;
  mediumRiskRoutes: number;
}

/**
 * Aggregates leaderboard rows into fleet-wide summary metrics (trip-weighted where applicable).
 */
export function aggregateRouteLeaderboard(rows: RouteLeaderboardRow[]): RouteLeaderboardAggregate {
  if (!rows.length) {
    return {
      routeCount: 0,
      totalTrips: 0,
      hardest: null,
      easiest: null,
      avgKwhPerKm: 0,
      avgCongestion: 0,
      avgDifficulty: 0,
      avgDmsPer100km: 0,
      avgPeakDeltaPct: 0,
      totalLeakageKwh: 0,
      highRiskRoutes: 0,
      mediumRiskRoutes: 0,
    };
  }

  const sorted = [...rows].sort((a, b) => a.difficulty_rank - b.difficulty_rank);
  const totalTrips = rows.reduce((s, r) => s + r.trip_count, 0);
  const weight = (fn: (r: RouteLeaderboardRow) => number) =>
    totalTrips > 0 ? rows.reduce((s, r) => s + fn(r) * r.trip_count, 0) / totalTrips : 0;

  return {
    routeCount: rows.length,
    totalTrips,
    hardest: sorted[0],
    easiest: sorted[sorted.length - 1],
    avgKwhPerKm: weight((r) => r.avg_kwh_per_km),
    avgCongestion: weight((r) => r.avg_congestion_score),
    avgDifficulty: weight((r) => r.peak_difficulty_score),
    avgDmsPer100km: weight((r) => r.avg_dms_per_100km),
    avgPeakDeltaPct: weight((r) => r.peak_delta_pct),
    totalLeakageKwh: rows.reduce((s, r) => s + Math.max(0, r.energy_leakage_kwh_30d), 0),
    highRiskRoutes: rows.filter((r) => routeDifficultyLabel(r.peak_difficulty_score) === "hard").length,
    mediumRiskRoutes: rows.filter((r) => routeDifficultyLabel(r.peak_difficulty_score) === "medium").length,
  };
}

/**
 * Fetches route difficulty leaderboard from mart_route_leaderboard.
 */
export async function fetchRouteLeaderboard(limit = 50): Promise<RouteLeaderboardRow[]> {
  const sql = `
    SELECT
      company_id,
      company_name,
      route_id,
      route_code,
      route_name,
      dominant_vehicle_size,
      trip_count,
      avg_kwh_per_km,
      avg_stops_per_km,
      avg_congestion_score,
      avg_altitude_gain,
      avg_dms_per_100km,
      peak_difficulty_score,
      peak_kwh_per_km,
      base_kwh_per_km,
      peak_delta_pct,
      peak_time_bucket,
      energy_leakage_kwh_30d,
      fleet_median_kwh_per_km,
      difficulty_rank,
      snapshot_date
    FROM glue_catalog.gold_db.mart_route_leaderboard
    ORDER BY difficulty_rank ASC
    LIMIT ${limit}
  `;

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetRouteLeaderboard($sql: String!) {
        sqlQuery(sql: $sql)
      }`,
      variables: { sql },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch route leaderboard: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  return parseSqlQueryResult<RouteLeaderboardRow>(json.data?.sqlQuery);
}

export interface RouteComparisonRow {
  route_id: number;
  company_id: string;
  company_name: string;
  route_name: string;
  route_code: string;
  vehicle_size: string;
  total_trips: number;
  avg_kwh_per_km: number;
  median_kwh_per_km: number;
  p25_kwh_per_km: number;
  p75_kwh_per_km: number;
  avg_regen_ratio: number;
  avg_idle_ratio: number;
  avg_speed_geo: number;
  avg_congestion_score: number;
  avg_altitude_gain: number;
  peak_difficulty_score: number;
  avg_difficulty_score: number;
  route_context_label: string;
  efficiency_tier: string;
  efficiency_trend: string;
  energy_leakage_kwh_30d: number;
  avg_dms_per_100km: number;
  avg_hard_braking_per_100km: number;
  avg_distraction_per_100km: number;
  avg_drowsiness_per_100km: number;
  avg_overspeed_per_100km: number;
  avg_collision_per_100km: number;
  segment_count: number;
  snapshot_date: string;
}

/**
 * Fetches per-route comparison metrics from mart_route_comparison.
 * Rows are keyed by (route_id, vehicle_size); callers can dedupe to a dominant size.
 */
export async function fetchRouteComparison(limit = 300): Promise<RouteComparisonRow[]> {
  const sql = `
    SELECT
      route_id,
      company_id,
      company_name,
      route_name,
      route_code,
      vehicle_size,
      total_trips,
      avg_kwh_per_km,
      median_kwh_per_km,
      p25_kwh_per_km,
      p75_kwh_per_km,
      avg_regen_ratio,
      avg_idle_ratio,
      avg_speed_geo,
      avg_congestion_score,
      avg_altitude_gain,
      peak_difficulty_score,
      avg_difficulty_score,
      route_context_label,
      efficiency_tier,
      efficiency_trend,
      energy_leakage_kwh_30d,
      avg_dms_per_100km,
      avg_hard_braking_per_100km,
      avg_distraction_per_100km,
      avg_drowsiness_per_100km,
      avg_overspeed_per_100km,
      avg_collision_per_100km,
      segment_count,
      snapshot_date
    FROM mart_route_comparison
    ORDER BY total_trips DESC
    LIMIT ${limit}
  `;

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetRouteComparison($sql: String!) {
        sqlQuery(sql: $sql)
      }`,
      variables: { sql },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch route comparison: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  return parseSqlQueryResult<RouteComparisonRow>(json.data?.sqlQuery);
}

export interface RouteEfficiencyRankingRow {
  snapshot_date: string;
  timeframe_days: number;
  companyid: number;
  companyname: string;
  route_id: number;
  trip_count: number;
  total_kwh: number;
  total_distance_km: number;
  kwh_per_km: number;
  fleet_median: number;
  category: string;
  bar_color: string;
  route_rank: number;
  route_code?: string;
  route_name?: string;
}

/**
 * Fetches route efficiency ranking from the gold_db.mart_route_efficiency_ranking SQLite table.
 */
export async function fetchRouteEfficiencyRanking(limit = 10, filters?: Filters): Promise<RouteEfficiencyRankingRow[]> {
  let timeframeDays: number | null = null;
  if (filters?.from && filters?.to) {
    const fromDate = new Date(filters.from);
    const toDate = new Date(filters.to);
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    const presets = [7, 30, 90, 180];
    const closestPreset = presets.find(p => Math.abs(diffDays - p) <= 2);
    timeframeDays = closestPreset !== undefined ? closestPreset : diffDays;
  }

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetRouteEfficiencyRanking($startTime: String, $endTime: String, $timeframeDays: Int) {
        martRouteEfficiencyRanking(startTime: $startTime, endTime: $endTime, timeframeDays: $timeframeDays) {
          routeId
          routeName
          kwhPerKm
          fleetMedian
          routeRank
          category
          barColor
          tripCount
        }
      }`,
      variables: {
        startTime: filters?.from || null,
        endTime: filters?.to || null,
        timeframeDays: timeframeDays,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch route efficiency ranking: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  const items = json.data?.martRouteEfficiencyRanking || [];
  return items.map((item: any) => ({
    route_id: item.routeId,
    route_name: item.routeName,
    kwh_per_km: item.kwhPerKm,
    fleet_median: item.fleetMedian,
    route_rank: item.routeRank,
    category: item.category,
    bar_color: item.barColor,
    route_code: undefined,
    trip_count: item.tripCount || 0,
  }));
}
