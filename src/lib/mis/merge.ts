import type { MergedTrip, MisTripRow, TripOverride } from "./types";
import { parseTripKey, tripKey } from "./keys";

export type OverlayMap = Map<string, TripOverride>;

export function mergeTrip(row: MisTripRow, overlay: OverlayMap): MergedTrip {
  const key = tripKey(row.scheduleCode, row.tripNumber);
  const o = overlay.get(key);

  const isLost = (o?.isLost ?? row.isLost) as 0 | 1;
  const isShort = isLost ? 0 : ((o?.isShort ?? row.isShort) as 0 | 1);
  const remark = o?.remark ?? row.remark;
  const reason = o?.reason ?? row.reason;

  let status: MergedTrip["status"] = "completed";
  if (o?.isExtra) status = "extra";
  else if (isLost) status = "lost";
  else if (isShort) status = "short";

  return {
    ...row,
    tripKey: key,
    hasOverride: !!o,
    isLost,
    isShort,
    remark,
    reason,
    fromStage: o?.fromStage ?? row.fromStage,
    toStage: o?.toStage ?? row.toStage,
    distanceInKM: o?.distanceInKM ?? row.distanceInKM,
    startTime: o?.startTime ?? row.startTime,
    endTime: o?.endTime ?? row.endTime,
    vehicleNumber: o?.vehicleNumber ?? row.vehicleNumber,
    status,
  };
}

export function mergeAllTrips(rows: MisTripRow[], overlay: OverlayMap): MergedTrip[] {
  const merged = rows.map((r) => mergeTrip(r, overlay));
  const sourceKeys = new Set(rows.map((r) => tripKey(r.scheduleCode, r.tripNumber)));

  const extraRows: MergedTrip[] = [];
  overlay.forEach((o, key) => {
    if (!o.isExtra || sourceKeys.has(key)) return;
    const { scheduleCode, tripNumber } = parseTripKey(key);
    const tn = Number(tripNumber);
    const base = rows.find((r) => r.scheduleCode === scheduleCode);

    extraRows.push({
      companyId: base?.companyId ?? "transvolt",
      siteId: base?.siteId ?? "khapri",
      schedulingDate: base?.schedulingDate ?? new Date().toISOString().slice(0, 10),
      scheduleCode,
      shift: base?.shift ?? "Morning",
      vehicleType: base?.vehicleType ?? "Electric",
      busType: base?.busType ?? "12m",
      vehicleNumber: o.vehicleNumber ?? base?.vehicleNumber ?? "—",
      startTime: o.startTime ?? "—",
      endTime: o.endTime ?? "—",
      fromStage: o.fromStage ?? "—",
      toStage: o.toStage ?? "—",
      distanceInKM: o.distanceInKM ?? 0,
      aDistanceInKM: o.distanceInKM ?? 0,
      employeeCode: base?.employeeCode ?? "—",
      driverName: base?.driverName ?? "—",
      isLost: 0,
      isShort: 0,
      remark: 0,
      reason: o.reason ?? "Extra trip",
      tripNumber: Number.isFinite(tn) ? tn : 9000,
      isScheduleCodeChanged: 0,
      zone: base?.zone,
      runningBoard: base?.runningBoard,
      route: base?.route,
      service: base?.service,
      tripKey: key,
      hasOverride: true,
      status: "extra",
    });
  });

  return [...merged, ...extraRows];
}
