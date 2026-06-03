import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileDown, FileSpreadsheet, RotateCcw } from "lucide-react";
import { useMisReport } from "@/contexts/MisReportContext";
import { useMisSiteTemplate } from "@/contexts/MisSiteTemplateContext";
import { exportToXlsx } from "@/lib/export-xlsx";
import { markCompleted, markLost, markShort } from "@/contexts/MisReportContext";
import { getScheduleCellValue, getTotalCellValue, groupBand } from "@/lib/mis/kms-columns";
import { COLUMN_GROUPS } from "@/lib/mis/column-groups";
import { OPS } from "@/lib/mis/ops-copy";
import { Button } from "@/components/ui/button";
import { ReasonPicker } from "./ReasonPicker";
import { MisStatusLegend } from "./MisStatusLegend";
import { MisTableShell, StatusPill, Td, Th } from "./mis-shared";

export function KmsReportTab() {
  const { state, scheduleReports, generateReport, resetAllAdjustments, setFilters, patchTrip } =
    useMisReport();
  const { visibleColumns, activeTemplate } = useMisSiteTemplate();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingTrip, setEditingTrip] = useState<string | null>(null);

  const totals = useMemo(() => {
    const t = scheduleReports.reduce(
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
    return t;
  }, [scheduleReports]);

  const exportExcel = () => {
    const rows = scheduleReports.map((r, i) => {
      const row: Record<string, string | number> = {};
      visibleColumns.forEach((col) => {
        row[col.id] = getScheduleCellValue(r, col.id, i);
      });
      return row;
    });
    exportToXlsx(
      `kms-${activeTemplate.siteId}`,
      visibleColumns.map((col) => ({ key: col.id, header: col.header })),
      rows,
      activeTemplate.templateName.slice(0, 31),
    );
  };

  const exportPdf = () => {
    document.body.classList.add("mis-print-kms");
    window.print();
    document.body.classList.remove("mis-print-kms");
  };

  return (
    <div className="space-y-4 mis-kms-report">
      <MisReportControls
        onGenerate={generateReport}
        onReset={resetAllAdjustments}
        onExportExcel={exportExcel}
        onExportPdf={exportPdf}
        exportDisabled={!state.reportGenerated}
        setFilters={setFilters}
        state={state}
      />

      {activeTemplate.routes.length > 0 && (
        <p className="text-[12px] text-muted-foreground">
          {OPS.routesAutoFilter}{" "}
          <strong className="text-foreground">{activeTemplate.routes.join(", ")}</strong>
        </p>
      )}

      {state.loadState === "ready" && scheduleReports.length > 0 && (
        <>
          <MisStatusLegend />
          <p className="text-[12px] text-muted-foreground">{OPS.expandTripsHint}</p>
        </>
      )}

      {state.loadState === "loading" && <SkeletonTable />}
      {state.loadState === "error" && (
        <ErrorPanel message={state.errorMessage ?? "Failed to load"} onRetry={generateReport} />
      )}
      {state.loadState === "ready" && scheduleReports.length === 0 && (
        <p className="py-12 text-center text-[13px] text-muted-foreground">
          No trips found for selected date and filters.
        </p>
      )}
      {state.loadState === "ready" && scheduleReports.length > 0 && (
        <MisTableShell>
          <thead>
            <tr>
              <Th band={COLUMN_GROUPS.identity.band} className="w-8" />
              {visibleColumns.map((col) => (
                <Th key={col.id} band={groupBand(col.group)} align={col.align}>
                  {col.header}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scheduleReports.map((row, idx) => {
              const open = expanded.has(row.key);
              return (
                <Fragment key={row.key}>
                  <tr
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() =>
                      setExpanded((s) => {
                        const n = new Set(s);
                        if (n.has(row.key)) n.delete(row.key);
                        else n.add(row.key);
                        return n;
                      })
                    }
                  >
                    <Td>
                      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </Td>
                    {visibleColumns.map((col) => (
                      <Td
                        key={col.id}
                        align={col.align}
                        className={col.id === "billingKMs" ? "font-semibold" : undefined}
                      >
                        {col.id === "sr" && row.hasAdjustment && (
                          <span
                            className="mr-1.5 inline-block h-2 w-2 rounded-full bg-primary"
                            title={OPS.rowAdjusted}
                          />
                        )}
                        {getScheduleCellValue(row, col.id, idx)}
                      </Td>
                    ))}
                  </tr>
                  {open &&
                    row.trips.map((trip) => (
                      <tr
                        key={trip.tripKey}
                        className={
                          trip.status === "lost"
                            ? "bg-red-500/8"
                            : trip.status === "short"
                              ? "bg-amber-500/8"
                              : trip.status === "extra"
                                ? "bg-emerald-500/8"
                                : "bg-muted/15"
                        }
                      >
                        <Td />
                        <Td colSpan={visibleColumns.length} className="py-2 pl-6">
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
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTrip(editingTrip === trip.tripKey ? null : trip.tripKey);
                              }}
                            >
                              {OPS.editTrip}
                            </Button>
                          </div>
                          {editingTrip === trip.tripKey && (
                            <div className="pb-2" onClick={(e) => e.stopPropagation()}>
                              <TripQuickActions
                                tripKey={trip.tripKey}
                                status={trip.status}
                                onPatch={patchTrip}
                                onClose={() => setEditingTrip(null)}
                              />
                            </div>
                          )}
                        </Td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
            <tr className="bg-muted/40 font-semibold">
              <Td />
              {visibleColumns.map((col) => (
                <Td key={col.id} align={col.align}>
                  {getTotalCellValue(col.id, totals)}
                </Td>
              ))}
            </tr>
          </tbody>
        </MisTableShell>
      )}
    </div>
  );
}

function TripQuickActions({
  tripKey,
  status,
  onPatch,
  onClose,
}: {
  tripKey: string;
  status: import("@/lib/mis/types").MergedTrip["status"];
  onPatch: (key: string, patch: import("@/lib/mis/types").TripOverride) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"lost" | "short" | null>(null);

  if (mode === "lost" || mode === "short") {
    return (
      <ReasonPicker
        onConfirm={(remark, notes) => {
          if (mode === "lost") onPatch(tripKey, markLost({}, remark, notes));
          else onPatch(tripKey, markShort({}, notes));
          setMode(null);
          onClose();
        }}
        onCancel={() => setMode(null)}
      />
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {status !== "lost" && status !== "extra" && (
        <Button size="sm" variant="destructive" className="h-7 text-[11px]" onClick={() => setMode("lost")}>
          {OPS.markNotDone}
        </Button>
      )}
      {status === "completed" && (
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setMode("short")}>
          {OPS.markShortTrip}
        </Button>
      )}
      {(status === "lost" || status === "short") && (
        <Button
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => {
            onPatch(tripKey, markCompleted());
            onClose();
          }}
        >
          {OPS.markDone}
        </Button>
      )}
    </div>
  );
}

function MisReportControls({
  state,
  onGenerate,
  onReset,
  onExportExcel,
  onExportPdf,
  exportDisabled,
  setFilters,
}: {
  state: ReturnType<typeof useMisReport>["state"];
  onGenerate: () => void;
  onReset: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  exportDisabled: boolean;
  setFilters: ReturnType<typeof useMisReport>["setFilters"];
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
      <p className="text-[13px] font-semibold">{OPS.step2}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[12px]">
          <span className="mb-1.5 block font-medium">From date</span>
          <input
            type="date"
            value={state.dateFrom}
            onChange={(e) => setFilters({ dateFrom: e.target.value })}
            className="h-11 rounded-md border border-border/60 bg-background px-3 text-[14px]"
          />
        </label>
        <label className="text-[12px]">
          <span className="mb-1.5 block font-medium">To date</span>
          <input
            type="date"
            value={state.dateTo}
            onChange={(e) => setFilters({ dateTo: e.target.value })}
            className="h-11 rounded-md border border-border/60 bg-background px-3 text-[14px]"
          />
        </label>
        <label className="text-[12px]">
          <span className="mb-1.5 block font-medium">Shift</span>
          <select
            value={state.shiftFilter}
            onChange={(e) =>
              setFilters({ shiftFilter: e.target.value as "All" | "Morning" | "Evening" })
            }
            className="h-11 rounded-md border border-border/60 bg-background px-3 text-[14px]"
          >
            <option>All</option>
            <option>Morning</option>
            <option>Evening</option>
          </select>
        </label>
        <Button
          size="lg"
          className="h-11 px-6 text-[14px]"
          onClick={onGenerate}
          disabled={state.loadState === "loading"}
        >
          {OPS.loadReport}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">{OPS.loadReportHint}</p>
      <div className="flex flex-wrap gap-2 border-t border-border/30 pt-3">
        <Button variant="outline" className="h-10" onClick={onReset}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          {OPS.undoChanges}
        </Button>
        <Button variant="outline" className="h-10" disabled={exportDisabled} onClick={onExportExcel}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          {OPS.downloadExcel}
        </Button>
        <Button variant="outline" className="h-10" disabled={exportDisabled} onClick={onExportPdf}>
          <FileDown className="mr-1.5 h-4 w-4" />
          {OPS.downloadPdf}
        </Button>
      </div>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-muted/50" />
      ))}
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-center">
      <p className="text-[13px]">{message}</p>
      <Button className="mt-3" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
