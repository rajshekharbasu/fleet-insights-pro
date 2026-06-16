import { useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { useMemo } from "react";
import { median } from "@/lib/analytics";
import { CHART_ENTER, CHART_ENTER_FAST } from "@/lib/chart-motion";

export interface TrendPoint {
  date: string;
  kwhPerKm: number;
  regenRatio: number;
  netKwh: number;
  socDropPerKm: number;
  idleShare: number;
}

const METRICS = [
  { key: "kwhPerKm", label: "kWh / km", unit: "kWh/km", color: "var(--color-chart-1)" },
  { key: "regenRatio", label: "Regen Ratio", unit: "%", color: "var(--color-chart-2)" },
  { key: "netKwh", label: "Net kWh", unit: "kWh", color: "var(--color-chart-3)" },
  { key: "socDropPerKm", label: "SOC Drop / km", unit: "%/km", color: "var(--color-chart-4)" },
  { key: "idleShare", label: "Idle Share", unit: "%", color: "var(--color-chart-5)" },
] as const;

type MetricKey = typeof METRICS[number]["key"];

function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/70 bg-popover/95 px-3 py-2 text-[12px] shadow-elevated backdrop-blur-sm">
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto num font-medium text-foreground">
            {Number(p.value).toFixed(2)} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MetricTrendChart({
  data, prevData, isGraphQl, error,
}: { 
  data: TrendPoint[]; 
  prevData?: TrendPoint[]; 
  isGraphQl?: boolean; 
  error?: any; 
}) {
  const [metric, setMetric] = useState<MetricKey>("kwhPerKm");
  const [compare, setCompare] = useState(false);
  const m = METRICS.find((x) => x.key === metric)!;

  const merged = data.map((d, i) => ({
    date: d.date.slice(5),
    current: d[metric],
    previous: compare && prevData?.[i] ? prevData[i][metric] : undefined,
  }));

  const periodMedian = useMemo(
    () => median(data.map((d) => d[metric])),
    [data, metric],
  );

  return (
    <div className="card-interactive chart-enter rounded-2xl border border-border/50 bg-card p-5 shadow-elevated">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight">Performance trend</h3>
            {isGraphQl && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-inset ring-success/20">
                GraphQL
              </span>
            )}
            {error && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/20" title={error instanceof Error ? error.message : String(error)}>
                Offline Fallback
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Daily aggregate · dashed line is period median{" "}
            <span className="num font-medium text-foreground">
              ({periodMedian.toFixed(2)} {m.unit})
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center rounded-xl border border-border/50 bg-card/80 p-1">
            {METRICS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setMetric(opt.key)}
                className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition-all ${
                  metric === opt.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCompare((v) => !v)}
            className={`rounded-xl border px-3 py-1.5 text-[11.5px] font-medium transition-all ${
              compare
                ? "border-primary/40 bg-primary/12 text-primary"
                : "border-border/50 text-muted-foreground hover:border-primary/25 hover:text-foreground"
            }`}
          >
            Compare prev. period
          </button>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={merged} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="trend-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={m.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={m.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} width={48} />
            <ReferenceLine
              y={periodMedian}
              stroke="var(--color-muted-foreground)"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `Median ${periodMedian.toFixed(2)}`,
                position: "insideTopRight",
                fill: "var(--color-muted-foreground)",
                fontSize: 10,
              }}
            />
            <Tooltip content={<CustomTooltip unit={m.unit} />} cursor={{ stroke: "var(--color-border)", strokeDasharray: "3 3" }} />
            {compare && (
              <Line
                type="monotone"
                dataKey="previous"
                name="Previous"
                stroke="var(--color-muted-foreground)"
                strokeWidth={1.4}
                strokeDasharray="4 4"
                dot={false}
                {...CHART_ENTER_FAST}
              />
            )}
            <Area
              key={metric}
              type="monotone"
              dataKey="current"
              name={m.label}
              stroke={m.color}
              strokeWidth={2}
              fill="url(#trend-grad)"
              {...CHART_ENTER}
            />
            {compare && <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
