import { GRAPHQL_API_URL } from "./config";
import type { Filters } from "../analytics";

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
