import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award, ChevronRight, Crown, FileSpreadsheet, GraduationCap, Loader2, Maximize2, ShieldAlert,
  TrendingDown, TrendingUp, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area, AreaChart, CartesianGrid,
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
import type { DriverScore } from "@/lib/fleet-data";
import {
  ATTRIBUTE_PILLAR_MAX,
  fetchDriverAttributeScoreMonths,
  fetchDriverAttributeScores,
  formatAttributeMonth,
  type DriverAttributeLeaderboardEntry,
  type DriverAttributeScoreRow,
} from "@/lib/graphql/driver-attribute-score";
import {
  computeTripBehaviorWindow,
  fetchDriverTripBehavior,
  fetchDriverTripDetailsForExport,
  fetchDriverTripsForDay,
  resolveDriverTripBehaviorAnchor,
  TRIP_BEHAVIOR_WINDOW_DAYS,
  type DriverDailyTripRow,
  type DriverTripDetailRow,
} from "@/lib/graphql/driver-trip-behavior";
import { fetchFilterOptions } from "@/lib/graphql/filter-options";
import { DEFAULT_FILTERS, type Filters } from "@/lib/analytics";
import { exportAttributeScoreWorkbook } from "@/lib/export/driver-attribute-excel";
import { exportDriverTrips } from "@/lib/export/driver-daily-excel";
import { formatUtcTripDate, formatUtcTripDateShort, formatUtcTripTime } from "@/lib/driver-trip-datetime";

export const Route = createFileRoute("/drivers")({
  head: () => ({
    meta: [
      { title: "Driver Intelligence · Voltline" },
      { name: "description", content: "Monthly Driver Attribute Score leaderboard — attendance, accidents, ADAS, energy and mobile." },
      { property: "og:title", content: "Driver Intelligence · Voltline" },
      { property: "og:description", content: "Ranked by driver_attribute_score with full pillar mark breakdown." },
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

const GRADE_BAND_STYLE: Record<string, { bg: string; text: string }> = {
  A: { bg: "color-mix(in oklab, var(--color-success) 15%, transparent)", text: "var(--color-success)" },
  B: { bg: "color-mix(in oklab, var(--color-primary) 15%, transparent)", text: "var(--color-primary)" },
  C: { bg: "color-mix(in oklab, var(--color-chart-2) 15%, transparent)", text: "var(--color-chart-2)" },
  D: { bg: "color-mix(in oklab, var(--color-warning) 15%, transparent)", text: "var(--color-warning)" },
};

function ScoreBandBadge({ band, size = "sm" }: { band: string | null | undefined; size?: "sm" | "md" }) {
  if (!band) return <span className="text-muted-foreground">—</span>;
  const letter = band.trim().charAt(0).toUpperCase();
  const style = GRADE_BAND_STYLE[letter];
  const riskColor = BAND_COLOR[band as DriverScore["risk_band"]];
  const bg = style?.bg ?? (riskColor ? `color-mix(in oklab, ${riskColor} 15%, transparent)` : "var(--color-muted)");
  const color = style?.text ?? riskColor ?? "var(--color-foreground)";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold uppercase tracking-wider",
        size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]",
      )}
      style={{ background: bg, color }}
    >
      {band}
    </span>
  );
}

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

type FilterKind = "excellent" | "weakness" | "poor";

const FILTER_META: Record<FilterKind, { accent: string; tone: string; blurb: string; Icon: typeof Award }> = {
  excellent: {
    accent: "var(--color-success)",
    tone: "text-success",
    blurb: "Drivers rated Excellent on the monthly Attribute Score.",
    Icon: Award,
  },
  weakness: {
    accent: "var(--color-warning)",
    tone: "text-warning",
    blurb: "Drivers with a dominant weakness and marks lost this month.",
    Icon: GraduationCap,
  },
  poor: {
    accent: "var(--color-destructive)",
    tone: "text-destructive",
    blurb: "Drivers rated Poor — priority for review and coaching.",
    Icon: ShieldAlert,
  },
};

const PILLAR_META: { key: keyof typeof ATTRIBUTE_PILLAR_MAX; label: string; color: string }[] = [
  { key: "accidents", label: "Accidents", color: "#ef4444" },
  { key: "soc", label: "soc/km", color: "#2dd4bf" },
  { key: "adas", label: "ADAS", color: "#5B8CFF" },
  { key: "attendance", label: "Attendance", color: "#f59e0b" },
  { key: "mobile", label: "Mobile", color: "#a855f7" },
  { key: "alcohol", label: "Alcohol", color: "#94a3b8" },
];

function FilterDetailPanel({
  filter, label, entries, onClose, onOpen,
}: {
  filter: FilterKind;
  label: string;
  entries: DriverAttributeLeaderboardEntry[];
  onClose: () => void;
  onOpen: (d: DriverAttributeLeaderboardEntry) => void;
}) {
  const meta = FILTER_META[filter];
  const cols: { key: string; head: string; cell: (e: DriverAttributeLeaderboardEntry) => ReactNode; align?: string }[] = [
    { key: "score", head: "Attribute score", cell: (e) => <span className="num">{fmt(e.attribute.totalAttributeScore)}</span>, align: "text-right" },
    { key: "rating", head: "Rating", cell: (e) => <ScoreBandBadge band={e.attribute.rating} /> },
    { key: "weak", head: "Weakness", cell: (e) => <span className="capitalize">{(e.attribute.dominantWeakness ?? "None").replace(/_/g, " ")}</span> },
    { key: "lost", head: "Marks lost", cell: (e) => <span className="num">{fmt(e.attribute.marksLost, 0)}</span>, align: "text-right" },
    { key: "trips", head: "Trips", cell: (e) => <span className="num">{e.attribute.tripsInMonth}</span>, align: "text-right" },
    { key: "soc", head: "soc/km", cell: (e) => <span className="num">{fmt(e.attribute.socPerKm, 3)}</span>, align: "text-right" },
    { key: "att", head: "Attendance", cell: (e) => <span className="num">{fmt(e.attribute.attendancePct, 0)}%</span>, align: "text-right" },
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
                    <span className="num font-semibold text-muted-foreground">{e.attribute.rank ?? "—"}</span>
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

function DriverCard({ d, onOpen }: {
  d: DriverAttributeLeaderboardEntry; onOpen: () => void;
}) {
  const a = d.attribute;
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
            <span className="absolute -left-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
              {a.rank}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[13.5px] font-semibold tracking-tight">{d.driver_name}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {d.company_name} · {a.tripsInMonth} trips · {fmt(a.attendancePct, 0)}% att.
            </div>
          </div>
        </div>
        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] uppercase tracking-wider"
          style={{ background: `color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 15%, transparent)`, color: BAND_COLOR[d.risk_band] }}>
          {a.rating}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Attribute score</div>
          <div className="num text-[22px] font-semibold tracking-tight">{fmt(a.totalAttributeScore, 0)}</div>
          <div className="text-[11px] num text-muted-foreground">
            {a.marksLost > 0 ? `${fmt(a.marksLost, 0)} marks lost` : "Full marks"}
            {a.dominantWeakness && a.dominantWeakness !== "None"
              ? ` · ${a.dominantWeakness}`
              : ""}
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <div className="num text-foreground">{fmt(a.socPerKm, 3)}</div>
          <div>soc/km</div>
        </div>
      </div>
    </button>
  );
}

function DriverIntelligencePage() {
  const [open, setOpen] = useState<DriverAttributeLeaderboardEntry | null>(null);
  const [sort, setSort] = useState<"score" | "efficiency" | "trips">("score");
  const [filter, setFilter] = useState<FilterKind | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: filterOptions } = useQuery({
    queryKey: ["filter_options"],
    queryFn: fetchFilterOptions,
  });

  const { data: months } = useQuery({
    queryKey: ["driver_attribute_score_months"],
    queryFn: fetchDriverAttributeScoreMonths,
  });

  const activeMonth = selectedMonth ?? (months?.[0] ? { year: months[0].year, month: months[0].month } : null);

  const { data: liveEntries, isLoading, error } = useQuery({
    queryKey: ["driver_attribute_score", activeMonth?.year, activeMonth?.month],
    queryFn: () => fetchDriverAttributeScores(activeMonth!.year, activeMonth!.month, 200),
    enabled: !!activeMonth,
  });

  const usingLive = (liveEntries?.length ?? 0) > 0;
  const allDrivers: DriverAttributeLeaderboardEntry[] = usingLive ? liveEntries! : [];

  const drivers = useMemo(
    () =>
      allDrivers.filter((d) => {
        if (filters.companies.length && !filters.companies.includes(d.company_name)) return false;
        if (filters.drivers.length && !filters.drivers.includes(d.driver_name)) return false;
        return true;
      }),
    [allDrivers, filters.companies, filters.drivers],
  );

  const sorted = useMemo(() => {
    const arr = [...drivers];
    if (sort === "score") {
      arr.sort((a, b) => a.attribute.rank - b.attribute.rank);
    }
    if (sort === "efficiency") arr.sort((a, b) => a.attribute.socPerKm - b.attribute.socPerKm);
    if (sort === "trips") arr.sort((a, b) => b.attribute.tripsInMonth - a.attribute.tripsInMonth);
    return arr;
  }, [sort, drivers]);

  const excellentCount = drivers.filter((d) => /excellent/i.test(d.attribute.rating)).length;
  const poorCount = drivers.filter((d) => /poor/i.test(d.attribute.rating)).length;
  const weaknessCount = drivers.filter(
    (d) => d.attribute.dominantWeakness && d.attribute.dominantWeakness !== "None" && d.attribute.marksLost > 0,
  ).length;
  const avgScore = drivers.length
    ? drivers.reduce((s, d) => s + d.attribute.totalAttributeScore, 0) / drivers.length
    : 0;
  const avgSoc = drivers.length
    ? drivers.reduce((s, d) => s + d.attribute.socPerKm, 0) / drivers.length
    : 0;

  const toggleFilter = (f: FilterKind) => setFilter((prev) => (prev === f ? null : f));

  const FILTER_LABEL: Record<FilterKind, string> = {
    excellent: "Excellent",
    weakness: "Has weakness",
    poor: "Poor rating",
  };

  const filterMatches = useMemo(() => {
    if (!usingLive || !filter) return [] as DriverAttributeLeaderboardEntry[];
    const list = drivers.filter((e) => {
      if (filter === "excellent") return /excellent/i.test(e.attribute.rating);
      if (filter === "poor") return /poor/i.test(e.attribute.rating);
      return !!(e.attribute.dominantWeakness && e.attribute.dominantWeakness !== "None" && e.attribute.marksLost > 0);
    });
    return list.sort((a, b) => a.attribute.rank - b.attribute.rank);
  }, [drivers, filter, usingLive]);

  const monthLabel = activeMonth
    ? formatAttributeMonth(activeMonth.year, activeMonth.month)
    : "—";

  async function handleExport() {
    if (exporting) return;
    const rows = drivers;
    if (!activeMonth || rows.length === 0) {
      toast.error("No attribute scores to export for this month.");
      return;
    }
    setExporting(true);
    try {
      await exportAttributeScoreWorkbook(rows, activeMonth.year, activeMonth.month);
      toast.success(`Exported ${rows.length} drivers · ${monthLabel}`);
    } catch (err) {
      console.error("Attribute score export failed", err);
      toast.error("Excel export failed. Check the console for details.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageShell
      eyebrow={`MBMT · Attribute Score · ${monthLabel}`}
      title="Driver Intelligence"
      description="Monthly Driver Attribute Score — attendance, accidents, ADAS behaviour, energy efficiency, mobile & alcohol."
      meta={
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || !usingLive}
          className="inline-flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-[13px] font-medium text-success shadow-elevated transition-all hover:-translate-y-0.5 hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          {exporting ? "Preparing…" : "Download report"}
        </button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          options={filterOptions}
          show={{ date: false, company: true, driver: true, route: false, vehicle: false }}
        />
        {months && months.length > 0 && (
          <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card/70 p-1">
            {months.map((m) => {
              const active = activeMonth?.year === m.year && activeMonth?.month === m.month;
              return (
                <button
                  key={`${m.year}-${m.month}`}
                  type="button"
                  onClick={() => setSelectedMonth({ year: m.year, month: m.month })}
                  className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m.label}
                  <span className="ml-1 opacity-70">({m.count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* A. Command center */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MiniStat label="Avg attribute score" value={fmt(avgScore, 0)} unit="/100" hint={`${drivers.length} scored drivers`} />
        <MiniStat label="Excellent" value={String(excellentCount)} tone="success" hint="Top rating" onClick={() => toggleFilter("excellent")} active={filter === "excellent"} />
        <MiniStat label="Has weakness" value={String(weaknessCount)} tone="warning" hint="Marks lost this month" onClick={() => toggleFilter("weakness")} active={filter === "weakness"} />
        <MiniStat label="Poor" value={String(poorCount)} tone="destructive" hint="Priority review" onClick={() => toggleFilter("poor")} active={filter === "poor"} />
        <MiniStat label="Avg soc/km" value={fmt(avgSoc, 3)} hint="Fleet energy intensity" />
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
              <h2 className="text-[16px] font-semibold tracking-tight">Attribute score leaderboard</h2>
              {usingLive && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-inset ring-success/20">
                  driver_attribute_score
                </span>
              )}
              {!usingLive && error && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                  Failed to load
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-muted-foreground">
              Ranked by monthly Attribute Score ({monthLabel}). Click a driver for pillar breakdown.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/70 p-0.5">
              {([
                ["score", "Rank"],
                ["efficiency", "soc/km"],
                ["trips", "Trips"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className={`rounded-md px-2.5 py-1 text-[11.5px] transition-colors ${
                    sort === key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
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
                  onOpen={() => setOpen(d)}
                />
              ))}
        </div>
        {!isLoading && !usingLive && !error && (
          <p className="py-8 text-center text-[13px] text-muted-foreground">
            No attribute scores for {monthLabel}.
          </p>
        )}
      </section>

      {/* D. Peer benchmarking */}
      <section>
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight">Top scores · {monthLabel}</h3>
            <Award className="h-4 w-4 text-primary" />
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {sorted.slice(0, 8).map((d, i) => (
              <div key={d.driver_id} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2">
                    {i === 0 && <Crown className="h-3 w-3 text-warning" />}
                    <span className="truncate">#{d.attribute.rank} {d.driver_name}</span>
                  </span>
                  <span className="num text-muted-foreground">{fmt(d.attribute.totalAttributeScore, 0)} · {d.attribute.rating}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${d.attribute.totalAttributeScore}%`,
                      background: `linear-gradient(90deg, ${BAND_COLOR[d.risk_band]}, color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 40%, transparent))`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* E. Coaching from weakness */}
      <section className="space-y-3">
        <h2 className="text-[16px] font-semibold tracking-tight">Coaching from attribute weakness</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sorted
            .filter((d) => d.attribute.marksLost > 0 && d.attribute.dominantWeakness && d.attribute.dominantWeakness !== "None")
            .slice(0, 6)
            .map((d) => (
              <InsightCard
                key={d.driver_id}
                icon={GraduationCap}
                tone={d.attribute.totalAttributeScore < 60 ? "destructive" : "warning"}
                tag={d.attribute.rating}
                title={d.driver_name}
                body={`Attribute ${fmt(d.attribute.totalAttributeScore, 0)}/100 · dominant weakness: ${d.attribute.dominantWeakness} (−${fmt(d.attribute.weaknessMarksLost, 0)} marks).`}
              />
            ))}
          {sorted.every((d) => !d.attribute.marksLost || !d.attribute.dominantWeakness || d.attribute.dominantWeakness === "None") && (
            <p className="text-[13px] text-muted-foreground col-span-full">No coaching flags for this month — all eligible drivers clean, or no weakness labelled.</p>
          )}
        </div>
      </section>

      {open && (
        <DriverDrawer
          d={open}
          usingLive={usingLive}
          onClose={() => setOpen(null)}
        />
      )}
    </PageShell>
  );
}

/* Trip behaviour tables below — unchanged; drawer uses attribute breakdown. */

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
  const part = (iso: string, withYear: boolean) => formatUtcTripDateShort(iso, withYear);
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
    cell: (r) => <span className="whitespace-nowrap">{formatUtcTripDate(r.schedulingDate)}</span>,
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
    key: "driverScore",
    head: "Driver score",
    title: "Avg contextual driver score (route-adjusted)",
    align: "text-right",
    cell: (r) => (
      <span className="num tabular-nums">{r.avgContextualDriverScore > 0 ? fmt(r.avgContextualDriverScore) : "—"}</span>
    ),
  },
  {
    key: "drivingScore",
    head: "Driving score",
    title: "Avg peer-ranked driving score",
    align: "text-right",
    cell: (r) => (
      <span className="num tabular-nums">{r.avgDrivingScore > 0 ? `${r.avgDrivingScore}%` : "—"}</span>
    ),
  },
  {
    key: "dms",
    head: "Alerts",
    title: "Total DMS alert events",
    align: "text-right",
    cell: (r) => (
      <span className={`num tabular-nums ${r.dmsEvents > 0 ? "font-medium text-warning" : ""}`}>
        {r.dmsEvents}
      </span>
    ),
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
    cell: (t) => <span className="num tabular-nums">{formatUtcTripTime(t.tripStartTime)}</span>,
  },
  {
    key: "end",
    head: "Sched. end",
    title: "trip_end_time",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{formatUtcTripTime(t.tripEndTime)}</span>,
  },
  {
    key: "actualStart",
    head: "Actual start",
    title: "actual_trip_start_time",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{formatUtcTripTime(t.actualTripStartTime)}</span>,
  },
  {
    key: "actualEnd",
    head: "Actual end",
    title: "actual_trip_end_time",
    align: "text-right",
    cell: (t) => <span className="num tabular-nums">{formatUtcTripTime(t.actualTripEndTime)}</span>,
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
    key: "driverScore",
    head: "Driver score",
    title: "contextual_driver_score",
    align: "text-right",
    cell: (t) => (
      <span className="num tabular-nums">
        {t.contextualDriverScore != null && t.contextualDriverScore > 0 ? fmt(t.contextualDriverScore) : "—"}
      </span>
    ),
  },
  {
    key: "drivingScore",
    head: "Driving score",
    title: "peer_percentile",
    align: "text-right",
    cell: (t) => (
      <span className="num tabular-nums">{t.drivingScore > 0 ? `${t.drivingScore}%` : "—"}</span>
    ),
  },
  {
    key: "band",
    head: "Band",
    title: "driver_score_band",
    align: "text-left",
    cell: (t) => <ScoreBandBadge band={t.driverScoreBand} />,
  },
  {
    key: "dms",
    head: "Alerts",
    title: "total_dms_events",
    align: "text-right",
    cell: (t) => (
      <span className={`num tabular-nums ${t.totalDmsEvents > 0 ? "font-medium text-warning" : ""}`}>
        {t.totalDmsEvents}
      </span>
    ),
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
  const trips = data?.rows ?? [];
  const ctx = { windowAvgEff };

  useEffect(() => {
    if (data?.storageError) {
      toast.warning(
        data.message ?? `Could not load trips for ${formatUtcTripDate(schedulingDate)}.`,
      );
    }
  }, [data?.storageError, data?.message, schedulingDate]);

  const panel = (content: ReactNode) => (
    <div className="mx-2 my-2 overflow-hidden rounded-xl border border-primary/15 bg-linear-to-br from-muted/25 via-card to-card shadow-sm ring-1 ring-border/50 sm:mx-3">
      <div className="flex items-center gap-2 border-b border-border/50 bg-primary/5 px-3 py-2 sm:px-4">
        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/85">
          Trip detail · {formatUtcTripDate(schedulingDate)}
        </span>
        {trips.length != null && !isLoading && !isError && !data?.storageError && (
          <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {trips.length} {trips.length === 1 ? "trip" : "trips"}
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
  if (data?.storageError) {
    return panel(
      <div className={cn("px-4 py-8 text-center", textSize, "text-warning")}>
        {data.message ?? "Trip data for this day is temporarily unavailable."}
      </div>,
    );
  }
  if (!trips.length) {
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
        {trips.map((t) => (
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
  extras?: { windowEndDate?: string | null; snapshotDate?: string | null };
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
      const result = await fetchDriverTripBehavior(driverId, TRIP_BEHAVIOR_WINDOW_DAYS + 1, window);
      return { ...result, anchorDate, window };
    },
    enabled,
    staleTime: 60_000,
  });

  const rows = data?.rows ?? [];
  const window = data?.window;
  const tripWarning = data?.warning;
  const previewRows = rows.length > INLINE_PREVIEW_DAYS ? rows.slice(-INLINE_PREVIEW_DAYS) : rows;
  const totalTrips = rows.reduce((s, r) => s + r.tripCount, 0);
  const totalAlerts = rows.reduce((s, r) => s + r.dmsEvents, 0);
  const windowSubtitle = window
    ? `${formatWindowSubtitle(window.fromDate, window.toDate, rows.length, totalTrips)} · ${totalAlerts} alerts`
    : null;
  const modalTitle = `${driverName} — Daily trip behavior — last ${TRIP_BEHAVIOR_WINDOW_DAYS} days`;

  useEffect(() => {
    if (tripWarning) toast.warning(tripWarning);
  }, [tripWarning]);

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : "Failed to load daily trip data.");
    }
  }, [isError, error]);

  async function handleExport() {
    if (exporting || rows.length === 0 || !window) return;
    setExporting(true);
    try {
      const { rows: tripRows, partial, failedDates } = await fetchDriverTripDetailsForExport(
        driverId,
        rows,
        window,
      );
      if (tripRows.length === 0) {
        toast.error("No trip-level rows found for export in this window.");
        return;
      }
      const dateSpan = `${window.fromDate} → ${window.toDate}`;
      await exportDriverTrips(driverName, tripRows, { dailySummary: rows, dateSpan });
      if (partial && failedDates?.length) {
        toast.warning(
          `Exported ${tripRows.length} trips; ${failedDates.length} day(s) skipped due to storage errors.`,
        );
      } else {
        toast.success(`Exported ${tripRows.length} trips (${rows.length} days) to Excel.`);
      }
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
      {tripWarning && (
        <div className="mb-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
          {tripWarning}
        </div>
      )}
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

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

function pillarOutcome(a: DriverAttributeScoreRow, key: keyof typeof ATTRIBUTE_PILLAR_MAX): string {
  switch (key) {
    case "accidents":
      if (a.majorAccidentCount > 0) return `${a.majorAccidentCount} major → hard zero`;
      if (a.accidentCount === 0) return "No accidents";
      return `${a.accidentCount} minor accident${a.accidentCount === 1 ? "" : "s"}`;
    case "soc":
      return a.socExcessPct <= 0
        ? `At/below route avg (${fmt(a.socPerKm, 3)} soc/km)`
        : `${fmt(a.socExcessPct, 1)}% above route avg`;
    case "adas":
      return `Brake ${fmt(a.hardBrakingScore, 1)}/7 · Accel ${fmt(a.hardAccelScore, 0)}/7 · Seatbelt ${fmt(a.seatbeltScore, 0)}/6`;
    case "attendance":
      return `${fmt(a.attendancePct, 1)}% of ${a.workingDays}-day month`;
    case "mobile":
      return `${a.mobileEvents} phone event${a.mobileEvents === 1 ? "" : "s"}`;
    case "alcohol":
      return "Placeholder — full marks";
    default:
      return "";
  }
}

function DriverDrawer({
  d, usingLive, onClose,
}: {
  d: DriverAttributeLeaderboardEntry;
  usingLive: boolean;
  onClose: () => void;
}) {
  const a = d.attribute;
  const monthLabel = formatAttributeMonth(a.year, a.month);
  const tripAnchor = lastDayOfMonth(a.year, a.month);

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
              <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <span>#{a.rank} · {d.company_name} · {monthLabel} · {a.tripsInMonth} trips</span>
                <ScoreBandBadge band={a.rating} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Attribute score</div>
              <div className="num text-[22px] font-semibold">{fmt(a.totalAttributeScore, 0)}</div>
              <div className="text-[10px] text-muted-foreground">/ 100 · monthly</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Rating</div>
              <div className="mt-1"><ScoreBandBadge band={a.rating} size="md" /></div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Marks lost</div>
              <div className="num text-[22px] font-semibold">{fmt(a.marksLost, 0)}</div>
              <div className="text-[10px] text-muted-foreground truncate">{a.dominantWeakness ?? "None"}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">soc/km</div>
              <div className="num text-[22px] font-semibold">{fmt(a.socPerKm, 3)}</div>
              <div className="text-[10px] text-muted-foreground">{fmt(a.kmInMonth, 0)} km</div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
            <div className="mb-3 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              How marks were calculated · {monthLabel}
            </div>
            <div className="space-y-3">
              {PILLAR_META.map((p) => {
                const marks = a.pillars[p.key];
                const max = ATTRIBUTE_PILLAR_MAX[p.key];
                const pct = max > 0 ? Math.min(100, (marks / max) * 100) : 0;
                return (
                  <div key={p.key}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="font-medium">{p.label}</span>
                      <span className="num text-muted-foreground">
                        {fmt(marks, marks % 1 === 0 ? 0 : 1)}
                        <span className="text-muted-foreground/70"> / {max}</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{pillarOutcome(a, p.key)}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-[13px]">
              <span className="text-muted-foreground">Sum of pillars</span>
              <span className="num text-[16px] font-semibold">{fmt(a.totalAttributeScore, 0)} / 100</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
            <div className="mb-3 text-[10.5px] uppercase tracking-wider text-muted-foreground">Month activity</div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                <span className="text-muted-foreground">Attendance</span>
                <span className="num font-medium">{fmt(a.attendancePct, 0)}%</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                <span className="text-muted-foreground">Duties</span>
                <span className="num font-medium">{a.dutiesInMonth}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                <span className="text-muted-foreground">Trips</span>
                <span className="num font-medium">{a.tripsInMonth}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                <span className="text-muted-foreground">Routes</span>
                <span className="num font-medium">{a.routesDriven}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                <span className="text-muted-foreground">Accidents</span>
                <span className="num font-medium">{a.accidentCount} ({a.majorAccidentCount} major)</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/25 px-2.5 py-1.5">
                <span className="text-muted-foreground">Mobile events</span>
                <span className="num font-medium">{a.mobileEvents}</span>
              </div>
            </div>
          </div>

          {usingLive && (
            <DriverDailyTripsSection
              driverId={d.driver_id}
              driverName={d.driver_name}
              enabled={usingLive}
              extras={{ windowEndDate: tripAnchor, snapshotDate: tripAnchor }}
            />
          )}
        </div>
      </aside>
    </>
  );
}
