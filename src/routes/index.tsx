import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BatteryCharging,
  Gauge,
  LayoutGrid,
  Recycle,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import { PageShell } from "@/components/layout/AppNav";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MetricTrendChart } from "@/components/dashboard/MetricTrendChart";
import { PivotMatrixTable } from "@/components/dashboard/PivotMatrixTable";
import { RankingList } from "@/components/dashboard/RankingList";
import { AnomalyTable } from "@/components/dashboard/AnomalyTable";
import { TripDetailDrawer } from "@/components/dashboard/TripDetailDrawer";
import { RouteEfficiencyChart } from "@/components/dashboard/RouteEfficiencyChart";
import { SectionHeader } from "@/components/layout/SectionHeader";
import {
  ALL_TRIPS,
  applyFilters,
  computePivotMedians,
  DEFAULT_FILTERS,
  median,
  pivot,
  previousPeriod,
  summarize,
  trendByDay,
  type Filters,
  type PivotDim,
} from "@/lib/analytics";
import type { Trip } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Voltline · EV Fleet Efficiency Analytics" },
      {
        name: "description",
        content: "Premium analytics for EV fleet trip efficiency, energy, and driver performance.",
      },
      { property: "og:title", content: "Voltline · EV Fleet Efficiency Analytics" },
      {
        property: "og:description",
        content: "Executive dashboard for EV fleet trip efficiency and diagnostics.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const filteredTrips = useMemo(() => applyFilters(ALL_TRIPS, filters), [filters]);
  const prevTrips = useMemo(() => applyFilters(ALL_TRIPS, previousPeriod(filters)), [filters]);

  const summary = useMemo(() => summarize(filteredTrips), [filteredTrips]);
  const prevSummary = useMemo(() => summarize(prevTrips), [prevTrips]);
  const trend = useMemo(() => trendByDay(filteredTrips), [filteredTrips]);
  const prevTrend = useMemo(() => trendByDay(prevTrips), [prevTrips]);

  const rowsByDim = (dim: PivotDim) => pivot(filteredTrips, dim);
  const driverMedians = useMemo(
    () => computePivotMedians(rowsByDim("driver_name")),
    [filteredTrips],
  );
  const tripMedians = useMemo(
    () => ({
      kwhPerKm: median(filteredTrips.map((t) => t.kwh_per_km)),
      regenRatio:
        median(filteredTrips.map((t) => t.regen_kwh / Math.max(t.gross_discharge_kwh, 0.01))) * 100,
      socDropPerKm: median(filteredTrips.map((t) => t.soc_drop_per_km)),
      idleShare: median(filteredTrips.map((t) => t.idle_energy_share_pct)),
    }),
    [filteredTrips],
  );

  function delta(curr: number, prev: number) {
    if (!prev) return 0;
    return ((curr - prev) / prev) * 100;
  }

  const spark = (k: keyof (typeof trend)[number]) =>
    trend.slice(-14).map((d) => ({ v: Number(d[k]) || 0 }));

  function openTripByEntity(_dim: PivotDim, row: { key: string }) {
    const t = [...filteredTrips].reverse().find((t) =>
      [t.driver_name, t.route_code, t.vehiclenumber, t.company_name, t.scheduling_date].includes(
        row.key,
      ),
    );
    if (t) setSelectedTrip(t);
  }

  const fmt = (n: number, d = 1) =>
    n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

  return (
    <PageShell
      eyebrow="Live · gold.trip_efficiency"
      title="EV fleet efficiency,"
      titleAccent="at a glance."
      description="Six months of trip-level telemetry, energy, and diagnostics — pivot, compare, and surface anomalies in seconds."
      meta={
        <div className="accent-bar-top rounded-2xl border border-border/50 bg-card/80 px-5 py-3.5 text-right shadow-elevated backdrop-blur-sm">
          <div className="section-label">Trips in window</div>
          <div className="num mt-1 text-[24px] font-semibold tracking-tight">
            {summary.totalTrips.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[12px] num text-muted-foreground">
            {fmt(summary.totalDistance, 0)} km tracked
          </div>
        </div>
      }
    >
      <FilterBar filters={filters} onChange={setFilters} />

      <section id="overview" className="space-y-4">
        <SectionHeader
          label="Overview"
          title="Key performance indicators"
          description="Trip-level aggregates vs. the previous period of equal length."
          icon={LayoutGrid}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Net Energy"
            value={fmt(summary.netKwh, 0)}
            unit="kWh"
            delta={delta(summary.netKwh, prevSummary.netKwh)}
            positiveIsGood={false}
            icon={Zap}
            spark={spark("netKwh")}
          />
          <KpiCard
            label="kWh / km"
            value={fmt(summary.kwhPerKm, 2)}
            delta={delta(summary.kwhPerKm, prevSummary.kwhPerKm)}
            positiveIsGood={false}
            icon={Gauge}
            spark={spark("kwhPerKm")}
            medianBenchmark={{
              value: `${fmt(driverMedians.kwhPerKm, 2)} kWh/km`,
              lowerIsBetter: true,
              numericValue: tripMedians.kwhPerKm,
            }}
          />
          <KpiCard
            label="Regen Ratio"
            value={fmt(summary.regenRatio * 100, 1)}
            unit="%"
            delta={delta(summary.regenRatio, prevSummary.regenRatio)}
            positiveIsGood
            icon={Recycle}
            spark={spark("regenRatio")}
            medianBenchmark={{
              value: `${fmt(driverMedians.regenRatio, 1)}%`,
              lowerIsBetter: false,
              numericValue: tripMedians.regenRatio,
            }}
          />
          <KpiCard
            label="SOC Drop / km"
            value={fmt(summary.socDropPerKm, 2)}
            unit="%/km"
            delta={delta(summary.socDropPerKm, prevSummary.socDropPerKm)}
            positiveIsGood={false}
            icon={BatteryCharging}
            spark={spark("socDropPerKm")}
            medianBenchmark={{
              value: fmt(tripMedians.socDropPerKm, 2),
              lowerIsBetter: true,
              numericValue: tripMedians.socDropPerKm,
            }}
          />
          <KpiCard
            label="Idle Energy"
            value={fmt(summary.idleSharePct, 1)}
            unit="%"
            delta={delta(summary.idleSharePct, prevSummary.idleSharePct)}
            positiveIsGood={false}
            icon={Timer}
            spark={spark("idleShare")}
            accent="warning"
            medianBenchmark={{
              value: `${fmt(driverMedians.idleShare, 1)}%`,
              lowerIsBetter: true,
              numericValue: tripMedians.idleShare,
            }}
          />
          <KpiCard
            label="Anomaly Rate"
            value={fmt(summary.anomalyRatePct, 1)}
            unit="%"
            delta={delta(summary.anomalyRatePct, prevSummary.anomalyRatePct || 0.001)}
            positiveIsGood={false}
            icon={AlertTriangle}
            spark={spark("trips")}
            accent="destructive"
          />
        </div>
      </section>

      <section id="trends" className="space-y-4">
        <SectionHeader
          label="Trends"
          title="Performance over time"
          description="Daily aggregates with optional comparison to the prior period."
          icon={TrendingUp}
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <MetricTrendChart data={trend} prevData={prevTrend} />
          </div>
          <RouteEfficiencyChart trips={filteredTrips} />
        </div>
      </section>

      <section id="explore" className="space-y-4">
        <SectionHeader
          label="Explore"
          title="Pivot exploration"
          description="Slice metrics by driver, route, vehicle, company, or date — each pivot shows a fleet median baseline row."
          icon={BarChart3}
        />
        <PivotMatrixTable rowsByDim={rowsByDim} onRowClick={openTripByEntity} />
      </section>

      <section id="rankings" className="space-y-4">
        <SectionHeader
          label="Rankings"
          title="Top & bottom performers"
          description="Entities with at least three trips in the selected window."
          icon={Gauge}
        />
        <RankingList rowsByDim={rowsByDim} />
      </section>

      <section id="anomalies" className="space-y-4">
        <SectionHeader
          label="Diagnostics"
          title="Anomaly feed"
          description="Trips flagged by efficiency or telemetry thresholds."
          icon={AlertTriangle}
        />
        <AnomalyTable trips={filteredTrips} onSelect={setSelectedTrip} />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-6 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Data source: <span className="num font-medium text-foreground">redshift · gold.trip_efficiency</span>
        </div>
        <div className="num">
          Last sync · {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
        </div>
      </footer>

      <TripDetailDrawer trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
    </PageShell>
  );
}
