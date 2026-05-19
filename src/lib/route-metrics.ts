import type { RouteContext, SegmentRisk } from "./fleet-data";

export interface RouteEndpointLabels {
  start: string;
  end: string;
}

export interface RouteStats {
  segmentCount: number;
  dmsTotal: number;
  harshBraking: number;
  overspeed: number;
  distraction: number;
  drowsiness: number;
  highRiskSegments: number;
  avgRisk: number;
  pathKm: number;
}

export function routeEndpointLabels(route: RouteContext): RouteEndpointLabels {
  const parts = route.route_name.split("→").map((s) => s.trim());
  if (parts.length >= 2) {
    return { start: parts[0], end: parts[parts.length - 1] };
  }
  return { start: "Origin", end: "Destination" };
}

export function computeRouteStats(
  route: RouteContext,
  segments: SegmentRisk[],
): RouteStats {
  const routeSegs = segments.filter((s) => s.route_id === route.route_id);
  const dmsTotal = routeSegs.reduce(
    (n, s) => n + s.harsh_braking + s.overspeed + s.distraction + s.drowsiness + s.rough_road,
    0,
  );
  const pathKm = routeSegs.reduce((n, s) => n + s.length_km, 0) || route.avg_distance_km;

  return {
    segmentCount: routeSegs.length,
    dmsTotal,
    harshBraking: routeSegs.reduce((n, s) => n + s.harsh_braking, 0),
    overspeed: routeSegs.reduce((n, s) => n + s.overspeed, 0),
    distraction: routeSegs.reduce((n, s) => n + s.distraction, 0),
    drowsiness: routeSegs.reduce((n, s) => n + s.drowsiness, 0),
    highRiskSegments: routeSegs.filter((s) => s.risk_score >= 70).length,
    avgRisk: routeSegs.length
      ? routeSegs.reduce((n, s) => n + s.risk_score, 0) / routeSegs.length
      : 0,
    pathKm,
  };
}

export type CompareWinner = "a" | "b" | "tie";

/** Lower is better for difficulty, efficiency, congestion, dms. Higher is better for speed. */
export function compareWinner(
  a: number,
  b: number,
  lowerIsBetter: boolean,
): CompareWinner {
  const diff = Math.abs(a - b);
  if (diff < 0.001 * Math.max(Math.abs(a), Math.abs(b), 1)) return "tie";
  if (lowerIsBetter) return a < b ? "a" : "b";
  return a > b ? "a" : "b";
}
