import { GRAPHQL_API_URL } from "./config";
import { type PivotRow } from "../analytics";

export interface GraphQlPivotRow {
  entityId: string;
  entityName?: string;
  trips: number;
  distanceKm: number;
  netKwh: number;
  kwhPerKm: number;
  regenPct: number;
  idlePct: number;
  anomalies: number;
  fleetTripsMedian: number;
  fleetDistanceMedian: number;
  fleetNetKwhMedian: number;
  fleetKwhPerKmMedian: number;
  fleetRegenPctMedian: number;
  fleetIdlePctMedian: number;
  fleetAnomaliesMedian: number;
  createdAt: string;
}

/**
 * Fetches pivot exploration records from the GraphQL endpoint.
 */
export async function fetchPivotExploration(
  pivotType: string,
  limit = 50,
): Promise<GraphQlPivotRow[]> {
  const query = `
    query GetmartPivotExplorationFact($pivotType: String!, $limit: Int) {
      martPivotExplorationFact(pivotType: $pivotType, limit: $limit) {
        entityId
        entityName
        trips
        distanceKm
        netKwh
        kwhPerKm
        regenPct
        idlePct
        anomalies
        fleetTripsMedian
        fleetDistanceMedian
        fleetNetKwhMedian
        fleetKwhPerKmMedian
        fleetRegenPctMedian
        fleetIdlePctMedian
        fleetAnomaliesMedian
        createdAt
      }
    }
  `;

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { pivotType, limit },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch pivot exploration: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  return json.data?.martPivotExplorationFact || [];
}

/**
 * Maps GraphQL pivot exploration fields to the frontend PivotRow format.
 */
export function mapGraphQlPivotRow(raw: GraphQlPivotRow): PivotRow & {
  fleetTripsMedian: number;
  fleetDistanceMedian: number;
  fleetNetKwhMedian: number;
  fleetKwhPerKmMedian: number;
  fleetRegenPctMedian: number;
  fleetIdlePctMedian: number;
  fleetAnomaliesMedian: number;
} {
  return {
    key: raw.entityId,
    label: raw.entityName || raw.entityId,
    trips: Number(raw.trips) || 0,
    distance: Number(raw.distanceKm) || 0,
    netKwh: Number(raw.netKwh) || 0,
    kwhPerKm: Number(raw.kwhPerKm) || 0,
    regenRatio: Number(raw.regenPct) || 0,
    idleShare: Number(raw.idlePct) || 0,
    anomalies: Number(raw.anomalies) || 0,
    fleetTripsMedian: Number(raw.fleetTripsMedian) || 0,
    fleetDistanceMedian: Number(raw.fleetDistanceMedian) || 0,
    fleetNetKwhMedian: Number(raw.fleetNetKwhMedian) || 0,
    fleetKwhPerKmMedian: Number(raw.fleetKwhPerKmMedian) || 0,
    fleetRegenPctMedian: Number(raw.fleetRegenPctMedian) || 0,
    fleetIdlePctMedian: Number(raw.fleetIdlePctMedian) || 0,
    fleetAnomaliesMedian: Number(raw.fleetAnomaliesMedian) || 0,
  };
}

export async function fetchDynamicPivot(
  dim: PivotDim,
  filters: Filters,
): Promise<PivotRow[]> {
  let whereClauses: string[] = [];
  if (filters) {
    if (filters.from) {
      whereClauses.push(`scheduling_date >= '${filters.from}'`);
    }
    if (filters.to) {
      whereClauses.push(`scheduling_date <= '${filters.to}'`);
    }
    if (filters.companies && filters.companies.length > 0) {
      const list = filters.companies.map(c => `'${c.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`companyname IN (${list})`);
    }
    if (filters.drivers && filters.drivers.length > 0) {
      const list = filters.drivers.map(d => `'${d.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`driver_name IN (${list})`);
    }
    if (filters.routes && filters.routes.length > 0) {
      const list = filters.routes.map(r => `'${r.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`route_code IN (${list})`);
    }
    if (filters.vehicles && filters.vehicles.length > 0) {
      const list = filters.vehicles.map(v => `'${v.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`vehiclenumber IN (${list})`);
    }
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  let dbCol = "";
  if (dim === "driver_name") dbCol = "driver_name";
  else if (dim === "route_code") dbCol = "route_code";
  else if (dim === "vehiclenumber") dbCol = "vehiclenumber";
  else if (dim === "company_name") dbCol = "companyname";
  else if (dim === "scheduling_date") dbCol = "SUBSTR(scheduling_date, 1, 10)";

  const sql = `
    SELECT 
      ${dbCol} as key,
      ${dbCol} as label,
      COUNT(*) as trips,
      SUM(distance_km_odo_trip) as distance,
      SUM(net_kwh_consumed) as netKwh,
      CASE WHEN SUM(distance_km_odo_trip) > 0 THEN SUM(net_kwh_consumed) / SUM(distance_km_odo_trip) ELSE 0 END as kwhPerKm,
      CASE WHEN SUM(gross_discharge_kwh) > 0 THEN SUM(regen_kwh) / SUM(gross_discharge_kwh) * 100 ELSE 0 END as regenRatio,
      CASE WHEN SUM(net_kwh_consumed) > 0 THEN SUM(idle_kwh_estimated) / SUM(net_kwh_consumed) * 100 ELSE 0 END as idleShare,
      SUM(CASE WHEN efficiency_anomaly_flag = 1 OR efficiency_anomaly_flag = 'true' THEN 1 ELSE 0 END) as anomalies
    FROM trip_efficiency_fact
    ${whereStr}
    GROUP BY ${dbCol}
    ORDER BY trips DESC
  `;

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetPivot($sql: String!) {
        sqlQuery(sql: $sql)
      }`,
      variables: { sql },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch dynamic pivot: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  const rows = json.data?.sqlQuery || [];
  return rows.map((r: any) => ({
    key: r.key || "—",
    label: r.label || "—",
    trips: Number(r.trips) || 0,
    distance: Number(r.distance) || 0,
    netKwh: Number(r.netKwh) || 0,
    kwhPerKm: Number(r.kwhPerKm) || 0,
    regenRatio: Number(r.regenRatio) || 0,
    idleShare: Number(r.idleShare) || 0,
    anomalies: Number(r.anomalies) || 0,
  }));
}

import { type Filters, type PivotDim } from "../analytics";
