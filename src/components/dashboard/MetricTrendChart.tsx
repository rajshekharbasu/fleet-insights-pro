import { useState } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

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
  data, prevData,
}: { data: TrendPoint[]; prevData?: TrendPoint[] }) {
  const [metric, setMetric] = useState<MetricKey>("kwhPerKm");
  const [compare, setCompare] = useState(false);
  const m = METRICS.find((x) => x.key === metric)!;

  const merged = data.map((d, i) => ({
    date: d.date.slice(5),
    current: d[metric],
    previous: compare && prevData?.[i] ? prevData[i][metric] : undefined,
  }));

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Performance trend</h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Daily aggregate for the selected period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/60 bg-card/80 p-0.5">
            {METRICS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setMetric(opt.key)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] transition-colors ${
                  metric === opt.key
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCompare((v) => !v)}
            className={`rounded-lg border px-2.5 py-1 text-[11.5px] transition-colors ${
              compare ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
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
                isAnimationActive={false}
              />
            )}
            <Area
              type="monotone"
              dataKey="current"
              name={m.label}
              stroke={m.color}
              strokeWidth={2}
              fill="url(#trend-grad)"
              isAnimationActive={false}
            />
            {compare && <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
