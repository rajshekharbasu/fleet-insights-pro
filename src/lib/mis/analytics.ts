import type {
  MergedTrip,
  MisTripRow,
  ScheduleMetrics,
  ScheduleReportRow,
} from "./types";
import { scheduleKey } from "./keys";
import type { OverlayMap } from "./merge";
import { mergeAllTrips } from "./merge";

export function computeScheduleMetrics(trips: MergedTrip[]): ScheduleMetrics {
  const sourceTrips = trips.filter((t) => t.status !== "extra");
  const extraTrips = trips.filter((t) => t.status === "extra");

  const tripCompleted = sourceTrips.filter((t) => t.status === "completed").length;
  const tripNotCompleted = sourceTrips.filter((t) => t.status === "lost").length;
  const shortTrip = sourceTrips.filter((t) => t.status === "short").length;

  const loss = (remark: number) =>
    sourceTrips.filter((t) => t.status === "lost" && t.remark === remark).length;

  const completedKMs = sourceTrips
    .filter((t) => t.isLost === 0)
    .reduce((s, t) => s + t.distanceInKM, 0);
  const lossKMs = sourceTrips
    .filter((t) => t.status === "lost")
    .reduce((s, t) => s + t.distanceInKM, 0);
  const extraKMs = extraTrips.reduce((s, t) => s + t.distanceInKM, 0);

  return {
    scheduledTrips: sourceTrips.length,
    tripCompleted,
    tripNotCompleted,
    shortTrip,
    lossA1: loss(1),
    lossA2: loss(2),
    lossB: loss(3),
    lossC: loss(4),
    lossE1: loss(5),
    lossE2: loss(6),
    totalLoss: tripNotCompleted,
    completedKMs,
    lossKMs,
    extraKMs,
    billingKMs: completedKMs + extraKMs,
    extraTripCount: extraTrips.length,
  };
}

function enrichRoute(scheduleCode: string): string {
  const m = scheduleCode.match(/^([A-Z]+-\d+)/i);
  return m?.[1] ?? scheduleCode.split("-")[0] ?? scheduleCode;
}

export function buildScheduleReports(
  sourceRows: MisTripRow[],
  overlay: OverlayMap,
): ScheduleReportRow[] {
  const merged = mergeAllTrips(sourceRows, overlay);
  const groups = new Map<string, MergedTrip[]>();

  merged.forEach((t) => {
    const k = scheduleKey(t.scheduleCode, t.shift);
    const arr = groups.get(k) ?? [];
    arr.push(t);
    groups.set(k, arr);
  });

  const reports: ScheduleReportRow[] = [];
  let sr = 0;

  groups.forEach((trips, key) => {
    const first = trips.find((t) => t.status !== "extra") ?? trips[0]!;
    const metrics = computeScheduleMetrics(trips);
    const hasAdjustment = trips.some((t) => t.hasOverride);

    const times = trips
      .filter((t) => t.status !== "extra")
      .map((t) => t.startTime)
      .sort();
    const endTimes = trips
      .filter((t) => t.status !== "extra")
      .map((t) => t.endTime)
      .sort();

    const aToB = trips
      .filter((t) => t.status !== "extra")
      .reduce((s, t) => s + t.distanceInKM, 0);
    const roundTrip = aToB * 2;

    sr += 1;
    reports.push({
      key,
      scheduleCode: first.scheduleCode,
      shift: first.shift,
      schedulingDate: first.schedulingDate,
      driverId: first.employeeCode,
      driverName: first.driverName,
      zone: first.zone ?? "Zone A",
      runningBoard: first.runningBoard ?? first.scheduleCode,
      busNo: first.vehicleNumber,
      busType: first.busType,
      vehicleType: first.vehicleType,
      route: first.route ?? enrichRoute(first.scheduleCode),
      service: first.service ?? "Regular",
      depotStartKm: 4.2,
      aToBKm: +(aToB / 2).toFixed(2),
      bToAKm: +(aToB / 2).toFixed(2),
      closingDepotKm: 4.1,
      roundTripKm: +roundTrip.toFixed(2),
      scheduleStartTime: times[0] ?? "—",
      scheduleEndTime: endTimes[endTimes.length - 1] ?? "—",
      metrics,
      trips: trips.sort((a, b) => a.tripNumber - b.tripNumber),
      hasAdjustment,
    });
  });

  return reports.sort((a, b) =>
    a.scheduleCode.localeCompare(b.scheduleCode) || a.shift.localeCompare(b.shift),
  );
}

export function routePrefix(scheduleCode: string): string {
  return enrichRoute(scheduleCode);
}

export function filterTrips(
  rows: MisTripRow[],
  opts: {
    dateFrom: string;
    dateTo: string;
    routes: string[];
    shift: "All" | "Morning" | "Evening";
    siteId?: string | null;
  },
): MisTripRow[] {
  return rows.filter((r) => {
    if (opts.siteId && r.siteId !== opts.siteId) return false;
    if (r.schedulingDate < opts.dateFrom || r.schedulingDate > opts.dateTo) return false;
    if (opts.shift !== "All" && r.shift !== opts.shift) return false;
    if (opts.routes.length > 0 && !opts.routes.includes(routePrefix(r.scheduleCode))) {
      return false;
    }
    return true;
  });
}

export function distinctRoutes(rows: MisTripRow[]): string[] {
  return [...new Set(rows.map((r) => routePrefix(r.scheduleCode)))].sort();
}

export function fmtKm(n: number): string {
  return n.toFixed(2);
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}
