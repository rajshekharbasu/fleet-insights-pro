import { Award, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { PivotDim, PivotRow } from "@/lib/analytics";

const DIMS: { key: PivotDim; label: string }[] = [
  { key: "driver_name", label: "Drivers" },
  { key: "route_code", label: "Routes" },
  { key: "vehiclenumber", label: "Vehicles" },
  { key: "company_name", label: "Companies" },
];

const METRICS: { key: keyof PivotRow; label: string; lowerIsBetter: boolean; format: (n: number) => string }[] = [
  { key: "kwhPerKm", label: "Efficiency", lowerIsBetter: true, format: (n) => `${n.toFixed(2)} kWh/km` },
  { key: "regenRatio", label: "Regen ratio", lowerIsBetter: false, format: (n) => `${n.toFixed(1)}%` },
  { key: "anomalies", label: "Anomalies", lowerIsBetter: true, format: (n) => `${n}` },
  { key: "idleShare", label: "Idle waste", lowerIsBetter: true, format: (n) => `${n.toFixed(1)}%` },
];

export function RankingList({ rowsByDim }: { rowsByDim: (dim: PivotDim) => PivotRow[] }) {
  const [dim, setDim] = useState<PivotDim>("driver_name");
  const [metricKey, setMetricKey] = useState<typeof METRICS[number]["key"]>("kwhPerKm");
  const metric = METRICS.find((m) => m.key === metricKey)!;
  const rows = rowsByDim(dim).filter((r) => r.trips >= 3);

  const { top, bottom } = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const av = a[metricKey] as number;
      const bv = b[metricKey] as number;
      return metric.lowerIsBetter ? av - bv : bv - av;
    });
    return { top: sorted.slice(0, 5), bottom: sorted.slice(-5).reverse() };
  }, [rows, metricKey, metric.lowerIsBetter]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Performance rankings</h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Best and worst performers across the fleet (min. 3 trips).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/60 bg-card/80 p-0.5">
            {DIMS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDim(d.key)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] transition-colors ${
                  dim === d.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-lg border border-border/60 bg-card/80 p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.key as string}
                onClick={() => setMetricKey(m.key)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] transition-colors ${
                  metricKey === m.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RankColumn title="Top performers" tone="success" rows={top} metric={metric} icon={<TrendingUp className="h-3.5 w-3.5" />} />
        <RankColumn title="Underperformers" tone="destructive" rows={bottom} metric={metric} icon={<TrendingDown className="h-3.5 w-3.5" />} />
      </div>
    </div>
  );
}

function RankColumn({
  title, rows, metric, tone, icon,
}: {
  title: string;
  rows: PivotRow[];
  metric: typeof METRICS[number];
  tone: "success" | "destructive";
  icon: React.ReactNode;
}) {
  const accent = tone === "success" ? "text-success bg-success/10 ring-success/20" : "text-destructive bg-destructive/10 ring-destructive/20";
  const max = Math.max(...rows.map((r) => Math.abs(r[metric.key] as number)), 1);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium ring-1 ${accent}`}>
          {icon} {title}
        </span>
      </div>
      <ol className="space-y-1.5">
        {rows.map((r, i) => {
          const v = r[metric.key] as number;
          const w = (Math.abs(v) / max) * 100;
          return (
            <li
              key={r.key}
              className="group flex items-center gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2 transition-colors hover:border-border hover:bg-muted/40"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/60 text-[11px] font-semibold text-muted-foreground">
                {i === 0 && tone === "success" ? <Award className="h-3.5 w-3.5 text-warning" /> : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-foreground">{r.label}</div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={tone === "success" ? "h-full bg-success/70" : "h-full bg-destructive/70"}
                    style={{ width: `${w}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <div className="num text-[12.5px] font-semibold text-foreground">{metric.format(v)}</div>
                <div className="text-[10.5px] text-muted-foreground">{r.trips} trips</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
