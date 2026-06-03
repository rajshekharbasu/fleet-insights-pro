import type { MergedTrip, PivotConfig, PivotMetric } from "./types";
import { mergeAllTrips } from "./merge";
import type { OverlayMap } from "./merge";
import type { MisTripRow } from "./types";
import { computeScheduleMetrics } from "./analytics";
import { scheduleKey } from "./keys";

function dimValue(trip: MergedTrip, dim: PivotConfig["rowDim"]): string {
  switch (dim) {
    case "date":
      return trip.schedulingDate;
    case "route":
      return trip.route ?? trip.scheduleCode.split("-")[0];
    case "driver":
      return trip.driverName;
    case "vehicle":
      return trip.vehicleNumber;
    case "shift":
      return trip.shift;
    case "busType":
      return trip.busType;
    case "lossCategory":
      if (trip.status !== "lost") return "—";
      return String(trip.remark);
    case "zone":
      return trip.zone ?? "—";
    case "fromStage":
      return trip.fromStage;
    case "toStage":
      return trip.toStage;
    case "runningBoard":
      return trip.runningBoard ?? trip.scheduleCode;
    default:
      return "—";
  }
}

function aggMetrics(trips: MergedTrip[]): Record<PivotMetric, number> {
  const source = trips.filter((t) => t.status !== "extra");
  const extra = trips.filter((t) => t.status === "extra");
  const completed = source.filter((t) => t.status === "completed");
  const lost = source.filter((t) => t.status === "lost");
  const short = source.filter((t) => t.status === "short");

  const scheduledKMs = source.reduce((s, t) => s + t.distanceInKM, 0);
  const completedKMs = completed.reduce((s, t) => s + t.distanceInKM, 0);
  const lossKMs = lost.reduce((s, t) => s + t.distanceInKM, 0);
  const extraKMs = extra.reduce((s, t) => s + t.distanceInKM, 0);
  const billingKMs = completedKMs + extraKMs + short.reduce((s, t) => s + t.distanceInKM, 0);

  const scheduledTrips = source.length;
  const completedTrips = completed.length;
  const lostTrips = lost.length;

  return {
    scheduledTrips,
    completedTrips,
    shortTrips: short.length,
    lostTrips,
    extraTrips: extra.length,
    completionPct: scheduledTrips ? (completedTrips / scheduledTrips) * 100 : 0,
    scheduledKMs,
    completedKMs,
    lossKMs,
    extraKMs,
    billingKMs,
    lossPct: scheduledKMs ? (lossKMs / scheduledKMs) * 100 : 0,
    lossA1: lost.filter((t) => t.remark === 1).length,
    lossA2: lost.filter((t) => t.remark === 2).length,
    lossB: lost.filter((t) => t.remark === 3).length,
    lossC: lost.filter((t) => t.remark === 4).length,
    lossE1: lost.filter((t) => t.remark === 5).length,
    lossE2: lost.filter((t) => t.remark === 6).length,
  };
}

export interface PivotTableResult {
  rowLabels: string[];
  colLabels: string[];
  cells: Record<string, Record<string, Record<PivotMetric, number>>>;
  rowTotals: Record<string, Record<PivotMetric, number>>;
  colTotals: Record<string, Record<PivotMetric, number>>;
  grandTotal: Record<PivotMetric, number>;
}

export function buildPivot(
  sourceRows: MisTripRow[],
  overlay: OverlayMap,
  config: PivotConfig,
): PivotTableResult {
  const merged = mergeAllTrips(sourceRows, overlay);
  const buckets = new Map<string, MergedTrip[]>();

  merged.forEach((t) => {
    const row = dimValue(t, config.rowDim);
    const col = config.colDim === "none" ? "_" : dimValue(t, config.colDim as PivotConfig["rowDim"]);
    const k = `${row}\0${col}`;
    const arr = buckets.get(k) ?? [];
    arr.push(t);
    buckets.set(k, arr);
  });

  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  const cells: PivotTableResult["cells"] = {};

  buckets.forEach((trips, k) => {
    const [row, col] = k.split("\0");
    rowSet.add(row);
    colSet.add(col);
    cells[row] ??= {};
    cells[row][col] = aggMetrics(trips);
  });

  const rowLabels = [...rowSet].sort();
  const colLabels = config.colDim === "none" ? ["_"] : [...colSet].sort();

  const rowTotals: PivotTableResult["rowTotals"] = {};
  rowLabels.forEach((row) => {
    const all: MergedTrip[] = [];
    colLabels.forEach((col) => {
      const k = `${row}\0${col}`;
      all.push(...(buckets.get(k) ?? []));
    });
    rowTotals[row] = aggMetrics(all);
  });

  const colTotals: PivotTableResult["colTotals"] = {};
  colLabels.forEach((col) => {
    const all: MergedTrip[] = [];
    rowLabels.forEach((row) => {
      const k = `${row}\0${col}`;
      all.push(...(buckets.get(k) ?? []));
    });
    colTotals[col] = aggMetrics(all);
  });

  return {
    rowLabels,
    colLabels: config.colDim === "none" ? [] : colLabels,
    cells,
    rowTotals,
    colTotals,
    grandTotal: aggMetrics(merged),
  };
}

/** Schedule-level pivot slice */
export function buildPivotFromSchedules(
  reports: ReturnType<typeof import("./analytics").buildScheduleReports>,
  config: PivotConfig,
): PivotTableResult {
  const trips: MergedTrip[] = reports.flatMap((r) => r.trips);
  return buildPivot(
    trips.filter((t) => t.status !== "extra") as MisTripRow[],
    new Map(),
    config,
  );
}
