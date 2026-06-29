import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle, Layers, Sparkles, ShieldAlert, TrendingDown, TrendingUp, X,
} from "lucide-react";
import { PageShell } from "@/components/layout/AppNav";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { SegmentRiskMapLoader } from "@/components/maps/SegmentRiskMapLoader";
import { SEGMENTS, type SegmentRisk } from "@/lib/fleet-data";
import { buildCorrelationMatrix, fetchMartSegmentCorrelation } from "@/lib/graphql/segments";
import { fetchRouteGeojson } from "@/lib/graphql/routes";
import {
  fetchSegmentRiskCompanies,
  fetchSegmentRiskMap,
  fetchSegmentRiskRoutes,
  fetchTopDangerousSegments,
  normalizeRiskLevel,
  RISK_LEVEL_COLOR,
  RISK_LEVEL_ORDER,
  type RouteContextBand,
  type SegmentRiskLevel,
  type SegmentRiskMapFilters,
  type SegmentRiskMapRow,
} from "@/lib/graphql/segment-risk-map";

export const Route = createFileRoute("/segments")({
  head: () => ({
    meta: [
      { title: "Segment Risk · Voltline" },
      { name: "description", content: "Spatial operational risk intelligence per route segment." },
      { property: "og:title", content: "Segment Risk · Voltline" },
      { property: "og:description", content: "Heat layers, dangerous segments, drilldowns and trend analytics." },
    ],
  }),
  component: SegmentRiskPage,
});

const fmt = (n: number, d = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

function computeSegmentCorrelationMatrix(segments: SegmentRisk[]) {
  const fields = ["harsh_braking", "overspeed", "distraction", "drowsiness", "rough_road", "energy_leakage_kwh"] as const;
  const labels = ["Braking", "Overspeed", "Distraction", "Drowsy", "Rough", "Leakage"];
  const matrix = fields.map((a) =>
    fields.map((b) => {
      const xs = segments.map((s) => s[a]);
      const ys = segments.map((s) => s[b]);
      const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
      const my = ys.reduce((s, v) => s + v, 0) / ys.length;
      let num = 0, dx = 0, dy = 0;
      for (let i = 0; i < xs.length; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        dx += (xs[i] - mx) ** 2;
        dy += (ys[i] - my) ** 2;
      }
      const corr = num / Math.sqrt(dx * dy || 1);
      return +corr.toFixed(2);
    }),
  );
  return { labels, matrix };
}

function CorrelationMatrix({
  segments,
  correlationRow,
  isLoading,
}: {
  segments: SegmentRisk[];
  correlationRow?: Awaited<ReturnType<typeof fetchMartSegmentCorrelation>>;
  isLoading?: boolean;
}) {
  const useLiveData = !!correlationRow;
  const { labels, matrix } = useMemo(
    () => (correlationRow ? buildCorrelationMatrix(correlationRow) : computeSegmentCorrelationMatrix(segments)),
    [segments, correlationRow],
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
      <div className="mb-3">
        <h3 className="text-[15px] font-semibold tracking-tight">Risk correlation matrix</h3>
        <p className="text-[12.5px] text-muted-foreground">
          {useLiveData
            ? `Pearson correlation from mart_segment_correlation across ${correlationRow?.route_bucket_count ?? 0} route buckets.`
            : "Pearson correlation between event classes across segments."}
        </p>
        {useLiveData && correlationRow?.note && (
          <p className="mt-1 text-[11px] text-muted-foreground/80">{correlationRow.note}</p>
        )}
      </div>
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-[12.5px] text-muted-foreground">
          Loading correlation data…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th />
                {labels.map((l) => (
                  <th key={l} className="text-[10.5px] font-normal uppercase tracking-wider text-muted-foreground">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={i}>
                  <td className="pr-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">{labels[i]}</td>
                  {row.map((v, j) => {
                    if (v === null) {
                      return (
                        <td
                          key={j}
                          className="h-12 w-12 rounded-lg bg-muted/20 text-center text-[11px] text-muted-foreground"
                          title={`${labels[i]} ↔ ${labels[j]}: no data`}
                        >
                          —
                        </td>
                      );
                    }
                    const t = Math.abs(v);
                    const positive = v >= 0;
                    const bg = positive
                      ? `color-mix(in oklab, var(--color-primary) ${Math.round(t * 75)}%, transparent)`
                      : `color-mix(in oklab, var(--color-destructive) ${Math.round(t * 75)}%, transparent)`;
                    return (
                      <td
                        key={j}
                        className="h-12 w-12 rounded-lg text-center text-[11px] num text-foreground transition-transform hover:scale-105"
                        style={{ background: bg }}
                        title={`${labels[i]} ↔ ${labels[j]}: ${v}`}
                      >
                        {v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const ROUTE_CONTEXTS: { value: RouteContextBand | "all"; label: string }[] = [
  { value: "all", label: "All routes" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

/**
 * Live spatial risk explorer backed by mart_segment_risk_map. Filter controls
 * (risk band, route, route difficulty, min score) are wired straight into the
 * SQL WHERE clause via the keyed react-query.
 */
function LiveSegmentRiskSection() {
  const [company, setCompany] = useState<string>("all");
  const [riskLevels, setRiskLevels] = useState<SegmentRiskLevel[]>([]);
  const [routeContext, setRouteContext] = useState<RouteContextBand | "all">("all");
  const [routeId, setRouteId] = useState<number | "all">("all");
  const [minRiskScore, setMinRiskScore] = useState(0);
  const [showFootprints, setShowFootprints] = useState(false);

  const filters = useMemo<SegmentRiskMapFilters>(
    () => ({
      company: company === "all" ? undefined : company,
      riskLevels: riskLevels.length ? riskLevels : undefined,
      routeContext: routeContext === "all" ? undefined : routeContext,
      routeId: routeId === "all" ? undefined : routeId,
      minRiskScore: minRiskScore > 0 ? minRiskScore : undefined,
      limit: 4000,
    }),
    [company, riskLevels, routeContext, routeId, minRiskScore],
  );

  const { data: companyOptions } = useQuery({
    queryKey: ["mart_segment_risk_map", "companies"],
    queryFn: fetchSegmentRiskCompanies,
    staleTime: 5 * 60_000,
  });

  const { data: routeOptions } = useQuery({
    queryKey: ["mart_segment_risk_map", "routes"],
    queryFn: fetchSegmentRiskRoutes,
    staleTime: 5 * 60_000,
  });

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["mart_segment_risk_map", filters],
    queryFn: () => fetchSegmentRiskMap(filters),
    placeholderData: (prev) => prev,
  });

  // Real road polylines (loaded once); used to underlay the selected route.
  const { data: routeGeojson } = useQuery({
    queryKey: ["route_geojson"],
    queryFn: () => fetchRouteGeojson(),
    staleTime: 5 * 60_000,
  });

  const routePath = useMemo<[number, number][] | undefined>(() => {
    if (routeId === "all") return undefined;
    const match = routeGeojson?.find((r) => r.route_id === routeId);
    return match && match.coordinates.length >= 2 ? match.coordinates : undefined;
  }, [routeGeojson, routeId]);

  const rows = data ?? [];

  const counts = useMemo(() => {
    const c: Record<SegmentRiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const r of rows) c[normalizeRiskLevel(r.risk_level)] += 1;
    return c;
  }, [rows]);

  const toggleRisk = (lvl: SegmentRiskLevel) =>
    setRiskLevels((prev) => (prev.includes(lvl) ? prev.filter((x) => x !== lvl) : [...prev, lvl]));

  return (
    <section>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elevated">
        {/* Card header — title + control strip, attached to the map below */}
        <div className="space-y-3 border-b border-border/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Live segment risk map</h3>
              <p className="text-[12.5px] text-muted-foreground">
                Real lat/lon risk bins from <span className="num">mart_segment_risk_map</span>. Filter by risk band, route and difficulty.
              </p>
            </div>
            <label className="flex cursor-pointer select-none items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-[12px]">
              <input
                type="checkbox"
                checked={showFootprints}
                onChange={(e) => setShowFootprints(e.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--color-primary)]"
              />
              <span className="text-muted-foreground">Show bin footprints</span>
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            {/* Risk band multi-select */}
            <div className="space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Risk band</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {RISK_LEVEL_ORDER.map((lvl) => {
                  const isActive = riskLevels.includes(lvl);
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => toggleRisk(lvl)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium capitalize transition-all ${
                        isActive
                          ? "border-transparent text-foreground"
                          : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                      style={isActive ? { background: `color-mix(in oklab, ${RISK_LEVEL_COLOR[lvl]} 24%, transparent)` } : undefined}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: RISK_LEVEL_COLOR[lvl] }} />
                      {lvl}
                      <span className="num text-muted-foreground">{counts[lvl]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Route difficulty segmented */}
            <div className="space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Route difficulty</div>
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/50 bg-card/70 p-1">
                {ROUTE_CONTEXTS.map((ctx) => {
                  const isActive = routeContext === ctx.value;
                  return (
                    <button
                      key={ctx.value}
                      type="button"
                      onClick={() => setRouteContext(ctx.value)}
                      className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-all ${
                        isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {ctx.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Company select */}
            <div className="space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Company</div>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="min-w-[150px] rounded-xl border border-border/60 bg-card px-3 py-2 text-[12.5px] text-foreground outline-none focus:border-primary/60"
              >
                <option value="all">All companies</option>
                {(companyOptions ?? []).map((c) => (
                  <option key={c} value={c}>
                    Company {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Route select */}
            <div className="space-y-1.5">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Route</div>
              <select
                value={String(routeId)}
                onChange={(e) => setRouteId(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="min-w-[180px] rounded-xl border border-border/60 bg-card px-3 py-2 text-[12.5px] text-foreground outline-none focus:border-primary/60"
              >
                <option value="all">All routes</option>
                {(routeOptions ?? []).map((r) => (
                  <option key={r.route_id} value={r.route_id}>
                    {r.route_code ? `${r.route_code} · ` : ""}
                    {r.route_name || `Route ${r.route_id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Min risk score slider */}
            <div className="min-w-[180px] flex-1 space-y-1.5">
              <div className="flex items-center justify-between text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <span>Min risk score</span>
                <span className="num text-foreground">{minRiskScore}</span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={minRiskScore}
                onChange={(e) => setMinRiskScore(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Map body */}
        <div className="p-3">
          {isError ? (
            <div className="flex h-[560px] items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 text-[13px] text-destructive">
              Failed to load segment risk data{error instanceof Error ? `: ${error.message}` : ""}.
            </div>
          ) : isLoading ? (
            <div className="flex h-[560px] items-center justify-center rounded-xl border border-border/50 bg-muted/20 text-[13px] text-muted-foreground">
              Loading segment risk map…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-[560px] flex-col items-center justify-center gap-1 rounded-xl border border-border/50 bg-muted/20 text-center">
              <ShieldAlert className="h-5 w-5 text-muted-foreground" />
              <div className="text-[13px] font-medium">No segments match these filters</div>
              <div className="text-[12px] text-muted-foreground">Loosen the risk band or lower the minimum score.</div>
            </div>
          ) : (
            <div className="relative">
              {isFetching && (
                <div className="absolute right-3 top-3 z-[1000] rounded-lg border border-border/50 bg-card/92 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur-md">
                  Updating…
                </div>
              )}
              <SegmentRiskMapLoader rows={rows} height={560} showFootprints={showFootprints} routePath={routePath} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const RISK_LABEL: Record<SegmentRiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

function RiskBadge({ level }: { level: SegmentRiskLevel }) {
  const color = RISK_LEVEL_COLOR[level];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium capitalize"
      style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {RISK_LABEL[level]}
    </span>
  );
}

/**
 * Top dangerous segments — backed live by `mart_segment_risk_map` via the
 * dedicated `fetchTopDangerousSegments` query (deduped to distinct segments).
 * Clicking a row opens a detail drawer with the extra telemetry fields.
 */
function TopDangerousSegments() {
  const [selected, setSelected] = useState<SegmentRiskMapRow | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["mart_segment_risk_map", "top", 10],
    queryFn: () => fetchTopDangerousSegments(undefined, 10),
  });

  const rows = data ?? [];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated xl:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Top dangerous segments</h3>
          <p className="text-[12.5px] text-muted-foreground">
            Live from <span className="num">mart_segment_risk_map</span> — distinct segments ranked by difficulty score.
          </p>
        </div>
        <ShieldAlert className="h-4 w-4 text-destructive" />
      </div>

      {isError ? (
        <div className="flex h-40 items-center justify-center text-center text-[12.5px] text-destructive">
          Failed to load segments{error instanceof Error ? `: ${error.message}` : ""}.
        </div>
      ) : isLoading ? (
        <div className="flex h-40 items-center justify-center text-[12.5px] text-muted-foreground">
          Loading dangerous segments…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-[12.5px] text-muted-foreground">
          No segment risk data available.
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {rows.map((s, i) => {
            const level = normalizeRiskLevel(s.risk_level);
            const change = s.difficulty_change_pct;
            return (
              <button
                key={s.segment_id}
                onClick={() => setSelected(s)}
                className="grid w-full grid-cols-[1.6rem_1fr_auto_auto] items-center gap-3 rounded-md px-1.5 py-2.5 text-left transition-colors hover:bg-muted/30"
              >
                <span className="num text-[12px] text-muted-foreground">{i + 1}</span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium num">{s.segment_id}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {s.route_code ? `Rte ${s.route_code} · ` : ""}
                    {s.dms_event_count} DMS · {s.hard_braking_count} brake · {fmt(s.avg_speed)} km/h
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[13px] font-semibold">{fmt(s.segment_difficulty_score, 0)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">risk</div>
                </div>
                {change !== null ? (
                  <div className={`num text-[11.5px] ${change > 0 ? "text-destructive" : "text-success"}`}>
                    {change > 0 ? "+" : ""}
                    {fmt(change)}%
                  </div>
                ) : (
                  <RiskBadge level={level} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected && <LiveSegmentDrawer segment={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function LiveSegmentDrawer({ segment, onClose }: { segment: SegmentRiskMapRow; onClose: () => void }) {
  const level = normalizeRiskLevel(segment.risk_level);
  const events = [
    { k: "DMS events", v: segment.dms_event_count, c: "var(--color-chart-4)" },
    { k: "Hard braking", v: segment.hard_braking_count, c: "var(--color-destructive)" },
    { k: "Severity-2", v: segment.severity_2_count, c: "var(--color-warning)" },
  ];
  const max = Math.max(1, ...events.map((e) => e.v));
  const change = segment.difficulty_change_pct;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-border/60 bg-card shadow-elevated animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Segment drilldown</div>
            <div className="num text-[16px] font-semibold">{segment.segment_id}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <div className="flex items-center gap-2">
            <RiskBadge level={level} />
            <span className="text-[11px] capitalize text-muted-foreground">{segment.trend_direction} trend</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Risk score</div>
              <div className="num text-[22px] font-semibold">{fmt(segment.segment_difficulty_score, 0)}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Period change</div>
              <div
                className={`num text-[22px] font-semibold ${
                  change === null ? "" : change > 0 ? "text-destructive" : "text-success"
                }`}
              >
                {change === null ? "—" : `${change > 0 ? "+" : ""}${fmt(change)}%`}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Avg speed</div>
              <div className="num text-[16px] font-semibold">{fmt(segment.avg_speed)} km/h</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Stop ratio</div>
              <div className="num text-[16px] font-semibold">{fmt(segment.stop_ratio * 100, 0)}%</div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">Route association</div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-[13px]">
              <div className="num text-primary">{segment.route_code || `Route ${segment.route_id}`}</div>
              <div className="text-muted-foreground">{segment.route_name}</div>
              <div className="mt-1 num text-[11px] text-muted-foreground">
                {segment.segment_lat_bin.toFixed(4)}, {segment.segment_lon_bin.toFixed(4)} · {segment.route_context_label} route
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">Event composition</div>
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.k}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground">{e.k}</span>
                    <span className="num">{e.v}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                    <div className="h-full rounded-full" style={{ width: `${(e.v / max) * 100}%`, background: e.c }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function SegmentRiskPage() {
  const { data: correlationRow, isLoading: correlationLoading } = useQuery({
    queryKey: ["mart_segment_correlation"],
    queryFn: () => fetchMartSegmentCorrelation(),
  });

  const worsening = useMemo(() => [...SEGMENTS].sort((a, b) => b.trend_30d - a.trend_30d).slice(0, 6), []);
  const improving = useMemo(() => [...SEGMENTS].sort((a, b) => a.trend_30d - b.trend_30d).slice(0, 6), []);

  return (
    <PageShell
      eyebrow="Live · gold.route_segment_fact"
      title="Segment Risk Intelligence"
      description="Spatial operational risk. Surface dangerous corridors, recurring hotspots and correlated event clusters."
    >
      {/* A. Live segment risk map (mart_segment_risk_map) */}
      <LiveSegmentRiskSection />

      {/* B + D */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <TopDangerousSegments />

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-tight">Worsening</h3>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </div>
            <div className="space-y-2">
              {worsening.map((s) => (
                <div key={s.segment_id} className="flex items-center justify-between text-[12px]">
                  <span className="num">{s.segment_id}</span>
                  <span className="num text-destructive">+{fmt(s.trend_30d)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-tight">Improving</h3>
              <TrendingDown className="h-4 w-4 text-success" />
            </div>
            <div className="space-y-2">
              {improving.map((s) => (
                <div key={s.segment_id} className="flex items-center justify-between text-[12px]">
                  <span className="num">{s.segment_id}</span>
                  <span className="num text-success">{fmt(s.trend_30d)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* E. Correlation matrix + insights */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CorrelationMatrix
            segments={SEGMENTS}
            correlationRow={correlationRow}
            isLoading={correlationLoading}
          />
        </div>
        <div className="space-y-3">
          <InsightCard
            icon={Layers}
            tone="warning"
            title="Rough road and harsh braking strongly co-occur"
            body="Segments with elevated rough-road counts show a 0.6+ Pearson correlation with braking intensity — pavement is the upstream cause."
          />
          <InsightCard
            icon={AlertTriangle}
            tone="destructive"
            title="Drowsiness clusters on long-haul evening segments"
            body="Drowsiness spikes correlate with segments > 4 km on long routes after 6 PM — schedule micro-breaks."
          />
          <InsightCard
            icon={Sparkles}
            title="Distraction is independent of road condition"
            body="Low correlation (< 0.2) with rough-road density. Coaching, not engineering, is the right lever."
          />
        </div>
      </section>
    </PageShell>
  );
}
