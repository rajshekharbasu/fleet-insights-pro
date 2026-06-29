import { useEffect, useMemo } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { useTheme } from "@/hooks/use-theme";
import { MUMBAI_CENTER, MUMBAI_DEFAULT_ZOOM } from "@/lib/geo-data";
import {
  RISK_LEVEL_COLOR,
  RISK_LEVEL_ORDER,
  normalizeRiskLevel,
  type SegmentRiskMapRow,
} from "@/lib/graphql/segment-risk-map";
import "leaflet/dist/leaflet.css";

const TILES = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
} as const;

const RISK_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/** Animated fit whenever the plotted point set changes. */
function FitToPoints({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points);
    map.flyToBounds(bounds, { padding: [28, 28], maxZoom: 15, duration: 0.8, easeLinearity: 0.22 });
  }, [map, fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Marker radius scaled by the segment risk score (0–100ish → 4–16px). */
function riskRadius(score: number): number {
  return 4 + Math.min(12, (Math.max(0, score) / 100) * 16);
}

export interface SegmentRiskMapProps {
  rows: SegmentRiskMapRow[];
  height?: number;
  /** Draw the polygon footprint of each bin in addition to the centroid dot. */
  showFootprints?: boolean;
  /**
   * Optional original road polyline for the selected route, as [lng, lat]
   * coordinates (the GeoJSON ordering from route_geometry_fact). Drawn as a
   * subtle underlay beneath the risk markers; omit when no single route is shown.
   */
  routePath?: [number, number][];
}

export function SegmentRiskMap({ rows, height = 560, showFootprints = false, routePath }: SegmentRiskMapProps) {
  const { dark } = useTheme();

  /** Leaflet-ordered ([lat, lng]) version of the route underlay, if any. */
  const routeLatLngs = useMemo<[number, number][]>(
    () => (routePath ?? []).map(([lng, lat]) => [lat, lng] as [number, number]),
    [routePath],
  );

  const points = useMemo<[number, number][]>(() => {
    const pts = rows
      .filter((r) => Number.isFinite(r.segment_lat_bin) && Number.isFinite(r.segment_lon_bin))
      .map((r) => [r.segment_lat_bin, r.segment_lon_bin] as [number, number]);
    // Include the route line so the full corridor stays in view when selected.
    return pts.concat(routeLatLngs);
  }, [rows, routeLatLngs]);

  const fitKey = useMemo(
    () =>
      `${rows.length}|${rows[0]?.segment_id ?? ""}|${rows[rows.length - 1]?.segment_id ?? ""}|${routeLatLngs.length}`,
    [rows, routeLatLngs.length],
  );

  return (
    <div
      className={`fleet-map-shell relative overflow-hidden rounded-2xl border border-border/60 shadow-elevated ${
        dark ? "fleet-map-dark" : "fleet-map-light"
      }`}
      style={{ height }}
    >
      <MapContainer
        center={MUMBAI_CENTER}
        zoom={MUMBAI_DEFAULT_ZOOM}
        className="fleet-map-canvas h-full w-full z-0"
        scrollWheelZoom
        attributionControl={false}
        zoomControl
      >
        <TileLayer url={dark ? TILES.dark : TILES.light} />
        <FitToPoints points={points} fitKey={fitKey} />

        {/* Original route road polyline (underlay, beneath the risk markers) */}
        {routeLatLngs.length >= 2 && (
          <>
            <Polyline
              positions={routeLatLngs}
              pathOptions={{ color: "#2dd4bf", weight: 11, opacity: 0.12, lineCap: "round", lineJoin: "round" }}
            />
            <Polyline
              positions={routeLatLngs}
              pathOptions={{ color: "#2dd4bf", weight: 4, opacity: 0.45, lineCap: "round", lineJoin: "round" }}
            />
          </>
        )}

        {showFootprints &&
          rows.map((r) => {
            if (r.segment_polygon.length < 3) return null;
            const ring = r.segment_polygon.map(([lng, lat]) => [lat, lng] as [number, number]);
            const color = RISK_LEVEL_COLOR[normalizeRiskLevel(r.risk_level)];
            return (
              <Polygon
                key={`poly-${r.segment_id}`}
                positions={ring}
                pathOptions={{ color, weight: 1, opacity: 0.35, fillColor: color, fillOpacity: 0.12 }}
              />
            );
          })}

        {rows.map((r) => {
          if (!Number.isFinite(r.segment_lat_bin) || !Number.isFinite(r.segment_lon_bin)) return null;
          const level = normalizeRiskLevel(r.risk_level);
          const color = RISK_LEVEL_COLOR[level];
          const isHigh = level === "high" || level === "critical";
          return (
            <CircleMarker
              key={r.segment_id}
              center={[r.segment_lat_bin, r.segment_lon_bin]}
              radius={riskRadius(r.segment_difficulty_score)}
              pathOptions={{
                color: isHigh ? "#fff" : color,
                fillColor: color,
                fillOpacity: isHigh ? 0.85 : 0.6,
                weight: isHigh ? 2 : 1.25,
              }}
            >
              <Popup>
                <div className="min-w-[180px] space-y-1 text-[12px]">
                  <div className="num font-semibold">{r.segment_id}</div>
                  <div className="text-muted-foreground">
                    {r.route_code ? `Route ${r.route_code} · ` : ""}
                    {r.route_name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    <span className="capitalize">{RISK_LABEL[level] ?? level} risk</span>
                  </div>
                  <div className="num">
                    Score {r.segment_difficulty_score.toFixed(0)} · {r.dms_event_count} DMS ·{" "}
                    {r.hard_braking_count} braking
                  </div>
                  <div className="num text-muted-foreground">
                    {r.avg_speed.toFixed(1)} km/h avg · {(r.stop_ratio * 100).toFixed(0)}% stop
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/92 px-2.5 py-1.5 text-[10.5px] backdrop-blur-md">
        {RISK_LEVEL_ORDER.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 px-1">
            <span className="h-2 w-2 rounded-full" style={{ background: RISK_LEVEL_COLOR[k] }} />
            <span className="capitalize text-muted-foreground">{RISK_LABEL[k]}</span>
          </span>
        ))}
      </div>

      <div className="pointer-events-none absolute right-3 bottom-3 z-[1000] rounded-xl border border-border/50 bg-card/92 px-3 py-2 text-[11px] backdrop-blur-md">
        <div className="section-label">mart_segment_risk_map</div>
        <div className="mt-0.5 num text-foreground">{rows.length} segments</div>
      </div>
    </div>
  );
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: undefined,
  iconUrl: undefined,
  shadowUrl: undefined,
});
