import { ArrowRight, MapPin, Plus, TrendingDown } from "lucide-react";
import type { RouteContext, SegmentRisk } from "@/lib/fleet-data";
import { COMPARE_ACCENT, type HotspotKind } from "@/lib/geo-data";
import {
  compareWinner,
  computeRouteStats,
  routeEndpointLabels,
  type CompareWinner,
} from "@/lib/route-metrics";
import { FleetMapLoader } from "./FleetMapLoader";

const MAP_HEIGHT = 400;
const fmt = (n: number, d = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

function ComparePlaceholder({ slot }: { slot: "A" | "B" }) {
  const accent = COMPARE_ACCENT[slot];
  return (
    <div className="compare-route-column flex flex-col overflow-hidden rounded-2xl border border-dashed border-border/60 bg-muted/10">
      <div
        className="flex flex-1 flex-col items-center justify-center px-6 text-center"
        style={{ minHeight: MAP_HEIGHT + 200 }}
      >
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ring-1"
          style={{
            background: `color-mix(in oklab, ${accent.color} 15%, transparent)`,
            color: accent.color,
            borderColor: `color-mix(in oklab, ${accent.color} 35%, transparent)`,
          }}
        >
          <Plus className="h-5 w-5" />
        </div>
        <p className="text-[14px] font-semibold">Select {accent.label}</p>
        <p className="mt-1 max-w-[240px] text-[12px] text-muted-foreground">
          Pick a second route below to compare full corridors, DMS footprints, and metrics side-by-side.
        </p>
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  unit,
  tone = "default",
  delta,
  deltaTone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "default" | "good" | "bad";
  delta?: string;
  deltaTone?: "default" | "good" | "bad";
}) {
  const toneClass =
    tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-foreground";
  const deltaClass =
    deltaTone === "good"
      ? "text-success"
      : deltaTone === "bad"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`num text-[15px] font-semibold ${toneClass}`}>{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      {delta && <div className={`num mt-0.5 text-[10px] font-medium ${deltaClass}`}>{delta}</div>}
    </div>
  );
}

/**
 * Percent difference of `value` relative to `peer` (lower DMS is better, so a
 * negative delta is "good"). Returns null when there's no peer to compare to.
 */
function dmsDelta(
  value: number,
  peer: number | undefined,
  peerCode: string | undefined,
): { text: string; tone: "good" | "bad" | "default" } | undefined {
  if (peer == null || peer <= 0) return undefined;
  const pct = ((value - peer) / peer) * 100;
  if (Math.abs(pct) < 0.5) return { text: `even vs ${peerCode ?? "peer"}`, tone: "default" };
  const sign = pct > 0 ? "+" : "−";
  return {
    text: `${sign}${fmt(Math.abs(pct), 0)}% vs ${peerCode ?? "peer"}`,
    tone: pct > 0 ? "bad" : "good",
  };
}

function RouteMetricsBlock({
  route,
  segments,
  slot,
  peer,
}: {
  route: RouteContext;
  segments: SegmentRisk[];
  slot: "A" | "B";
  peer?: RouteContext;
}) {
  const accent = COMPARE_ACCENT[slot];
  const stats = computeRouteStats(route, segments);
  const peerStats = peer ? computeRouteStats(peer, segments) : null;

  const winnerTone = (
    metric: keyof Pick<RouteContext, "difficulty_score" | "efficiency_kwh_per_km" | "congestion_score" | "peak_dms_index" | "avg_speed_kmh">,
    lowerIsBetter: boolean,
  ): "default" | "good" | "bad" => {
    if (!peer) return "default";
    const w = compareWinner(route[metric], peer[metric], lowerIsBetter);
    if (w === "tie") return "default";
    const won = (w === "a" && slot === "A") || (w === "b" && slot === "B");
    return won ? "good" : "bad";
  };

  return (
    <div className="border-t border-border/50 bg-card/80 p-4">
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCell
          label="Difficulty"
          value={fmt(route.difficulty_score)}
          unit="/ 100"
          tone={winnerTone("difficulty_score", true)}
        />
        <MetricCell
          label="Efficiency"
          value={fmt(route.efficiency_kwh_per_km, 2)}
          unit="kWh/km"
          tone={winnerTone("efficiency_kwh_per_km", true)}
        />
        <MetricCell
          label="DMS / 100km"
          value={fmt(route.peak_dms_index, 1)}
          tone={winnerTone("peak_dms_index", true)}
          delta={dmsDelta(route.peak_dms_index, peer?.peak_dms_index, peer?.route_code)?.text}
          deltaTone={dmsDelta(route.peak_dms_index, peer?.peak_dms_index, peer?.route_code)?.tone}
        />
        <MetricCell
          label="High-risk segs"
          value={String(stats.highRiskSegments)}
          tone={
            peerStats
              ? compareWinner(stats.highRiskSegments, peerStats.highRiskSegments, true) === "tie"
                ? "default"
                : (compareWinner(stats.highRiskSegments, peerStats.highRiskSegments, true) === "a") ===
                    (slot === "A")
                  ? "good"
                  : "bad"
              : "default"
          }
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
          <span className="text-muted-foreground">Congestion</span>
          <span className="num font-medium">{fmt(route.congestion_score)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
          <span className="text-muted-foreground">Peak DMS</span>
          <span className="num font-medium">{fmt(route.peak_dms_index)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
          <span className="text-muted-foreground">Leakage</span>
          <span className="num font-medium">{fmt(route.energy_leakage_kwh, 0)} kWh</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        {stats.harshBraking > 0 && (
          <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-destructive">
            {stats.harshBraking} harsh brake
          </span>
        )}
        {stats.overspeed > 0 && (
          <span className="rounded-md bg-warning/10 px-2 py-0.5 text-warning">
            {stats.overspeed} overspeed
          </span>
        )}
        {stats.distraction > 0 && (
          <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-purple-400">
            {stats.distraction} distraction
          </span>
        )}
        {stats.drowsiness > 0 && (
          <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-blue-400">
            {stats.drowsiness} drowsiness
          </span>
        )}
      </div>
      <div
        className="mt-2 text-[10px] font-medium"
        style={{ color: accent.color }}
      >
        {route.stop_count ? `${route.stop_count} stages` : `${stats.segmentCount} segments`} · {fmt(stats.pathKm, 1)} km corridor
      </div>
    </div>
  );
}

function CompareRouteColumn({
  route,
  slot,
  segments,
  kinds,
  mapFitTrigger,
  peer,
}: {
  route: RouteContext;
  slot: "A" | "B";
  segments: SegmentRisk[];
  kinds: HotspotKind[];
  mapFitTrigger: string;
  peer?: RouteContext;
}) {
  const accent = COMPARE_ACCENT[slot];
  const { start, end } = routeEndpointLabels(route);
  const stats = computeRouteStats(route, segments);

  return (
    <div
      className="compare-route-column compare-map-panel flex flex-col overflow-hidden rounded-2xl ring-1"
      style={{
        borderColor: `color-mix(in oklab, ${accent.color} 35%, var(--border))`,
      }}
    >
      <div
        className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 px-4 py-3"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklab, ${accent.color} 8%, var(--card)), var(--card))`,
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background"
              style={{ background: accent.color }}
            >
              {slot}
            </span>
            <span className="num text-[13px] font-semibold">{route.route_code}</span>
          </div>
          <div className="mt-1 text-[12px] font-medium text-foreground">{route.route_name}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-1.5 py-0.5 text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {start}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5"
              style={{
                background: `color-mix(in oklab, ${accent.color} 15%, transparent)`,
                color: accent.color,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent.color }} />
              {end}
            </span>
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <div className="num text-[18px] font-semibold text-foreground">{fmt(route.difficulty_score)}</div>
          <div>difficulty / 100</div>
        </div>
      </div>

      <FleetMapLoader
        routes={[route]}
        segments={segments}
        focusRouteId={route.route_id}
        activeKinds={kinds}
        height={MAP_HEIGHT}
        showLegend
        showFleetBadge={false}
        fitFocusRoute
        soloRoute
        showEndpoints
        dmsMode="full"
        accentColor={accent.color}
        panelTitle={`${start} → ${end}`}
        panelSubtitle={route.stop_count ? `${route.stop_count} stages · real geometry` : `${stats.dmsTotal} DMS footprints · full corridor`}
        fitTrigger={`${mapFitTrigger}|${route.route_id}|${slot}`}
      />

      <RouteMetricsBlock route={route} segments={segments} slot={slot} peer={peer} />
    </div>
  );
}

type CompareRow = {
  label: string;
  a: string;
  b: string;
  winner: CompareWinner;
  lowerIsBetter: boolean;
  /** Optional % gap between A and B, rendered next to the edge winner. */
  gap?: string;
};

/** Percent gap between two values relative to the smaller one. */
function pctGap(a: number, b: number): string | undefined {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (lo <= 0) return undefined;
  const pct = ((hi - lo) / lo) * 100;
  if (pct < 0.5) return undefined;
  return `−${fmt(pct, 0)}%`;
}

function HeadToHeadBar({
  routeA,
  routeB,
  segments,
}: {
  routeA: RouteContext;
  routeB: RouteContext;
  segments: SegmentRisk[];
}) {
  const statsA = computeRouteStats(routeA, segments);
  const statsB = computeRouteStats(routeB, segments);

  const rows: CompareRow[] = [
    {
      label: "Difficulty",
      a: fmt(routeA.difficulty_score),
      b: fmt(routeB.difficulty_score),
      winner: compareWinner(routeA.difficulty_score, routeB.difficulty_score, true),
      lowerIsBetter: true,
    },
    {
      label: "Efficiency",
      a: `${fmt(routeA.efficiency_kwh_per_km, 2)} kWh/km`,
      b: `${fmt(routeB.efficiency_kwh_per_km, 2)} kWh/km`,
      winner: compareWinner(routeA.efficiency_kwh_per_km, routeB.efficiency_kwh_per_km, true),
      lowerIsBetter: true,
    },
    {
      label: "DMS / 100km",
      a: fmt(routeA.peak_dms_index, 1),
      b: fmt(routeB.peak_dms_index, 1),
      winner: compareWinner(routeA.peak_dms_index, routeB.peak_dms_index, true),
      lowerIsBetter: true,
      gap: pctGap(routeA.peak_dms_index, routeB.peak_dms_index),
    },
    {
      label: "High-risk segments",
      a: String(statsA.highRiskSegments),
      b: String(statsB.highRiskSegments),
      winner: compareWinner(statsA.highRiskSegments, statsB.highRiskSegments, true),
      lowerIsBetter: true,
    },
    {
      label: "Congestion",
      a: fmt(routeA.congestion_score),
      b: fmt(routeB.congestion_score),
      winner: compareWinner(routeA.congestion_score, routeB.congestion_score, true),
      lowerIsBetter: true,
    },
    {
      label: "Avg speed",
      a: `${fmt(routeA.avg_speed_kmh)} km/h`,
      b: `${fmt(routeB.avg_speed_kmh)} km/h`,
      winner: compareWinner(routeA.avg_speed_kmh, routeB.avg_speed_kmh, false),
      lowerIsBetter: false,
    },
  ];

  if (routeA.stop_count != null && routeB.stop_count != null) {
    rows.push({
      label: "Stages",
      a: String(routeA.stop_count),
      b: String(routeB.stop_count),
      winner: compareWinner(routeA.stop_count, routeB.stop_count, true),
      lowerIsBetter: true,
    });
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-elevated">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight">Head-to-head metrics</h3>
          <p className="text-[11.5px] text-muted-foreground">
            {routeA.route_code} vs {routeB.route_code} — lower difficulty & DMS is better
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-[12px]">
          <thead>
            <tr className="border-b border-border/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Metric</th>
              <th className="pb-2 pr-4 font-medium" style={{ color: COMPARE_ACCENT.A.color }}>
                {routeA.route_code}
              </th>
              <th className="pb-2 pr-4 font-medium" style={{ color: COMPARE_ACCENT.B.color }}>
                {routeB.route_code}
              </th>
              <th className="pb-2 font-medium">Edge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border/30 last:border-0">
                <td className="py-2.5 pr-4 text-muted-foreground">{row.label}</td>
                <td
                  className={`num py-2.5 pr-4 font-medium ${
                    row.winner === "a" ? "text-success" : row.winner === "b" ? "text-muted-foreground" : ""
                  }`}
                >
                  {row.a}
                </td>
                <td
                  className={`num py-2.5 pr-4 font-medium ${
                    row.winner === "b" ? "text-success" : row.winner === "a" ? "text-muted-foreground" : ""
                  }`}
                >
                  {row.b}
                </td>
                <td className="py-2.5">
                  {row.winner === "tie" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                      <TrendingDown className="h-3 w-3" />
                      {row.winner === "a" ? routeA.route_code : routeB.route_code}
                      {row.gap && (
                        <span className="num text-[10px] text-muted-foreground">{row.gap}</span>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RouteComparePanel({
  routes,
  segments,
  compareIds,
  kinds,
}: {
  routes: RouteContext[];
  segments: SegmentRisk[];
  compareIds: string[];
  kinds: HotspotKind[];
}) {
  const routeA = routes.find((r) => r.route_id === compareIds[0]);
  const routeB = routes.find((r) => r.route_id === compareIds[1]);
  const mapFitTrigger = `${compareIds.join(",")}|${kinds.join(",")}`;

  if (compareIds.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight">Mumbai fleet map</h2>
            <p className="text-[12.5px] text-muted-foreground">
              Select up to 2 routes below for side-by-side corridor maps with DMS footprints and metrics.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            <MapPin className="h-3 w-3" />
            Mumbai · MMR
          </div>
        </div>
        <FleetMapLoader
          routes={routes}
          segments={segments}
          activeKinds={kinds}
          height={480}
          showFleetBadge
          showEndpoints
          dmsMode="summary"
          fitTrigger={`${mapFitTrigger}|overview`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight">Route comparison · full corridor</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Each panel shows the complete route start-to-end with segment overlays and DMS event footprints.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1"
            style={{
              color: COMPARE_ACCENT.A.color,
              background: `color-mix(in oklab, ${COMPARE_ACCENT.A.color} 12%, transparent)`,
              borderColor: `color-mix(in oklab, ${COMPARE_ACCENT.A.color} 30%, transparent)`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: COMPARE_ACCENT.A.color }} />
            {routeA?.route_code ?? "Route A"}
          </span>
          <span className="text-muted-foreground">vs</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1"
            style={{
              color: COMPARE_ACCENT.B.color,
              background: `color-mix(in oklab, ${COMPARE_ACCENT.B.color} 12%, transparent)`,
              borderColor: `color-mix(in oklab, ${COMPARE_ACCENT.B.color} 30%, transparent)`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: COMPARE_ACCENT.B.color }} />
            {routeB?.route_code ?? "Route B"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {routeA ? (
          <CompareRouteColumn
            route={routeA}
            slot="A"
            segments={segments}
            kinds={kinds}
            mapFitTrigger={mapFitTrigger}
            peer={routeB}
          />
        ) : (
          <ComparePlaceholder slot="A" />
        )}
        {routeB ? (
          <CompareRouteColumn
            route={routeB}
            slot="B"
            segments={segments}
            kinds={kinds}
            mapFitTrigger={mapFitTrigger}
            peer={routeA}
          />
        ) : (
          <ComparePlaceholder slot="B" />
        )}
      </div>

      {routeA && routeB && (
        <HeadToHeadBar routeA={routeA} routeB={routeB} segments={segments} />
      )}
    </div>
  );
}
