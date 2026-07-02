import { Fragment, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { useTheme } from "@/hooks/use-theme";
import type { RouteContext, SegmentRisk } from "@/lib/fleet-data";
import {
  buildDmsEventCollection,
  buildDmsSummaryCollection,
  buildRouteCollection,
  buildSegmentSpanCollection,
  collectionBounds,
  KIND_COLOR,
  KIND_LABEL,
  MAP_ZOOM,
  mergeBounds,
  MUMBAI_CENTER,
  MUMBAI_DEFAULT_ZOOM,
  mumbaiBounds,
  pointCollectionBounds,
  riskColor,
  routeBounds,
  routeColor,
  segmentIntensity,
  type HotspotKind,
} from "@/lib/geo-data";
import "leaflet/dist/leaflet.css";

const TILES = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
} as const;

/** Animated pan/zoom whenever `fitTrigger` changes (route pick, DMS filter, etc.). */
function MapViewAnimator({
  bounds,
  maxZoom,
  fitTrigger,
}: {
  bounds: [[number, number], [number, number]] | null;
  maxZoom: number;
  fitTrigger: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;
    const latLngBounds = L.latLngBounds(bounds);
    map.flyToBounds(latLngBounds, {
      padding: [22, 22],
      maxZoom,
      duration: 0.85,
      easeLinearity: 0.22,
    });
  }, [map, bounds, maxZoom, fitTrigger]);

  return null;
}

function routeStrokeColor(
  routeId: string,
  difficulty: number,
  focusRouteId?: string,
  accentColor?: string,
  perRouteColors = false,
): { color: string; weight: number; opacity: number } {
  const isFocus = focusRouteId === routeId;
  const isBackground = focusRouteId && !isFocus;

  if (isFocus && accentColor) {
    return { color: accentColor, weight: 5, opacity: 0.98 };
  }
  if (isFocus) {
    return { color: riskColor(difficulty), weight: 5, opacity: 0.98 };
  }
  if (isBackground) {
    return { color: "#64748b", weight: 2, opacity: 0.22 };
  }
  if (perRouteColors) {
    return { color: routeColor(routeId), weight: 4, opacity: 0.85 };
  }
  return { color: riskColor(difficulty), weight: 3, opacity: 0.75 };
}

const START_MARKER_COLOR = "#22c55e";

function routeEndpointIcon(label: "S" | "E", fillColor: string, size: number): L.DivIcon {
  return L.divIcon({
    className: "route-endpoint-icon",
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${fillColor};border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
      font-size:${Math.round(size * 0.42)}px;font-weight:700;color:#fff;
      font-family:system-ui,sans-serif;line-height:1;
    ">${label}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export interface FleetMapProps {
  routes: RouteContext[];
  segments?: SegmentRisk[];
  focusRouteId?: string;
  highlightRouteIds?: string[];
  activeKinds?: HotspotKind[];
  height?: number;
  showLegend?: boolean;
  showFleetBadge?: boolean;
  panelTitle?: string;
  panelSubtitle?: string;
  accentColor?: string;
  fitFocusRoute?: boolean;
  /** Overview: no dots. Summary: one dot per risky segment. Full: all DMS types. */
  dmsMode?: "none" | "summary" | "full";
  /** Change this string to re-run the fly-to animation (e.g. compareIds + kinds). */
  fitTrigger?: string;
  /** Only render the focused route — for side-by-side compare panels. */
  soloRoute?: boolean;
  /** Start / end markers on each visible route corridor. */
  showEndpoints?: boolean;
  onSegmentHover?: (s: SegmentRisk | null) => void;
  onSegmentClick?: (s: SegmentRisk) => void;
}

export function FleetMap({
  routes,
  segments = [],
  focusRouteId,
  highlightRouteIds,
  activeKinds = ["risk"],
  height = 480,
  showLegend = true,
  showFleetBadge = true,
  panelTitle,
  panelSubtitle,
  accentColor,
  fitFocusRoute = false,
  dmsMode: dmsModeProp,
  fitTrigger: fitTriggerProp,
  soloRoute = false,
  showEndpoints = false,
  onSegmentHover,
  onSegmentClick,
}: FleetMapProps) {
  const dmsMode =
    dmsModeProp ?? (focusRouteId ? "full" : "none");
  const [flightPulse, setFlightPulse] = useState(false);
  const { dark } = useTheme();

  const displayRoutes = useMemo(() => {
    if (soloRoute && focusRouteId) {
      const r = routes.find((x) => x.route_id === focusRouteId);
      return r ? [r] : routes;
    }
    return routes;
  }, [routes, soloRoute, focusRouteId]);

  const routeCollection = useMemo(
    () => buildRouteCollection(displayRoutes),
    [displayRoutes],
  );

  const focusRoute = useMemo(
    () => displayRoutes.find((r) => r.route_id === focusRouteId) ?? routes.find((r) => r.route_id === focusRouteId),
    [displayRoutes, routes, focusRouteId],
  );

  const endpoints = useMemo(() => {
    if (!showEndpoints) return [];
    return routeCollection.features
      .filter((f) => f.geometry.coordinates.length >= 2)
      .map((f) => {
        const coords = f.geometry.coordinates as [number, number][];
        const isFocus = focusRouteId === f.properties.route_id;
        const endColor =
          isFocus && accentColor ? accentColor : routeColor(f.properties.route_id);
        const size =
          soloRoute || routeCollection.features.length <= 2
            ? 22
            : routeCollection.features.length <= 6
              ? 18
              : 15;
        return {
          routeId: f.properties.route_id,
          routeCode: f.properties.route_code,
          routeName: f.properties.route_name,
          start: coords[0],
          end: coords[coords.length - 1],
          endColor,
          size,
        };
      });
  }, [showEndpoints, routeCollection, focusRouteId, accentColor, soloRoute]);

  const segmentSpans = useMemo(
    () => (focusRoute ? buildSegmentSpanCollection(focusRoute, segments) : null),
    [focusRoute, segments],
  );

  const eventCollection = useMemo(() => {
    if (dmsMode === "none") {
      return { type: "FeatureCollection" as const, features: [] };
    }
    if (dmsMode === "summary") {
      return buildDmsSummaryCollection(segments, focusRouteId, 60);
    }
    return buildDmsEventCollection(segments, activeKinds, focusRouteId);
  }, [segments, activeKinds, focusRouteId, dmsMode]);

  const segmentById = useMemo(
    () => new Map(segments.map((s) => [s.segment_id, s])),
    [segments],
  );

  const fitMaxZoom = soloRoute
    ? MAP_ZOOM.compare.max
    : focusRouteId
      ? MAP_ZOOM.focus.max
      : MAP_ZOOM.overview.max;

  const kindsKey = activeKinds.join(",");

  const fitTrigger =
    fitTriggerProp ??
    `${focusRouteId ?? "fleet"}|${kindsKey}|${dmsMode}|${eventCollection.features.length}`;

  const fitBounds = useMemo(() => {
    let base: [[number, number], [number, number]] | null = null;

    const routePad = soloRoute ? 0.005 : 0.0025;

    if (fitFocusRoute && focusRoute) {
      base = routeBounds(focusRoute, routePad);
    } else if (focusRouteId && focusRoute) {
      base = routeBounds(focusRoute, routePad);
    } else if (focusRouteId) {
      const f = routeCollection.features.find((x) => x.properties.route_id === focusRouteId);
      if (f?.geometry.coordinates.length) {
        base = pointCollectionBounds(f.geometry.coordinates as [number, number][], 0.003);
      }
    } else {
      base = collectionBounds(routeCollection, 0.003) ?? mumbaiBounds(0.004);
    }

    if (focusRouteId && dmsMode !== "none" && eventCollection.features.length > 0) {
      const pts = eventCollection.features.map(
        (f) => f.geometry.coordinates as [number, number],
      );
      base = mergeBounds(base, pointCollectionBounds(pts, 0.002), 0.001);
    }

    return base;
  }, [
    fitFocusRoute,
    focusRoute,
    focusRouteId,
    routeCollection,
    eventCollection.features,
    dmsMode,
    soloRoute,
  ]);

  useEffect(() => {
    setFlightPulse(true);
    const t = window.setTimeout(() => setFlightPulse(false), 700);
    return () => window.clearTimeout(t);
  }, [fitTrigger]);

  const kindsForLegend =
    activeKinds.includes("risk") || activeKinds.length === 0
      ? (["risk"] as HotspotKind[])
      : activeKinds;

  const dmsOnRoute = eventCollection.features.length;
  const highRiskSegs =
    segmentSpans?.features.filter((f) => f.properties.risk_score >= 70).length ?? 0;

  const usePerRouteColors = !focusRouteId && displayRoutes.length > 0;

  const legendRoutes = useMemo(
    () =>
      [...displayRoutes].sort((a, b) => a.route_code.localeCompare(b.route_code)),
    [displayRoutes],
  );

  return (
    <div
      className={`fleet-map-shell relative overflow-hidden rounded-2xl border shadow-elevated transition-[box-shadow,border-color] duration-500 ${dark ? "fleet-map-dark" : "fleet-map-light"} ${flightPulse ? "map-flight-pulse" : ""}`}
      style={{ height }}
    >
      {panelTitle && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[1000] border-b border-border/40 px-4 py-3 backdrop-blur-md"
          style={{
            background: `linear-gradient(180deg, color-mix(in oklab, var(--card) 94%, ${accentColor ?? "var(--primary)"} 6%), transparent)`,
          }}
        >
          <div className="flex items-center gap-2">
            {accentColor && (
              <span
                className="h-2.5 w-2.5 rounded-full ring-2 ring-white/30"
                style={{ background: accentColor, boxShadow: `0 0 12px ${accentColor}` }}
              />
            )}
            <div>
              <div className="text-[13px] font-semibold tracking-tight">{panelTitle}</div>
              {panelSubtitle && (
                <div className="text-[11px] text-muted-foreground">{panelSubtitle}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <MapContainer
        center={MUMBAI_CENTER}
        zoom={MUMBAI_DEFAULT_ZOOM}
        className="fleet-map-canvas h-full w-full z-0"
        scrollWheelZoom
        attributionControl={false}
        zoomControl
      >
        <TileLayer url={dark ? TILES.dark : TILES.light} />
        <MapViewAnimator bounds={fitBounds} maxZoom={fitMaxZoom} fitTrigger={fitTrigger} />

        {routeCollection.features.map((f) => {
          const stroke = routeStrokeColor(
            f.properties.route_id,
            f.properties.difficulty_score,
            focusRouteId,
            accentColor,
            usePerRouteColors,
          );
          const latLngs = f.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number],
          );
          const isFocus = focusRouteId === f.properties.route_id;

          return (
            <Polyline
              key={`glow-${f.properties.route_id}-${focusRouteId ?? "all"}-${kindsKey}`}
              positions={latLngs}
              pathOptions={{
                color: stroke.color,
                weight: isFocus ? 14 : 5,
                opacity: isFocus ? 0.2 : 0.05,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          );
        })}

        {routeCollection.features.map((f) => {
          const stroke = routeStrokeColor(
            f.properties.route_id,
            f.properties.difficulty_score,
            focusRouteId,
            accentColor,
            usePerRouteColors,
          );
          const latLngs = f.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number],
          );

          return (
            <Polyline
              key={f.properties.route_id}
              positions={latLngs}
              pathOptions={{
                color: stroke.color,
                weight: stroke.weight,
                opacity: stroke.opacity,
                lineCap: "round",
                lineJoin: "round",
              }}
            >
              <Popup>
                <div className="min-w-[160px] space-y-1 text-[12px]">
                  <div className="font-semibold">{f.properties.route_code}</div>
                  <div className="text-muted-foreground">{f.properties.route_name}</div>
                  <div className="num">
                    Difficulty {f.properties.difficulty_score.toFixed(0)} ·{" "}
                    {f.properties.efficiency_kwh_per_km.toFixed(2)} kWh/km
                  </div>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {segmentSpans?.features.map((span) => {
          const latLngs = span.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng] as [number, number],
          );
          const risk = span.properties.risk_score;
          const hasDms = span.properties.has_dms;
          const color = hasDms ? "#fb7185" : riskColor(risk);

          return (
            <Polyline
              key={`seg-${span.properties.segment_id}`}
              positions={latLngs}
              pathOptions={{
                color,
                weight: hasDms ? 7 : 4,
                opacity: hasDms ? 0.95 : 0.55,
                lineCap: "round",
              }}
            />
          );
        })}

        {showEndpoints && focusRoute?.stops?.map((stop, i) => (
          <CircleMarker
            key={`stop-${focusRoute.route_id}-${stop.stage_id}-${i}`}
            center={[stop.lat, stop.lon]}
            radius={4.5}
            pathOptions={{
              color: "#fff",
              fillColor: accentColor ?? "var(--color-primary)",
              fillOpacity: 0.9,
              weight: 1.5,
            }}
          >
            <Popup>
              <div className="min-w-[150px] space-y-0.5 text-[12px]">
                <div className="font-semibold">Stage {stop.stage_id}</div>
                <div className="num text-muted-foreground">
                  {stop.lat.toFixed(5)}, {stop.lon.toFixed(5)}
                </div>
                <div className="text-muted-foreground">Stop {i + 1} of {focusRoute.stops!.length}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {endpoints.map((ep) => (
          <Fragment key={ep.routeId}>
            <Marker
              position={[ep.start[1], ep.start[0]]}
              icon={routeEndpointIcon("S", START_MARKER_COLOR, ep.size)}
            >
              <Popup>
                <div className="min-w-[140px] space-y-0.5 text-[12px]">
                  <div className="font-semibold">{ep.routeCode} · Start</div>
                  <div className="text-muted-foreground">{ep.routeName}</div>
                </div>
              </Popup>
            </Marker>
            <Marker
              position={[ep.end[1], ep.end[0]]}
              icon={routeEndpointIcon("E", ep.endColor, ep.size)}
            >
              <Popup>
                <div className="min-w-[140px] space-y-0.5 text-[12px]">
                  <div className="font-semibold">{ep.routeCode} · End</div>
                  <div className="text-muted-foreground">{ep.routeName}</div>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        ))}

        {dmsMode !== "none" &&
          eventCollection.features.map((ev, i) => {
          const seg = segmentById.get(ev.properties.segment_id);
          const intensity = seg ? segmentIntensity(seg, activeKinds) : ev.properties.count / 40;
          const [lng, lat] = ev.geometry.coordinates;
          const color = KIND_COLOR[ev.properties.kind];
          const radius =
            dmsMode === "full"
              ? 4 + Math.min(12, intensity * 14 + ev.properties.count / 8)
              : 3.5 + Math.min(8, intensity * 10);
          const isHigh = ev.properties.risk_score >= 70;

          return (
            <CircleMarker
              key={`${ev.properties.segment_id}-${ev.properties.kind}-${kindsKey}-${i}`}
              center={[lat, lng]}
              radius={radius}
              pathOptions={{
                color: isHigh ? "#fff" : color,
                fillColor: color,
                fillOpacity: isHigh ? 0.88 : 0.62,
                weight: isHigh ? 2.5 : 1.5,
              }}
              eventHandlers={{
                mouseover: () => seg && onSegmentHover?.(seg),
                mouseout: () => onSegmentHover?.(null),
                click: () => seg && onSegmentClick?.(seg),
              }}
            >
              <Popup>
                <div className="min-w-[150px] space-y-1 text-[12px]">
                  <div className="num font-semibold">{ev.properties.segment_id}</div>
                  <div className="capitalize text-muted-foreground">
                    {KIND_LABEL[ev.properties.kind]} · {ev.properties.count} events
                  </div>
                  <div className="num">Risk {ev.properties.risk_score.toFixed(0)}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {showFleetBadge && (
        <div className="pointer-events-none absolute left-3 bottom-3 z-[1000] flex flex-col gap-1.5">
          <div className="rounded-xl border border-border/50 bg-card/92 px-3 py-2 text-[11px] backdrop-blur-md">
            <div className="section-label">Mumbai · MMR</div>
            <div className="mt-0.5 num text-foreground">
              {focusRoute ? (
                <>
                  {focusRoute.route_code}
                  <span className="text-muted-foreground"> · </span>
                  {dmsOnRoute} DMS events
                </>
              ) : (
                <>{routes.length} routes</>
              )}
            </div>
          </div>
          {focusRoute && highRiskSegs > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[10.5px] font-medium text-destructive backdrop-blur-md">
              {highRiskSegs} high-risk segments
            </div>
          )}
        </div>
      )}

      {showLegend && focusRouteId && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-[1000] flex flex-col gap-1 rounded-xl border border-border/50 bg-card/92 px-2.5 py-2 text-[10px] backdrop-blur-md">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-6 rounded-full bg-[#fb7185]" /> Segment w/ DMS
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" /> DMS event
          </span>
        </div>
      )}

      {showLegend && !focusRouteId && kindsForLegend.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-wrap items-center gap-1.5 rounded-xl border border-border/50 bg-card/92 px-2.5 py-1.5 text-[10.5px] backdrop-blur-md">
          {kindsForLegend.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 px-1">
              <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
              <span className="text-muted-foreground">{KIND_LABEL[k]}</span>
            </span>
          ))}
        </div>
      )}

      {showLegend && usePerRouteColors && legendRoutes.length > 1 && (
        <div className="pointer-events-auto absolute bottom-3 right-3 z-[1000] max-h-[220px] max-w-[min(280px,calc(100%-1.5rem))] overflow-y-auto rounded-xl border border-border/50 bg-card/92 px-2.5 py-2 text-[10.5px] backdrop-blur-md">
          <div className="section-label mb-1.5">Routes</div>
          <div className="flex flex-col gap-1">
            {legendRoutes.map((r) => (
              <span
                key={r.route_id}
                className="inline-flex min-w-0 items-center gap-2"
                title={r.route_name}
              >
                <span
                  className="h-1.5 w-4 shrink-0 rounded-full"
                  style={{ background: routeColor(r.route_id) }}
                />
                <span className="num shrink-0 font-medium">{r.route_code}</span>
                <span className="truncate text-muted-foreground">{r.route_name}</span>
              </span>
            ))}
          </div>
          {showEndpoints && (
            <div className="mt-2 flex flex-col gap-1 border-t border-border/40 pt-2">
              <span className="inline-flex items-center gap-2">
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: START_MARKER_COLOR }}
                >
                  S
                </span>
                <span className="text-muted-foreground">Route start</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: routeColor(legendRoutes[0]?.route_id ?? "") }}
                >
                  E
                </span>
                <span className="text-muted-foreground">Route end (route color)</span>
              </span>
            </div>
          )}
        </div>
      )}

      {showLegend && showEndpoints && (!usePerRouteColors || legendRoutes.length <= 1) && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-[1000] flex flex-col gap-1 rounded-xl border border-border/50 bg-card/92 px-2.5 py-2 text-[10.5px] backdrop-blur-md">
          <span className="inline-flex items-center gap-2">
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
              style={{ background: START_MARKER_COLOR }}
            >
              S
            </span>
            <span className="text-muted-foreground">Start</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
              style={{ background: accentColor ?? "#f97316" }}
            >
              E
            </span>
            <span className="text-muted-foreground">End</span>
          </span>
        </div>
      )}
    </div>
  );
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: undefined,
  iconUrl: undefined,
  shadowUrl: undefined,
});
