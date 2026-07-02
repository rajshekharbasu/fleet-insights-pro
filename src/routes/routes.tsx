import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Brain,
  Flame,
  Loader2,
  MapPin,
  Mountain,
  Snowflake,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "@/components/layout/AppNav";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { RouteComparePanel } from "@/components/maps/RouteComparePanel";
import type { HotspotKind } from "@/lib/geo-data";
import { lngLatToNorm } from "@/lib/geo-data";
import { ROUTES, SEGMENTS, type RouteContext, type RouteStop } from "@/lib/fleet-data";
import { fetchRouteLeaderboard, aggregateRouteLeaderboard, fetchRouteComparison, fetchRouteGeometry, fetchRouteGeojson, routeDifficultyLabel, type RouteLeaderboardRow, type RouteComparisonRow, type RouteGeometryRow, type RouteGeojsonRow } from "@/lib/graphql/routes";
import { fetchFilterOptions } from "@/lib/graphql/filter-options";
import { DEFAULT_FILTERS, type Filters } from "@/lib/analytics";
import { CHART_ENTER } from "@/lib/chart-motion";

const LIVE_ROUTE_ANCHORS = [
  { x: 0.14, y: 0.84 }, { x: 0.26, y: 0.7 }, { x: 0.4, y: 0.55 }, { x: 0.55, y: 0.4 },
  { x: 0.72, y: 0.52 }, { x: 0.86, y: 0.68 }, { x: 0.74, y: 0.82 }, { x: 0.52, y: 0.88 },
  { x: 0.32, y: 0.38 }, { x: 0.18, y: 0.52 },
];

const clampUnit = (v: number) => Math.max(0.06, Math.min(0.94, v));

/** Deterministic, representative SVG corridor for a live route (mart carries no geometry). */
function liveRoutePath(seed: number) {
  let s = (Math.abs(seed) * 2654435761) % 2147483647 || 1;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const anchor = LIVE_ROUTE_ANCHORS[Math.abs(seed) % LIVE_ROUTE_ANCHORS.length];
  let x = clampUnit(anchor.x + (rand() - 0.5) * 0.05);
  let y = clampUnit(anchor.y + (rand() - 0.5) * 0.05);
  const pts = [{ x, y }];
  const segs = 8 + Math.floor(rand() * 8);
  for (let i = 0; i < segs; i++) {
    const step = 0.03 + rand() * 0.02;
    const angle = rand() * Math.PI * 2;
    x = clampUnit(x + Math.cos(angle) * step);
    y = clampUnit(y + Math.sin(angle) * step * 0.75);
    pts.push({ x, y });
  }
  return pts;
}

const EARTH_R_KM = 6371;
function haversineKm(a: RouteStop, b: RouteStop) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Orders raw stops into a sensible corridor via nearest-neighbour from the
 * west-most stop (the mart array order is not the travel sequence).
 */
function orderStops(stops: RouteStop[]): RouteStop[] {
  if (stops.length <= 2) return [...stops];
  const remaining = [...stops];
  let startIdx = 0;
  for (let i = 1; i < remaining.length; i++) {
    if (remaining[i].lon < remaining[startIdx].lon) startIdx = i;
  }
  const ordered: RouteStop[] = [remaining.splice(startIdx, 1)[0]];
  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = (remaining[i].lat - last.lat) ** 2 + (remaining[i].lon - last.lon) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    ordered.push(remaining.splice(best, 1)[0]);
  }
  return ordered;
}

/** Bridges a mart_route_comparison row into the RouteContext shape the map panel renders. */
function routeContextFromComparison(row: RouteComparisonRow, geometry?: RouteGeometryRow): RouteContext {
  const orderedStops = geometry?.stops_raw?.length ? orderStops(geometry.stops_raw) : null;

  let path: { x: number; y: number }[];
  let distanceKm: number;

  if (orderedStops && orderedStops.length >= 2) {
    // Real geometry — project actual lat/long into the map's normalized space.
    path = orderedStops.map((s) => lngLatToNorm(s.lon, s.lat));
    distanceKm = 0;
    for (let i = 1; i < orderedStops.length; i++) {
      distanceKm += haversineKm(orderedStops[i - 1], orderedStops[i]);
    }
  } else {
    // Fallback: deterministic representative corridor when geometry is missing.
    path = liveRoutePath(row.route_id);
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    distanceKm = len * 90;
  }

  const stopCount = geometry?.stop_count ?? orderedStops?.length ?? 0;

  return {
    route_id: String(row.route_id),
    route_code: `R-${row.route_code}`,
    route_name: row.route_name.replace(/\s+to\s+/gi, " → "),
    active_trips_30d: row.total_trips,
    avg_distance_km: +distanceKm.toFixed(1),
    avg_speed_kmh: +row.avg_speed_geo.toFixed(1),
    altitude_gain_m: Math.round(row.avg_altitude_gain),
    stop_density_per_km: distanceKm > 0 && stopCount ? +(stopCount / distanceKm).toFixed(2) : 0,
    rough_road_density: 0,
    congestion_score: +row.avg_congestion_score.toFixed(1),
    difficulty_score: +row.peak_difficulty_score.toFixed(1),
    efficiency_kwh_per_km: +row.avg_kwh_per_km.toFixed(3),
    peak_efficiency: +row.p75_kwh_per_km.toFixed(3),
    offpeak_efficiency: +row.p25_kwh_per_km.toFixed(3),
    peak_stop_ratio: 0,
    offpeak_stop_ratio: 0,
    peak_dms_index: +row.avg_dms_per_100km.toFixed(2),
    offpeak_dms_index: +row.avg_dms_per_100km.toFixed(2),
    energy_leakage_kwh: +row.energy_leakage_kwh_30d.toFixed(1),
    path,
    stops: orderedStops ?? undefined,
    stop_count: stopCount || undefined,
  };
}

/**
 * Builds the RouteContext the map renders from a real road polyline
 * (route_geometry_fact.route_geojson). The polyline is the source of truth for
 * the drawn line; richer metrics are merged from mart_route_comparison when a
 * matching row exists, otherwise we fall back to the geojson row's own metrics.
 */
function routeContextFromGeojson(
  g: RouteGeojsonRow,
  comparison?: RouteComparisonRow,
  geometry?: RouteGeometryRow,
): RouteContext {
  const path = g.coordinates.map(([lng, lat]) => lngLatToNorm(lng, lat));

  // Corridor length straight from the polyline (haversine over consecutive pts).
  let distanceKm = 0;
  for (let i = 1; i < g.coordinates.length; i++) {
    const [lng1, lat1] = g.coordinates[i - 1];
    const [lng2, lat2] = g.coordinates[i];
    distanceKm += haversineKm({ lat: lat1, lon: lng1 } as RouteStop, { lat: lat2, lon: lng2 } as RouteStop);
  }

  const orderedStops = geometry?.stops_raw?.length ? orderStops(geometry.stops_raw) : null;
  const stopCount = geometry?.stop_count ?? orderedStops?.length ?? 0;

  return {
    route_id: String(g.route_id),
    route_code: `R-${g.route_code}`,
    route_name: g.route_name.replace(/\s+to\s+/gi, " → "),
    active_trips_30d: comparison?.total_trips ?? g.trip_count,
    avg_distance_km: +distanceKm.toFixed(1),
    avg_speed_kmh: comparison ? +comparison.avg_speed_geo.toFixed(1) : 0,
    altitude_gain_m: comparison ? Math.round(comparison.avg_altitude_gain) : 0,
    stop_density_per_km: distanceKm > 0 && stopCount ? +(stopCount / distanceKm).toFixed(2) : 0,
    rough_road_density: 0,
    congestion_score: comparison ? +comparison.avg_congestion_score.toFixed(1) : 0,
    difficulty_score: +(comparison?.peak_difficulty_score ?? g.difficulty_score).toFixed(1),
    efficiency_kwh_per_km: +(comparison?.avg_kwh_per_km ?? g.efficiency_kwh_per_km).toFixed(3),
    peak_efficiency: comparison ? +comparison.p75_kwh_per_km.toFixed(3) : +g.efficiency_kwh_per_km.toFixed(3),
    offpeak_efficiency: comparison ? +comparison.p25_kwh_per_km.toFixed(3) : +g.efficiency_kwh_per_km.toFixed(3),
    peak_stop_ratio: 0,
    offpeak_stop_ratio: 0,
    peak_dms_index: +(comparison?.avg_dms_per_100km ?? g.avg_dms_per_100km).toFixed(2),
    offpeak_dms_index: +(comparison?.avg_dms_per_100km ?? g.avg_dms_per_100km).toFixed(2),
    energy_leakage_kwh: comparison ? +comparison.energy_leakage_kwh_30d.toFixed(1) : 0,
    path,
    stops: orderedStops ?? undefined,
    stop_count: stopCount || undefined,
  };
}

export const Route = createFileRoute("/routes")({
  head: () => ({
    meta: [
      { title: "Route Intelligence · Voltline" },
      { name: "description", content: "Operational route intelligence, difficulty and energy complexity for EV fleets." },
      { property: "og:title", content: "Route Intelligence · Voltline" },
      { property: "og:description", content: "Compare, rank and explore route efficiency, congestion and DMS exposure." },
    ],
  }),
  component: RouteIntelligencePage,
});

const fmt = (n: number, d = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

function LoadingPanel({
  label,
  className = "h-[400px] rounded-2xl border border-border/60 bg-muted/15",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2.5 text-muted-foreground ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-[12.5px]">{label}</span>
    </div>
  );
}

function MiniStatSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
      <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
      <div className="mt-3 h-8 w-24 animate-pulse rounded bg-muted/40" />
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-muted/30" />
    </div>
  );
}

function MiniStat({ label, value, unit, hint, name, tone = "default" }: {
  label: string; value: string; unit?: string; hint?: string; name?: string;
  tone?: "default" | "warning" | "success" | "destructive";
}) {
  const toneClass =
    tone === "warning" ? "text-warning"
      : tone === "success" ? "text-success"
      : tone === "destructive" ? "text-destructive"
      : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`num text-[26px] font-semibold tracking-tight ${toneClass}`}>{value}</span>
        {unit && <span className="text-[12px] font-medium text-muted-foreground">{unit}</span>}
      </div>
      {name && <div className="mt-1 line-clamp-1 text-[11.5px] font-medium text-foreground" title={name}>{name}</div>}
      {hint && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function DifficultyBar({ value }: { value: number }) {
  const tone = value > 75 ? "var(--color-destructive)" : value > 55 ? "var(--color-warning)" : "var(--color-primary)";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, value)}%`, background: `linear-gradient(90deg, ${tone}, color-mix(in oklab, ${tone} 50%, transparent))` }}
      />
    </div>
  );
}

function LeaderboardRouteCard({
  r,
  slot,
  onSelect,
}: {
  r: RouteLeaderboardRow;
  slot: "A" | "B" | null;
  onSelect: () => void;
}) {
  const slotColor = slot === "A" ? "#2dd4bf" : slot === "B" ? "#c084fc" : undefined;
  const contextLabel = routeDifficultyLabel(r.peak_difficulty_score);
  const contextTone =
    contextLabel === "hard"
      ? "text-destructive"
      : contextLabel === "medium"
        ? "text-warning"
        : "text-success";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl border bg-card p-4 text-left shadow-elevated transition-all hover:-translate-y-0.5 ${
        slot
          ? "border-primary/50 ring-2"
          : "border-border/60 hover:border-primary/40"
      }`}
      style={
        slot && slotColor
          ? { boxShadow: `0 0 0 1px color-mix(in oklab, ${slotColor} 40%, transparent), 0 12px 32px -12px color-mix(in oklab, ${slotColor} 25%, transparent)` }
          : undefined
      }
    >
      {slot && (
        <div
          className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background"
          style={{ background: slotColor }}
        >
          {slot}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="num text-[12px] font-medium text-primary">R-{r.route_code}</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[12px] text-muted-foreground">{r.trip_count.toLocaleString()} trips</span>
            <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] num text-muted-foreground">
              #{r.difficulty_rank}
            </span>
          </div>
          <div className="mt-0.5 line-clamp-2 text-[13.5px] font-semibold tracking-tight">{r.route_name}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {r.company_name} · {r.dominant_vehicle_size}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="num text-[22px] font-semibold tracking-tight">{fmt(r.peak_difficulty_score)}</span>
        <span className="text-[11px] text-muted-foreground">/ 100</span>
        <span className={`ml-1 text-[11px] font-medium capitalize ${contextTone}`}>{contextLabel}</span>
        <span className={`ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] num ${
          r.peak_delta_pct > 5 ? "bg-destructive/10 text-destructive" : "bg-muted/40 text-muted-foreground"
        }`}>
          <TrendingUp className="h-3 w-3" />
          {fmt(r.peak_delta_pct)}% peak
        </span>
      </div>
      <div className="mt-2"><DifficultyBar value={r.peak_difficulty_score} /></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <div><div className="text-[10px] uppercase tracking-wider">kWh/km</div><div className="num text-foreground">{fmt(r.avg_kwh_per_km, 2)}</div></div>
        <div><div className="text-[10px] uppercase tracking-wider">DMS /100km</div><div className="num text-foreground">{fmt(r.avg_dms_per_100km, 1)}</div></div>
        <div><div className="text-[10px] uppercase tracking-wider">Stops/km</div><div className="num text-foreground">{fmt(r.avg_stops_per_km, 3)}</div></div>
        <div><div className="text-[10px] uppercase tracking-wider">Congestion</div><div className="num text-foreground">{fmt(r.avg_congestion_score, 0)}</div></div>
      </div>
    </button>
  );
}

function RouteCard({
  r,
  slot,
  onSelect,
}: {
  r: typeof ROUTES[number];
  slot: "A" | "B" | null;
  onSelect: () => void;
}) {
  const peakDelta = ((r.peak_efficiency - r.offpeak_efficiency) / r.offpeak_efficiency) * 100;
  const slotColor = slot === "A" ? "#2dd4bf" : slot === "B" ? "#c084fc" : undefined;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl border bg-card p-4 text-left shadow-elevated transition-all hover:-translate-y-0.5 ${
        slot
          ? "border-primary/50 ring-2"
          : "border-border/60 hover:border-primary/40"
      }`}
      style={
        slot && slotColor
          ? { boxShadow: `0 0 0 1px color-mix(in oklab, ${slotColor} 40%, transparent), 0 12px 32px -12px color-mix(in oklab, ${slotColor} 25%, transparent)` }
          : undefined
      }
    >
      {slot && (
        <div
          className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background"
          style={{ background: slotColor }}
        >
          {slot}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="num text-[12px] font-medium text-primary">{r.route_code}</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[12px] text-muted-foreground">{r.active_trips_30d} trips · 30d</span>
          </div>
          <div className="mt-0.5 text-[13.5px] font-semibold tracking-tight">{r.route_name}</div>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="num text-[22px] font-semibold tracking-tight">{fmt(r.difficulty_score)}</span>
        <span className="text-[11px] text-muted-foreground">/ 100</span>
        <span className={`ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] num ${
          peakDelta > 8 ? "bg-destructive/10 text-destructive" : "bg-muted/40 text-muted-foreground"
        }`}>
          <TrendingUp className="h-3 w-3" />
          {fmt(peakDelta)}% peak
        </span>
      </div>
      <div className="mt-2"><DifficultyBar value={r.difficulty_score} /></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
        <div><div className="text-[10px] uppercase tracking-wider">kWh/km</div><div className="num text-foreground">{fmt(r.efficiency_kwh_per_km, 2)}</div></div>
        <div><div className="text-[10px] uppercase tracking-wider">Stops/km</div><div className="num text-foreground">{fmt(r.stop_density_per_km, 2)}</div></div>
        <div><div className="text-[10px] uppercase tracking-wider">Rough</div><div className="num text-foreground">{fmt(r.rough_road_density * 100, 0)}%</div></div>
      </div>
    </button>
  );
}

function RouteIntelligencePage() {
  const [kinds] = useState<HotspotKind[]>(["risk"]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const { data: filterOptions } = useQuery({
    queryKey: ["filter_options"],
    queryFn: fetchFilterOptions,
  });

  const { data: leaderboardRows, isLoading: leaderboardLoading, error: leaderboardError } = useQuery({
    queryKey: ["mart_route_leaderboard"],
    queryFn: () => fetchRouteLeaderboard(50),
  });

  const { data: comparisonRows } = useQuery({
    queryKey: ["mart_route_comparison"],
    queryFn: () => fetchRouteComparison(300),
  });

  const { data: geometryRows } = useQuery({
    queryKey: ["mart_route_geometry"],
    queryFn: () => fetchRouteGeometry(500),
  });

  const { data: geojsonRows, isLoading: geojsonLoading } = useQuery({
    queryKey: ["route_geometry_fact"],
    queryFn: () => fetchRouteGeojson(500),
  });

  // Leaderboard is a pre-aggregated snapshot, so Company/Route filtering is
  // applied client-side over the returned rows (date-range/driver/vehicle don't
  // map to this table).
  const search = (filters.search ?? "").trim().toLowerCase();

  const sortedLeaderboard = useMemo(() => {
    const rows = leaderboardRows ?? [];
    return rows.filter((r) => {
      if (filters.companies.length && !filters.companies.includes(r.company_name)) return false;
      if (filters.routes.length && !filters.routes.includes(r.route_code)) return false;
      if (
        search &&
        !`${r.route_name} ${r.route_code} ${r.company_name}`.toLowerCase().includes(search)
      )
        return false;
      return true;
    });
  }, [leaderboardRows, filters.companies, filters.routes, search]);

  const leaderboardAgg = useMemo(
    () => aggregateRouteLeaderboard(sortedLeaderboard),
    [sortedLeaderboard],
  );

  // One comparison row per route — keep the dominant vehicle size (most trips).
  const comparisonByRouteId = useMemo(() => {
    const map = new Map<number, RouteComparisonRow>();
    for (const r of comparisonRows ?? []) {
      const existing = map.get(r.route_id);
      if (!existing || r.total_trips > existing.total_trips) map.set(r.route_id, r);
    }
    return map;
  }, [comparisonRows]);

  const geometryByRouteId = useMemo(() => {
    const map = new Map<number, RouteGeometryRow>();
    for (const g of geometryRows ?? []) map.set(g.route_id, g);
    return map;
  }, [geometryRows]);

  const sortedMock = useMemo(
    () =>
      [...ROUTES]
        .filter(
          (r) =>
            !search || `${r.route_name} ${r.route_code}`.toLowerCase().includes(search),
        )
        .sort((a, b) => b.difficulty_score - a.difficulty_score),
    [search],
  );
  const leaderboardReady = !leaderboardLoading;
  const useGraphQlLeaderboard = leaderboardReady && sortedLeaderboard.length > 0;
  const useMockFallback = leaderboardReady && !useGraphQlLeaderboard;
  const isPageLoading = leaderboardLoading || geojsonLoading;

  const hardest = useGraphQlLeaderboard ? leaderboardAgg.hardest! : sortedMock[0];
  const easiest = useGraphQlLeaderboard ? leaderboardAgg.easiest! : sortedMock[sortedMock.length - 1];

  const avgEff = useGraphQlLeaderboard
    ? leaderboardAgg.avgKwhPerKm
    : sortedMock.reduce((s, r) => s + r.efficiency_kwh_per_km, 0) / sortedMock.length;
  const avgCong = useGraphQlLeaderboard
    ? leaderboardAgg.avgCongestion
    : sortedMock.reduce((s, r) => s + r.congestion_score, 0) / sortedMock.length;
  const avgDiff = useGraphQlLeaderboard
    ? leaderboardAgg.avgDifficulty
    : sortedMock.reduce((s, r) => s + r.difficulty_score, 0) / sortedMock.length;

  function resolveCompareId(routeCode: string) {
    const mock = ROUTES.find((r) => r.route_code === routeCode || r.route_code === `R-${routeCode}`);
    return mock?.route_id ?? routeCode;
  }

  function selectRoute(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length === 0) return [id];
      if (prev.length === 1) return [prev[0], id];
      return [prev[1], id];
    });
  }

  function compareKeyForLeaderboard(row: RouteLeaderboardRow) {
    return useGraphQlLeaderboard ? String(row.route_id) : resolveCompareId(row.route_code);
  }

  function selectLeaderboardRoute(row: RouteLeaderboardRow) {
    selectRoute(compareKeyForLeaderboard(row));
  }

  function slotFor(id: string): "A" | "B" | null {
    if (compareIds[0] === id) return "A";
    if (compareIds[1] === id) return "B";
    return null;
  }

  const compareRoutes = ROUTES.filter((r) => compareIds.includes(r.route_id));
  const compareData = ["Efficiency", "AvgSpeed", "StopRatio", "DMS", "Altitude", "Leakage"].map((dim) => {
    const row: Record<string, string | number> = { dim };
    for (const r of compareRoutes) {
      const v =
        dim === "Efficiency" ? r.efficiency_kwh_per_km * 50
          : dim === "AvgSpeed" ? r.avg_speed_kmh
          : dim === "StopRatio" ? r.peak_stop_ratio * 200
          : dim === "DMS" ? r.peak_dms_index
          : dim === "Altitude" ? r.altitude_gain_m / 8
          : r.energy_leakage_kwh / 12;
      row[r.route_code] = +v.toFixed(1);
    }
    return row;
  });

  const peakOffData = compareRoutes.map((r) => ({
    code: r.route_code,
    peak: +(r.peak_efficiency * 100).toFixed(1),
    offpeak: +(r.offpeak_efficiency * 100).toFixed(1),
  }));

  // Live comparison studio backed by mart_route_comparison.
  const compareComparisonRows = useGraphQlLeaderboard
    ? (compareIds
        .map((id) => comparisonByRouteId.get(Number(id)))
        .filter(Boolean) as RouteComparisonRow[])
    : [];

  const martCompareData = ["Efficiency", "Speed", "Congestion", "DMS", "Altitude", "Leakage"].map((dim) => {
    const row: Record<string, string | number> = { dim };
    for (const r of compareComparisonRows) {
      const v =
        dim === "Efficiency" ? r.avg_kwh_per_km * 40
          : dim === "Speed" ? r.avg_speed_geo
          : dim === "Congestion" ? r.avg_congestion_score
          : dim === "DMS" ? r.avg_dms_per_100km * 100
          : dim === "Altitude" ? r.avg_altitude_gain
          : r.energy_leakage_kwh_30d / 50;
      row[`R-${r.route_code}`] = +v.toFixed(1);
    }
    return row;
  });

  const martDistData = compareComparisonRows.map((r) => ({
    code: `R-${r.route_code}`,
    p25: +r.p25_kwh_per_km.toFixed(2),
    median: +r.median_kwh_per_km.toFixed(2),
    p75: +r.p75_kwh_per_km.toFixed(2),
  }));

  const showMartCompare = useGraphQlLeaderboard && compareComparisonRows.length >= 2;

  // Build RouteContexts for the map panel from live mart rows + real geometry; merge with mock for the overview map.
  const liveCompareRoutes = useMemo(
    () => compareComparisonRows.map((r) => routeContextFromComparison(r, geometryByRouteId.get(r.route_id))),
    [compareComparisonRows, geometryByRouteId],
  );

  // Real road polylines (route_geometry_fact). These power the map layer:
  // by default every route is plotted; the Company/Route filter narrows it.
  const geoRoutes = useMemo(() => {
    const rows = geojsonRows ?? [];
    return rows
      .filter((g) => {
        if (filters.companies.length && !filters.companies.includes(g.company_name)) return false;
        if (filters.routes.length && !filters.routes.includes(g.route_code)) return false;
        if (
          search &&
          !`${g.route_name} ${g.route_code} ${g.company_name}`.toLowerCase().includes(search)
        )
          return false;
        return true;
      })
      .map((g) =>
        routeContextFromGeojson(
          g,
          comparisonByRouteId.get(g.route_id),
          geometryByRouteId.get(g.route_id),
        ),
      );
  }, [geojsonRows, filters.companies, filters.routes, search, comparisonByRouteId, geometryByRouteId]);

  const hasGeoRoutes = (geojsonRows?.length ?? 0) > 0;

  // Prefer real geometry; fall back to the previous mock/comparison blend until
  // route_geometry_fact has loaded.
  const panelRoutes = hasGeoRoutes
    ? geoRoutes
    : useGraphQlLeaderboard
      ? [...ROUTES, ...liveCompareRoutes]
      : ROUTES;

  return (
    <PageShell
      eyebrow="Live · Mumbai MMR"
      title="Route Intelligence"
      description="Compare two routes side-by-side — full corridor maps with DMS footprints, start-to-end, and head-to-head metrics."
      meta={
        <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-right">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Mumbai · MMR</div>
          <div className="mt-0.5 flex items-center justify-end gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-[14px] font-semibold tracking-tight">
              {isPageLoading ? "…" : hasGeoRoutes ? geoRoutes.length : useMockFallback ? ROUTES.length : 0} routes
            </span>
          </div>
          <div className="text-[11px] num text-muted-foreground">
            {compareIds.length}/2 selected for compare
          </div>
        </div>
      }
    >
      <FilterBar
        filters={filters}
        onChange={setFilters}
        options={filterOptions}
        show={{ date: false, company: true, route: true, driver: false, vehicle: false, search: true }}
      />

      {/* Map comparison — primary interaction */}
      <section className="space-y-3">
        {isPageLoading ? (
          <LoadingPanel label="Loading route map…" />
        ) : (
          <RouteComparePanel
            routes={panelRoutes}
            segments={hasGeoRoutes ? [] : useMockFallback ? SEGMENTS : []}
            compareIds={compareIds}
            kinds={kinds}
          />
        )}
      </section>

      <section className="space-y-4">
        {isPageLoading ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <MiniStatSkeleton key={`stat-skel-${i}`} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <MiniStatSkeleton key={`stat-skel-ext-${i}`} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              <MiniStat
                label="Active routes"
                value={String(useGraphQlLeaderboard ? leaderboardAgg.routeCount : ROUTES.length)}
                hint={useGraphQlLeaderboard ? "Live mart" : "Mumbai MMR"}
              />
              <MiniStat
                label="Hardest"
                value={useGraphQlLeaderboard ? `R-${(hardest as RouteLeaderboardRow).route_code}` : (hardest as typeof ROUTES[number]).route_code}
                tone="destructive"
                name={hardest.route_name}
                hint={`${fmt(useGraphQlLeaderboard ? (hardest as RouteLeaderboardRow).peak_difficulty_score : (hardest as typeof ROUTES[number]).difficulty_score)} difficulty`}
              />
              <MiniStat
                label="Easiest"
                value={useGraphQlLeaderboard ? `R-${(easiest as RouteLeaderboardRow).route_code}` : (easiest as typeof ROUTES[number]).route_code}
                tone="success"
                name={easiest.route_name}
                hint={`${fmt(useGraphQlLeaderboard ? (easiest as RouteLeaderboardRow).peak_difficulty_score : (easiest as typeof ROUTES[number]).difficulty_score)} difficulty`}
              />
              <MiniStat label="Avg efficiency" value={fmt(avgEff, 2)} unit="kWh/km" hint="Trip-weighted" />
              <MiniStat label="Avg congestion" value={fmt(avgCong)} unit="/100" hint="Trip-weighted" />
              <MiniStat label="Avg difficulty" value={fmt(avgDiff)} unit="/100" hint="Trip-weighted" />
            </div>

            {useGraphQlLeaderboard && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <MiniStat
                  label="Total trips"
                  value={leaderboardAgg.totalTrips.toLocaleString()}
                  hint="Across ranked routes"
                />
                <MiniStat
                  label="Energy leakage"
                  value={fmt(leaderboardAgg.totalLeakageKwh, 0)}
                  unit="kWh"
                  hint="30-day window"
                  tone="warning"
                />
                <MiniStat
                  label="High-risk routes"
                  value={String(leaderboardAgg.highRiskRoutes)}
                  hint="Difficulty ≥ 40"
                  tone="destructive"
                />
                <MiniStat
                  label="Avg peak delta"
                  value={fmt(leaderboardAgg.avgPeakDeltaPct, 1)}
                  unit="%"
                  hint="Peak vs base kWh/km"
                />
              </div>
            )}
          </>
        )}

        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold tracking-tight">Route difficulty leaderboard</h2>
              {useGraphQlLeaderboard && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-inset ring-success/20">
                  GraphQL
                </span>
              )}
              {leaderboardError && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                  Offline fallback
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              Ranked by peak difficulty score. Click a route to compare on the map.
            </p>
          </div>
          <div className="text-[11px] num text-muted-foreground">
            {compareIds.length}/2 selected
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isPageLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={`lb-skel-${i}`} className="h-44 animate-pulse rounded-2xl border border-border/60 bg-muted/30" />
              ))
            : useGraphQlLeaderboard
              ? sortedLeaderboard.map((r) => (
                  <LeaderboardRouteCard
                    key={`${r.company_id}-${r.route_id}`}
                    r={r}
                    slot={slotFor(compareKeyForLeaderboard(r))}
                    onSelect={() => selectLeaderboardRoute(r)}
                  />
                ))
              : useMockFallback
                ? sortedMock.map((r) => (
                    <RouteCard
                      key={r.route_id}
                      r={r}
                      slot={slotFor(r.route_id)}
                      onSelect={() => selectRoute(r.route_id)}
                    />
                  ))
                : (
                  <div className="col-span-full flex h-40 items-center justify-center rounded-2xl border border-border/60 bg-muted/15 text-[12.5px] text-muted-foreground">
                    No route leaderboard data available.
                  </div>
                )}
        </div>
      </section>

      {showMartCompare ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="chart-enter rounded-2xl border border-border/60 bg-card p-5 shadow-elevated xl:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold tracking-tight">Route comparison studio</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-inset ring-success/20">
                    GraphQL
                  </span>
                </div>
                <p className="text-[12.5px] text-muted-foreground">
                  Fingerprint for {compareComparisonRows.map((r) => `R-${r.route_code}`).join(" vs ")}.
                </p>
              </div>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={martCompareData} outerRadius="78%">
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  {compareComparisonRows.map((r, i) => (
                    <Radar
                      key={r.route_id}
                      name={`R-${r.route_code}`}
                      dataKey={`R-${r.route_code}`}
                      stroke={`var(--color-chart-${(i % 5) + 1})`}
                      fill={`var(--color-chart-${(i % 5) + 1})`}
                      fillOpacity={0.18}
                      {...CHART_ENTER}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-enter rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">Efficiency distribution</h3>
                <p className="text-[12.5px] text-muted-foreground">kWh/km spread — p25, median, p75.</p>
              </div>
              <Flame className="h-4 w-4 text-warning" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={martDistData} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
                  <XAxis dataKey="code" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="p25" name="p25" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} {...CHART_ENTER} />
                  <Bar dataKey="median" name="Median" fill="var(--color-primary)" radius={[4, 4, 0, 0]} {...CHART_ENTER} />
                  <Bar dataKey="p75" name="p75" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} {...CHART_ENTER} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      ) : compareRoutes.length >= 2 ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="chart-enter rounded-2xl border border-border/60 bg-card p-5 shadow-elevated xl:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">Route comparison studio</h3>
                <p className="text-[12.5px] text-muted-foreground">
                  Fingerprint for {compareRoutes.map((r) => r.route_code).join(" vs ")}.
                </p>
              </div>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={compareData} outerRadius="78%">
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                  {compareRoutes.map((r, i) => (
                    <Radar
                      key={r.route_code}
                      name={r.route_code}
                      dataKey={r.route_code}
                      stroke={`var(--color-chart-${(i % 5) + 1})`}
                      fill={`var(--color-chart-${(i % 5) + 1})`}
                      fillOpacity={0.18}
                      {...CHART_ENTER}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-enter rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight">Peak vs off-peak</h3>
                <p className="text-[12.5px] text-muted-foreground">Energy intensity during peak hours.</p>
              </div>
              <Flame className="h-4 w-4 text-warning" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakOffData} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
                  <XAxis dataKey="code" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="offpeak" name="Off-peak" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} {...CHART_ENTER} />
                  <Bar dataKey="peak" name="Peak" fill="var(--color-primary)" radius={[4, 4, 0, 0]} {...CHART_ENTER} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {useGraphQlLeaderboard ? (
          <>
            <InsightCard
              icon={Flame}
              tone="destructive"
              tag={`R-${(hardest as RouteLeaderboardRow).route_code}`}
              title={`R-${(hardest as RouteLeaderboardRow).route_code} peaks ${fmt((hardest as RouteLeaderboardRow).peak_delta_pct)}% above base kWh/km`}
              body={`${(hardest as RouteLeaderboardRow).peak_time_bucket} peak on ${(hardest as RouteLeaderboardRow).route_name} — congestion ${fmt((hardest as RouteLeaderboardRow).avg_congestion_score, 0)}/100.`}
            />
            <InsightCard
              icon={Mountain}
              tone="warning"
              tag={`R-${sortedLeaderboard[1]?.route_code ?? "—"}`}
              title={`${sortedLeaderboard[1]?.route_name ?? "Second-ranked route"} in difficulty exposure`}
              body={`Altitude gain ${fmt(sortedLeaderboard[1]?.avg_altitude_gain ?? 0, 1)}m · DMS ${fmt(sortedLeaderboard[1]?.avg_dms_per_100km ?? 0, 2)}/100km — review descent coaching.`}
            />
            <InsightCard
              icon={Snowflake}
              tone="success"
              tag={`R-${(easiest as RouteLeaderboardRow).route_code}`}
              title={`R-${(easiest as RouteLeaderboardRow).route_code} lowest difficulty at ${fmt((easiest as RouteLeaderboardRow).peak_difficulty_score)} / 100`}
              body={`Efficiency ${fmt((easiest as RouteLeaderboardRow).avg_kwh_per_km, 2)} kWh/km vs fleet median ${fmt((easiest as RouteLeaderboardRow).fleet_median_kwh_per_km, 2)}.`}
            />
            <InsightCard
              icon={Zap}
              tone="primary"
              title="Energy leakage concentrates on top routes"
              body={`${[...sortedLeaderboard].sort((a, b) => b.energy_leakage_kwh_30d - a.energy_leakage_kwh_30d).slice(0, 3).map((r) => `R-${r.route_code}`).join(", ")} account for ${fmt(
                ([...sortedLeaderboard].sort((a, b) => b.energy_leakage_kwh_30d - a.energy_leakage_kwh_30d).slice(0, 3).reduce((s, r) => s + r.energy_leakage_kwh_30d, 0) /
                  sortedLeaderboard.reduce((s, r) => s + Math.max(0, r.energy_leakage_kwh_30d), 0)) * 100,
                0,
              )}% of positive 30d leakage.`}
            />
          </>
        ) : (
          <>
            <InsightCard
              icon={Flame}
              tone="destructive"
              tag={(hardest as typeof ROUTES[number]).route_code}
              title={`${(hardest as typeof ROUTES[number]).route_code} shows ${fmt((((hardest as typeof ROUTES[number]).peak_efficiency - (hardest as typeof ROUTES[number]).offpeak_efficiency) / (hardest as typeof ROUTES[number]).offpeak_efficiency) * 100)}% higher energy loss during peak`}
              body={`Driven by congestion (${fmt((hardest as typeof ROUTES[number]).congestion_score)}/100) on the ${(hardest as typeof ROUTES[number]).route_name} corridor.`}
            />
            <InsightCard
              icon={Mountain}
              tone="warning"
              tag={sortedMock[1].route_code}
              title={`${sortedMock[1].route_code} contributes the most harsh braking density`}
              body={`Altitude gain of ${sortedMock[1].altitude_gain_m}m on Western Express corridors — recommend descent coaching.`}
            />
            <InsightCard
              icon={Snowflake}
              tone="success"
              tag={(easiest as typeof ROUTES[number]).route_code}
              title={`${(easiest as typeof ROUTES[number]).route_code} maintains best-in-class efficiency at ${fmt((easiest as typeof ROUTES[number]).efficiency_kwh_per_km, 2)} kWh/km`}
              body={`Low rough-road density (${fmt((easiest as typeof ROUTES[number]).rough_road_density * 100, 0)}%) — benchmark for new drivers in Mumbai.`}
            />
            <InsightCard
              icon={Zap}
              tone="primary"
              title="Energy leakage concentrates on 3 routes"
              body={`${sortedMock.slice(0, 3).map((r) => r.route_code).join(", ")} account for ${fmt(
                (sortedMock.slice(0, 3).reduce((s, r) => s + r.energy_leakage_kwh, 0) /
                  sortedMock.reduce((s, r) => s + r.energy_leakage_kwh, 0)) * 100,
                0,
              )}% of total estimated leakage.`}
            />
          </>
        )}
        <InsightCard
          icon={Sparkles}
          tag="Coaching"
          title="Difficulty-normalized efficiency is improving"
          body="kWh/km adjusted for difficulty is trending down 2.4% week-over-week across Mumbai routes."
        />
        <InsightCard
          icon={MapPin}
          tone="warning"
          title="DMS clusters near BKC and Andheri interchanges"
          body="Highest-risk segments cluster on R-101, R-309 and R-417 — strong candidate for geofence alerts."
        />
      </section>
    </PageShell>
  );
}
