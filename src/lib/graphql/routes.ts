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
  let whereClauses: string[] = [];
  if (filters) {
    if (filters.companies && filters.companies.length > 0) {
      const list = filters.companies.map(c => `'${c.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`r.companyname IN (${list})`);
    }
    if (filters.routes && filters.routes.length > 0) {
      const list = filters.routes.map(r => `'${r.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`c.route_code IN (${list})`);
    }
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sql = `
    SELECT r.*, c.route_code, c.route_name 
    FROM mart_route_efficiency_ranking r
    LEFT JOIN (
      SELECT DISTINCT route_id, route_code, route_name 
      FROM glue_catalog.gold_db.route_context_fact
    ) c ON r.route_id = c.route_id
    ${whereStr}
    ORDER BY r.route_rank ASC
    LIMIT ${limit}
  `;

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetRouteEfficiencyRanking($sql: String!) {
        sqlQuery(sql: $sql)
      }`,
      variables: { sql },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch route efficiency ranking: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  return json.data?.sqlQuery || [];
}
