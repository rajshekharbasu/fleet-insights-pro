import { useMemo } from "react";
import { buildPivot } from "@/lib/mis/pivot";
import { sampleMergedTrips } from "@/lib/mis/preview-sample";
import { PIVOT_DIMENSIONS, PIVOT_METRICS } from "@/lib/mis/constants";
import { OPS } from "@/lib/mis/ops-copy";
import { fmtKm, fmtPct } from "@/lib/mis/analytics";
import type { PivotConfig, PivotMetric } from "@/lib/mis/types";
import { MisTableShell, Td, Th } from "./mis-shared";

function formatMetric(m: PivotMetric, v: number): string {
  if (m === "completionPct" || m === "lossPct") return fmtPct(v);
  if (m.includes("KMs") || m === "billingKMs") return fmtKm(v);
  return String(Math.round(v * 10) / 10);
}

function dimLabel(id: PivotConfig["rowDim"]): string {
  return PIVOT_DIMENSIONS.find((d) => d.id === id)?.label ?? id;
}

function metricLabel(id: PivotMetric): string {
  return PIVOT_METRICS.find((m) => m.id === id)?.label ?? id;
}

export function MisPivotPreview({
  siteName,
  config,
  useLiveTrips,
  liveTrips,
}: {
  siteName: string;
  config: PivotConfig;
  useLiveTrips?: boolean;
  liveTrips?: Parameters<typeof buildPivot>[0];
}) {
  const pivot = useMemo(() => {
    const rows = useLiveTrips && liveTrips?.length ? liveTrips : sampleMergedTrips(siteName);
    return buildPivot(rows, new Map(), config);
  }, [siteName, config, useLiveTrips, liveTrips]);

  if (!config.metrics.length) {
    return (
      <p className="py-6 text-center text-[13px] text-muted-foreground">
        Pick at least one number to show in the summary table.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] font-semibold text-primary">{OPS.previewSummary}</div>
        <div className="text-[12px] text-muted-foreground">
          {OPS.pivotRows}: <strong className="text-foreground">{dimLabel(config.rowDim)}</strong>
          {config.colDim !== "none" && (
            <>
              {" "}
              · Columns: <strong className="text-foreground">{dimLabel(config.colDim as PivotConfig["rowDim"])}</strong>
            </>
          )}
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-dashed border-primary/35 bg-background">
        <MisTableShell className="min-w-0">
          <thead>
            <tr>
              <Th className="bg-muted/80 py-2 text-[10px]">{dimLabel(config.rowDim)}</Th>
              {config.metrics.map((m) => (
                <Th key={m} align="right" className="bg-muted/80 py-2 text-[10px]">
                  {metricLabel(m)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pivot.rowLabels.slice(0, 6).map((row) => (
              <tr key={row} className="hover:bg-muted/15">
                <Td className="py-1.5 text-[11px] font-medium">{row}</Td>
                {config.metrics.map((m) => (
                  <Td key={m} align="right" className="py-1.5 text-[11px] tabular-nums">
                    {formatMetric(m, pivot.rowTotals[row]?.[m] ?? 0)}
                  </Td>
                ))}
              </tr>
            ))}
            <tr className="bg-muted/40 font-semibold">
              <Td className="py-1.5 text-[11px]">Total</Td>
              {config.metrics.map((m) => (
                <Td key={m} align="right" className="py-1.5 text-[11px]">
                  {formatMetric(m, pivot.grandTotal[m] ?? 0)}
                </Td>
              ))}
            </tr>
          </tbody>
        </MisTableShell>
      </div>

      {!useLiveTrips && (
        <p className="text-[11px] text-muted-foreground">{OPS.sampleDataNote}</p>
      )}
    </div>
  );
}
