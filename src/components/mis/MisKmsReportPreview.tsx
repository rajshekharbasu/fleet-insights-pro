import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  DEFAULT_COLUMN_ORDER,
  getScheduleCellValue,
  getTotalCellValue,
  groupBand,
  resolveVisibleColumns,
  type ColumnTemplateConfig,
  type KmsColumnId,
} from "@/lib/mis/kms-columns";
import { OPS } from "@/lib/mis/ops-copy";
import { sampleScheduleReports } from "@/lib/mis/preview-sample";
import type { ScheduleReportRow } from "@/lib/mis/types";
import { MisTableShell, StatusPill, Td, Th } from "./mis-shared";
import { COLUMN_GROUPS } from "@/lib/mis/column-groups";
import { MisStatusLegend } from "./MisStatusLegend";

export function MisKmsReportPreview({
  siteName,
  templateName,
  routes,
  columns,
  columnOrder = DEFAULT_COLUMN_ORDER,
  rows: rowsProp,
  maxRows = 2,
  defaultExpandFirst = true,
  showLegend = true,
  showTripDetail = true,
  compact = false,
}: {
  siteName: string;
  templateName?: string;
  routes?: string[];
  columns: Partial<Record<KmsColumnId, ColumnTemplateConfig>>;
  columnOrder?: KmsColumnId[];
  rows?: ScheduleReportRow[];
  maxRows?: number;
  defaultExpandFirst?: boolean;
  showLegend?: boolean;
  showTripDetail?: boolean;
  /** Tighter layout for template editor side panel */
  compact?: boolean;
}) {
  const visibleColumns = useMemo(
    () => resolveVisibleColumns(columnOrder, columns),
    [columnOrder, columns],
  );

  const allRows = useMemo(
    () => rowsProp ?? sampleScheduleReports(siteName),
    [rowsProp, siteName],
  );

  const rows = useMemo(() => allRows.slice(0, maxRows), [allRows, maxRows]);

  const [expanded, setExpanded] = useState<Set<string>>(() =>
    defaultExpandFirst && rows[0] ? new Set([rows[0].key]) : new Set(),
  );

  const totals = useMemo(() => {
    return allRows.reduce(
      (acc, r) => {
        acc.tripCompleted += r.metrics.tripCompleted;
        acc.tripNotCompleted += r.metrics.tripNotCompleted;
        acc.shortTrip += r.metrics.shortTrip;
        acc.totalLoss += r.metrics.totalLoss;
        acc.completedKMs += r.metrics.completedKMs;
        acc.lossKMs += r.metrics.lossKMs;
        acc.extraKMs += r.metrics.extraKMs;
        acc.billingKMs += r.metrics.billingKMs;
        return acc;
      },
      {
        tripCompleted: 0,
        tripNotCompleted: 0,
        shortTrip: 0,
        totalLoss: 0,
        completedKMs: 0,
        lossKMs: 0,
        extraKMs: 0,
        billingKMs: 0,
      },
    );
  }, [allRows]);

  if (visibleColumns.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-muted-foreground">{OPS.emptyColumns}</p>
    );
  }

  const colSpanRest = Math.max(1, visibleColumns.length);

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] font-semibold text-primary">{OPS.previewDaily}</div>
        {templateName && <div className="text-[14px] font-semibold">{templateName}</div>}
        <div className="text-[12px] text-muted-foreground">
          {siteName}
          {routes && routes.length > 0 && <> · {routes.join(", ")}</>}
        </div>
      </div>

      {showLegend && <MisStatusLegend compact />}

      <p className="text-[11px] text-muted-foreground">
        Tap a row with ▶ to see each trip leg (completed, lost, short, extra).
      </p>

      <div
        className={`max-w-full overflow-x-auto overflow-y-visible rounded-lg border border-dashed border-primary/35 bg-background ${
          compact ? "max-h-[50vh]" : ""
        }`}
      >
        <MisTableShell className="min-w-0 w-max max-w-none">
          <thead>
            <tr>
              <Th band={COLUMN_GROUPS.identity.band} className="w-8 py-2" />
              {visibleColumns.map((col) => (
                <Th
                  key={col.id}
                  band={groupBand(col.group)}
                  align={col.align}
                  className={`py-2 ${compact ? "text-[9px] whitespace-nowrap px-1" : "text-[10px]"}`}
                >
                  {col.header}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const open = expanded.has(row.key);
              const tripRowClass =
                row.status === "lost"
                  ? "bg-red-500/8"
                  : row.status === "short"
                    ? "bg-amber-500/8"
                    : row.status === "extra"
                      ? "bg-emerald-500/8"
                      : "bg-muted/15";

              return (
                <Fragment key={row.key}>
                  <tr
                    className="cursor-pointer hover:bg-muted/25"
                    onClick={() =>
                      showTripDetail &&
                      setExpanded((s) => {
                        const n = new Set(s);
                        if (n.has(row.key)) n.delete(row.key);
                        else n.add(row.key);
                        return n;
                      })
                    }
                  >
                    <Td className="py-1.5">
                      {showTripDetail &&
                        (open ? (
                          <ChevronDown className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ))}
                    </Td>
                    {visibleColumns.map((col) => (
                      <Td
                        key={col.id}
                        align={col.align}
                        className={`py-1.5 text-[11px] ${col.id === "billingKMs" ? "font-semibold" : ""}`}
                      >
                        {col.id === "sr" && (
                          <>
                            {row.hasAdjustment && (
                              <span
                                className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary"
                                title={OPS.rowAdjusted}
                              />
                            )}
                          </>
                        )}
                        {getScheduleCellValue(row, col.id, idx)}
                      </Td>
                    ))}
                  </tr>
                  {showTripDetail &&
                    open &&
                    row.trips.map((trip) => (
                      <tr key={trip.tripKey} className={tripRowClass}>
                        <Td />
                        <Td colSpan={colSpanRest} className="py-2 pl-6">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-medium">
                              Trip {trip.tripNumber}: {trip.fromStage} → {trip.toStage}
                            </span>
                            <span className="tabular-nums">{trip.distanceInKM.toFixed(2)} km</span>
                            <span className="text-muted-foreground">
                              {trip.startTime}–{trip.endTime}
                            </span>
                            <StatusPill status={trip.status} />
                            {trip.hasOverride && (
                              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/30">
                                {OPS.rowAdjusted}
                              </span>
                            )}
                            {trip.reason && (
                              <span className="text-muted-foreground">— {trip.reason}</span>
                            )}
                          </div>
                        </Td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
            <tr className="bg-muted/50 font-semibold">
              <Td />
              {visibleColumns.map((col) => (
                <Td key={col.id} align={col.align} className="py-1.5 text-[11px]">
                  {getTotalCellValue(col.id, totals)}
                </Td>
              ))}
            </tr>
          </tbody>
        </MisTableShell>
      </div>

      {!rowsProp && (
        <p className="text-[11px] text-muted-foreground">{OPS.sampleDataNote}</p>
      )}
    </div>
  );
}
