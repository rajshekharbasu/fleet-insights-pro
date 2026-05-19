import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Activity, AlertTriangle, ArrowUpRight, Battery, ChevronRight, Gauge, MapPin,
  Radar as RadarIcon, Route as RouteIcon, ShieldAlert, Sparkles, Users, Zap,
} from "lucide-react";
import {
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip,
} from "recharts";
import { PageShell } from "@/components/layout/AppNav";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { FleetMapLoader } from "@/components/maps/FleetMapLoader";
import { DRIVERS, FLEET_KPIS, ROUTES, SEGMENTS } from "@/lib/fleet-data";
import { CHART_ENTER } from "@/lib/chart-motion";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet Command Center · Voltline" },
      { name: "description", content: "Executive operational intelligence for EV fleet operations." },
      { property: "og:title", content: "Fleet Command Center · Voltline" },
      { property: "og:description", content: "Unified KPIs, risk radar, leakage analytics and executive drilldowns." },
    ],
  }),
  component: FleetCommandPage,
});

const fmt = (n: number, d = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

function HeroKpi({ label, value, unit, tone = "default", icon: Icon, hint }: {
  label: string; value: string; unit?: string; hint?: string;
  tone?: "default" | "warning" | "destructive" | "success";
  icon: any;
}) {
  const toneClass =
    tone === "warning" ? "text-warning bg-warning/10 ring-warning/25"
      : tone === "destructive" ? "text-destructive bg-destructive/10 ring-destructive/25"
      : tone === "success" ? "text-success bg-success/10 ring-success/25"
      : "text-primary bg-primary/10 ring-primary/25";
  return (
    <div className="accent-bar-top card-interactive group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-elevated">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-50 blur-2xl transition-opacity group-hover:opacity-75"
        style={{
          background:
            tone === "destructive" ? "color-mix(in oklab, var(--color-destructive) 50%, transparent)"
              : tone === "warning" ? "color-mix(in oklab, var(--color-warning) 50%, transparent)"
              : tone === "success" ? "color-mix(in oklab, var(--color-success) 50%, transparent)"
              : "color-mix(in oklab, var(--color-primary) 50%, transparent)",
        }}
        aria-hidden
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="num text-[28px] font-semibold tracking-tight">{value}</span>
            {unit && <span className="text-[12px] font-medium text-muted-foreground">{unit}</span>}
          </div>
          {hint && <div className="mt-1 text-[11.5px] text-muted-foreground">{hint}</div>}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function FleetCommandPage() {
  const worstRoutes = useMemo(
    () => [...ROUTES].sort((a, b) => b.energy_leakage_kwh - a.energy_leakage_kwh).slice(0, 5),
    [],
  );
  const worstDrivers = useMemo(
    () => [...DRIVERS].sort((a, b) => a.contextual_score - b.contextual_score).slice(0, 5),
    [],
  );
  const worstSegments = useMemo(
    () => [...SEGMENTS].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5),
    [],
  );

  const routeRisk =
    ROUTES.reduce((s, r) => s + r.difficulty_score, 0) / ROUTES.length;
  const segmentRisk =
    SEGMENTS.reduce((s, x) => s + x.risk_score, 0) / SEGMENTS.length;
  const driverRisk =
    DRIVERS.reduce((s, d) => s + (100 - d.contextual_score), 0) / DRIVERS.length;
  const energyRisk = Math.min(
    100,
    (FLEET_KPIS.total_energy_leakage_kwh / (ROUTES.length * 200)) * 100,
  );
  const dmsRisk = Math.min(100, FLEET_KPIS.total_dms_events / 80);

  const radar = [
    { axis: "Route", v: +routeRisk.toFixed(1) },
    { axis: "Segment", v: +segmentRisk.toFixed(1) },
    { axis: "Driver", v: +driverRisk.toFixed(1) },
    { axis: "Energy", v: +energyRisk.toFixed(1) },
    { axis: "DMS", v: +dmsRisk.toFixed(1) },
    { axis: "Battery", v: +Math.min(100, FLEET_KPIS.fleet_efficiency_kwh_per_km * 55).toFixed(1) },
  ];

  return (
    <PageShell
      eyebrow="Unified · all gold-layer facts"
      title="Fleet Command"
      titleAccent="Center"
      description="Executive operational intelligence across routes, segments, drivers and energy systems."
      meta={
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-right">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Operational status</div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="text-[14px] font-semibold tracking-tight">Nominal</span>
            </div>
          </div>
        </div>
      }
    >
      {/* A. Hero KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <HeroKpi label="Fleet efficiency" value={fmt(FLEET_KPIS.fleet_efficiency_kwh_per_km, 2)} unit="kWh/km" icon={Gauge} hint="Composite, 30d" />
        <HeroKpi label="Risk index" value={fmt(FLEET_KPIS.operational_risk_index)} unit="/100" tone="warning" icon={ShieldAlert} hint="Inverse of avg score" />
        <HeroKpi label="Energy leakage" value={fmt(FLEET_KPIS.total_energy_leakage_kwh, 0)} unit="kWh" tone="destructive" icon={Zap} hint="Estimated, 30d" />
        <HeroKpi label="DMS events" value={fmt(FLEET_KPIS.total_dms_events, 0)} icon={AlertTriangle} hint="All severities" />
        <HeroKpi label="High-risk routes" value={String(FLEET_KPIS.high_risk_routes)} unit="of 10" tone="warning" icon={RouteIcon} />
        <HeroKpi label="High-risk drivers" value={String(FLEET_KPIS.high_risk_drivers)} tone="destructive" icon={Users} />
      </section>

      {/* B. Map + D. Radar */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <FleetMapLoader
            routes={ROUTES}
            segments={SEGMENTS}
            activeKinds={["risk"]}
            height={520}
            dmsMode="summary"
          />
        </div>
        <div className="chart-enter rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Operational risk radar</h3>
              <p className="text-[12.5px] text-muted-foreground">Composite layers, normalized 0–100.</p>
            </div>
            <RadarIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="78%">
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Radar dataKey="v" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.22} {...CHART_ENTER} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1.5 text-[12px]">
            {radar.map((r) => (
              <div key={r.axis} className="flex items-center justify-between">
                <span className="text-muted-foreground">{r.axis}</span>
                <span className="num">{fmt(r.v)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* C. Leakage analytics + Drilldowns */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <DrillCard title="Top leakage routes" icon={Zap} to="/routes" tone="destructive"
          rows={worstRoutes.map((r) => ({
            label: `${r.route_code} · ${r.route_name}`,
            value: `${fmt(r.energy_leakage_kwh, 0)} kWh`,
            sub: `${fmt(r.efficiency_kwh_per_km, 2)} kWh/km`,
          }))}
        />
        <DrillCard title="Top dangerous segments" icon={MapPin} to="/segments" tone="warning"
          rows={worstSegments.map((s) => ({
            label: s.segment_id,
            value: fmt(s.risk_score),
            sub: `${s.harsh_braking} brake · ${s.distraction} distraction`,
          }))}
        />
        <DrillCard title="Coaching priorities" icon={Users} to="/drivers" tone="destructive"
          rows={worstDrivers.map((d) => ({
            label: d.driver_name,
            value: fmt(d.contextual_score),
            sub: `${d.company_name} · ${d.risk_band}`,
          }))}
        />
      </section>

      {/* E. Executive insights */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InsightCard
          icon={Activity}
          tone="warning"
          tag="Trend"
          title={`Route deterioration on ${worstRoutes[0].route_code}`}
          body={`Energy leakage rising over the last 14 days; peak-hour kWh/km is ${fmt(((worstRoutes[0].peak_efficiency - worstRoutes[0].offpeak_efficiency) / worstRoutes[0].offpeak_efficiency) * 100)}% above off-peak.`}
        />
        <InsightCard
          icon={ShieldAlert}
          tone="destructive"
          tag="Risk"
          title={`Driver risk concentration in ${worstDrivers[0].company_name}`}
          body={`${FLEET_KPIS.high_risk_drivers} drivers below threshold — recommend cohort intervention this week.`}
        />
        <InsightCard
          icon={Sparkles}
          tone="success"
          tag="Win"
          title="Fleet efficiency improving"
          body="Composite kWh/km is trending down 2.1% week-over-week, driven by regen ratio gains on R-744 and R-417."
        />
        <InsightCard
          icon={Battery}
          tone="warning"
          tag="Battery"
          title="Cell temperature drift on 7 vehicles"
          body="Soft thermal anomalies during sustained discharge — schedule diagnostic checks in the next service window."
        />
        <InsightCard
          icon={MapPin}
          title="Congestion intensifying on harbor corridor"
          body="Peak-hour congestion score on R-101 grew 6 points week-over-week. Consider 25-min depart shift."
        />
        <InsightCard
          icon={ArrowUpRight}
          tag="Opportunity"
          title="Best practices from R-744 transferable"
          body="Steady-state efficiency on R-744 suggests micro-coaching pattern applicable across 3 similar low-congestion corridors."
        />
      </section>

      {/* F. Breadcrumb-style drilldown rail */}
      <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-elevated backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
          <span className="rounded-md bg-muted/40 px-2 py-1 text-foreground">Fleet</span>
          <ChevronRight className="h-3 w-3" />
          <Link to="/routes" className="rounded-md px-2 py-1 hover:bg-muted/40 hover:text-foreground">Route</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/segments" className="rounded-md px-2 py-1 hover:bg-muted/40 hover:text-foreground">Segment</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/drivers" className="rounded-md px-2 py-1 hover:bg-muted/40 hover:text-foreground">Driver</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/" className="rounded-md px-2 py-1 hover:bg-muted/40 hover:text-foreground">Trip</Link>
        </div>
      </section>
    </PageShell>
  );
}

function DrillCard({ title, icon: Icon, rows, to, tone }: {
  title: string; icon: any; to: string;
  tone: "warning" | "destructive" | "success" | "primary";
  rows: { label: string; value: string; sub?: string }[];
}) {
  const toneClass =
    tone === "destructive" ? "text-destructive"
      : tone === "warning" ? "text-warning"
      : tone === "success" ? "text-success"
      : "text-primary";
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${toneClass}`} />
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        </div>
        <Link to={to} className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground">
          Open <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-border/40">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between py-2 text-[12.5px]">
            <div className="min-w-0">
              <div className="truncate">{r.label}</div>
              {r.sub && <div className="text-[11px] text-muted-foreground">{r.sub}</div>}
            </div>
            <div className={`num font-semibold ${toneClass}`}>{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
