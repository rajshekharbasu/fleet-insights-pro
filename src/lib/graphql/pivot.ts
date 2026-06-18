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
  let pivotDim = "";
  let keyCol = "entity_id";
  let labelCol = "COALESCE(entity_name, entity_id)";

  if (dim === "driver_name") {
    pivotDim = "driver";
    keyCol = "entity_name";
    labelCol = "entity_name";
  } else if (dim === "route_code") {
    pivotDim = "route";
    keyCol = "entity_id";
    labelCol = "COALESCE(entity_name, entity_id)";
  } else if (dim === "vehiclenumber") {
    pivotDim = "vehicle";
    keyCol = "entity_id";
    labelCol = "COALESCE(entity_name, entity_id)";
  } else if (dim === "company_name") {
    pivotDim = "company";
    keyCol = "companyname";
    labelCol = "companyname";
  } else if (dim === "scheduling_date") {
    pivotDim = "company";
    keyCol = "SUBSTR(snapshot_date, 1, 10)";
    labelCol = "SUBSTR(snapshot_date, 1, 10)";
  }

  let whereClauses: string[] = [`pivot_dimension = '${pivotDim}'`];

  if (filters) {
    if (filters.from) {
      whereClauses.push(`snapshot_date >= '${filters.from}'`);
    }
    if (filters.to) {
      whereClauses.push(`snapshot_date <= '${filters.to}'`);
    }
    if (filters.companies && filters.companies.length > 0) {
      const list = filters.companies.map(c => `'${c.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`companyname IN (${list})`);
    }
    if (dim === "driver_name" && filters.drivers && filters.drivers.length > 0) {
      const list = filters.drivers.map(d => `'${d.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`entity_name IN (${list})`);
    }
    if (dim === "route_code" && filters.routes && filters.routes.length > 0) {
      const list = filters.routes.map(r => `'${r.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`entity_id IN (${list})`);
    }
    if (dim === "vehiclenumber" && filters.vehicles && filters.vehicles.length > 0) {
      const list = filters.vehicles.map(v => `'${v.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`entity_id IN (${list})`);
    }
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sql = `
    SELECT 
      ${keyCol} as key,
      ${labelCol} as label,
      SUM(trip_count) as trips,
      SUM(total_distance_km) as distance,
      SUM(total_net_kwh) as netKwh,
      CASE WHEN SUM(total_distance_km) > 0 THEN SUM(total_net_kwh) / SUM(total_distance_km) ELSE 0 END as kwhPerKm,
      CASE WHEN SUM(trip_count) > 0 THEN SUM(avg_regen_pct * trip_count) / SUM(trip_count) ELSE 0 END as regenRatio,
      CASE WHEN SUM(trip_count) > 0 THEN SUM(avg_idle_pct * trip_count) / SUM(trip_count) ELSE 0 END as idleShare,
      SUM(COALESCE(total_anomalies, 0)) as anomalies
    FROM mart_pivot_exploration_fact
    ${whereStr}
    GROUP BY ${keyCol}, ${labelCol}
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
