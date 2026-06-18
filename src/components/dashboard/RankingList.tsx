import { Award, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MedianRangeBar } from "@/components/dashboard/MedianBaseline";
import { computePivotMedians, type PivotDim, type PivotRow, type Filters, DEFAULT_FILTERS } from "@/lib/analytics";
import { fetchPivotExploration, mapGraphQlPivotRow, fetchDynamicPivot } from "@/lib/graphql/pivot";

const DIMS: { key: PivotDim; label: string }[] = [
  { key: "driver_name", label: "Drivers" },
  { key: "route_code", label: "Routes" },
  { key: "vehiclenumber", label: "Vehicles" },
  { key: "company_name", label: "Companies" },
];

const PIVOT_TYPE_MAP: Record<PivotDim, string> = {
  driver_name: "DRIVER",
  route_code: "ROUTE",
  vehiclenumber: "VEHICLE",
  company_name: "COMPANY",
  scheduling_date: "DATE",
};

const METRICS: { key: keyof PivotRow; label: string; lowerIsBetter: boolean; format: (n: number) => string }[] = [
  { key: "kwhPerKm", label: "Efficiency", lowerIsBetter: true, format: (n) => `${n.toFixed(2)} kWh/km` },
  { key: "regenRatio", label: "Regen ratio", lowerIsBetter: false, format: (n) => `${n.toFixed(1)}%` },
  { key: "anomalies", label: "Anomalies", lowerIsBetter: true, format: (n) => `${n}` },
  { key: "idleShare", label: "Idle waste", lowerIsBetter: true, format: (n) => `${n.toFixed(1)}%` },
];

export function RankingList({ rowsByDim, filters }: { rowsByDim: (dim: PivotDim) => PivotRow[]; filters?: Filters }) {
  const [dim, setDim] = useState<PivotDim>("driver_name");
  const [metricKey, setMetricKey] = useState<typeof METRICS[number]["key"]>("kwhPerKm");
  const metric = METRICS.find((m) => m.key === metricKey)!;

  const pivotType = PIVOT_TYPE_MAP[dim];

  const { data: dbPivotRows, isLoading, error } = useQuery({
    queryKey: ["dynamic_pivot", "ranking", dim, filters],
    queryFn: () => fetchDynamicPivot(dim, filters || DEFAULT_FILTERS),
  });

  const rows = useMemo(() => {
    let rawRows = rowsByDim(dim);
    if (dbPivotRows && dbPivotRows.length > 0) {
      rawRows = dbPivotRows;
    }
    return rawRows.filter((r) => r.trips >= 3);
  }, [dbPivotRows, dim, rowsByDim]);

  const medians = useMemo(() => {
    if (!rows.length) {
      return {
        kwhPerKm: 0,
        regenRatio: 0,
        idleShare: 0,
        anomalies: 0,
        netKwh: 0,
        trips: 0,
        distance: 0,
      };
    }
    const first = rows[0];
    if ("fleetKwhPerKmMedian" in first) {
      return {
        kwhPerKm: (first as any).fleetKwhPerKmMedian ?? 0,
        regenRatio: (first as any).fleetRegenPctMedian ?? 0,
        idleShare: (first as any).fleetIdlePctMedian ?? 0,
        anomalies: (first as any).fleetAnomaliesMedian ?? 0,
        netKwh: (first as any).fleetNetKwhMedian ?? 0,
        trips: (first as any).fleetTripsMedian ?? 0,
        distance: (first as any).fleetDistanceMedian ?? 0,
      };
    }
    return computePivotMedians(rows);
  }, [rows]);

  const medianVal = medians[metricKey as keyof typeof medians] as number;

  const { top, bottom } = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const av = a[metricKey] as number;
      const bv = b[metricKey] as number;
      return metric.lowerIsBetter ? av - bv : bv - av;
    });
    return { top: sorted.slice(0, 5), bottom: sorted.slice(-5).reverse() };
  }, [rows, metricKey, metric.lowerIsBetter]);

  return (
    <div className="card-interactive rounded-2xl border border-border/50 bg-card p-5 shadow-elevated">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight">Performance rankings</h3>
            {dbPivotRows && dbPivotRows.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-inset ring-success/20">
                GraphQL
              </span>
            )}
            {error && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/20" title={error.message}>
                Offline Fallback
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Best and worst vs pivot median{" "}
            <span className="num font-medium text-primary">
              ({metric.format(medianVal)})
            </span>
            {" "}— min. 50 trips.
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
        {isLoading ? (
          <div className="col-span-2 py-12 text-center text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Querying GraphQL server...</span>
            </div>
          </div>
        ) : (
          <>
            <RankColumn title="Top performers" tone="success" rows={top} metric={metric} median={medianVal} icon={<TrendingUp className="h-3.5 w-3.5" />} />
            <RankColumn title="Underperformers" tone="destructive" rows={bottom} metric={metric} median={medianVal} icon={<TrendingDown className="h-3.5 w-3.5" />} />
          </>
        )}
      </div>
    </div>
  );
}

function RankColumn({
  title, rows, metric, median, tone, icon,
}: {
  title: string;
  rows: PivotRow[];
  metric: typeof METRICS[number];
  median: number;
  tone: "success" | "destructive";
  icon: React.ReactNode;
}) {
  const accent = tone === "success" ? "text-success bg-success/10 ring-success/20" : "text-destructive bg-destructive/10 ring-destructive/20";
  const values = rows.map((r) => r[metric.key] as number);
  const min = Math.min(median, ...values);
  const max = Math.max(median, ...values, 1);

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
                <MedianRangeBar
                  value={v}
                  median={median}
                  min={min}
                  max={max}
                  lowerIsBetter={metric.lowerIsBetter}
                />
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
