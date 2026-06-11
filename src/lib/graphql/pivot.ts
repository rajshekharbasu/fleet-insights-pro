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
