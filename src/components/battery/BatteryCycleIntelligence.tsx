/**
 * Battery Cycle Intelligence
 * ------------------------------------------------------------------
 * HV battery discharge-cycle command center for the Voltline fleet.
 * Headline story: vehicle operational efficiency (RTE / Regen / Idle)
 * plus battery cycle load (EFC). Trip metrics are excluded everywhere.
 *
 * Data is pulled live from the analytics DB via GraphQL `sqlQuery`:
 *   - `cycle`        → monthly per-bus summary (the BatteryDataset)
 *   - `cycle_daily`  → daily trend (drill drawer + Trends screen)
 *   - `cycle_trip`   → trip segments (drill drawer)
 *
 * A global Company (SPV) filter in the top header scopes every screen.
 * Screens: Overview · Fleet Mix · Health & Risk · Trends. Clicking a bus
 * anywhere opens a drill drawer with its daily trend and trip segments.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  BatteryCharging,
  BatteryMedium,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  FileSpreadsheet,
  Gauge,
  LayoutGrid,
  Loader2,
  Recycle,
  Rows3,
  Search,
  ShieldAlert,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import detailJson from "@/data/hv-battery-cycles.json";
import {
  anchorBounds,
  BAND_COLOR,
  buildBatteryDataset,
  buildSampleDataset,
  depotColor,
  exportBatteryWorkbook,
  hasData,
  keyForMonthName,
  lastDataInWindow,
  prevDataKey,
  siteAgg,
  windowKeys,
  type BatteryDataset,
  type Band,
  type BusRow,
  type DetailData,
  type FleetAgg,
} from "@/lib/battery-cycles";
import {
  fetchCycleDaily,
  fetchCycleRows,
  fetchCycleTrips,
  type CycleDailyRow,
} from "@/lib/graphql/cycles";
import { fmt, Seg, Sparkline } from "./charts";
import { FleetMixView } from "./FleetMixView";
import { HealthRiskView } from "./HealthRiskView";
import { TrendsView } from "./TrendsView";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

type Layout = "spotlight" | "grid" | "compact";
type ViewKey = "overview" | "mix" | "health" | "trends";
type Selected = { bus: BusRow; monthName: string };

const VIEWS: { value: ViewKey; label: string; Icon: LucideIcon }[] = [
  { value: "overview", label: "Overview", Icon: LayoutGrid },
  { value: "mix", label: "Fleet Mix", Icon: BarChart3 },
  { value: "health", label: "Health & Risk", Icon: ShieldAlert },
  { value: "trends", label: "Trends", Icon: TrendingUp },
];

type KpiKey = keyof Omit<FleetAgg, "buses">;
type KpiDef = { key: KpiKey; label: string; unit: string; dec: number; goodUp: boolean | null; color: string; Icon: LucideIcon };

const KPI_DEFS: KpiDef[] = [
  { key: "rte", label: "Round-Trip Efficiency", unit: "%", dec: 1, goodUp: true, color: "var(--primary)", Icon: Gauge },
  { key: "regen", label: "Energy Regeneration", unit: "%", dec: 1, goodUp: true, color: "var(--chart-2)", Icon: Recycle },
  { key: "idle", label: "Auxiliary Idle Load", unit: "%", dec: 1, goodUp: false, color: "var(--warning)", Icon: Clock },
  { key: "efcG", label: "Battery Cycle Load", unit: "EFC", dec: 1, goodUp: null, color: "var(--chart-4)", Icon: BatteryCharging },
  { key: "efcN", label: "Net Cycle Load", unit: "EFC", dec: 1, goodUp: null, color: "var(--chart-4)", Icon: BatteryMedium },
  { key: "gross", label: "Energy Throughput", unit: "kWh/bus", dec: 0, goodUp: true, color: "var(--primary)", Icon: Activity },
];

const LAYOUTS: { value: Layout; label: string; Icon: LucideIcon }[] = [
  { value: "spotlight", label: "Spotlight", Icon: Gauge },
  { value: "grid", label: "Grid", Icon: LayoutGrid },
  { value: "compact", label: "Compact", Icon: Rows3 },
];

const BANDS: { value: "ALL" | Band; label: string; dot: string }[] = [
  { value: "ALL", label: "All", dot: "var(--muted-foreground)" },
  { value: "HEALTHY", label: "Healthy", dot: "var(--success)" },
  { value: "MONITOR", label: "Monitor", dot: "var(--warning)" },
  { value: "ATTENTION", label: "Attention", dot: "var(--destructive)" },
];

const DRILL_COLS: { key: keyof BusRow; label: string; align: "left" | "right" | "center" }[] = [
  { key: "reg", label: "Bus", align: "left" },
  { key: "type", label: "Type", align: "left" },
  { key: "grossKwh", label: "Gross kWh", align: "right" },
  { key: "efcGross", label: "EFC Gr", align: "right" },
  { key: "efcNet", label: "EFC Net", align: "right" },
  { key: "regen", label: "Regen%", align: "right" },
  { key: "idle", label: "Idle%", align: "right" },
  { key: "rte", label: "RTE%", align: "right" },
  { key: "spread", label: "Spread mV", align: "right" },
  { key: "healthScore", label: "Health", align: "right" },
  { key: "band", label: "Band", align: "center" },
];

/* ================================================================== *
 * Data wrapper — fetches live `cycle` data, falls back to the sample *
 * ================================================================== */
export function BatteryCycleIntelligence() {
  const sample = useMemo(() => buildSampleDataset(detailJson as unknown as DetailData), []);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cycle", "dataset"],
    queryFn: async () => buildBatteryDataset(await fetchCycleRows()),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="text-[13px]">Loading battery cycle analytics…</span>
      </div>
    );
  }

  const dataset = data && data.depots.length ? data : sample;
  const sig = `${dataset.source}:${dataset.depots.join(",")}:${dataset.dataKeys.join(",")}`;
  return <BatteryDashboard key={sig} dataset={dataset} degraded={isError && !data} />;
}

/* ================================================================== *
 * Dashboard — pure function of the dataset                           *
 * ================================================================== */
function BatteryDashboard({ dataset, degraded }: { dataset: BatteryDataset; degraded?: boolean }) {
  const bounds = anchorBounds(dataset);
  const initAnchor = bounds.max;
  const initSel = lastDataInWindow(dataset, windowKeys(dataset, initAnchor));
  const lastMonthName = dataset.dataMonths[dataset.dataMonths.length - 1] ?? "";

  const [view, setView] = useState<ViewKey>("overview");
  const [company, setCompany] = useState<"ALL" | string>("ALL");
  const [layout, setLayout] = useState<Layout>("spotlight");
  const [anchorIdx, setAnchorIdx] = useState(initAnchor);
  const [selKey, setSelKey] = useState<string>(initSel);
  const [sortKey, setSortKey] = useState<keyof BusRow>("healthScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [band, setBand] = useState<"ALL" | Band>("ALL");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);

  // Reset selected drawer when global company or month changes
  useEffect(() => {
    setSelected(null);
  }, [company, selKey]);

  const selMonthName = dataset.mname[selKey] ?? "—";
  const explorerMonth = selMonthName !== "—" ? selMonthName : lastMonthName;
  const wk = useMemo(() => windowKeys(dataset, anchorIdx), [dataset, anchorIdx]);
  const prev = prevDataKey(dataset, selKey);
  const curAgg = siteAgg(dataset, selKey, company);
  const prevAgg = prev ? siteAgg(dataset, prev, company) : null;
  const liveDrill = dataset.source === "live";
  const scopedDepots = useMemo(
    () => (company === "ALL" ? dataset.depots : dataset.depots.filter((d) => d === company)),
    [dataset, company],
  );

  const kpis = useMemo(
    () =>
      KPI_DEFS.map((d) => {
        const vals = wk.map((k) => {
          const a = siteAgg(dataset, k, company);
          return a ? (a[d.key] as number) : null;
        });
        const curV = curAgg ? (curAgg[d.key] as number) : null;
        const prevV = prevAgg ? (prevAgg[d.key] as number) : null;
        let deltaPct: number | null = null;
        let good: boolean | null = null;
        if (curV != null && prevV != null && prevV !== 0) deltaPct = ((curV - prevV) / Math.abs(prevV)) * 100;
        if (deltaPct != null && d.goodUp != null) good = d.goodUp ? deltaPct >= 0 : deltaPct <= 0;
        return {
          ...d,
          vals,
          value: fmt(curV, d.dec),
          w: vals.map((v) => fmt(v, d.dec)),
          deltaText: deltaPct == null ? "—" : `${deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(deltaPct).toFixed(1)}%`,
          good,
        };
      }),
    [dataset, wk, curAgg, prevAgg, company],
  );

  const gauges = useMemo(() => {
    const C = 2 * Math.PI * 52;
    const defs = [
      { key: "rte" as const, label: "Round-Trip Eff.", max: 100, color: "var(--primary)", goodUp: true },
      { key: "regen" as const, label: "Energy Regen", max: 25, color: "var(--chart-2)", goodUp: true },
      { key: "idle" as const, label: "Aux Idle", max: 40, color: "var(--warning)", goodUp: false },
    ];
    return defs.map((d) => {
      const v = curAgg ? curAgg[d.key] : 0;
      const fill = Math.min(1, v / d.max) * C;
      let delta: number | null = null;
      let good: boolean | null = null;
      if (prevAgg && curAgg) {
        delta = v - prevAgg[d.key];
        good = d.goodUp ? delta >= 0 : delta <= 0;
      }
      return {
        ...d,
        value: v.toFixed(1),
        dash: `${fill.toFixed(1)} ${(C - fill).toFixed(1)}`,
        deltaText: delta == null ? "— no prior" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pts vs prev`,
        deltaColor: delta == null ? "var(--muted-foreground)" : good ? "var(--success)" : "var(--destructive)",
      };
    });
  }, [curAgg, prevAgg]);

  const depotCards = useMemo(() => {
    const m = dataset.mname[selKey];
    return scopedDepots.map((dep) => {
      const s = dataset.summary[dep]?.[m];
      const h = dataset.health[dep]?.[m] ?? [0, 0, 0];
      const tot = h[0] + h[1] + h[2] || 1;
      return {
        depot: dep,
        color: depotColor(dep, dataset.depots),
        border: company === dep ? depotColor(dep, dataset.depots) : "var(--border)",
        buses: s?.buses ?? 0,
        efcG: (s?.efcG ?? 0).toFixed(1),
        gross: Math.round(s?.gross ?? 0).toLocaleString(),
        bars: [
          { label: "Round-trip eff.", val: `${(s?.rte ?? 0).toFixed(1)}%`, w: Math.min(100, s?.rte ?? 0), color: "var(--primary)" },
          { label: "Energy regen", val: `${(s?.regen ?? 0).toFixed(1)}%`, w: Math.min(100, ((s?.regen ?? 0) / 25) * 100), color: "var(--chart-2)" },
          { label: "Aux idle", val: `${(s?.idle ?? 0).toFixed(1)}%`, w: Math.min(100, ((s?.idle ?? 0) / 40) * 100), color: "var(--warning)" },
        ],
        healthy: h[0],
        monitor: h[1],
        attention: h[2],
        healthyPct: (h[0] / tot) * 100,
        monitorPct: (h[1] / tot) * 100,
        attentionPct: (h[2] / tot) * 100,
        healthyPctLabel: `${Math.round((h[0] / tot) * 100)}%`,
        onSelect: () => setCompany((c) => (c === dep ? "ALL" : dep)),
      };
    });
  }, [dataset, scopedDepots, selKey, company]);

  const efcBars = useMemo(() => {
    let mx = 0;
    for (const dep of scopedDepots) for (const k of wk) if (hasData(dataset, k)) mx = Math.max(mx, dataset.summary[dep]?.[dataset.mname[k]]?.efcG ?? 0);
    if (!mx) mx = 1;
    return scopedDepots.map((dep) => ({
      depot: dep,
      months: wk.map((k) => {
        if (!hasData(dataset, k))
          return { label: dataset.mshort[k], val: "—", h: 100, valColor: "var(--muted-foreground)", fill: "repeating-linear-gradient(135deg,color-mix(in oklab,var(--muted-foreground) 13%,transparent) 0 5px,transparent 5px 11px)" };
        const v = dataset.summary[dep]?.[dataset.mname[k]]?.efcG ?? 0;
        return {
          label: dataset.mshort[k],
          val: v.toFixed(1),
          h: (v / mx) * 100,
          valColor: "var(--foreground)",
          fill: `linear-gradient(180deg,${depotColor(dep, dataset.depots)},color-mix(in oklab,${depotColor(dep, dataset.depots)} 62%,transparent))`,
        };
      }),
    }));
  }, [dataset, scopedDepots, wk]);

  const drillRows = useMemo(() => {
    const depotsToQuery = company === "ALL" ? dataset.depots : [company];
    let rows: BusRow[] = [];
    depotsToQuery.forEach((dep) => {
      const r = dataset.detail[`${dep}|${explorerMonth}`] || [];
      rows.push(...r);
    });
    rows = rows.slice();

    if (band !== "ALL") rows = rows.filter((r) => r.band === band);
    if (q) {
      const needle = q.toUpperCase();
      rows = rows.filter((r) => (r.reg || "").toUpperCase().includes(needle));
    }
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[sortKey] as number | string | null;
      const bv = b[sortKey] as number | string | null;
      if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv)) * dir;
      return (((av ?? -Infinity) as number) - ((bv ?? -Infinity) as number)) * dir;
    });
    return rows;
  }, [dataset, company, explorerMonth, band, q, sortKey, sortDir]);

  const drillAll = useMemo(() => {
    const depotsToQuery = company === "ALL" ? dataset.depots : [company];
    const rows: BusRow[] = [];
    depotsToQuery.forEach((dep) => {
      const r = dataset.detail[`${dep}|${explorerMonth}`] || [];
      rows.push(...r);
    });
    return rows;
  }, [dataset, company, explorerMonth]);
  const drillAvgEfc = (() => {
    const v = drillRows.map((r) => r.efcGross).filter((x): x is number => x != null);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "—";
  })();

  const canPrev = anchorIdx > bounds.min;
  const canNext = anchorIdx < bounds.max;
  const shift = (dir: number) => {
    const a = anchorIdx + dir;
    if (a < bounds.min || a > bounds.max) return;
    setAnchorIdx(a);
    setSelKey(lastDataInWindow(dataset, windowKeys(dataset, a)));
  };
  const toggleSort = (k: keyof BusRow) => {
    setSortDir((d) => (sortKey === k && d === "desc" ? "asc" : "desc"));
    setSortKey(k);
  };

  const prevMonthLabel = prev ? dataset.mname[prev] : "baseline";
  const windowEfcLabel = `${dataset.mshort[wk[0]]} – ${dataset.mshort[wk[2]]} 2026`;

  const onExport = () => {
    const months = wk.filter((k) => hasData(dataset, k)).map((k) => dataset.mname[k]);
    void exportBatteryWorkbook(dataset, months);
  };

  const pickBus = (bus: BusRow, monthName: string) => setSelected((cur) => (cur?.bus.reg === bus.reg && cur.monthName === monthName ? null : { bus, monthName }));
  const drawerMonthKey = selected ? keyForMonthName(dataset, selected.monthName) : null;

  return (
    <div className="space-y-4">
      {/* ===== COMPANY SCOPE BAR (global) ===== */}
      <CompanyScopeBar dataset={dataset} company={company} month={selMonthName} onChange={setCompany} />

      {/* ===== TITLE + CONTROLS ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-label flex items-center gap-2" style={{ color: "var(--primary)" }}>
            Operational Efficiency
            <SourceBadge source={dataset.source} degraded={degraded} />
          </div>
          <h1 className="mt-1.5 text-[27px] font-semibold tracking-tight">How hard the batteries are working</h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
            {company === "ALL" ? `${dataset.depots.length} companies · fleet-weighted` : `${company} company`} ·{" "}
            {dataset.mshort[dataset.dataKeys[0]]}–{dataset.mshort[dataset.dataKeys[dataset.dataKeys.length - 1]]} 2026.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2.5">
          {/* PERIOD NAVIGATOR */}
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Period</span>
            <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-[3px]">
              <button type="button" aria-label="Earlier 3 months" onClick={() => shift(-1)} disabled={!canPrev} className="flex h-8 w-[30px] items-center justify-center rounded-lg text-foreground transition disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {wk.map((k) => {
                const hd = hasData(dataset, k);
                const active = k === selKey;
                return (
                  <button key={k} type="button" onClick={() => hd && setSelKey(k)} disabled={!hd}
                    className={cn("flex min-w-[50px] flex-col items-center rounded-lg px-3 py-1 text-[12.5px] font-semibold leading-tight transition", active ? "nav-pill-active text-foreground" : "text-muted-foreground", !hd && "opacity-50")}>
                    {dataset.mshort[k]}
                    <span className="mt-px text-[8.5px] font-medium uppercase tracking-wide" style={{ color: active ? "var(--primary)" : "var(--muted-foreground)" }}>{hd ? "'26" : "no data"}</span>
                  </button>
                );
              })}
              <button type="button" aria-label="Later 3 months" onClick={() => shift(1)} disabled={!canNext} className="flex h-8 w-[30px] items-center justify-center rounded-lg text-foreground transition disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* LAYOUT (overview only) + EXPORT */}
          <div className="flex items-center gap-2">
            {view === "overview" && (
              <>
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Layout</span>
                <div className="flex gap-0.5 rounded-xl border border-border/60 bg-muted/40 p-[3px]">
                  {LAYOUTS.map(({ value, label, Icon }) => (
                    <Seg key={value} active={layout === value} onClick={() => setLayout(value)}>
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </Seg>
                  ))}
                </div>
              </>
            )}
            <button type="button" onClick={onExport} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/15">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* ===== VIEW TABS ===== */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-[3px]">
        {VIEWS.map(({ value, label, Icon }) => (
          <button key={value} type="button" onClick={() => setView(value)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors", view === value ? "nav-pill-active text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* ===== SHARED DRILL DRAWER ===== */}
      <Dialog open={!!(selected && liveDrill && drawerMonthKey)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden border-none bg-transparent shadow-none [&>button]:hidden">
          {selected && liveDrill && drawerMonthKey && (
            <BusDrillDrawer reg={selected.bus.reg} type={selected.bus.type} monthName={selected.monthName} reportMonth={drawerMonthKey} summary={selected.bus} onClose={() => setSelected(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* ===== OVERVIEW ===== */}
      {view === "overview" && (
        <>
          {layout === "spotlight" && (
            <div className="chart-enter grid gap-4 lg:grid-cols-[1.55fr_1fr]">
              <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 shadow-elevated">
                <div className="cc-curve-panel pointer-events-none absolute inset-0" aria-hidden />
                <div className="relative mb-4 flex items-center justify-between">
                  <div className="section-label">Efficiency vitals · {selMonthName}</div>
                  <div className="text-[11px] text-muted-foreground">vs {prevMonthLabel}</div>
                </div>
                <div className="relative grid grid-cols-3 gap-2">
                  {gauges.map((g) => (
                    <div key={g.key} className="flex flex-col items-center text-center">
                      <div className="relative h-32 w-32">
                        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
                          <circle cx="64" cy="64" r="52" fill="none" stroke="color-mix(in oklab,var(--muted-foreground) 22%,transparent)" strokeWidth="11" />
                          <circle cx="64" cy="64" r="52" fill="none" stroke={g.color} strokeWidth="11" strokeLinecap="round" strokeDasharray={g.dash} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="num text-[25px] font-semibold leading-none">{g.value}</span>
                          <span className="mt-0.5 text-[11px] text-muted-foreground">%</span>
                        </div>
                      </div>
                      <div className="mt-2 text-[12px] font-semibold tracking-tight">{g.label}</div>
                      <div className="num mt-0.5 text-[11px] font-medium" style={{ color: g.deltaColor }}>{g.deltaText}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-rows-3 gap-4">
                {kpis.slice(3).map((k) => (
                  <div key={k.key} className="card-interactive accent-bar-top relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-elevated" style={{ ["--accent-color" as string]: k.color }}>
                    <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl ring-1" style={{ color: k.color, background: `color-mix(in oklab,${k.color} 13%,transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab,${k.color} 25%,transparent)` }}>
                      <k.Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="section-label">{k.label}</div>
                      <div className="mt-0.5 flex items-baseline gap-1.5">
                        <span className="num text-[24px] font-semibold">{k.value}</span>
                        <span className="text-[11.5px] text-muted-foreground">{k.unit}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <DeltaPill k={k} />
                      <Sparkline vals={k.vals} color={k.color} w={78} h={26} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {layout === "grid" && (
            <div className="chart-enter grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {kpis.map((k) => (
                <div key={k.key} className="card-interactive accent-bar-top relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-elevated" style={{ ["--accent-color" as string]: k.color }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="section-label">{k.label}</div>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="num text-[28px] font-semibold">{k.value}</span>
                        <span className="text-[12px] text-muted-foreground">{k.unit}</span>
                      </div>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl ring-1" style={{ color: k.color, background: `color-mix(in oklab,${k.color} 13%,transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab,${k.color} 25%,transparent)` }}>
                      <k.Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <DeltaPill k={k} suffix={`vs ${prev ? dataset.mshort[prev] : "—"}`} />
                    <Sparkline vals={k.vals} color={k.color} w={118} h={38} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {layout === "compact" && (
            <div className="chart-enter overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elevated">
              <div className="grid grid-cols-[1.4fr_repeat(3,1fr)_1.1fr_0.9fr] border-b border-border px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <div>Metric</div>
                <div className="text-right">{dataset.mshort[wk[0]]}</div>
                <div className="text-right">{dataset.mshort[wk[1]]}</div>
                <div className="text-right">{dataset.mshort[wk[2]]}</div>
                <div className="text-right">Trend</div>
                <div className="text-right">{dataset.mshort[selKey]} Δ</div>
              </div>
              {kpis.map((k) => (
                <div key={k.key} className="grid grid-cols-[1.4fr_repeat(3,1fr)_1.1fr_0.9fr] items-center border-b border-border/50 px-5 py-3">
                  <div className="flex items-center gap-2.5"><span className="h-2 w-2 rounded-sm" style={{ background: k.color }} /><span className="text-[13px] font-medium">{k.label}</span></div>
                  <div className="num text-right text-[13px] text-muted-foreground">{k.w[0]}</div>
                  <div className="num text-right text-[13px] text-muted-foreground">{k.w[1]}</div>
                  <div className="num text-right text-[14px] font-semibold">{k.w[2]}</div>
                  <div className="flex justify-end"><Sparkline vals={k.vals} color={k.color} w={90} h={26} lineOnly /></div>
                  <div className="num text-right text-[12px] font-semibold" style={{ color: k.good == null ? "var(--muted-foreground)" : k.good ? "var(--success)" : "var(--destructive)" }}>{k.deltaText}</div>
                </div>
              ))}
            </div>
          )}

          {/* COMPANY COMPARISON */}
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))" }}>
            {depotCards.map((d) => (
              <button key={d.depot} type="button" onClick={d.onSelect} className="card-interactive rounded-2xl border bg-card p-5 text-left shadow-elevated transition" style={{ borderColor: d.border }}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} /><span className="text-[15px] font-semibold tracking-tight">{d.depot}</span></div>
                  <div className="text-[11px] text-muted-foreground"><span className="num font-semibold text-foreground">{d.buses}</span> buses</div>
                </div>
                <div className="mb-4 flex items-end gap-1.5">
                  <span className="num text-[30px] font-semibold leading-none">{d.efcG}</span>
                  <span className="mb-1 text-[11px] text-muted-foreground">EFC / mo</span>
                  <span className="ml-auto text-[11px] text-muted-foreground"><span className="num text-foreground">{d.gross}</span> kWh avg</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {d.bars.map((bar) => (
                    <div key={bar.label}>
                      <div className="mb-1 flex justify-between text-[11px]"><span className="text-muted-foreground">{bar.label}</span><span className="num font-semibold">{bar.val}</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "color-mix(in oklab,var(--muted-foreground) 16%,transparent)" }}><div className="h-full rounded-full" style={{ width: `${bar.w}%`, background: bar.color }} /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-border/60 pt-3">
                  <div className="mb-2 flex justify-between text-[10.5px] uppercase tracking-wide text-muted-foreground"><span>Health bands</span><span className="num normal-case tracking-normal">{d.healthyPctLabel} healthy</span></div>
                  <div className="flex h-2 gap-[1.5px] overflow-hidden rounded-md">
                    <div style={{ width: `${d.healthyPct}%`, background: "var(--success)" }} />
                    <div style={{ width: `${d.monitorPct}%`, background: "var(--warning)" }} />
                    <div style={{ width: `${d.attentionPct}%`, background: "var(--destructive)" }} />
                  </div>
                  <div className="mt-2 flex gap-3.5 text-[11px]">
                    <HealthLegend color="var(--success)" n={d.healthy} label="Healthy" />
                    <HealthLegend color="var(--warning)" n={d.monitor} label="Monitor" />
                    <HealthLegend color="var(--destructive)" n={d.attention} label="Attention" />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* EFC TRACKING */}
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-elevated">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="section-label">Battery cycle load trajectory</div>
                <div className="mt-1 text-[16px] font-semibold tracking-tight">Equivalent full cycles (gross) by company · {windowEfcLabel}</div>
              </div>
              <div className="flex flex-wrap gap-4">
                {scopedDepots.map((dep) => (
                  <span key={dep} className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: depotColor(dep, dataset.depots) }} />{dep}</span>
                ))}
              </div>
            </div>
            <TooltipProvider delayDuration={100}>
              <div className="flex h-44 items-end gap-2 overflow-x-auto pl-1">
                {efcBars.map((grp) => (
                  <div key={grp.depot} className="flex h-full flex-col" style={{ flex: "1 0 140px" }}>
                    <div className="flex flex-1 items-end justify-center gap-2.5">
                      {grp.months.map((m, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <div className="flex h-full max-w-[58px] flex-1 flex-col items-center justify-end cursor-pointer group/bar">
                              <span className="num mb-1.5 text-[11.5px] font-semibold transition-opacity group-hover/bar:text-foreground" style={{ color: m.valColor }}>{m.val}</span>
                              <div className="w-full rounded-t-md transition-all group-hover/bar:brightness-110 group-hover/bar:scale-x-[1.05]" style={{ height: `${m.h}%`, minHeight: 3, background: m.fill }} />
                              <span className="mt-1.5 text-[10.5px] text-muted-foreground group-hover/bar:text-foreground">{m.label}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-[11px] p-0.5">
                              <p className="font-semibold text-foreground">{grp.depot}</p>
                              <p className="text-muted-foreground mt-0.5">{m.label} 2026: <strong className="text-foreground num">{m.val} EFC</strong></p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    <div className="mt-2.5 border-t border-border/60 pt-2.5 text-center text-[12.5px] font-semibold">{grp.depot}</div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
          </div>

          {/* PER-BUS EXPLORER */}
          <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
            <div>
              <div className="section-label" style={{ color: "var(--primary)" }}>Bus-level explorer</div>
              <h2 className="mt-1 text-[20px] font-semibold tracking-tight">Per-bus discharge cycle detail</h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search registration…" className="h-9 w-[230px] rounded-xl border border-border bg-card pl-8 pr-3 text-[13px] outline-none focus:border-primary/40" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3">
            <FilterGroup label="Band">
              {BANDS.map((b) => (<Seg key={b.value} active={band === b.value} onClick={() => setBand(b.value)}><span className="h-1.5 w-1.5 rounded-sm" style={{ background: b.dot }} /> {b.label}</Seg>))}
            </FilterGroup>
            <div className="ml-auto flex items-center gap-3.5 text-[12px] text-muted-foreground">
              <span><span className="num font-semibold text-foreground">{drillRows.length}</span> of {drillAll.length} buses</span>
              <span>avg EFC <span className="num font-semibold text-foreground">{drillAvgEfc}</span></span>
              <button type="button" onClick={() => { setBand("ALL"); setQ(""); }} className="text-[11.5px] font-semibold text-primary">Reset</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elevated">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-[12.5px]">
                <thead>
                  <tr className="bg-muted/50">
                    {DRILL_COLS.map((c) => {
                      const activeCol = sortKey === c.key;
                      return (
                        <th key={String(c.key)} onClick={() => toggleSort(c.key)} className="th-sort sticky top-0 cursor-pointer whitespace-nowrap border-b border-border px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ textAlign: c.align, color: activeCol ? "var(--primary)" : "var(--muted-foreground)" }}>
                           {c.label}{activeCol ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {drillRows.map((r) => {
                    const bc = BAND_COLOR[r.band] ?? "var(--muted-foreground)";
                    const isSel = selected?.bus.reg === r.reg;
                    return (
                      <tr key={r.reg} onClick={() => liveDrill && pickBus(r, explorerMonth)} className={cn("border-b border-border/40", r.band === "ATTENTION" && "cc-row-alert", liveDrill && "cursor-pointer hover:bg-muted/40", isSel && "bg-primary/5")}>
                        <td className="whitespace-nowrap px-3.5 py-2.5"><div className="flex items-center gap-2.5"><span className="h-[22px] w-[3px] flex-none rounded-sm" style={{ background: bc }} /><span className="num font-semibold">{r.reg}</span></div></td>
                        <td className="whitespace-nowrap px-3.5 py-2.5 text-muted-foreground">{r.type || "—"}</td>
                        <td className="num px-3.5 py-2.5 text-right">{fmt(r.grossKwh, 0)}</td>
                        <td className="num px-3.5 py-2.5 text-right font-semibold">{fmt(r.efcGross, 1)}</td>
                        <td className="num px-3.5 py-2.5 text-right text-muted-foreground">{fmt(r.efcNet, 1)}</td>
                        <td className="num px-3.5 py-2.5 text-right">{fmt(r.regen, 1)}</td>
                        <td className="num px-3.5 py-2.5 text-right">{fmt(r.idle, 1)}</td>
                        <td className="num px-3.5 py-2.5 text-right">{fmt(r.rte, 1)}</td>
                        <td className="num px-3.5 py-2.5 text-right text-muted-foreground">{fmt(r.spread, 0)}</td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center justify-end gap-2.5">
                            <div className="h-[5px] w-[46px] overflow-hidden rounded-full" style={{ background: "color-mix(in oklab,var(--muted-foreground) 18%,transparent)" }}><div className="h-full rounded-full" style={{ width: `${r.healthScore == null ? 0 : Math.max(5, Math.min(100, r.healthScore))}%`, background: bc }} /></div>
                            <span className="num w-[22px] text-right font-semibold">{fmt(r.healthScore, 0)}</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-center"><span className="inline-block rounded-md px-2.5 py-[3px] text-[10.5px] font-semibold tracking-wide" style={{ color: bc, background: `color-mix(in oklab,${bc} 13%,transparent)` }}>{r.band}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {drillRows.length === 0 && <div className="p-12 text-center text-[13px] text-muted-foreground">No buses match these filters.</div>}
            {liveDrill && drillRows.length > 0 && <div className="border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground">Tip: click a bus to see its daily trend and trip segments.</div>}
          </div>
        </>
      )}

      {/* ===== FLEET MIX ===== */}
      {view === "mix" && <FleetMixView dataset={dataset} company={company} monthName={selMonthName} onSelectBus={(b) => pickBus(b, selMonthName)} />}

      {/* ===== HEALTH & RISK ===== */}
      {view === "health" && <HealthRiskView dataset={dataset} company={company} monthName={selMonthName} onSelectBus={(b) => pickBus(b, selMonthName)} />}

      {/* ===== TRENDS ===== */}
      {view === "trends" && <TrendsView dataset={dataset} company={company} monthName={selMonthName} />}
    </div>
  );
}

/* ================================================================== *
 * Company scope bar                                                  *
 * ================================================================== */
function CompanyScopeBar({ dataset, company, month, onChange }: { dataset: BatteryDataset; company: "ALL" | string; month: string; onChange: (c: "ALL" | string) => void }) {
  const totalBuses = dataset.depots.reduce((a, d) => a + (dataset.summary[d]?.[month]?.buses ?? 0), 0);
  const scoped = company === "ALL" ? totalBuses : dataset.summary[company]?.[month]?.buses ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card p-2.5 shadow-elevated">
      <div className="flex items-center gap-2 pl-1 pr-2">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Company</span>
      </div>
      <button type="button" onClick={() => onChange("ALL")}
        className={cn("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition", company === "ALL" ? "nav-pill-active text-foreground" : "text-muted-foreground hover:text-foreground")}>
        All companies
        <span className="num rounded-md bg-muted px-1.5 py-px text-[10.5px] font-semibold text-muted-foreground">{totalBuses}</span>
      </button>
      {dataset.depots.map((d) => {
        const n = dataset.summary[d]?.[month]?.buses ?? 0;
        const c = depotColor(d, dataset.depots);
        const active = company === d;
        return (
          <button key={d} type="button" onClick={() => onChange(d)}
            className={cn("inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition", active ? "nav-pill-active text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
            {d}
            <span className="num rounded-md bg-muted px-1.5 py-px text-[10.5px] font-semibold text-muted-foreground">{n}</span>
          </button>
        );
      })}
      <div className="ml-auto pr-1 text-[11.5px] text-muted-foreground">
        Scope: <span className="num font-semibold text-foreground">{scoped}</span> buses · {month}
      </div>
    </div>
  );
}

/* ================================================================== *
 * Per-bus drill drawer — cycle_daily + cycle_trip                    *
 * ================================================================== */
function BusDrillDrawer({ reg, type, monthName, reportMonth, summary, onClose }: { reg: string; type: string; monthName: string; reportMonth: string; summary: BusRow; onClose: () => void }) {
  const daily = useQuery({ queryKey: ["cycle_daily", reg, reportMonth], queryFn: () => fetchCycleDaily(reg, reportMonth), staleTime: 5 * 60_000 });
  const trips = useQuery({ queryKey: ["cycle_trip", reg, reportMonth], queryFn: () => fetchCycleTrips(reg, reportMonth), staleTime: 5 * 60_000 });
  const bc = BAND_COLOR[summary.band] ?? "var(--muted-foreground)";

  return (
    <div className="chart-enter overflow-hidden rounded-2xl border bg-card shadow-elevated" style={{ borderColor: bc }}>
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="h-7 w-[3px] rounded-sm" style={{ background: bc }} />
          <div>
            <div className="flex items-center gap-2">
              <span className="num text-[15px] font-semibold">{reg}</span>
              <span className="rounded-md px-2 py-[2px] text-[10px] font-semibold tracking-wide" style={{ color: bc, background: `color-mix(in oklab,${bc} 13%,transparent)` }}>{summary.band}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">{type} · {monthName} 2026 · health <span className="num">{fmt(summary.healthScore, 0)}</span></div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Close detail"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="section-label">Daily discharge & efficiency</div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--chart-4)" }} /> Gross kWh</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: "var(--primary)" }} /> RTE %</span>
            </div>
          </div>
          {daily.isLoading ? <DrawerLoading label="Loading daily series…" /> : daily.isError ? <DrawerError /> : (daily.data?.length ?? 0) === 0 ? <DrawerEmpty label="No daily rows for this bus/month." /> : <DailyChart rows={daily.data ?? []} />}
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <div className="section-label">Trip segments</div>
            <div className="text-[11px] text-muted-foreground"><span className="num font-semibold text-foreground">{trips.data?.length ?? 0}</span> trips</div>
          </div>
          {trips.isLoading ? <DrawerLoading label="Loading trips…" /> : trips.isError ? <DrawerError /> : (trips.data?.length ?? 0) === 0 ? <DrawerEmpty label="No trip segments for this bus/month." /> : (
            <div className="max-h-[280px] overflow-auto rounded-xl border border-border/60">
              <table className="w-full border-collapse text-[11.5px]">
                <thead className="sticky top-0 bg-muted/70 backdrop-blur">
                  <tr className="text-[9.5px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2.5 py-2 text-left font-semibold">Start</th>
                    <th className="px-2.5 py-2 text-right font-semibold">Dur</th>
                    <th className="px-2.5 py-2 text-right font-semibold">Gross</th>
                    <th className="px-2.5 py-2 text-right font-semibold">Regen%</th>
                    <th className="px-2.5 py-2 text-right font-semibold">SOC</th>
                    <th className="px-2.5 py-2 text-right font-semibold">EFC</th>
                  </tr>
                </thead>
                <tbody>
                  {(trips.data ?? []).map((t, i) => {
                    const flag = (t.segment_flag ?? "").toUpperCase();
                    const warn = flag && flag !== "OK";
                    return (
                      <tr key={t.segment_id ?? i} className={cn("border-b border-border/40", warn && "cc-row-alert")}>
                        <td className="whitespace-nowrap px-2.5 py-1.5">{fmtTime(t.trip_start)}</td>
                        <td className="num px-2.5 py-1.5 text-right">{fmt(t.duration_min, 0)}m</td>
                        <td className="num px-2.5 py-1.5 text-right font-semibold">{fmt(t.gross_discharge_kwh, 1)}</td>
                        <td className="num px-2.5 py-1.5 text-right">{fmt(t.regen_pct, 1)}</td>
                        <td className="num px-2.5 py-1.5 text-right text-muted-foreground">{fmt(t.soc_max, 0)}→{fmt(t.soc_min, 0)}</td>
                        <td className="num px-2.5 py-1.5 text-right">{fmt(t.efc_gross_trip, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Daily gross-discharge bars with an overlaid RTE% line. */
function DailyChart({ rows }: { rows: CycleDailyRow[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const W = 560;
  const H = 170;
  const padL = 6, padR = 6, padT = 14, padB = 18;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = rows.length;
  const maxGross = Math.max(1, ...rows.map((r) => r.gross_discharge_kwh ?? 0));
  const slot = innerW / Math.max(1, n);
  const barW = Math.max(2, Math.min(18, slot * 0.6));
  const rtePts = rows.map((r, i) => {
    if (r.daily_rte_pct == null) return null;
    const x = padL + slot * i + slot / 2;
    const y = padT + innerH - (Math.min(100, r.daily_rte_pct) / 100) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).filter(Boolean).join(" ");

  const hoveredRow = hoveredIdx !== null ? rows[hoveredIdx] : null;
  const leftPercent = hoveredIdx !== null ? ((padL + slot * hoveredIdx + slot / 2) / Math.max(W, n * 16)) * 100 : 0;

  return (
    <div className="relative overflow-x-auto rounded-xl border border-border/60 bg-muted/20 p-3">
      <svg width={Math.max(W, n * 16)} height={H} viewBox={`0 0 ${Math.max(W, n * 16)} ${H}`} className="block">
        {[0.25, 0.5, 0.75].map((g) => (<line key={g} x1={padL} x2={W - padR} y1={padT + innerH * g} y2={padT + innerH * g} stroke="color-mix(in oklab,var(--muted-foreground) 16%,transparent)" strokeWidth={1} />))}
        
        {/* Hover vertical dashed guide line */}
        {hoveredIdx !== null && (
          <line
            x1={padL + slot * hoveredIdx + slot / 2}
            x2={padL + slot * hoveredIdx + slot / 2}
            y1={padT}
            y2={padT + innerH}
            stroke="color-mix(in oklab,var(--primary) 35%,transparent)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            pointerEvents="none"
          />
        )}

        {rows.map((r, i) => {
          const v = r.gross_discharge_kwh ?? 0;
          const h = (v / maxGross) * innerH;
          const x = padL + slot * i + (slot - barW) / 2;
          const y = padT + innerH - h;
          const isHovered = hoveredIdx === i;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={Math.max(1, h)}
              rx={2}
              fill={isHovered ? "var(--chart-4)" : "color-mix(in oklab,var(--chart-4) 78%,transparent)"}
              pointerEvents="none"
            />
          );
        })}
        {rtePts && <polyline points={rtePts} fill="none" stroke="var(--primary)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}

        {/* Highlight circle on line point when hovered */}
        {hoveredIdx !== null && hoveredRow && hoveredRow.daily_rte_pct != null && (
          <g pointerEvents="none">
            <circle
              cx={padL + slot * hoveredIdx + slot / 2}
              cy={padT + innerH - (Math.min(100, hoveredRow.daily_rte_pct) / 100) * innerH}
              r={6}
              fill="var(--card)"
              stroke="var(--primary)"
              strokeWidth={2}
            />
            <circle
              cx={padL + slot * hoveredIdx + slot / 2}
              cy={padT + innerH - (Math.min(100, hoveredRow.daily_rte_pct) / 100) * innerH}
              r={2.5}
              fill="var(--primary)"
            />
          </g>
        )}

        {/* Hover detection vertical zones */}
        {rows.map((r, i) => {
          const x = padL + slot * i;
          return (
            <rect
              key={`detect-${i}`}
              x={x}
              y={padT}
              width={slot}
              height={innerH}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[9.5px] text-muted-foreground">
        <span>{fmtDay(rows[0]?.session_date)}</span>
        <span className="num">peak {fmt(maxGross, 0)} kWh</span>
        <span>{fmtDay(rows[n - 1]?.session_date)}</span>
      </div>

      {/* Floating interactive tooltip */}
      {hoveredIdx !== null && hoveredRow && (
        <div
          className="absolute z-50 rounded-xl border border-border bg-card/95 p-2.5 shadow-elevated backdrop-blur-sm transition-all pointer-events-none text-[11.5px] min-w-[125px]"
          style={{
            left: `${leftPercent}%`,
            top: "16px",
            transform: leftPercent > 70 ? "translateX(-100%)" : leftPercent < 30 ? "translateX(0)" : "translateX(-50%)",
            marginLeft: leftPercent > 70 ? "-8px" : leftPercent < 30 ? "8px" : "0",
          }}
        >
          <div className="font-semibold text-foreground mb-1">{fmtDay(hoveredRow.session_date)}</div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-sm bg-[var(--chart-4)]" />
            <span>Gross: <strong className="text-foreground num">{fmt(hoveredRow.gross_discharge_kwh, 1)}</strong> kWh</span>
          </div>
          {hoveredRow.daily_rte_pct != null && (
            <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
              <span className="h-2 w-2 rounded-sm bg-[var(--primary)]" />
              <span>RTE: <strong className="text-foreground num">{fmt(hoveredRow.daily_rte_pct, 1)}%</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DrawerLoading({ label }: { label: string }) {
  return <div className="flex h-[170px] items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/20 text-[12px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {label}</div>;
}
function DrawerError() {
  return <div className="flex h-[170px] items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 text-[12px] text-destructive">Failed to load.</div>;
}
function DrawerEmpty({ label }: { label: string }) {
  return <div className="flex h-[170px] items-center justify-center rounded-xl border border-border/60 bg-muted/20 text-[12px] text-muted-foreground">{label}</div>;
}

/* ---------- small presentational helpers ---------- */
function SourceBadge({ source, degraded }: { source: "live" | "sample"; degraded?: boolean }) {
  const live = source === "live" && !degraded;
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-[1px] text-[9.5px] font-semibold tracking-wide" style={{ color: live ? "var(--success)" : "var(--warning)", background: live ? "color-mix(in oklab,var(--success) 14%,transparent)" : "color-mix(in oklab,var(--warning) 14%,transparent)" }}>
      <Database className="h-2.5 w-2.5" /> {live ? "Live" : "Sample"}
    </span>
  );
}

function DeltaPill({ k, suffix }: { k: { deltaText: string; good: boolean | null }; suffix?: string }) {
  const color = k.good == null ? "var(--muted-foreground)" : k.good ? "var(--success)" : "var(--destructive)";
  return (
    <div className="num inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold" style={{ color, background: `color-mix(in oklab,${color} 14%,transparent)` }}>
      {k.deltaText}
      {suffix && <span className="ml-0.5 font-normal opacity-60">{suffix}</span>}
    </div>
  );
}

function HealthLegend({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5"><span className="h-[7px] w-[7px] rounded-sm" style={{ background: color }} /><span className="num font-semibold">{n}</span><span className="text-muted-foreground">{label}</span></span>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex gap-0.5 rounded-xl border border-border/60 bg-card p-[3px]">{children}</div>
    </div>
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}
