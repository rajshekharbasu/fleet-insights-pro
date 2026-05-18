import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity, Brain, Flame, Gauge, MapPin, Mountain, Route as RouteIcon,
  Snowflake, Sparkles, TrendingDown, TrendingUp, Zap,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageShell } from "@/components/layout/AppNav";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { GeoCanvas, type HotspotKind } from "@/components/maps/GeoCanvas";
import { ROUTES, SEGMENTS } from "@/lib/fleet-data";

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

function MiniStat({ label, value, unit, hint, tone = "default" }: {
  label: string; value: string; unit?: string; hint?: string;
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
      {hint && <div className="mt-1 text-[11.5px] text-muted-foreground">{hint}</div>}
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

function RouteCard({ r, selected, onToggle }: { r: typeof ROUTES[number]; selected: boolean; onToggle: () => void }) {
  const peakDelta = ((r.peak_efficiency - r.offpeak_efficiency) / r.offpeak_efficiency) * 100;
  return (
    <button
      onClick={onToggle}
      className={`group relative overflow-hidden rounded-2xl border bg-card p-4 text-left shadow-elevated transition-all hover:-translate-y-0.5 hover:border-primary/40 ${
        selected ? "border-primary/60 ring-1 ring-primary/30" : "border-border/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="num text-[12px] font-medium text-primary">{r.route_code}</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[12px] text-muted-foreground">{r.active_trips_30d} trips · 30d</span>
          </div>
          <div className="mt-0.5 text-[13.5px] font-semibold tracking-tight">{r.route_name}</div>
        </div>
        <div className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
          Difficulty
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
  const [kinds, setKinds] = useState<HotspotKind[]>(["risk"]);
  const [compareIds, setCompareIds] = useState<string[]>([ROUTES[0].route_id, ROUTES[1].route_id]);

  const sorted = useMemo(() => [...ROUTES].sort((a, b) => b.difficulty_score - a.difficulty_score), []);
  const hardest = sorted[0];
  const easiest = sorted[sorted.length - 1];
  const avgEff = sorted.reduce((s, r) => s + r.efficiency_kwh_per_km, 0) / sorted.length;
  const avgCong = sorted.reduce((s, r) => s + r.congestion_score, 0) / sorted.length;
  const avgDiff = sorted.reduce((s, r) => s + r.difficulty_score, 0) / sorted.length;

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? [...prev.slice(1), id] : [...prev, id],
    );
  }

  const compareRoutes = ROUTES.filter((r) => compareIds.includes(r.route_id));
  const compareData = ["Efficiency", "AvgSpeed", "StopRatio", "DMS", "Altitude", "Leakage"].map((dim) => {
    const row: any = { dim };
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

  const ALL_KINDS: HotspotKind[] = ["risk", "harsh_braking", "overspeed", "distraction", "drowsiness", "rough_road"];

  return (
    <PageShell
      eyebrow="Live · gold.route_context_fact + gold.route_segment_fact"
      title="Route Intelligence"
      description="Operational route complexity, energy intensity and contextual risk across the fleet."
      meta={
        <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-right">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Active routes</div>
          <div className="num mt-0.5 text-[20px] font-semibold tracking-tight">{ROUTES.length}</div>
          <div className="text-[11px] num text-muted-foreground">{sorted.reduce((s, r) => s + r.active_trips_30d, 0)} trips · 30d</div>
        </div>
      }
    >
      {/* A. Executive overview */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <MiniStat label="Active routes" value={String(ROUTES.length)} hint="Operational in window" />
        <MiniStat label="Hardest" value={hardest.route_code} tone="destructive" hint={`${fmt(hardest.difficulty_score)} difficulty`} />
        <MiniStat label="Easiest" value={easiest.route_code} tone="success" hint={`${fmt(easiest.difficulty_score)} difficulty`} />
        <MiniStat label="Avg efficiency" value={fmt(avgEff, 2)} unit="kWh/km" hint="Fleet-wide" />
        <MiniStat label="Avg congestion" value={fmt(avgCong)} unit="/100" hint="Time-weighted" />
        <MiniStat label="Avg difficulty" value={fmt(avgDiff)} unit="/100" hint="Composite index" />
      </section>

      {/* B. Leaderboard */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight">Route difficulty leaderboard</h2>
            <p className="text-[12.5px] text-muted-foreground">Click any route to add it to the comparison studio.</p>
          </div>
          <div className="text-[11px] num text-muted-foreground">{compareIds.length} selected · max 4</div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((r) => (
            <RouteCard key={r.route_id} r={r} selected={compareIds.includes(r.route_id)} onToggle={() => toggleCompare(r.route_id)} />
          ))}
        </div>
      </section>

      {/* C. Comparison studio */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Route comparison studio</h3>
              <p className="text-[12.5px] text-muted-foreground">Multi-dimensional fingerprint across {compareRoutes.length} routes.</p>
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
                    isAnimationActive={false}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* E. Peak vs offpeak */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Peak vs off-peak</h3>
              <p className="text-[12.5px] text-muted-foreground">Energy intensity degradation during peak.</p>
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
                <Bar dataKey="offpeak" name="Off-peak" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="peak" name="Peak" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* D. Heat map */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight">Route heat intelligence map</h2>
            <p className="text-[12.5px] text-muted-foreground">Glowing intensity by event class across all active routes.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-card/70 p-0.5">
            {ALL_KINDS.map((k) => {
              const active = kinds.includes(k);
              return (
                <button
                  key={k}
                  onClick={() =>
                    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [k]))
                  }
                  className={`rounded-md px-2.5 py-1 text-[11.5px] capitalize transition-colors ${
                    active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k.replace("_", " ")}
                </button>
              );
            })}
          </div>
        </div>
        <GeoCanvas
          routes={ROUTES}
          segments={SEGMENTS}
          highlightRouteIds={compareIds}
          activeKinds={kinds}
          height={520}
        />
      </section>

      {/* F. Insights */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InsightCard
          icon={Flame}
          tone="destructive"
          tag={hardest.route_code}
          title={`${hardest.route_code} shows ${fmt(((hardest.peak_efficiency - hardest.offpeak_efficiency) / hardest.offpeak_efficiency) * 100)}% higher energy loss during peak`}
          body={`Driven by congestion (${fmt(hardest.congestion_score)}/100) and ${fmt(hardest.stop_density_per_km, 1)} stops/km. Consider re-timing departures by 25 minutes.`}
        />
        <InsightCard
          icon={Mountain}
          tone="warning"
          tag={sorted[1].route_code}
          title={`${sorted[1].route_code} contributes the most harsh braking density`}
          body={`Altitude gain of ${sorted[1].altitude_gain_m}m correlates with regen ramp anomalies. Recommend coaching for descent control.`}
        />
        <InsightCard
          icon={Snowflake}
          tone="success"
          tag={easiest.route_code}
          title={`${easiest.route_code} maintains best-in-class efficiency at ${fmt(easiest.efficiency_kwh_per_km, 2)} kWh/km`}
          body={`Low rough-road density (${fmt(easiest.rough_road_density * 100, 0)}%) and a steady flow envelope. Use as a benchmark for new drivers.`}
        />
        <InsightCard
          icon={Zap}
          tone="primary"
          title="Energy leakage concentrates on 3 routes"
          body={`${sorted.slice(0, 3).map((r) => r.route_code).join(", ")} together account for ${fmt(
            (sorted.slice(0, 3).reduce((s, r) => s + r.energy_leakage_kwh, 0) /
              sorted.reduce((s, r) => s + r.energy_leakage_kwh, 0)) * 100,
            0,
          )}% of total estimated leakage.`}
        />
        <InsightCard
          icon={Sparkles}
          tag="Coaching"
          title="Difficulty-normalized efficiency is improving"
          body={`Across all routes, kWh/km adjusted for difficulty is trending down ${fmt(2.4)}% week-over-week.`}
        />
        <InsightCard
          icon={MapPin}
          tone="warning"
          title="Recurring DMS clusters at segment crossings"
          body={`Highest-risk segments cluster near 4 intersections common to R-101, R-309 and R-417 — strong candidate for geofence alerts.`}
        />
      </section>
    </PageShell>
  );
}
