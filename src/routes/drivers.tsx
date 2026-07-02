import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award, BadgeCheck, Brain, ChevronRight, Crown, FileSpreadsheet, GraduationCap, Loader2, Maximize2, ShieldAlert, Star,
  TrendingDown, TrendingUp, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageShell } from "@/components/layout/AppNav";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { FilterBar } from "@/components/dashboard/FilterBar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DRIVERS, type DriverScore } from "@/lib/fleet-data";
import { fetchDriverLeaderboard, type DriverLeaderboardExtras, type DriverLeaderboardEntry } from "@/lib/graphql/drivers";
import {
  computeTripBehaviorWindow,
  fetchDriverTripBehavior,
  fetchDriverTripDetails,
  fetchDriverTripsForDay,
  resolveDriverTripBehaviorAnchor,
  TRIP_BEHAVIOR_WINDOW_DAYS,
  type DriverDailyTripRow,
  type DriverTripDetailRow,
} from "@/lib/graphql/driver-trip-behavior";
import { fetchFilterOptions } from "@/lib/graphql/filter-options";
import { DEFAULT_FILTERS, type Filters } from "@/lib/analytics";
import { exportDriverWorkbook } from "@/lib/export/driver-excel";
import { exportDriverTrips } from "@/lib/export/driver-daily-excel";

export const Route = createFileRoute("/drivers")({
  head: () => ({
    meta: [
      { title: "Driver Intelligence · Voltline" },
      { name: "description", content: "Driver coaching, benchmarking and operational optimization." },
      { property: "og:title", content: "Driver Intelligence · Voltline" },
      { property: "og:description", content: "Contextual driver scoring, behavior fingerprints and peer benchmarking." },
    ],
  }),
  component: DriverIntelligencePage,
});

const fmt = (n: number, d = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

const BAND_COLOR: Record<DriverScore["risk_band"], string> = {
  Elite: "var(--color-success)",
  Strong: "var(--color-primary)",
  Average: "var(--color-chart-2)",
  "At-risk": "var(--color-warning)",
  Critical: "var(--color-destructive)",
};

function MiniStat({ label, value, unit, hint, tone = "default", onClick, active }: {
  label: string; value: string; unit?: string; hint?: string;
  tone?: "default" | "warning" | "success" | "destructive";
  onClick?: () => void; active?: boolean;
}) {
  const toneClass =
    tone === "warning" ? "text-warning"
      : tone === "success" ? "text-success"
      : tone === "destructive" ? "text-destructive"
      : "text-foreground";
  const accent =
    tone === "warning" ? "var(--color-warning)"
      : tone === "success" ? "var(--color-success)"
      : tone === "destructive" ? "var(--color-destructive)"
      : "var(--color-primary)";
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
      className={`rounded-2xl border bg-card p-5 shadow-elevated transition-all ${
        interactive ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40" : ""
      } ${active ? "ring-2" : "border-border/60"}`}
      style={active ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent}, 0 12px 32px -12px color-mix(in oklab, ${accent} 30%, transparent)` } : undefined}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`num text-[26px] font-semibold tracking-tight ${toneClass}`}>{value}</span>
        {unit && <span className="text-[12px] font-medium text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

type FilterKind = "incentive" | "review" | "coaching";

const FILTER_META: Record<FilterKind, { accent: string; tone: string; blurb: string; Icon: typeof Award }> = {
  incentive: {
    accent: "var(--color-success)",
    tone: "text-success",
    blurb: "Top performers qualifying for rewards this cycle.",
    Icon: Award,
  },
  review: {
    accent: "var(--color-destructive)",
    tone: "text-destructive",
    blurb: "Drivers flagged for manual review and intervention.",
    Icon: ShieldAlert,
  },
  coaching: {
    accent: "var(--color-warning)",
    tone: "text-warning",
    blurb: "Drivers with an assigned coaching module in the queue.",
    Icon: GraduationCap,
  },
};

function pctCell(v: number | null, alreadyPct = false): string {
  if (v == null) return "—";
  return `${fmt(alreadyPct ? v : v * 100, 0)}%`;
}

function TrendCell({ extras }: { extras: DriverLeaderboardExtras }) {
  const dir = scoreTrendDir(extras);
  if (dir > 0) return <span className="inline-flex items-center gap-1 text-success"><TrendingUp className="h-3.5 w-3.5" />Improving</span>;
  if (dir < 0) return <span className="inline-flex items-center gap-1 text-destructive"><TrendingDown className="h-3.5 w-3.5" />Declining</span>;
  return <span className="text-muted-foreground">Stable</span>;
}

function FilterDetailPanel({
  filter, label, entries, onClose, onOpen,
}: {
  filter: FilterKind;
  label: string;
  entries: DriverLeaderboardEntry[];
  onClose: () => void;
  onOpen: (d: DriverScore) => void;
}) {
  const meta = FILTER_META[filter];
  const cols: { key: string; head: string; cell: (e: DriverLeaderboardEntry) => ReactNode; align?: string }[] =
    filter === "incentive"
      ? [
          { key: "pct", head: "Percentile", cell: (e) => <span className="num">{e.percentile}</span>, align: "text-right" },
          { key: "stars", head: "Stars/trip", cell: (e) => <span className="num">{e.extras.starsPerTripWeighted == null ? "—" : fmt(e.extras.starsPerTripWeighted, 2)}</span>, align: "text-right" },
          { key: "trips", head: "Trips scored", cell: (e) => <span className="num">{e.extras.tripsScored ?? "—"}</span>, align: "text-right" },
          { key: "eff", head: "Efficiency", cell: (e) => <span className="num">{fmt(e.efficiency_kwh_per_km, 2)}</span>, align: "text-right" },
          { key: "trend", head: "Trend", cell: (e) => <TrendCell extras={e.extras} /> },
        ]
      : filter === "review"
      ? [
          { key: "risk", head: "Dominant risk", cell: (e) => <span className="capitalize">{e.extras.dominantRisk ?? "—"}</span> },
          { key: "hr", head: "High-risk", cell: (e) => <span className="num">{pctCell(e.extras.highRiskRatio)}</span>, align: "text-right" },
          { key: "fatigue", head: "Fatigue", cell: (e) => <span className="num">{e.extras.fatigueDensity == null ? "—" : fmt(e.extras.fatigueDensity, 2)}</span>, align: "text-right" },
          { key: "trips", head: "Trips scored", cell: (e) => <span className="num">{e.extras.tripsScored ?? "—"}</span>, align: "text-right" },
          { key: "trend", head: "Trend", cell: (e) => <TrendCell extras={e.extras} /> },
        ]
      : [
          { key: "module", head: "Module", cell: (e) => <span>{e.extras.coachingModule ?? "—"}</span> },
          { key: "trigger", head: "Trigger", cell: (e) => <span className="text-muted-foreground">{e.extras.coachingTrigger ?? "—"}</span> },
          { key: "risk", head: "Dominant risk", cell: (e) => <span className="capitalize">{e.extras.dominantRisk ?? "—"}</span> },
          { key: "hr", head: "High-risk", cell: (e) => <span className="num">{pctCell(e.extras.highRiskRatio)}</span>, align: "text-right" },
        ];

  return (
    <section
      className="overflow-hidden rounded-2xl border bg-card shadow-elevated"
      style={{ borderColor: `color-mix(in oklab, ${meta.accent} 35%, transparent)` }}
    >
      <div
        className="flex items-center justify-between gap-3 border-b px-5 py-3.5"
        style={{ borderColor: `color-mix(in oklab, ${meta.accent} 20%, transparent)`, background: `color-mix(in oklab, ${meta.accent} 7%, transparent)` }}
      >
        <div className="flex items-center gap-3">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${meta.tone}`} style={{ background: `color-mix(in oklab, ${meta.accent} 14%, transparent)` }}>
            <meta.Icon className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight">{label}</h3>
              <span className={`num rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`} style={{ background: `color-mix(in oklab, ${meta.accent} 14%, transparent)` }}>
                {entries.length}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground">{meta.blurb}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="p-8 text-center text-[12.5px] text-muted-foreground">No drivers match “{label}”.</div>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-medium">#</th>
                <th className="px-3 py-2.5 text-left font-medium">Driver</th>
                {cols.map((c) => (
                  <th key={c.key} className={`px-3 py-2.5 font-medium ${c.align ?? "text-left"}`}>{c.head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.driver_id}
                  onClick={() => onOpen(e)}
                  className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-5 py-2.5 text-left">
                    <span className="num font-semibold text-muted-foreground">{e.extras.rank ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">{e.driver_name}</div>
                    <div className="text-[11px] text-muted-foreground">{e.company_name}</div>
                  </td>
                  {cols.map((c) => (
                    <td key={c.key} className={`px-3 py-2.5 ${c.align ?? "text-left"}`}>{c.cell(e)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function scoreTrendDir(extras?: DriverLeaderboardExtras, fallbackDeltaPct = 0): number {
  const t = extras?.scoreTrend;
  if (t) {
    if (/up|improv|better|rise|gain|pos/i.test(t)) return 1;
    if (/down|declin|worse|drop|fall|neg/i.test(t)) return -1;
    const n = Number(t);
    if (Number.isFinite(n) && n !== 0) return Math.sign(n);
    return 0;
  }
  return fallbackDeltaPct < 0 ? 1 : fallbackDeltaPct > 0 ? -1 : 0;
}

function DriverCard({ d, extras, onOpen }: {
  d: DriverScore; extras?: DriverLeaderboardExtras; onOpen: () => void;
}) {
  const dir = scoreTrendDir(extras, d.efficiency_delta_pct);
  const trendLabel = extras?.scoreTrend ? String(extras.scoreTrend) : dir > 0 ? "improving" : dir < 0 ? "declining" : "stable";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full overflow-hidden rounded-2xl border border-border/60 bg-card p-4 text-left shadow-elevated transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 text-left">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full text-[11.5px] font-semibold tracking-tight"
            style={{ background: `color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 18%, var(--color-card))`, color: BAND_COLOR[d.risk_band], boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 35%, transparent)` }}
          >
            {d.driver_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            {extras?.rank != null && (
              <span className="absolute -left-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
                {extras.rank}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[13.5px] font-semibold tracking-tight">{d.driver_name}</span>
              {extras?.incentiveEligible && <Award className="h-3 w-3 text-success" aria-label="Incentive eligible" />}
              {extras?.reviewRequired && <ShieldAlert className="h-3 w-3 text-destructive" aria-label="Review required" />}
            </div>
            <div className="text-[11px] text-muted-foreground">{d.company_name} · {d.trips_30d} trips</div>
          </div>
        </div>
        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] uppercase tracking-wider"
          style={{ background: `color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 15%, transparent)`, color: BAND_COLOR[d.risk_band] }}>
          {d.risk_band}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Peer percentile</div>
          <div className="num text-[22px] font-semibold tracking-tight">{fmt(d.contextual_score)} %</div>
          <div className="text-[11px] num text-muted-foreground">diff exposure {fmt(d.difficulty_exposure, 0)}</div>
        </div>
        <div className="h-10 w-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.score_evolution.map((v) => ({ v }))} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={`drv-${d.driver_id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={BAND_COLOR[d.risk_band]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={BAND_COLOR[d.risk_band]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area dataKey="v" type="monotone" stroke={BAND_COLOR[d.risk_band]} strokeWidth={1.4} fill={`url(#drv-${d.driver_id})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className={`num inline-flex items-center gap-1 ${dir > 0 ? "text-success" : dir < 0 ? "text-destructive" : "text-muted-foreground"}`}>
          {dir > 0 ? <TrendingUp className="h-3 w-3" /> : dir < 0 ? <TrendingDown className="h-3 w-3" /> : null}
          {fmt(d.efficiency_kwh_per_km, 2)} kWh/km
        </span>
        <span className="text-[10.5px] capitalize text-muted-foreground">{trendLabel.replace(/_/g, " ")}</span>
      </div>
    </button>
  );
}

function DriverIntelligencePage() {
  const [open, setOpen] = useState<DriverScore | null>(null);
  const [sort, setSort] = useState<"score" | "efficiency" | "exposure">("score");
  const [filter, setFilter] = useState<"incentive" | "review" | "coaching" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const { data: filterOptions } = useQuery({
    queryKey: ["filter_options"],
    queryFn: fetchFilterOptions,
  });

  const { data: liveEntries, isLoading, error } = useQuery({
    queryKey: ["mart_driver_leaderboard"],
    queryFn: () => fetchDriverLeaderboard(50),
  });

  const usingLive = (liveEntries?.length ?? 0) > 0;
  const allDrivers: DriverScore[] = usingLive ? liveEntries! : DRIVERS;

  // The leaderboard is a snapshot, so Company/Driver filtering is applied
  // client-side over the returned rows.
  const drivers: DriverScore[] = useMemo(
    () =>
      allDrivers.filter((d) => {
        if (filters.companies.length && !filters.companies.includes(d.company_name)) return false;
        if (filters.drivers.length && !filters.drivers.includes(d.driver_name)) return false;
        return true;
      }),
    [allDrivers, filters.companies, filters.drivers],
  );

  const extrasById = useMemo(
    () => new Map((liveEntries ?? []).map((e) => [e.driver_id, e.extras])),
    [liveEntries],
  );

  const sorted = useMemo(() => {
    const arr = [...drivers];
    if (sort === "score") {
      if (usingLive) {
        arr.sort(
          (a, b) =>
            (extrasById.get(a.driver_id)?.rank ?? Number.POSITIVE_INFINITY) -
            (extrasById.get(b.driver_id)?.rank ?? Number.POSITIVE_INFINITY),
        );
      } else {
        arr.sort((a, b) => b.contextual_score - a.contextual_score);
      }
    }
    if (sort === "efficiency") arr.sort((a, b) => a.efficiency_kwh_per_km - b.efficiency_kwh_per_km);
    if (sort === "exposure") arr.sort((a, b) => b.difficulty_exposure - a.difficulty_exposure);
    return arr;
  }, [sort, drivers, usingLive, extrasById]);

  const elite = drivers.filter((d) => d.risk_band === "Elite").length;
  const critical = drivers.filter((d) => d.risk_band === "Critical" || d.risk_band === "At-risk").length;
  const avgScore = drivers.length ? drivers.reduce((s, d) => s + d.contextual_score, 0) / drivers.length : 0;
  const avgEff = drivers.length ? drivers.reduce((s, d) => s + d.efficiency_kwh_per_km, 0) / drivers.length : 0;

  const incentiveCount = (liveEntries ?? []).filter((e) => e.extras.incentiveEligible).length;
  const reviewCount = (liveEntries ?? []).filter((e) => e.extras.reviewRequired).length;
  const coachingCount = (liveEntries ?? []).filter((e) => e.extras.coachingModule).length;

  const toggleFilter = (f: "incentive" | "review" | "coaching") =>
    setFilter((prev) => (prev === f ? null : f));

  async function handleExport() {
    if (exporting) return;
    const rows = liveEntries ?? [];
    if (rows.length === 0) {
      toast.error("No driver data to export yet.");
      return;
    }
    setExporting(true);
    try {
      await exportDriverWorkbook(rows);
      toast.success(`Exported ${rows.length} drivers to Excel.`);
    } catch (err) {
      console.error("Excel export failed", err);
      toast.error("Excel export failed. Check the console for details.");
    } finally {
      setExporting(false);
    }
  }

  const FILTER_LABEL: Record<"incentive" | "review" | "coaching", string> = {
    incentive: "Incentive eligible",
    review: "Needs review",
    coaching: "Coaching queue",
  };

  const filterMatches = useMemo(() => {
    if (!usingLive || !filter) return [] as DriverLeaderboardEntry[];
    const list = (liveEntries ?? []).filter((e) => {
      if (filter === "incentive") return e.extras.incentiveEligible;
      if (filter === "review") return e.extras.reviewRequired;
      return !!e.extras.coachingModule;
    });
    return list.sort(
      (a, b) =>
        (a.extras.rank ?? Number.POSITIVE_INFINITY) - (b.extras.rank ?? Number.POSITIVE_INFINITY),
    );
  }, [liveEntries, filter, usingLive]);

  return (
    <PageShell
      eyebrow={usingLive ? "Live · mart_driver_leaderboard" : "Live · gold.driver_trip_behavior_fact + driver_contextual_score_fact"}
      title="Driver Intelligence"
      description="Contextual driver scoring, behavior fingerprints and peer benchmarking — calibrated to route difficulty."
      meta={
        usingLive ? (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-[13px] font-medium text-success shadow-elevated transition-all hover:-translate-y-0.5 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            {exporting ? "Preparing…" : "Export to Excel"}
          </button>
        ) : undefined
      }
    >
      <FilterBar
        filters={filters}
        onChange={setFilters}
        options={filterOptions}
        show={{ date: false, company: true, driver: true, route: false, vehicle: false }}
      />

      {/* A. Command center */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {usingLive ? (
          <>
            <MiniStat label="Avg percentile" value={fmt(avgScore)} unit="/100" hint="Peer-ranked" />
            <MiniStat label="Incentive eligible" value={String(incentiveCount)} tone="success" hint="Top performers" onClick={() => toggleFilter("incentive")} active={filter === "incentive"} />
            <MiniStat label="Needs review" value={String(reviewCount)} tone="destructive" hint="Coaching priority" onClick={() => toggleFilter("review")} active={filter === "review"} />
            <MiniStat label="Fleet efficiency" value={fmt(avgEff, 2)} unit="kWh/km" hint="Avg of leaderboard" />
            <MiniStat label="Coaching queue" value={String(coachingCount)} tone="warning" hint="Modules assigned" onClick={() => toggleFilter("coaching")} active={filter === "coaching"} />
          </>
        ) : (
          <>
            <MiniStat label="Avg score" value={fmt(avgScore)} unit="/100" hint="Route-normalized" />
            <MiniStat label="Elite drivers" value={String(elite)} tone="success" hint="Top tier" />
            <MiniStat label="High-risk" value={String(critical)} tone="destructive" hint="Coaching priority" />
            <MiniStat label="Fleet efficiency" value={fmt(avgEff, 2)} unit="kWh/km" />
            <MiniStat label="Coaching slots" value={String(Math.max(3, Math.round(critical * 1.5)))} tone="warning" hint="Auto-scheduled" />
          </>
        )}
      </section>

      {/* A2. Card drill-down */}
      {usingLive && filter && (
        <FilterDetailPanel
          filter={filter}
          label={FILTER_LABEL[filter]}
          entries={filterMatches}
          onClose={() => setFilter(null)}
          onOpen={(d) => setOpen(d)}
        />
      )}

      {/* B. Leaderboard */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold tracking-tight">Driver leaderboard</h2>
              {usingLive && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-inset ring-success/20">
                  GraphQL
                </span>
              )}
              {!usingLive && error && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                  Offline fallback
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              {usingLive
                ? "Ranked by composite driver score from driver leaderboard. Click a driver for the deep dive."
                : "Click a driver for the deep dive or add to behavior comparison."}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/70 p-0.5">
            {(["score", "efficiency", "exposure"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] capitalize transition-colors ${
                  sort === s ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading && !usingLive
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={`drv-skel-${i}`} className="h-44 animate-pulse rounded-2xl border border-border/60 bg-muted/30" />
              ))
            : sorted.map((d) => (
                <DriverCard
                  key={d.driver_id}
                  d={d}
                  extras={extrasById.get(d.driver_id)}
                  onOpen={() => setOpen(d)}
                />
              ))}
        </div>
      </section>

      {/* D. Peer benchmarking */}
      <section>
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight">Peer benchmarking</h3>
            <Award className="h-4 w-4 text-primary" />
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {sorted.slice(0, 8).map((d, i) => (
              <div key={d.driver_id} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2">
                    {i === 0 && <Crown className="h-3 w-3 text-warning" />}
                    <span className="truncate">{d.driver_name}</span>
                  </span>
                  <span className="num text-muted-foreground">P{d.percentile}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${d.percentile}%`,
                      background: `linear-gradient(90deg, ${BAND_COLOR[d.risk_band]}, color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 40%, transparent))`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* E. Coaching */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted
          .filter((d) => d.contextual_score < 70)
          .slice(0, 3)
          .map((d) => (
            <InsightCard
              key={d.driver_id}
              icon={GraduationCap}
              tone={d.contextual_score < 50 ? "destructive" : "warning"}
              tag={d.driver_name.split(" ")[0]}
              title={
                d.harsh_braking > d.distraction
                  ? `${d.driver_name}: high braking intensity on congestion-heavy routes`
                  : `${d.driver_name}: distraction spikes on peak-hour difficult routes`
              }
              body={`Contextual score ${fmt(d.contextual_score)} · exposure ${fmt(d.difficulty_exposure)}. Recommend 2-session coaching focused on ${
                d.harsh_braking > d.distraction ? "regen-aware deceleration" : "attentional reset routines"
              }.`}
            />
          ))}
        {sorted
          .filter((d) => d.risk_band === "Elite")
          .slice(0, 2)
          .map((d) => (
            <InsightCard
              key={d.driver_id}
              icon={BadgeCheck}
              tone="success"
              tag={d.driver_name.split(" ")[0]}
              title={`${d.driver_name} sustains elite efficiency on high-altitude routes`}
              body={`Use as benchmark for cohort training; pair as mentor for two at-risk drivers in the same depot.`}
            />
          ))}
        <InsightCard
          icon={Brain}
          title="Cohort-level pattern: peak-hour distraction"
          body="Distraction events rise 38% during 5–7 PM across at-risk drivers. Push proactive nudges 10 minutes before departure."
        />
      </section>

      {open && (
        <DriverDrawer
          d={open}
          extras={extrasById.get(open.driver_id)}
          usingLive={usingLive}
          onClose={() => setOpen(null)}
        />
      )}
    </PageShell>
  );
}

function formatTripDate(iso: string): string {
  const [y, m, day] = iso.split("-");
  if (!y || !m || !day) return iso;
  const dt = new Date(Number(y), Number(m) - 1, Number(day));
  return dt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function formatTripTime(raw: string | null): string {
  if (!raw) return "—";
  const clock = raw.match(/(\d{1,2}):(\d{2})/);
  if (clock && raw.length <= 12) {
    const h = clock[1].padStart(2, "0");
    return `${h}:${clock[2]}`;
  }
  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) {
    return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return raw.slice(0, 5);
}

function tripRouteLabel(t: DriverTripDetailRow): string {
  return t.routeName ?? "—";
}

function tripVehicleLabel(t: DriverTripDetailRow): string {
  return t.vehicleNumber ?? t.busCode ?? "—";
}

function isHighRiskTrip(t: DriverTripDetailRow): boolean {
  return (t.behaviorRiskFlag ?? "").toUpperCase() === "HIGH";
}

function formatWindowSubtitle(from: string, to: string, dayCount: number, tripCount: number): string {
  const part = (iso: string, withYear: boolean) => {
    const [y, mo, d] = iso.split("-");
    const dt = new Date(Number(y), Number(mo) - 1, Number(d));
    return dt.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    });
  };
  const range =
    from.slice(0, 4) === to.slice(0, 4)
      ? `${part(from, false)} – ${part(to, true)}`
      : `${part(from, true)} – ${part(to, true)}`;
  return `${range} · ${dayCount} days · ${tripCount} trips`;
}

function effHeatClass(value: number, windowAvg: number): string {
  if (windowAvg <= 0 || value <= 0) return "";
  const ratio = value / windowAvg;
  if (ratio <= 0.95) return "bg-success/12 text-success font-medium";
  if (ratio >= 1.05) return "bg-warning/12 text-warning font-medium";
  return "";
}

const INLINE_PREVIEW_DAYS = 10;

const tripTableHead = (compact: boolean, align: "text-left" | "text-right" = "text-left") =>
  cn(
    "whitespace-nowrap align-middle font-semibold uppercase tracking-wider text-muted-foreground",
    compact ? "h-8 px-2.5 text-[9.5px]" : "h-9 px-3 text-[10px]",
    align,
  );

const tripTableCell = (compact: boolean, align: "text-left" | "text-right" = "text-left", extra?: string) =>
  cn(
    "align-middle",
    compact ? "px-2.5 py-2" : "px-3 py-2.5",
    align,
    extra,
  );

type DailyTripCol = {
  key: string;
  head: string;
  title: string;
  align: "text-left" | "text-right";
  cell: (r: DriverDailyTripRow, ctx: { windowAvgEff: number }) => ReactNode;
  cellClass?: (r: DriverDailyTripRow, ctx: { windowAvgEff: number }) => string;
};

const DAILY_TRIP_COLS: DailyTripCol[] = [
  {
    key: "date",
    head: "Date",
    title: "Scheduling date",
    align: "text-left",
    cell: (r) => <span className="whitespace-nowrap">{formatTripDate(r.schedulingDate)}</span>,
  },
  {
    key: "trips",
    head: "Trips",
    title: "Trip count",
    align: "text-right",
    cell: (r) => <span className="num tabular-nums">{r.tripCount}</span>,
  },
  {
    key: "dist",
    head: "Distance",
    title: "Total distance (km)",
    align: "text-right",
    cell: (r) => <span className="num tabular-nums">{fmt(r.totalDistanceKm, 0)}</span>,
  },
  {
    key: "eff",
    head: "Eff.",
    title: "Avg efficiency (kWh/km)",
    align: "text-right",
    cell: (r, ctx) => (
      <span className={`num tabular-nums rounded px-1 ${effHeatClass(r.avgEfficiencyKwhPerKm, ctx.windowAvgEff)}`}>
        {fmt(r.avgEfficiencyKwhPerKm, 2)}
      </span>
    ),
  },
  {
    key: "exp",
    head: "Exposure",
    title: "Avg route difficulty score",
    align: "text-right",
    cell: (r) => <span className="num tabular-nums">{fmt(r.avgRouteDifficulty, 0)}</span>,
  },
  {
    key: "dms",
    head: "DMS",
    title: "Total DMS events",
    align: "text-right",
    cell: (r) => <span className="num tabular-nums">{r.dmsEvents}</span>,
  },
  {
    key: "brake",
    head: "Braking",
    title: "Hard braking density /100 km",
    align: "text-right",
    cell: (r) => <span className="num tabular-nums">{fmt(r.avgBrakingDensity, 1)}</span>,
  },
  {
    key: "speed",
    head: "Overspeed",
    title: "Overspeed density /100 km",
    align: "text-right",
    cell: (r) => <span className="num tabular-nums">{fmt(r.avgOverspeedDensity, 1)}</span>,
  },
  {
    key: "distraction",
    head: "Distract.",
    title: "Distraction density /100 km",
    align: "text-right",
    cell: (r) => <span className="num tabular-nums">{fmt(r.avgDistractionDensity, 1)}</span>,
  },
  {
    key: "fatigue",
    head: "Fatigue",
    title: "Fatigue density /100 km",
    align: "text-right",
    cell: (r) => <span className="num tabular-nums">{fmt(r.avgFatigueDensity, 1)}</span>,
  },
  {
    key: "stars",
    head: "Stars",
    title: "Driver star events (positive behavior)",
    align: "text-right",
    cell: (r) => (
      <span className={`num tabular-nums ${r.driverStars > 0 ? "font-medium text-success" : ""}`}>
        {r.driverStars}
      </span>
    ),
  },
  {
    key: "hr",
    head: "High-risk",
    title: "Trips flagged HIGH behavior risk",
    align: "text-right",
    cell: (r) => (
      <span className={`num tabular-nums ${r.highRiskTrips > 0 ? "font-semibold text-destructive" : ""}`}>
        {r.highRiskTrips}
      </span>
    ),
    cellClass: (r) => (r.highRiskTrips > 0 ? "bg-destructive/8" : ""),
  },
];

type TripDetailCol = {
  key: string;
  head: string;
  title: string;
  align: "text-left" | "text-right";
  cell: (t: DriverTripDetailRow, ctx: { windowAvgEff: number }) => ReactNode;
  cellClass?: (t: DriverTripDetailRow, ctx: { windowAvgEff: number }) => string;
};

const TRIP_DETAIL_COLS: TripDetailCol[] = [
  {
    key: "route",
    head: "Route",
    title: "Route name",
    align: "text-left",
    cell: (t) => <span className="whitespace-nowrap">{tripRouteLabel(t)}</span>,
  },
  {
    key: "routeCode",
    head: "Route code",
    title: "route_code",
    align: "text-left",
    cell: (t) => <span className="whitespace-nowrap font-mono text-[0.95em]">{t.routeCode ?? "—"}</span>,
  },
  {
    key: "timeBucket",
    head: "Time bucket",
    title: "time_bucket",
    align: "text-left",
    cell: (t) => <span className="whitespace-nowrap">{t.timeBucket ?? "—"}</span>,
  },
  {
    key: "vehicleSize",
    head: "Vehicle size",
    title: "vehicle_size",
    align: "text-left",
    cell: (t) => <span className="whitespace-nowrap">{t.vehicleSize ?? "—"}</span>,
  },
  {
    key: "vehicle",
    head: "Vehicle",
    title: "Vehicle number or bus code",
    align: "text-left",
    cell: (t) => <span className="whitespace-nowrap">{tripVehicleLabel(t)}</span>,
  },
  {
    key: "start",
    head: "Sched. start",
    title: "trip_start_time",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{formatTripTime(t.tripStartTime)}</span>,
  },
  {
    key: "end",
    head: "Sched. end",
    title: "trip_end_time",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{formatTripTime(t.tripEndTime)}</span>,
  },
  {
    key: "actualStart",
    head: "Actual start",
    title: "actual_trip_start_time",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{formatTripTime(t.actualTripStartTime)}</span>,
  },
  {
    key: "actualEnd",
    head: "Actual end",
    title: "actual_trip_end_time",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{formatTripTime(t.actualTripEndTime)}</span>,
  },
  {
    key: "actualDur",
    head: "Actual dur.",
    title: "actual_trip_duration_min",
    align: "text-right",
    cell: (t) => (
      <span className="num tabular-nums">
        {t.actualTripDurationMin != null && t.actualTripDurationMin > 0 ? `${fmt(t.actualTripDurationMin, 0)}m` : "—"}
      </span>
    ),
  },
  {
    key: "actualDist",
    head: "Actual dist.",
    title: "distance_km_odo_trip",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{fmt(t.actualDistanceKm, 1)}</span>,
  },
  {
    key: "eff",
    head: "Eff.",
    title: "Efficiency (kWh/km)",
    align: "text-right",
    cell: (t, ctx) => (
      <span className={`num tabular-nums rounded px-1 ${effHeatClass(t.kwhPerKm, ctx.windowAvgEff)}`}>
        {fmt(t.kwhPerKm, 2)}
      </span>
    ),
  },
  {
    key: "exp",
    head: "Difficulty",
    title: "route_difficulty_score",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{fmt(t.routeDifficultyScore, 1)}</span>,
  },
  {
    key: "dms",
    head: "DMS",
    title: "Total DMS events",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{t.totalDmsEvents}</span>,
  },
  {
    key: "brake",
    head: "Braking",
    title: "Hard braking density /100 km",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{fmt(t.hardBrakingDensity, 1)}</span>,
  },
  {
    key: "speed",
    head: "Overspeed",
    title: "Overspeed density /100 km",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{fmt(t.overspeedDensity, 1)}</span>,
  },
  {
    key: "distraction",
    head: "Distract.",
    title: "Distraction density /100 km",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{fmt(t.distractionDensity, 1)}</span>,
  },
  {
    key: "fatigue",
    head: "Fatigue",
    title: "Fatigue density /100 km",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{fmt(t.fatigueDensity, 1)}</span>,
  },
  {
    key: "stars",
    head: "Stars",
    title: "Driver star events",
    align: "text-right",
    cell: (t) => (
      <span className={`num tabular-nums ${t.driverStarCount > 0 ? "font-medium text-success" : ""}`}>
        {t.driverStarCount}
      </span>
    ),
  },
  {
    key: "risk",
    head: "Risk",
    title: "Behavior risk flag",
    align: "text-right",
    cell: (t) => (
      <span className={`num tabular-nums uppercase ${isHighRiskTrip(t) ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
        {t.behaviorRiskFlag ?? "—"}
      </span>
    ),
    cellClass: (t) => (isHighRiskTrip(t) ? "bg-destructive/8" : ""),
  },
];

function DriverDayTripDetails({
  driverId,
  schedulingDate,
  windowAvgEff,
  textSize,
  compact,
}: {
  driverId: string;
  schedulingDate: string;
  windowAvgEff: number;
  textSize: string;
  compact: boolean;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["driver_trip_behavior_day", driverId, schedulingDate],
    queryFn: () => fetchDriverTripsForDay(driverId, schedulingDate),
    staleTime: 60_000,
  });
  const ctx = { windowAvgEff };

  const panel = (content: ReactNode) => (
    <div className="mx-2 my-2 overflow-hidden rounded-xl border border-primary/15 bg-linear-to-br from-muted/25 via-card to-card shadow-sm ring-1 ring-border/50 sm:mx-3">
      <div className="flex items-center gap-2 border-b border-border/50 bg-primary/5 px-3 py-2 sm:px-4">
        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/85">
          Trip detail · {formatTripDate(schedulingDate)}
        </span>
        {data?.length != null && !isLoading && !isError && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {data.length} {data.length === 1 ? "trip" : "trips"}
          </span>
        )}
      </div>
      <div className="overflow-x-auto">{content}</div>
    </div>
  );

  if (isLoading) {
    return panel(
      <div className={cn("flex items-center justify-center gap-2 py-8", textSize, "text-muted-foreground")}>
        <Loader2 className="size-4 animate-spin text-primary" />
        Loading trips…
      </div>,
    );
  }
  if (isError) {
    return panel(
      <div className={cn("px-4 py-8 text-center", textSize, "text-destructive")}>
        {error instanceof Error ? error.message : "Failed to load trip details."}
      </div>,
    );
  }
  if (!data?.length) {
    return panel(
      <div className={cn("px-4 py-8 text-center", textSize, "text-muted-foreground")}>
        No trips for this day.
      </div>,
    );
  }

  return panel(
    <table className={cn("w-full min-w-[1120px] caption-bottom", textSize)}>
      <TableHeader className="bg-muted/30 [&_tr]:border-b [&_tr]:border-border/50">
        <TableRow className="border-0 hover:bg-transparent">
          {TRIP_DETAIL_COLS.map((c) => (
            <TableHead key={c.key} title={c.title} className={tripTableHead(compact, c.align)}>
              {c.head}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((t) => (
          <TableRow
            key={t.tripId || `${schedulingDate}-${t.tripStartTime}`}
            className={cn(
              "border-border/40 transition-colors",
              isHighRiskTrip(t) ? "bg-destructive/5 hover:bg-destructive/8" : "hover:bg-muted/35",
            )}
          >
            {TRIP_DETAIL_COLS.map((c) => (
              <TableCell
                key={c.key}
                className={tripTableCell(compact, c.align, c.cellClass?.(t, ctx))}
              >
                {c.cell(t, ctx)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </table>,
  );
}

function DriverDailyTripsTable({
  driverId,
  rows,
  expandedDate,
  onToggleDate,
  minWidth = "min-w-[880px]",
  textSize = "text-[11px]",
  compact = false,
}: {
  driverId: string;
  rows: DriverDailyTripRow[];
  expandedDate: string | null;
  onToggleDate: (schedulingDate: string) => void;
  minWidth?: string;
  textSize?: string;
  compact?: boolean;
}) {
  const windowAvgEff =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.avgEfficiencyKwhPerKm * r.tripCount, 0)
        / Math.max(1, rows.reduce((s, r) => s + r.tripCount, 0))
      : 0;
  const ctx = { windowAvgEff };

  return (
    <table className={cn("w-full caption-bottom", minWidth, textSize)}>
      <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm [&_tr]:border-b [&_tr]:border-border/60">
        <TableRow className="border-0 hover:bg-transparent">
          <TableHead className={cn(tripTableHead(compact), "w-9")} aria-label="Expand" />
          {DAILY_TRIP_COLS.map((c) => (
            <TableHead key={c.key} title={c.title} className={tripTableHead(compact, c.align)}>
              {c.head}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const open = expandedDate === r.schedulingDate;
          return (
            <Fragment key={r.schedulingDate}>
              <TableRow
                role="button"
                tabIndex={0}
                data-state={open ? "selected" : undefined}
                onClick={() => onToggleDate(r.schedulingDate)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleDate(r.schedulingDate);
                  }
                }}
                className={cn(
                  "cursor-pointer border-border/40 transition-colors",
                  open
                    ? "border-l-2 border-l-primary bg-primary/6 hover:bg-primary/8"
                    : "hover:bg-muted/40",
                )}
              >
                <TableCell className={tripTableCell(compact)}>
                  <ChevronRight
                    className={cn(
                      "size-4 text-muted-foreground transition-transform duration-200",
                      open && "rotate-90 text-primary",
                    )}
                  />
                </TableCell>
                {DAILY_TRIP_COLS.map((c) => (
                  <TableCell
                    key={c.key}
                    className={tripTableCell(compact, c.align, c.cellClass?.(r, ctx))}
                  >
                    {c.cell(r, ctx)}
                  </TableCell>
                ))}
              </TableRow>
              {open && (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={DAILY_TRIP_COLS.length + 1} className="p-0">
                    <DriverDayTripDetails
                      driverId={driverId}
                      schedulingDate={r.schedulingDate}
                      windowAvgEff={windowAvgEff}
                      textSize={textSize}
                      compact={compact}
                    />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </table>
  );
}

function DriverDailyTripsSection({
  driverId,
  driverName,
  enabled,
  extras,
}: {
  driverId: string;
  driverName: string;
  enabled: boolean;
  extras?: DriverLeaderboardExtras;
}) {
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const toggleDate = (schedulingDate: string) =>
    setExpandedDate((prev) => (prev === schedulingDate ? null : schedulingDate));

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "driver_trip_behavior_fact",
      driverId,
      extras?.windowEndDate,
      extras?.snapshotDate,
    ],
    queryFn: async () => {
      const anchorDate = await resolveDriverTripBehaviorAnchor(driverId, extras);
      const window = computeTripBehaviorWindow(anchorDate);
      const rows = await fetchDriverTripBehavior(driverId, TRIP_BEHAVIOR_WINDOW_DAYS + 1, window);
      return { rows, anchorDate, window };
    },
    enabled,
    staleTime: 60_000,
  });

  const rows = data?.rows ?? [];
  const window = data?.window;
  const previewRows = rows.length > INLINE_PREVIEW_DAYS ? rows.slice(-INLINE_PREVIEW_DAYS) : rows;
  const totalTrips = rows.reduce((s, r) => s + r.tripCount, 0);
  const windowSubtitle = window ? formatWindowSubtitle(window.fromDate, window.toDate, rows.length, totalTrips) : null;
  const modalTitle = `${driverName} — Daily trip behavior — last ${TRIP_BEHAVIOR_WINDOW_DAYS} days`;

  async function handleExport() {
    if (exporting || rows.length === 0 || !window) return;
    setExporting(true);
    try {
      const tripRows = await fetchDriverTripDetails(driverId, window);
      const dateSpan = `${window.fromDate} → ${window.toDate}`;
      await exportDriverTrips(driverName, tripRows, { dailySummary: rows, dateSpan });
      toast.success(`Exported ${tripRows.length} trips (${rows.length} days) to Excel.`);
    } catch (err) {
      console.error("Trip export failed", err);
      toast.error("Trip export failed.");
    } finally {
      setExporting(false);
    }
  }

  const headerActions = rows.length > 0 && (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2 py-1 text-[10.5px] font-medium text-foreground transition-colors hover:bg-muted/40"
        title="Expand daily trips"
      >
        <Maximize2 className="h-3 w-3" />
        Expand
      </button>
      <button
        type="button"
        onClick={() => handleExport()}
        disabled={exporting}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2 py-1 text-[10.5px] font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-60"
      >
        {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSpreadsheet className="h-3 w-3" />}
        Export trips
      </button>
    </div>
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Daily trip behavior</div>
          {windowSubtitle && (
            <div className="mt-0.5 text-[10.5px] text-muted-foreground/90">{windowSubtitle}</div>
          )}
        </div>
        {headerActions}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" /> Loading daily trips…
          </div>
        ) : isError ? (
          <div className="px-4 py-8 text-center text-[12px] text-destructive">
            {error instanceof Error ? error.message : "Failed to load daily trip data."}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
            No daily trip data for this driver in the last {TRIP_BEHAVIOR_WINDOW_DAYS} days.
          </div>
        ) : (
          <div className="max-h-52 overflow-x-auto overflow-y-auto">
            <DriverDailyTripsTable
              driverId={driverId}
              rows={previewRows}
              expandedDate={expandedDate}
              onToggleDate={toggleDate}
              compact
            />
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <p className="mt-1.5 text-[10.5px] text-muted-foreground">
          {rows.length > INLINE_PREVIEW_DAYS
            ? `Showing ${previewRows.length} of ${rows.length} days`
            : `${rows.length} days`}
          {" · "}
          {totalTrips} trips · click a day for trip detail · driver_trip_behavior_fact
        </p>
      )}

      <Dialog open={expanded} onOpenChange={(open) => { setExpanded(open); if (!open) setExpandedDate(null); }}>
        <DialogContent className="flex max-h-[92vh] w-[min(98vw,80rem)] max-w-[80rem] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-12 text-left">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-[15px] font-semibold tracking-tight">{modalTitle}</DialogTitle>
                {windowSubtitle && (
                  <p className="mt-1 text-[12px] text-muted-foreground">{windowSubtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleExport()}
                disabled={exporting || rows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-60"
              >
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                Export trips
              </button>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5">
            {rows.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                <DriverDailyTripsTable
                  driverId={driverId}
                  rows={rows}
                  expandedDate={expandedDate}
                  onToggleDate={toggleDate}
                  minWidth="min-w-[960px]"
                  textSize="text-[12px]"
                />
              </div>
            ) : (
              <p className="py-8 text-center text-[12px] text-muted-foreground">No daily trip data.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DriverDrawer({
  d, extras, usingLive, onClose,
}: {
  d: DriverScore;
  extras?: DriverLeaderboardExtras;
  usingLive: boolean;
  onClose: () => void;
}) {
  const evo = d.score_evolution.map((v, i) => ({ wk: `W${i + 1}`, score: v }));
  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-border/60 bg-card shadow-elevated animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-semibold"
              style={{ background: `color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 18%, var(--color-card))`, color: BAND_COLOR[d.risk_band] }}>
              {d.driver_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-tight">{d.driver_name}</div>
              <div className="text-[11.5px] text-muted-foreground">{d.company_name} · {d.trips_30d} trips · P{d.percentile}</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Score</div>
              <div className="num text-[22px] font-semibold">{fmt(d.contextual_score)}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Eff.</div>
              <div className="num text-[22px] font-semibold">{fmt(d.efficiency_kwh_per_km, 2)}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Exposure</div>
              <div className="num text-[22px] font-semibold">{fmt(d.difficulty_exposure, 0)}</div>
            </div>
          </div>
          {extras && (
            <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Coaching & risk</div>
                <div className="flex items-center gap-1.5">
                  {extras.incentiveEligible && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                      <Award className="h-3 w-3" /> Incentive
                    </span>
                  )}
                  {extras.reviewRequired && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                      <ShieldAlert className="h-3 w-3" /> Review
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                {extras.dominantRisk && (
                  <div className="col-span-2 flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                    <span className="text-muted-foreground">Dominant risk</span>
                    <span className="font-medium capitalize">{extras.dominantRisk.replace(/_/g, " ")}</span>
                  </div>
                )}
                {extras.coachingModule && (
                  <div className="col-span-2 flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                    <span className="text-muted-foreground">Coaching module</span>
                    <span className="font-medium capitalize">{extras.coachingModule.replace(/_/g, " ")}</span>
                  </div>
                )}
                {extras.coachingTrigger && (
                  <div className="col-span-2 rounded-lg bg-muted/25 px-2.5 py-1.5">
                    <div className="text-muted-foreground">Trigger</div>
                    <div className="mt-0.5 text-[11.5px] font-medium capitalize">{extras.coachingTrigger.replace(/_/g, " ")}</div>
                  </div>
                )}
                {extras.starsPerTripWeighted != null && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                    <span className="inline-flex items-center gap-1 text-muted-foreground"><Star className="h-3 w-3" /> Stars/trip</span>
                    <span className="num font-medium">{fmt(extras.starsPerTripWeighted, 2)}</span>
                  </div>
                )}
                {extras.highRiskRatio != null && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                    <span className="text-muted-foreground">High-risk</span>
                    <span className="num font-medium">{fmt(extras.highRiskRatio * 100, 0)}%</span>
                  </div>
                )}
                {extras.peerScoreCoveragePct != null && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                    <span className="text-muted-foreground">Peer coverage</span>
                    <span className="num font-medium">{fmt(extras.peerScoreCoveragePct, 0)}%</span>
                  </div>
                )}
                {extras.tripsScored != null && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                    <span className="text-muted-foreground">Trips scored</span>
                    <span className="num font-medium">{extras.tripsScored}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <div>
            <div className="mb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">12-week score evolution</div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evo} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
                  <XAxis dataKey="wk" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} domain={[20, 100]} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" stroke={BAND_COLOR[d.risk_band]} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">Behavior fingerprint</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Harsh braking", d.harsh_braking, "var(--color-destructive)"],
                ["Harsh accel", d.harsh_accel, "var(--color-warning)"],
                ["Overspeed", d.overspeed, "var(--color-chart-3)"],
                ["Distraction", d.distraction, "var(--color-chart-4)"],
                ["Drowsiness", d.drowsiness, "var(--color-chart-2)"],
                ["Phone use", d.phone_use, "var(--color-chart-5)"],
              ].map(([k, v, c]) => (
                <div key={k as string} className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{k as string}</span>
                    <span className="num">{fmt(v as number)}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/50">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (v as number) * 2)}%`, background: c as string }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {usingLive && (
            <DriverDailyTripsSection
              driverId={d.driver_id}
              driverName={d.driver_name}
              enabled={usingLive}
              extras={extras}
            />
          )}
        </div>
      </aside>
    </>
  );
}
