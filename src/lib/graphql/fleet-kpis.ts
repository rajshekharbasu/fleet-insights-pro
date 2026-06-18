import { GRAPHQL_API_URL } from "./config";
import type { FleetKpiRecord } from "../graphql-adapter";

function parseSqlQueryResult<T>(result: T[] | { error?: string } | null | undefined): T[] {
  if (!result) return [];
  if (!Array.isArray(result)) {
    throw new Error(result.error || "GraphQL sqlQuery error");
  }
  return result;
}

/**
 * Fetches pre-aggregated fleet KPI snapshots (current vs previous period) per company.
 */
export async function fetchMartFleetKpis(): Promise<FleetKpiRecord[]> {
  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query mart_fleet_kpis {
        sqlQuery(sql: "SELECT * FROM mart_fleet_kpis ORDER BY companyname")
      }`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch fleet KPIs: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  return parseSqlQueryResult<FleetKpiRecord>(json.data?.sqlQuery);
}
