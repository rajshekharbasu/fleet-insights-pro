// GeoJSON layer for fleet maps. Swap builders with API GeoJSON when real coords are wired in.

import type { RouteContext, SegmentRisk } from "./fleet-data";

export type HotspotKind =
  | "harsh_braking"
  | "overspeed"
  | "distraction"
  | "drowsiness"
  | "rough_road"
  | "risk";

export type LngLat = [number, number];

/** Greater Mumbai — tight viewport (island city + inner suburbs). */
export const GEO_BBOX = {
  minLat: 18.94,
  maxLat: 19.21,
  minLng: 72.805,
  maxLng: 72.955,
} as const;

/** Mumbai city center — default map anchor. */
export const MUMBAI_CENTER: [number, number] = [19.076, 72.8777];

/** Closer default — avoids zoomed-out clutter. */
export const MUMBAI_DEFAULT_ZOOM = 13;

export const MAP_ZOOM = {
  overview: { max: 14, min: 12 },
  focus: { max: 17, min: 14 },
  /** Side-by-side compare — fit full corridor start-to-end. */
  compare: { max: 15, min: 13 },
} as const;

export function normToLngLat(x: number, y: number): LngLat {
  const lng = GEO_BBOX.minLng + x * (GEO_BBOX.maxLng - GEO_BBOX.minLng);
  const lat = GEO_BBOX.maxLat - y * (GEO_BBOX.maxLat - GEO_BBOX.minLat);
  return [lng, lat];
}

/** Inverse of {@link normToLngLat} — maps real lng/lat into the map's normalized space. */
export function lngLatToNorm(lng: number, lat: number): { x: number; y: number } {
  const x = (lng - GEO_BBOX.minLng) / (GEO_BBOX.maxLng - GEO_BBOX.minLng);
  const y = (GEO_BBOX.maxLat - lat) / (GEO_BBOX.maxLat - GEO_BBOX.minLat);
  return { x, y };
}

export interface RouteLineProperties {
  route_id: string;
  route_code: string;
  route_name: string;
  difficulty_score: number;
  efficiency_kwh_per_km: number;
  congestion_score: number;
}

export interface DmsEventProperties {
  segment_id: string;
  route_id: string;
  route_code: string;
  kind: HotspotKind;
  count: number;
  risk_score: number;
  length_km: number;
}

export interface SegmentSpanProperties {
  segment_id: string;
  route_id: string;
  risk_score: number;
  has_dms: boolean;
  dms_total: number;
}

export type RouteLineFeature = GeoJSON.Feature<GeoJSON.LineString, RouteLineProperties>;
export type DmsPointFeature = GeoJSON.Feature<GeoJSON.Point, DmsEventProperties>;
export type SegmentSpanFeature = GeoJSON.Feature<GeoJSON.LineString, SegmentSpanProperties>;

export function buildRouteCollection(
  routes: RouteContext[],
): GeoJSON.FeatureCollection<GeoJSON.LineString, RouteLineProperties> {
  return {
    type: "FeatureCollection",
    features: routes.map((r) => ({
      type: "Feature",
      properties: {
        route_id: r.route_id,
        route_code: r.route_code,
        route_name: r.route_name,
        difficulty_score: r.difficulty_score,
        efficiency_kwh_per_km: r.efficiency_kwh_per_km,
        congestion_score: r.congestion_score,
      },
      geometry: {
        type: "LineString",
        coordinates: r.path.map((p) => normToLngLat(p.x, p.y)),
      },
    })),
  };
}

export function buildSegmentSpanCollection(
  route: RouteContext,
  segments: SegmentRisk[],
): GeoJSON.FeatureCollection<GeoJSON.LineString, SegmentSpanProperties> {
  const features: SegmentSpanFeature[] = [];

  for (const s of segments.filter((seg) => seg.route_id === route.route_id)) {
    const i = s.seq - 1;
    const a = route.path[i];
    const b = route.path[i + 1];
    if (!a || !b) continue;
    const dmsTotal = s.harsh_braking + s.overspeed + s.distraction + s.drowsiness + s.rough_road;
    features.push({
      type: "Feature",
      properties: {
        segment_id: s.segment_id,
        route_id: s.route_id,
        risk_score: s.risk_score,
        has_dms: dmsTotal > 0,
        dms_total: dmsTotal,
      },
      geometry: {
        type: "LineString",
        coordinates: [normToLngLat(a.x, a.y), normToLngLat(b.x, b.y)],
      },
    });
  }

  return { type: "FeatureCollection", features };
}

const KIND_FIELDS: Record<Exclude<HotspotKind, "risk">, keyof SegmentRisk> = {
  harsh_braking: "harsh_braking",
  overspeed: "overspeed",
  distraction: "distraction",
  drowsiness: "drowsiness",
  rough_road: "rough_road",
};

export function segmentIntensity(s: SegmentRisk, kinds: HotspotKind[]): number {
  if (kinds.includes("risk") || kinds.length === 0) return s.risk_score / 100;
  let sum = 0;
  let cap = 0;
  for (const k of kinds) {
    if (k === "risk") continue;
    const field = KIND_FIELDS[k];
    sum += Math.min(60, s[field] as number);
    cap += 60;
  }
  return cap ? sum / cap : 0;
}

export function buildDmsEventCollection(
  segments: SegmentRisk[],
  activeKinds: HotspotKind[],
  routeId?: string,
): GeoJSON.FeatureCollection<GeoJSON.Point, DmsEventProperties> {
  const scoped = routeId ? segments.filter((s) => s.route_id === routeId) : segments;
  const kinds =
    activeKinds.includes("risk") || activeKinds.length === 0
      ? (Object.keys(KIND_FIELDS) as Exclude<HotspotKind, "risk">[])
      : activeKinds.filter((k): k is Exclude<HotspotKind, "risk"> => k !== "risk");

  const features: DmsPointFeature[] = [];

  for (const s of scoped) {
    const coord = normToLngLat(s.x, s.y);
    for (const kind of kinds) {
      const count = s[KIND_FIELDS[kind]] as number;
      if (count <= 0) continue;
      features.push({
        type: "Feature",
        properties: {
          segment_id: s.segment_id,
          route_id: s.route_id,
          route_code: s.route_code,
          kind,
          count,
          risk_score: s.risk_score,
          length_km: s.length_km,
        },
        geometry: { type: "Point", coordinates: coord },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

/** One marker per segment (dominant DMS type) — cleaner at city zoom. */
export function buildDmsSummaryCollection(
  segments: SegmentRisk[],
  routeId?: string,
  minRisk = 55,
): GeoJSON.FeatureCollection<GeoJSON.Point, DmsEventProperties> {
  const scoped = routeId ? segments.filter((s) => s.route_id === routeId) : segments;
  const features: DmsPointFeature[] = [];

  for (const s of scoped) {
    if (s.risk_score < minRisk) continue;
    const counts = (Object.keys(KIND_FIELDS) as Exclude<HotspotKind, "risk">[]).map((k) => ({
      kind: k,
      count: s[KIND_FIELDS[k]] as number,
    }));
    const top = counts.sort((a, b) => b.count - a.count)[0];
    if (!top || top.count <= 0) continue;
    features.push({
      type: "Feature",
      properties: {
        segment_id: s.segment_id,
        route_id: s.route_id,
        route_code: s.route_code,
        kind: top.kind,
        count: top.count,
        risk_score: s.risk_score,
        length_km: s.length_km,
      },
      geometry: { type: "Point", coordinates: normToLngLat(s.x, s.y) },
    });
  }

  return { type: "FeatureCollection", features };
}

export function collectionBounds(
  routes: GeoJSON.FeatureCollection<GeoJSON.LineString, RouteLineProperties>,
  pad = 0.004,
): [[number, number], [number, number]] | null {
  const coords: LngLat[] = [];
  for (const f of routes.features) {
    for (const c of f.geometry.coordinates) coords.push(c as LngLat);
  }
  if (!coords.length) return null;
  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLat - pad, minLng - pad],
    [maxLat + pad, maxLng + pad],
  ];
}

export function mumbaiBounds(pad = 0.006): [[number, number], [number, number]] {
  return [
    [GEO_BBOX.minLat - pad, GEO_BBOX.minLng - pad],
    [GEO_BBOX.maxLat + pad, GEO_BBOX.maxLng + pad],
  ];
}

export function pointCollectionBounds(
  coords: LngLat[],
  pad = 0.002,
): [[number, number], [number, number]] | null {
  if (!coords.length) return null;
  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLat - pad, minLng - pad],
    [maxLat + pad, maxLng + pad],
  ];
}

export function mergeBounds(
  a: [[number, number], [number, number]] | null,
  b: [[number, number], [number, number]] | null,
  pad = 0.001,
): [[number, number], [number, number]] | null {
  if (!a) return b;
  if (!b) return a;
  return [
    [
      Math.min(a[0][0], b[0][0]) - pad,
      Math.min(a[0][1], b[0][1]) - pad,
    ],
    [
      Math.max(a[1][0], b[1][0]) + pad,
      Math.max(a[1][1], b[1][1]) + pad,
    ],
  ];
}

export function routeBounds(
  route: RouteContext,
  pad = 0.0025,
): [[number, number], [number, number]] {
  const coords = route.path.map((p) => normToLngLat(p.x, p.y));
  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLat - pad, minLng - pad],
    [maxLat + pad, maxLng + pad],
  ];
}

export function riskColor(score: number): string {
  if (score >= 75) return "#f87171";
  if (score >= 55) return "#fbbf24";
  return "#2dd4bf";
}

export const KIND_COLOR: Record<HotspotKind, string> = {
  harsh_braking: "#ef4444",
  overspeed: "#f59e0b",
  distraction: "#a855f7",
  drowsiness: "#3b82f6",
  rough_road: "#eab308",
  risk: "#2dd4bf",
};

export const KIND_LABEL: Record<HotspotKind, string> = {
  risk: "Composite risk",
  harsh_braking: "Harsh braking",
  overspeed: "Overspeed",
  distraction: "Distraction",
  drowsiness: "Drowsiness",
  rough_road: "Rough road",
};

export const COMPARE_ACCENT = {
  A: { color: "#2dd4bf", label: "Route A" },
  B: { color: "#c084fc", label: "Route B" },
} as const;

export const ROUTE_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/** Stable hash so the same route_id always maps to the same palette slot. */
function hashRouteId(routeId: string): number {
  let h = 0;
  for (let i = 0; i < routeId.length; i++) {
    h = (Math.imul(31, h) + routeId.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Deterministic color per route — cycles chart tokens, then evenly-spaced oklch
 * hues for additional routes (mirrors depotColor in battery-cycles.ts).
 */
export function routeColor(routeId: string): string {
  const i = hashRouteId(routeId);
  const slot = i % ROUTE_PALETTE.length;
  const cycle = Math.floor(i / ROUTE_PALETTE.length);
  if (cycle === 0) return ROUTE_PALETTE[slot];
  const hue = (195 + (cycle - 1) * 47 + slot * 23) % 360;
  return `oklch(0.62 0.16 ${hue})`;
}
