import type { PivotMedians } from "@/lib/analytics";

export function vsMedian(
  value: number,
  medianVal: number,
  lowerIsBetter = true,
): { diffPct: number; better: boolean; tie: boolean } {
  if (!medianVal) return { diffPct: 0, better: true, tie: true };
  const diffPct = ((value - medianVal) / medianVal) * 100;
  const tie = Math.abs(diffPct) < 1.5;
  const better = tie ? true : lowerIsBetter ? value <= medianVal : value >= medianVal;
  return { diffPct, better, tie };
}

/** Compact delta vs pivot median for table cells. */
export function VsMedianCell({
  value,
  median,
  format,
  lowerIsBetter = true,
  decimals = 2,
}: {
  value: number;
  median: number;
  format?: (v: number) => string;
  lowerIsBetter?: boolean;
  decimals?: number;
}) {
  const { diffPct, better, tie } = vsMedian(value, median, lowerIsBetter);
  const display = format ? format(value) : value.toFixed(decimals);

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`num font-medium ${
          tie ? "text-foreground" : better ? "text-success" : "text-destructive"
        }`}
      >
        {display}
      </span>
      {!tie && (
        <span
          className={`num text-[10px] ${
            better ? "text-success/80" : "text-destructive/80"
          }`}
        >
          {diffPct > 0 ? "+" : ""}
          {diffPct.toFixed(0)}% vs median
        </span>
      )}
    </div>
  );
}

/** Horizontal bar: median at center, value position relative to median. */
export function MedianRangeBar({
  value,
  median,
  min,
  max,
  lowerIsBetter = true,
}: {
  value: number;
  median: number;
  min: number;
  max: number;
  lowerIsBetter?: boolean;
}) {
  const span = Math.max(max - min, 0.001);
  const medPos = ((median - min) / span) * 100;
  const valPos = ((value - min) / span) * 100;
  const { better, tie } = vsMedian(value, median, lowerIsBetter);
  const fill =
    tie ? "var(--color-muted-foreground)" : better ? "var(--color-success)" : "var(--color-destructive)";

  return (
    <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
      <span
        className="absolute top-0 z-10 h-full w-0.5 -translate-x-1/2 bg-foreground/50"
        style={{ left: `${medPos}%` }}
        title={`Median ${median.toFixed(2)}`}
      />
      <span
        className="absolute top-1/2 z-20 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
        style={{ left: `${valPos}%`, background: fill }}
      />
    </div>
  );
}

export function MedianLegend() {
  return (
    <span className="inline-flex items-center gap-2 text-[10.5px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-0.5 bg-foreground/50" />
        Pivot median
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-success" />
        Better than median
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-destructive" />
        Worse than median
      </span>
    </span>
  );
}

export function PivotMedianFooter({ medians }: { medians: PivotMedians }) {
  return (
    <tfoot className="sticky bottom-0 z-10 border-t-2 border-primary/25 bg-primary/5 backdrop-blur-sm">
      <tr className="text-[12px] font-medium">
        <td className="px-4 py-3 text-foreground" colSpan={1}>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-0.5 rounded-full bg-foreground/60" />
            Fleet median
            <span className="text-[10px] font-normal text-muted-foreground">(this pivot)</span>
          </span>
        </td>
        <td className="px-4 py-3 text-right num text-muted-foreground">{medians.trips}</td>
        <td className="px-4 py-3 text-right num text-muted-foreground">
          {medians.distance.toLocaleString()} km
        </td>
        <td className="px-4 py-3 text-right num text-primary">{medians.netKwh.toLocaleString()}</td>
        <td className="px-4 py-3 text-right num text-primary">{medians.kwhPerKm.toFixed(2)}</td>
        <td className="px-4 py-3 text-right num text-muted-foreground">{medians.regenRatio.toFixed(1)}%</td>
        <td className="px-4 py-3 text-right num text-muted-foreground">{medians.idleShare.toFixed(1)}%</td>
        <td className="px-4 py-3 text-right num text-muted-foreground">{medians.anomalies.toFixed(0)}</td>
      </tr>
    </tfoot>
  );
}
