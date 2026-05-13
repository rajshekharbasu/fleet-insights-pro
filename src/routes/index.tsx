import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity, AlertTriangle, BatteryCharging, Gauge, Recycle, Timer, Zap } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MetricTrendChart } from "@/components/dashboard/MetricTrendChart";
import { PivotMatrixTable } from "@/components/dashboard/PivotMatrixTable";
import { RankingList } from "@/components/dashboard/RankingList";
import { AnomalyTable } from "@/components/dashboard/AnomalyTable";
import { TripDetailDrawer } from "@/components/dashboard/TripDetailDrawer";
import { RouteHeatmap } from "@/components/dashboard/RouteHeatmap";
import {
  ALL_TRIPS, applyFilters, DEFAULT_FILTERS, pivot, previousPeriod, summarize, trendByDay,
  type Filters, type PivotDim,
} from "@/lib/analytics";
import type { Trip } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Voltline · EV Fleet Efficiency Analytics" },
      { name: "description", content: "Premium analytics for EV fleet trip efficiency, energy, and driver performance." },
      { property: "og:title", content: "Voltline · EV Fleet Efficiency Analytics" },
      { property: "og:description", content: "Executive dashboard for EV fleet trip efficiency and diagnostics." },
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

  function delta(curr: number, prev: number) {
    if (!prev) return 0;
    return ((curr - prev) / prev) * 100;
  }

  // Sparklines: pull last 14 days of trend per metric
  const spark = (k: keyof typeof trend[number]) =>
    trend.slice(-14).map((d) => ({ v: Number(d[k]) || 0 }));

  function openTripByEntity(_dim: PivotDim, row: { key: string }) {
    // Pick the most recent matching trip in the filtered set as a representative
    const t = [...filteredTrips].reverse().find((t) =>
      [t.driver_name, t.route_code, t.vehiclenumber, t.company_name, t.scheduling_date].includes(row.key),
    );
    if (t) setSelectedTrip(t);
  }

  const fmt = (n: number, d = 1) => n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-[0.18]" aria-hidden />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative">
        <DashboardHeader />

        <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
          {/* Hero */}
          <section id="overview" className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Live · streaming from gold.trip_efficiency
              </div>
              <h1 className="mt-3 text-balance text-[28px] font-semibold tracking-tight md:text-[32px]">
                EV fleet efficiency, at a glance.
              </h1>
              <p className="mt-1 max-w-xl text-[13.5px] text-muted-foreground">
                Six months of trip-level telemetry, energy, and diagnostics — pivot, compare, and surface anomalies in seconds.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-right">
              <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Trips in window</div>
              <div className="num mt-0.5 text-[20px] font-semibold tracking-tight">
                {summary.totalTrips.toLocaleString()}
              </div>
              <div className="text-[11px] num text-muted-foreground">
                {fmt(summary.totalDistance, 0)} km tracked
              </div>
            </div>
          </section>

          <FilterBar filters={filters} onChange={setFilters} />

          {/* KPI cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
            />
            <KpiCard
              label="Regen Ratio"
              value={fmt(summary.regenRatio * 100, 1)}
              unit="%"
              delta={delta(summary.regenRatio, prevSummary.regenRatio)}
              positiveIsGood
              icon={Recycle}
              spark={spark("regenRatio")}
            />
            <KpiCard
              label="SOC Drop / km"
              value={fmt(summary.socDropPerKm, 2)}
              unit="%/km"
              delta={delta(summary.socDropPerKm, prevSummary.socDropPerKm)}
              positiveIsGood={false}
              icon={BatteryCharging}
              spark={spark("socDropPerKm")}
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
          </section>

          {/* Trend + heatmap */}
          <section id="trends" className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <MetricTrendChart data={trend} prevData={prevTrend} />
            </div>
            <RouteHeatmap trips={filteredTrips} />
          </section>

          {/* Pivot */}
          <section id="explore">
            <PivotMatrixTable rowsByDim={rowsByDim} onRowClick={openTripByEntity} />
          </section>

          {/* Rankings */}
          <section id="rankings">
            <RankingList rowsByDim={rowsByDim} />
          </section>

          {/* Anomalies */}
          <section id="anomalies">
            <AnomalyTable trips={filteredTrips} onSelect={setSelectedTrip} />
          </section>

          <footer className="flex items-center justify-between border-t border-border/50 pt-5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3" />
              Data source: <span className="num text-foreground">redshift · gold.trip_efficiency</span>
            </div>
            <div className="num">Last sync · {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</div>
          </footer>
        </main>
      </div>

      <TripDetailDrawer trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
    </div>
  );
}
