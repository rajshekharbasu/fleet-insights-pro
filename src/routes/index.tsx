import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { aggregateGraphQlKpis, type DailyKpiRecord } from "@/lib/graphql-adapter";
import { GRAPHQL_API_URL } from "@/lib/graphql/config";
import { fetchDbTrips, fetchDbTripStats } from "@/lib/graphql/trips";
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
import { DailyInsightsBrief } from "@/components/insights/DailyInsightsBrief";
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

function graphQlTrendByDay(records: DailyKpiRecord[], f: Filters) {
  const matched = records.filter((r) => {
    const d = r.scheduling_date.slice(0, 10);
    if (d < f.from || d > f.to) return false;
    const companyName = r.company_name || (r as any).companyname;
    if (f.companies.length && !f.companies.includes(companyName)) return false;
    return true;
  });

  const map = new Map<string, DailyKpiRecord[]>();
  for (const r of matched) {
    const d = r.scheduling_date.slice(0, 10);
    const arr = map.get(d) ?? [];
    arr.push(r);
    map.set(d, arr);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRecords]) => {
      let totalKwh = 0;
      let totalGrossKwh = 0;
      let totalTrips = 0;
      let totalDistance = 0;
      let sumRegenRatioWeighted = 0;
      let sumIdleRatioWeighted = 0;
      let sumSocPerKmWeighted = 0;

      for (const r of dayRecords) {
        totalKwh += r.total_kwh;
        const gross = r.regen_ratio < 0.99 ? r.total_kwh / (1 - r.regen_ratio) : r.total_kwh;
        totalGrossKwh += gross;
        totalTrips += r.trip_count;
        const distance = r.kwh_per_km > 0 ? r.total_kwh / r.kwh_per_km : 0;
        totalDistance += distance;
        sumRegenRatioWeighted += r.regen_ratio * r.total_kwh;
        sumIdleRatioWeighted += (r.idle_ratio * 100) * r.total_kwh;
        sumSocPerKmWeighted += r.soc_per_km * distance;
      }

      return {
        date,
        kwhPerKm: totalDistance > 0 ? +(totalKwh / totalDistance).toFixed(3) : 0,
        grossKwhPerKm: totalDistance > 0 ? +(totalGrossKwh / totalDistance).toFixed(3) : 0,
        regenRatio: totalKwh > 0 ? +(sumRegenRatioWeighted / totalKwh * 100).toFixed(2) : 0,
        netKwh: +totalKwh.toFixed(1),
        grossKwh: +totalGrossKwh.toFixed(1),
        socDropPerKm: totalDistance > 0 ? +(sumSocPerKmWeighted / totalDistance).toFixed(3) : 0,
        idleShare: totalKwh > 0 ? +(sumIdleRatioWeighted / totalKwh).toFixed(2) : 0,
        trips: totalTrips,
      };
    });
}

function DashboardPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const { data: filterOptions } = useQuery({
    queryKey: ["filter_options"],
    queryFn: async () => {
      const sql = `
        SELECT 
          DISTINCT companyname, 
          driver_name, 
          route_code, 
          route_name,
          vehiclenumber,
          bus_code
        FROM trip_efficiency_fact
      `;
      const res = await fetch(GRAPHQL_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query GetFilterOptions($sql: String!) {
            sqlQuery(sql: $sql)
          }`,
          variables: { sql },
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch filter options");
      const json = await res.json();
      const rows = json.data?.sqlQuery || [];

      // Extract unique lists
      const companies = Array.from(new Set(rows.map((r: any) => r.companyname).filter(Boolean))).sort() as string[];
      const drivers = Array.from(new Set(rows.map((r: any) => r.driver_name).filter(Boolean))).sort() as string[];
      const routes = (Array.from(
        new Map(
          rows
            .filter((r: any) => r.route_code)
            .map((r: any) => [r.route_code, r.route_name || r.route_code])
        ).entries()
      ) as [string, string][]).map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code));
      const vehicles = (Array.from(
        new Map(
          rows
            .filter((r: any) => r.vehiclenumber)
            .map((r: any) => [r.vehiclenumber, r.bus_code || r.vehiclenumber])
        ).entries()
      ) as [string, string][]).map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code));

      return { companies, drivers, routes, vehicles };
    }
  });

  const { data: graphQlData, isLoading, error } = useQuery({
    queryKey: ["mart_performance_trend"],
    queryFn: async () => {
      const res = await fetch(GRAPHQL_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query mart_performance_trend {
                  sqlQuery(sql: "SELECT * FROM mart_performance_trend")
                }`
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch GraphQL data");
      const json = await res.json();
      return json;
    }
  });

  const { data: dbTrips } = useQuery({
    queryKey: ["db_trips", filters],
    queryFn: () => fetchDbTrips(300, filters),
  });

  const { data: dbStats } = useQuery({
    queryKey: ["db_trip_stats", filters],
    queryFn: () => fetchDbTripStats(filters),
  });

  const allTrips = useMemo(() => {
    return dbTrips && dbTrips.length > 0 ? dbTrips : ALL_TRIPS;
  }, [dbTrips]);

  const filteredTrips = useMemo(() => applyFilters(allTrips, filters), [allTrips, filters]);
  const prevTrips = useMemo(() => applyFilters(allTrips, previousPeriod(filters)), [allTrips, filters]);

  const summary = useMemo(() => {
    if (graphQlData?.data?.sqlQuery) {
      const filteredRecords = (graphQlData.data.sqlQuery as DailyKpiRecord[]).filter((r) => {
        const d = r.scheduling_date.slice(0, 10);
        if (d < filters.from || d > filters.to) return false;
        const companyName = r.company_name || (r as any).companyname;
        if (filters.companies.length && !filters.companies.includes(companyName)) return false;
        return true;
      });
      return aggregateGraphQlKpis(filteredRecords);
    }
    return summarize(filteredTrips);
  }, [graphQlData, filteredTrips, filters]);

  const prevSummary = useMemo(() => {
    if (graphQlData?.data?.sqlQuery) {
      const prevFilters = previousPeriod(filters);
      const filteredRecords = (graphQlData.data.sqlQuery as DailyKpiRecord[]).filter((r) => {
        const d = r.scheduling_date.slice(0, 10);
        if (d < prevFilters.from || d > prevFilters.to) return false;
        const companyName = r.company_name || (r as any).companyname;
        if (filters.companies.length && !filters.companies.includes(companyName)) return false;
        return true;
      });
      return aggregateGraphQlKpis(filteredRecords);
    }
    return summarize(prevTrips);
  }, [graphQlData, prevTrips, filters]);

  const trend = useMemo(() => {
    if (graphQlData?.data?.sqlQuery) {
      return graphQlTrendByDay(graphQlData.data.sqlQuery, filters);
    }
    return trendByDay(filteredTrips);
  }, [graphQlData, filteredTrips, filters]);

  const prevTrend = useMemo(() => {
    if (graphQlData?.data?.sqlQuery) {
      return graphQlTrendByDay(graphQlData.data.sqlQuery, previousPeriod(filters));
    }
    return trendByDay(prevTrips);
  }, [graphQlData, prevTrips, filters]);

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
            {(dbStats?.totalTrips ?? summary.totalTrips).toLocaleString()}
          </div>
          <div className="mt-0.5 text-[12px] num text-muted-foreground">
            {fmt(dbStats?.totalDistance ?? summary.totalDistance, 0)} km tracked
          </div>
        </div>
      }
    >
      <FilterBar filters={filters} onChange={setFilters} options={filterOptions} />

      <DailyInsightsBrief trips={filteredTrips} />

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
            label="Gross kWh / km"
            value={fmt(summary.grossKwhPerKm, 2)}
            delta={delta(summary.grossKwhPerKm, prevSummary.grossKwhPerKm)}
            positiveIsGood={false}
            icon={Gauge}
            spark={spark("grossKwhPerKm")}
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
            <MetricTrendChart data={trend} prevData={prevTrend} isGraphQl={!!graphQlData?.data?.sqlQuery} error={error} />
          </div>
          <RouteEfficiencyChart trips={filteredTrips} filters={filters} />
        </div>
      </section>

      <section id="explore" className="space-y-4">
        <SectionHeader
          label="Explore"
          title="Pivot exploration"
          description="Slice metrics by driver, route, vehicle, company, or date — each pivot shows a fleet median baseline row."
          icon={BarChart3}
        />
        <PivotMatrixTable rowsByDim={rowsByDim} filters={filters} />
      </section>

      <section id="rankings" className="space-y-4">
        <SectionHeader
          label="Rankings"
          title="Top & bottom performers"
          description="Entities with at least three trips in the selected window."
          icon={Gauge}
        />
        <RankingList rowsByDim={rowsByDim} filters={filters} />
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
