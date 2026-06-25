/**
 * Health & Risk — battery health distribution and thermal / cell-balance risk,
 * scoped to the selected company. The scatter plots cell-spread vs peak temp;
 * clicking any point or list row opens the shared drill drawer.
 */
import { useMemo, useState } from "react";
import { HeartPulse, ShieldAlert, Thermometer } from "lucide-react";
import {
  BAND_COLOR,
  healthTotals,
  rowsForScope,
  type BatteryDataset,
  type Band,
  type BusRow,
} from "@/lib/battery-cycles";
import { Donut, fmt, Panel, Seg, type DonutSeg } from "./charts";

const BAND_FILTERS: { value: "ALL" | Band; label: string; dot: string }[] = [
  { value: "ALL", label: "All", dot: "var(--muted-foreground)" },
  { value: "HEALTHY", label: "Healthy", dot: "var(--success)" },
  { value: "MONITOR", label: "Monitor", dot: "var(--warning)" },
  { value: "ATTENTION", label: "Attention", dot: "var(--destructive)" },
];

export function HealthRiskView({
  dataset,
  company,
  monthName,
  onSelectBus,
}: {
  dataset: BatteryDataset;
  company: "ALL" | string;
  monthName: string;
  onSelectBus: (bus: BusRow) => void;
}) {
  const rows = useMemo(() => rowsForScope(dataset, monthName, company), [dataset, company, monthName]);
  const [band, setBand] = useState<"ALL" | Band>("ALL");

  const h = healthTotals(rows);
  const donut: DonutSeg[] = [
    { label: "Healthy", value: h.healthy, color: "var(--success)" },
    { label: "Monitor", value: h.monitor, color: "var(--warning)" },
    { label: "Attention", value: h.attention, color: "var(--destructive)" },
  ];
  const avgHealth = rows.length ? rows.reduce((a, r) => a + (r.healthScore ?? 0), 0) / rows.length : 0;
  const avgSpread = rows.length ? rows.reduce((a, r) => a + (r.spread ?? 0), 0) / rows.length : 0;
  const subzero = rows.reduce((a, r) => a + (r.subzero ?? 0), 0);

  const filtered = useMemo(() => (band === "ALL" ? rows : rows.filter((r) => r.band === band)), [rows, band]);
  const watchlist = useMemo(
    () => [...rows].filter((r) => r.band !== "HEALTHY").sort((a, b) => (a.healthScore ?? 0) - (b.healthScore ?? 0)),
    [rows],
  );

  if (!rows.length) {
    return <div className="rounded-2xl border border-border/60 bg-card p-12 text-center text-[13px] text-muted-foreground">No data for this scope.</div>;
  }

  return (
    <div className="chart-enter space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <RiskStat Icon={HeartPulse} label="Avg health score" value={fmt(avgHealth, 1)} color="var(--success)" />
        <RiskStat Icon={ShieldAlert} label="Needs attention" value={fmt(h.attention)} sub={`${h.monitor} monitor`} color="var(--destructive)" />
        <RiskStat Icon={Thermometer} label="Avg cell spread" value={`${fmt(avgSpread, 0)} mV`} sub={`${subzero} sub-zero days`} color="var(--warning)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        {/* Health distribution */}
        <Panel title="Health distribution" subtitle={`${monthName} · ${h.total} buses`}>
          <div className="flex items-center gap-5">
            <Donut segments={donut} centerTop={`${Math.round((h.healthy / (h.total || 1)) * 100)}%`} centerSub="healthy" />
            <div className="flex-1 space-y-2.5">
              <LegendRow color="var(--success)" label="Healthy" n={h.healthy} total={h.total} />
              <LegendRow color="var(--warning)" label="Monitor" n={h.monitor} total={h.total} />
              <LegendRow color="var(--destructive)" label="Attention" n={h.attention} total={h.total} />
            </div>
          </div>
        </Panel>

        {/* Risk scatter */}
        <Panel
          title="Thermal & cell-balance risk"
          subtitle="Cell spread (mV) vs peak temperature (°C)"
          right={
            <div className="flex gap-0.5 rounded-xl border border-border/60 bg-muted/40 p-[3px]">
              {BAND_FILTERS.map((b) => (
                <Seg key={b.value} active={band === b.value} onClick={() => setBand(b.value)}>
                  <span className="h-1.5 w-1.5 rounded-sm" style={{ background: b.dot }} /> {b.label}
                </Seg>
              ))}
            </div>
          }
        >
          <RiskScatter rows={filtered} onSelectBus={onSelectBus} />
        </Panel>
      </div>

      {/* Watchlist */}
      <Panel title="Risk watchlist" subtitle={`${watchlist.length} buses outside the healthy band · worst first · click for detail`}>
        {watchlist.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">All buses healthy in this scope.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
              <thead className="bg-muted/50">
                <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3.5 py-2.5 text-left font-semibold">Bus</th>
                  <th className="px-3.5 py-2.5 text-left font-semibold">Type</th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">Health</th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">Spread mV</th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">Peak °C</th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">Sub-zero</th>
                  <th className="px-3.5 py-2.5 text-center font-semibold">Band</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.slice(0, 60).map((r) => {
                  const bc = BAND_COLOR[r.band];
                  return (
                    <tr key={r.reg} onClick={() => onSelectBus(r)} className="cursor-pointer border-b border-border/40 transition hover:bg-muted/40">
                      <td className="num whitespace-nowrap px-3.5 py-2 font-semibold">{r.reg}</td>
                      <td className="whitespace-nowrap px-3.5 py-2 text-muted-foreground">{r.type}</td>
                      <td className="num px-3.5 py-2 text-right font-semibold">{fmt(r.healthScore, 0)}</td>
                      <td className="num px-3.5 py-2 text-right">{fmt(r.spread, 0)}</td>
                      <td className="num px-3.5 py-2 text-right">{fmt(r.peakTemp, 0)}</td>
                      <td className="num px-3.5 py-2 text-right text-muted-foreground">{fmt(r.subzero, 0)}</td>
                      <td className="px-3.5 py-2 text-center">
                        <span className="inline-block rounded-md px-2 py-[2px] text-[10px] font-semibold" style={{ color: bc, background: `color-mix(in oklab,${bc} 13%,transparent)` }}>
                          {r.band}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function RiskScatter({ rows, onSelectBus }: { rows: BusRow[]; onSelectBus: (b: BusRow) => void }) {
  const W = 640;
  const H = 280;
  const pad = { l: 44, r: 14, t: 14, b: 34 };
  const pts = rows.filter((r) => r.spread != null && r.peakTemp != null);
  const xs = pts.map((r) => r.spread as number);
  const ys = pts.map((r) => r.peakTemp as number);
  const xMin = Math.min(0, ...xs);
  const xMax = Math.max(50, ...xs) * 1.05;
  const yMin = Math.min(20, ...ys) - 2;
  const yMax = Math.max(50, ...ys) + 2;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const sx = (v: number) => pad.l + ((v - xMin) / (xMax - xMin || 1)) * innerW;
  const sy = (v: number) => pad.t + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const xTicks = 4;
  const yTicks = 4;

  if (!pts.length) return <div className="py-10 text-center text-[13px] text-muted-foreground">No buses match this filter.</div>;

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = yMin + ((yMax - yMin) / yTicks) * i;
          const y = sy(v);
          return (
            <g key={`y${i}`}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="color-mix(in oklab,var(--muted-foreground) 14%,transparent)" strokeWidth={1} />
              <text x={pad.l - 8} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize={9}>{Math.round(v)}</text>
            </g>
          );
        })}
        {Array.from({ length: xTicks + 1 }).map((_, i) => {
          const v = xMin + ((xMax - xMin) / xTicks) * i;
          const x = sx(v);
          return (
            <g key={`x${i}`}>
              <line x1={x} x2={x} y1={pad.t} y2={H - pad.b} stroke="color-mix(in oklab,var(--muted-foreground) 8%,transparent)" strokeWidth={1} />
              <text x={x} y={H - pad.b + 14} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>{Math.round(v)}</text>
            </g>
          );
        })}
        <text x={pad.l} y={H - 4} className="fill-muted-foreground" fontSize={9}>cell spread (mV) →</text>
        {pts.map((r) => (
          <circle
            key={r.reg}
            cx={sx(r.spread as number)}
            cy={sy(r.peakTemp as number)}
            r={5}
            fill={`color-mix(in oklab,${BAND_COLOR[r.band]} 78%,transparent)`}
            stroke={BAND_COLOR[r.band]}
            strokeWidth={1}
            className="cursor-pointer"
            onClick={() => onSelectBus(r)}
          >
            <title>{`${r.reg} · ${r.type}\nspread ${fmt(r.spread, 0)} mV · peak ${fmt(r.peakTemp, 0)}°C · health ${fmt(r.healthScore, 0)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function LegendRow({ color, label, n, total }: { color: string; label: string; n: number; total: number }) {
  const pct = Math.round((n / (total || 1)) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{label}</span>
        <span className="text-muted-foreground"><span className="num font-semibold text-foreground">{n}</span> · {pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "color-mix(in oklab,var(--muted-foreground) 16%,transparent)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function RiskStat({ Icon, label, value, sub, color }: { Icon: typeof HeartPulse; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="card-interactive accent-bar-top relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-elevated" style={{ ["--accent-color" as string]: color }}>
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl ring-1" style={{ color, background: `color-mix(in oklab,${color} 13%,transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab,${color} 25%,transparent)` }}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div>
        <div className="section-label">{label}</div>
        <div className="num mt-0.5 text-[22px] font-semibold leading-none">{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}
