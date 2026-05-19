import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { AlertTriangle, ArrowRight, BookOpen, Clock, TrendingUp, Zap } from "lucide-react";
import { CHART_ENTER } from "@/lib/chart-motion";
import type {
  AbnormalityDriver,
  BusLeaderboardRow,
  ChargerFilters,
  ChargerKpiMetric,
  ChargerLeaderboardRow,
  ChargerStory,
  ExecutiveKpis,
} from "@/lib/charger-analytics";
import {
  KPI_METRIC_META,
  abnormalityDrivers,
  buildChargerStory,
  energyVsSocScatter,
  kpiTrendByDay,
  kpiTrendByHour,
  trendSummaryStats,
} from "@/lib/charger-analytics";
import type {
  BusOperationalHealthDaily,
  ChargerHealthDaily,
  ChargingSession,
  DepotEnergyDaily,
} from "@/lib/charger-data";
import { fmt, Panel, PanelHeader } from "./charger-shared";

const KPI_CHIPS: ChargerKpiMetric[] = [
  "energy",
  "soc_delta",
  "charge_power",
  "sessions",
  "duration",
  "disconnect_rate",
  "abnormality",
];

type TrendView = "daily" | "hourly";

function StoryBanner({ story }: { story: ChargerStory }) {
  const border =
    story.tone === "critical"
      ? "border-destructive/40 bg-destructive/8"
      : story.tone === "warning"
        ? "border-warning/40 bg-warning/8"
        : "border-primary/30 bg-primary/8";
  return (
    <div className={`rounded-2xl border p-5 ${border}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card ring-1 ring-border/50">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            What the data is saying
          </div>
          <h2 className="mt-1 text-[16px] font-semibold leading-snug tracking-tight">{story.headline}</h2>
          <ul className="mt-3 space-y-1.5">
            {story.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function KpiTrendExplorer({
  metric,
  onMetric,
  trendView,
  onTrendView,
  daily,
  hourly,
  stats,
}: {
  metric: ChargerKpiMetric;
  onMetric: (m: ChargerKpiMetric) => void;
  trendView: TrendView;
  onTrendView: (v: TrendView) => void;
  daily: ReturnType<typeof kpiTrendByDay>;
  hourly: ReturnType<typeof kpiTrendByHour>;
  stats: ReturnType<typeof trendSummaryStats>;
}) {
  const meta = KPI_METRIC_META[metric];
  const chartData = trendView === "daily" ? daily : hourly;
  const xKey = trendView === "daily" ? "date" : "hour";

  return (
    <Panel>
      <PanelHeader
        title="KPI trend explorer"
        description="Pick a metric — chart updates with fleet average and median. Abnormal sessions overlay on daily view."
        action={
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg border border-border/60 p-0.5">
              {(["daily", "hourly"] as TrendView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onTrendView(v)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize ${
                    trendView === v ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {v === "daily" ? "By date" : "By hour"}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <div className="flex flex-wrap gap-1.5 border-b border-border/40 px-4 pb-3">
        {KPI_CHIPS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onMetric(k)}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
              metric === k
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {KPI_METRIC_META[k].label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-border/40 px-4 py-3 sm:grid-cols-4">
        {[
          { label: "Fleet average", value: stats.average, unit: meta.unit },
          { label: "Median", value: stats.median, unit: meta.unit },
          { label: "Peak", value: stats.peak, unit: meta.unit },
          { label: "Latest", value: stats.latest, unit: meta.unit },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/25 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="num text-[18px] font-semibold">
              {fmt(s.value, 1)}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="h-72 p-4 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
            <XAxis dataKey={xKey} tick={{ fontSize: 10 }} interval={trendView === "hourly" ? 2 : "preserveStartEnd"} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
              formatter={(v: number) => [`${fmt(v, 2)} ${meta.unit}`, meta.label]}
            />
            <ReferenceLine
              y={stats.average}
              stroke="var(--color-primary)"
              strokeDasharray="6 4"
              label={{ value: `Avg ${fmt(stats.average, 1)}`, fontSize: 9, fill: "var(--color-primary)" }}
            />
            <ReferenceLine
              y={stats.median}
              stroke="var(--color-muted-foreground)"
              strokeDasharray="4 4"
              label={{ value: `Median ${fmt(stats.median, 1)}`, fontSize: 9, fill: "var(--color-muted-foreground)" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              name={meta.label}
              stroke="var(--color-chart-1)"
              fill="var(--color-chart-1)"
              fillOpacity={0.15}
              strokeWidth={2}
              {...CHART_ENTER}
            />
            {trendView === "daily" && (
              <Bar dataKey="abnormalSessions" name="Abnormal sessions" fill="var(--color-destructive)" fillOpacity={0.35} barSize={8} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="border-t border-border/40 px-4 py-2 text-[11px] text-muted-foreground">
        <TrendingUp className="mr-1 inline h-3 w-3" />
        Teal line = fleet average · dashed = median · red bars = abnormal sessions (daily only)
      </p>
    </Panel>
  );
}

function EnergySocTimeCharts({ sessions }: { sessions: ChargingSession[] }) {
  const scatter = useMemo(() => energyVsSocScatter(sessions), [sessions]);
  const hourlyEnergy = useMemo(() => kpiTrendByHour(sessions, "energy"), [sessions]);
  const hourlySoc = useMemo(() => kpiTrendByHour(sessions, "soc_delta"), [sessions]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel className="p-5">
        <PanelHeader
          title="Energy delivered vs SOC gained"
          description="Each dot is a charging session. Red = abnormal session."
        />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
              <XAxis type="number" dataKey="socDelta" name="SOC Δ %" tick={{ fontSize: 10 }} />
              <YAxis type="number" dataKey="energy" name="kWh" tick={{ fontSize: 10 }} />
              <ZAxis type="number" dataKey="power" range={[30, 120]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  if (!payload?.[0]) return null;
                  const d = payload[0].payload as (typeof scatter)[0];
                  return (
                    <div className="rounded-lg border bg-popover p-2 text-[11px]">
                      <div className="font-semibold">Bus {d.vehicle}</div>
                      <div>SOC +{d.socDelta}% · {d.energy} kWh · {d.power} kW</div>
                      <div className="text-muted-foreground">{String(d.hour).padStart(2, "0")}:00</div>
                      {d.abnormal && <div className="text-destructive">Abnormal session</div>}
                    </div>
                  );
                }}
              />
              <Scatter
                name="Sessions"
                data={scatter.filter((s) => !s.abnormal)}
                fill="var(--color-primary)"
                fillOpacity={0.55}
              />
              <Scatter name="Abnormal" data={scatter.filter((s) => s.abnormal)} fill="var(--color-destructive)" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader
          title="Time-of-day profile"
          description="When energy is delivered & SOC is gained — spot peak windows."
          action={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hourlyEnergy.map((e, i) => ({ ...e, soc: hourlySoc[i]?.value ?? 0 }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
              <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar yAxisId="l" dataKey="value" name="Energy kWh" fill="var(--color-primary)" fillOpacity={0.7} barSize={10} />
              <Line yAxisId="r" type="monotone" dataKey="soc" name="SOC %" stroke="#a855f7" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Bars = total kWh per hour · purple line = average SOC gained in that hour
        </p>
      </Panel>
    </div>
  );
}

function AbnormalityKpiBreakdown({ drivers }: { drivers: AbnormalityDriver[] }) {
  if (!drivers.length) {
    return (
      <Panel className="p-8 text-center text-[13px] text-muted-foreground">
        No abnormal entities in the current filter — fleet KPIs are within expected ranges.
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader
        title="Why is it abnormal? — KPI drivers"
        description="Each row links abnormality score to metrics that diverge from fleet averages (±15% triggers highlight)."
        action={<AlertTriangle className="h-4 w-4 text-warning" />}
      />
      <div className="divide-y divide-border/40">
        {drivers.map((d) => (
          <div key={d.entity} className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold">{d.entity}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">{d.depot}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Abnormality</span>
                <span className="num text-[15px] font-semibold text-destructive">{fmt(d.abnormalityScore, 0)}</span>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {d.drivers.map((dr) => (
                <div
                  key={dr.kpi}
                  className={`rounded-xl border px-3 py-2 text-[11px] ${
                    dr.triggered
                      ? "border-destructive/40 bg-destructive/8"
                      : "border-border/40 bg-muted/20"
                  }`}
                >
                  <div className="font-medium">{dr.kpi}</div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="num text-[14px] font-semibold">
                      {fmt(dr.value, 1)} {dr.unit}
                    </span>
                    <span
                      className={`num text-[10px] ${dr.triggered ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {dr.pctVsAvg > 0 ? "+" : ""}
                      {dr.pctVsAvg.toFixed(0)}% vs avg
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    Fleet avg {fmt(dr.fleetAvg, 1)} {dr.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function ChargerStoryboard({
  filters,
  kpis,
  buses,
  chargers,
  depots,
  sessions,
  busLb,
  chargerLb,
}: {
  filters: ChargerFilters;
  kpis: ExecutiveKpis;
  buses: BusOperationalHealthDaily[];
  chargers: ChargerHealthDaily[];
  depots: DepotEnergyDaily[];
  sessions: ChargingSession[];
  busLb: BusLeaderboardRow[];
  chargerLb: ChargerLeaderboardRow[];
}) {
  const [metric, setMetric] = useState<ChargerKpiMetric>("energy");
  const [trendView, setTrendView] = useState<TrendView>("daily");

  const dailyTrend = useMemo(
    () => kpiTrendByDay(buses, chargers, depots, sessions, metric),
    [buses, chargers, depots, sessions, metric],
  );
  const hourlyTrend = useMemo(() => kpiTrendByHour(sessions, metric), [sessions, metric]);
  const stats = useMemo(() => trendSummaryStats(dailyTrend), [dailyTrend]);
  const drivers = useMemo(
    () => abnormalityDrivers(busLb, chargerLb, sessions),
    [busLb, chargerLb, sessions],
  );
  const story = useMemo(
    () => buildChargerStory(kpis, dailyTrend, drivers, metric),
    [kpis, dailyTrend, drivers, metric],
  );

  return (
    <div className="space-y-6">
      <StoryBanner story={story} />

      <KpiTrendExplorer
        metric={metric}
        onMetric={setMetric}
        trendView={trendView}
        onTrendView={setTrendView}
        daily={dailyTrend}
        hourly={hourlyTrend}
        stats={stats}
      />

      <EnergySocTimeCharts sessions={sessions} />

      <AbnormalityKpiBreakdown drivers={drivers} />

      <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-3 text-[11.5px] text-muted-foreground">
        <Zap className="mb-1 inline h-3.5 w-3.5 text-primary" />{" "}
        <strong className="text-foreground">How to read this page:</strong> Start with the story banner →
        select a KPI chip to see trends vs fleet average → check energy/SOC/time charts for operational
        patterns → use the abnormality breakdown to see which metrics caused each flag. Filters above
        apply to all charts ({filters.trendWindow} window
        {filters.depotIds.length ? ` · ${filters.depotIds.length} depot(s)` : ""}).
      </div>
    </div>
  );
}
