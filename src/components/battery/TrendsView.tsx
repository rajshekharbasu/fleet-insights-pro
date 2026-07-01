/**
 * Trends — daily fleet trajectory (from cycle_daily, aggregated server-side)
 * plus the monthly KPI trend across the data window, scoped to the company.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  keyForMonthName,
  siteAgg,
  type BatteryDataset,
} from "@/lib/battery-cycles";
import { fetchDailyTrend, type DailyTrendPoint } from "@/lib/graphql/cycles";
import { fmt, Panel, Sparkline } from "./charts";

export function TrendsView({
  dataset,
  company,
  monthName,
}: {
  dataset: BatteryDataset;
  company: "ALL" | string;
  monthName: string;
}) {
  const monthKey = keyForMonthName(dataset, monthName) ?? "";
  const live = dataset.source === "live" && !!monthKey;
  const trend = useQuery({
    queryKey: ["daily_trend", company, monthKey],
    queryFn: () => fetchDailyTrend(company === "ALL" ? null : company, monthKey),
    enabled: live,
    staleTime: 5 * 60_000,
  });

  const monthly = useMemo(() => {
    return dataset.dataKeys.map((k) => {
      const a = siteAgg(dataset, k, company);
      return { key: k, label: dataset.mshort[k], efcG: a?.efcG ?? null, rte: a?.rte ?? null, regen: a?.regen ?? null };
    });
  }, [dataset, company]);

  return (
    <div className="chart-enter space-y-4">
      <Panel
        title="Daily discharge trajectory"
        subtitle={`${monthName} 2026 · ${company === "ALL" ? "all companies" : company} · daily gross discharge with round-trip efficiency`}
        right={
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--chart-4)" }} /> Gross kWh</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: "var(--primary)" }} /> RTE %</span>
          </div>
        }
      >
        {!live ? (
          <Empty label="Daily trend needs the live data source." />
        ) : trend.isLoading ? (
          <Loading label="Aggregating daily series…" />
        ) : trend.isError ? (
          <ErrorBox />
        ) : (trend.data?.length ?? 0) === 0 ? (
          <Empty label="No daily rows for this scope." />
        ) : (
          <DailyTrendChart rows={trend.data ?? []} />
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
        <MonthlyTrend label="Battery cycle load" unit="EFC" color="var(--chart-4)" points={monthly.map((m) => ({ label: m.label, v: m.efcG }))} dec={1} />
        <MonthlyTrend label="Round-trip efficiency" unit="%" color="var(--primary)" points={monthly.map((m) => ({ label: m.label, v: m.rte }))} dec={1} />
        <MonthlyTrend label="Energy regeneration" unit="%" color="var(--chart-2)" points={monthly.map((m) => ({ label: m.label, v: m.regen }))} dec={1} />
      </div>

      {live && (trend.data?.length ?? 0) > 0 && <RegenStrip rows={trend.data ?? []} />}
    </div>
  );
}

function DailyTrendChart({ rows }: { rows: DailyTrendPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const H = 240;
  const pad = { l: 44, r: 14, t: 16, b: 26 };
  const n = rows.length;
  const W = Math.max(680, n * 22);
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const maxGross = Math.max(1, ...rows.map((r) => r.gross_kwh ?? 0));
  const slot = innerW / Math.max(1, n);
  const barW = Math.max(3, Math.min(20, slot * 0.62));

  const rtePts = rows
    .map((r, i) => {
      if (r.rte_pct == null) return null;
      const x = pad.l + slot * i + slot / 2;
      const y = pad.t + innerH - (Math.min(100, r.rte_pct) / 100) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  const hoveredRow = hoveredIdx !== null ? rows[hoveredIdx] : null;
  const leftPercent = hoveredIdx !== null ? ((pad.l + slot * hoveredIdx + slot / 2) / W) * 100 : 0;

  return (
    <div className="relative overflow-x-auto rounded-xl border border-border/60 bg-muted/20 p-3">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => {
          const y = pad.t + innerH * g;
          return (
            <g key={g}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="color-mix(in oklab,var(--muted-foreground) 13%,transparent)" strokeWidth={1} />
              <text x={pad.l - 8} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize={9}>{Math.round(maxGross * (1 - g))}</text>
            </g>
          );
        })}

        {/* Hover guide line */}
        {hoveredIdx !== null && (
          <line
            x1={pad.l + slot * hoveredIdx + slot / 2}
            x2={pad.l + slot * hoveredIdx + slot / 2}
            y1={pad.t}
            y2={pad.t + innerH}
            stroke="color-mix(in oklab,var(--primary) 35%,transparent)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            pointerEvents="none"
          />
        )}

        {rows.map((r, i) => {
          const v = r.gross_kwh ?? 0;
          const h = (v / maxGross) * innerH;
          const x = pad.l + slot * i + (slot - barW) / 2;
          const y = pad.t + innerH - h;
          const isHovered = hoveredIdx === i;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={Math.max(1, h)}
              rx={2}
              fill={isHovered ? "var(--chart-4)" : "color-mix(in oklab,var(--chart-4) 75%,transparent)"}
              pointerEvents="none"
            />
          );
        })}
        {rtePts && <polyline points={rtePts} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}

        {/* Highlight circle on line point when hovered */}
        {hoveredIdx !== null && hoveredRow && hoveredRow.rte_pct != null && (
          <g pointerEvents="none">
            <circle
              cx={pad.l + slot * hoveredIdx + slot / 2}
              cy={pad.t + innerH - (Math.min(100, hoveredRow.rte_pct) / 100) * innerH}
              r={6}
              fill="var(--card)"
              stroke="var(--primary)"
              strokeWidth={2}
            />
            <circle
              cx={pad.l + slot * hoveredIdx + slot / 2}
              cy={pad.t + innerH - (Math.min(100, hoveredRow.rte_pct) / 100) * innerH}
              r={2.5}
              fill="var(--primary)"
            />
          </g>
        )}

        {/* Hover detection vertical zones */}
        {rows.map((r, i) => {
          const x = pad.l + slot * i;
          return (
            <rect
              key={`detect-${i}`}
              x={x}
              y={pad.t}
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
        <span className="num">peak {fmt(maxGross, 0)} kWh/day</span>
        <span>{fmtDay(rows[n - 1]?.session_date)}</span>
      </div>

      {/* Floating tooltip */}
      {hoveredIdx !== null && hoveredRow && (
        <div
          className="absolute z-50 rounded-xl border border-border bg-card/95 p-2.5 shadow-elevated backdrop-blur-sm transition-all pointer-events-none text-[11.5px] min-w-[130px]"
          style={{
            left: `${leftPercent}%`,
            top: "20px",
            transform: leftPercent > 75 ? "translateX(-100%)" : leftPercent < 25 ? "translateX(0)" : "translateX(-50%)",
            marginLeft: leftPercent > 75 ? "-8px" : leftPercent < 25 ? "8px" : "0",
          }}
        >
          <div className="font-semibold text-foreground mb-1">{fmtDay(hoveredRow.session_date)}</div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-sm bg-[var(--chart-4)]" />
            <span>Gross: <strong className="text-foreground num">{fmt(hoveredRow.gross_kwh, 0)}</strong> kWh</span>
          </div>
          {hoveredRow.rte_pct != null && (
            <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
              <span className="h-2 w-2 rounded-sm bg-[var(--primary)]" />
              <span>RTE: <strong className="text-foreground num">{fmt(hoveredRow.rte_pct, 1)}%</strong></span>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground mt-1 border-t border-border/40 pt-1">
            Active: <span className="text-foreground num">{hoveredRow.buses}</span> buses
          </div>
        </div>
      )}
    </div>
  );
}

function RegenStrip({ rows }: { rows: DailyTrendPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const n = rows.length;
  const W = 900;
  const H = 70;
  const padL = 6, padR = 6, padT = 8, padB = 8;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const valid = rows.filter((r) => r.regen_pct != null);
  const avg = valid.length ? valid.reduce((a, b) => a + (b.regen_pct ?? 0), 0) / valid.length : 0;

  const maxVal = Math.max(1, ...rows.map((r) => r.regen_pct ?? 0));
  const minVal = Math.min(...rows.map((r) => r.regen_pct ?? 0));
  const range = maxVal - minVal || 1;

  const slot = innerW / Math.max(1, n);

  // Generate points for line and area
  const pts = rows.map((r, i) => {
    if (r.regen_pct == null) return null;
    const x = padL + slot * i + slot / 2;
    const y = padT + innerH - ((r.regen_pct - minVal) / range) * innerH;
    return { x, y, val: r.regen_pct, r };
  });

  const validPts = pts.filter((p): p is NonNullable<typeof p> => p !== null);
  const linePoints = validPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPoints = validPts.length
    ? `${validPts[0].x.toFixed(1)},${(H - padB).toFixed(1)} ` +
      linePoints +
      ` ${validPts[validPts.length - 1].x.toFixed(1)},${(H - padB).toFixed(1)}`
    : "";

  const hoveredPt = hoveredIdx !== null ? pts[hoveredIdx] : null;
  const leftPercent = hoveredIdx !== null ? ((padL + slot * hoveredIdx + slot / 2) / W) * 100 : 0;

  return (
    <Panel title="Daily energy regeneration" subtitle={`avg ${fmt(avg, 1)}% across ${n} days`}>
      <div className="relative overflow-x-auto rounded-xl border border-border/60 bg-muted/20 p-3">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
          {/* Background area under line */}
          {areaPoints && (
            <polygon
              points={areaPoints}
              fill="var(--chart-2)"
              fillOpacity={0.11}
              pointerEvents="none"
            />
          )}

          {/* Dotted grid lines */}
          {[0.25, 0.5, 0.75].map((g) => (
            <line
              key={g}
              x1={padL}
              x2={W - padR}
              y1={padT + innerH * g}
              y2={padT + innerH * g}
              stroke="color-mix(in oklab,var(--muted-foreground) 11%,transparent)"
              strokeWidth={1}
              strokeDasharray="2 2"
              pointerEvents="none"
            />
          ))}

          {/* Main trend line */}
          {linePoints && (
            <polyline
              points={linePoints}
              fill="none"
              stroke="var(--chart-2)"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {/* Hover cursor guide line */}
          {hoveredIdx !== null && hoveredPt && (
            <line
              x1={hoveredPt.x}
              x2={hoveredPt.x}
              y1={padT}
              y2={H - padB}
              stroke="color-mix(in oklab,var(--chart-2) 35%,transparent)"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          )}

          {/* Hover highlighted dot */}
          {hoveredIdx !== null && hoveredPt && (
            <g pointerEvents="none">
              <circle cx={hoveredPt.x} cy={hoveredPt.y} r={5.5} fill="var(--card)" stroke="var(--chart-2)" strokeWidth={2} />
              <circle cx={hoveredPt.x} cy={hoveredPt.y} r={2} fill="var(--chart-2)" />
            </g>
          )}

          {/* Hover detection zones */}
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

        {/* Floating tooltip */}
        {hoveredIdx !== null && hoveredPt && (
          <div
            className="absolute z-50 rounded-xl border border-border bg-card/95 p-2 shadow-elevated backdrop-blur-sm transition-all pointer-events-none text-[11px] min-w-[100px]"
            style={{
              left: `${leftPercent}%`,
              bottom: "4px",
              transform: leftPercent > 80 ? "translateX(-100%)" : leftPercent < 20 ? "translateX(0)" : "translateX(-50%)",
              marginLeft: leftPercent > 80 ? "-8px" : leftPercent < 20 ? "8px" : "0",
            }}
          >
            <div className="font-semibold text-foreground mb-0.5">{fmtDay(hoveredPt.r.session_date)}</div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-sm bg-[var(--chart-2)]" />
              <span>Regen: <strong className="text-foreground num">{fmt(hoveredPt.val, 1)}%</strong></span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function MonthlyTrend({ label, unit, color, points, dec }: { label: string; unit: string; color: string; points: { label: string; v: number | null }[]; dec: number }) {
  const last = points[points.length - 1]?.v ?? null;
  const first = points.find((p) => p.v != null)?.v ?? null;
  const delta = last != null && first != null && first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
      <div className="section-label">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="num text-[24px] font-semibold">{fmt(last, dec)}</span>
        <span className="text-[12px] text-muted-foreground">{unit}</span>
        {delta != null && (
          <span className="num ml-auto text-[12px] font-semibold" style={{ color: delta >= 0 ? "var(--success)" : "var(--destructive)" }}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-3 h-12">
        <Sparkline vals={points.map((p) => p.v)} color={color} w={260} h={44} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        {points.map((p) => <span key={p.label}>{p.label}</span>)}
      </div>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return <div className="flex h-[240px] items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/20 text-[12px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {label}</div>;
}
function ErrorBox() {
  return <div className="flex h-[240px] items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 text-[12px] text-destructive">Failed to load daily trend.</div>;
}
function Empty({ label }: { label: string }) {
  return <div className="flex h-[240px] items-center justify-center rounded-xl border border-border/60 bg-muted/20 text-[12px] text-muted-foreground">{label}</div>;
}

function fmtDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}
