import { fmtKm } from "./analytics";
import type { ScheduleReportRow } from "./types";
import { COLUMN_GROUPS, type ColumnGroupKey } from "./column-groups";

export type KmsColumnId =
  | "sr"
  | "date"
  | "driverId"
  | "zone"
  | "runningBoard"
  | "shift"
  | "busNo"
  | "busType"
  | "vehicleType"
  | "route"
  | "service"
  | "depotStartKm"
  | "aToBKm"
  | "bToAKm"
  | "closingDepotKm"
  | "roundTripKm"
  | "scheduledTrips"
  | "scheduleStartTime"
  | "scheduleEndTime"
  | "tripCompleted"
  | "shortTrip"
  | "tripNotCompleted"
  | "lossA1"
  | "lossA2"
  | "lossB"
  | "lossC"
  | "lossE1"
  | "lossE2"
  | "totalLoss"
  | "completedKMs"
  | "lossKMs"
  | "extraKMs"
  | "billingKMs";

export interface KmsColumnCatalogItem {
  id: KmsColumnId;
  group: ColumnGroupKey;
  defaultHeader: string;
  align: "left" | "right";
  /** Cannot be hidden (core identity) */
  locked?: boolean;
}

export const KMS_COLUMN_CATALOG: KmsColumnCatalogItem[] = [
  { id: "sr", group: "identity", defaultHeader: "Sr", align: "left", locked: true },
  { id: "date", group: "identity", defaultHeader: "Date", align: "left" },
  { id: "driverId", group: "identity", defaultHeader: "Driver ID", align: "left" },
  { id: "zone", group: "identity", defaultHeader: "Zone", align: "left" },
  { id: "runningBoard", group: "identity", defaultHeader: "Running Board", align: "left" },
  { id: "shift", group: "identity", defaultHeader: "Shift", align: "left" },
  { id: "busNo", group: "scheduleBus", defaultHeader: "Bus No", align: "left" },
  { id: "busType", group: "scheduleBus", defaultHeader: "Bus Type", align: "left" },
  { id: "vehicleType", group: "scheduleBus", defaultHeader: "Vehicle Type", align: "left" },
  { id: "route", group: "route", defaultHeader: "Route", align: "left" },
  { id: "service", group: "route", defaultHeader: "Service", align: "left" },
  { id: "depotStartKm", group: "route", defaultHeader: "Depot→Start KM", align: "right" },
  { id: "aToBKm", group: "route", defaultHeader: "A→B KM", align: "right" },
  { id: "bToAKm", group: "route", defaultHeader: "B→A KM", align: "right" },
  { id: "closingDepotKm", group: "route", defaultHeader: "Closing→Depot KM", align: "right" },
  { id: "roundTripKm", group: "route", defaultHeader: "Round Trip KM", align: "right" },
  { id: "scheduledTrips", group: "route", defaultHeader: "Scheduled Trip", align: "right" },
  { id: "scheduleStartTime", group: "route", defaultHeader: "Schedule Start Time", align: "left" },
  { id: "scheduleEndTime", group: "route", defaultHeader: "Schedule End Time", align: "left" },
  { id: "tripCompleted", group: "tripStatus", defaultHeader: "Trip Completed", align: "right" },
  { id: "shortTrip", group: "tripStatus", defaultHeader: "Short Trip", align: "right" },
  { id: "tripNotCompleted", group: "tripStatus", defaultHeader: "Not Completed", align: "right" },
  { id: "lossA1", group: "loss", defaultHeader: "Loss A1 (Conductor)", align: "right" },
  { id: "lossA2", group: "loss", defaultHeader: "Loss A2 (Driver)", align: "right" },
  { id: "lossB", group: "loss", defaultHeader: "Loss B (Traffic)", align: "right" },
  { id: "lossC", group: "loss", defaultHeader: "Loss C (Accident)", align: "right" },
  { id: "lossE1", group: "loss", defaultHeader: "Loss E1 (Defect)", align: "right" },
  { id: "lossE2", group: "loss", defaultHeader: "Loss E2 (Battery)", align: "right" },
  { id: "totalLoss", group: "loss", defaultHeader: "Total Loss", align: "right" },
  { id: "completedKMs", group: "km", defaultHeader: "Completed KMs", align: "right" },
  { id: "lossKMs", group: "km", defaultHeader: "Loss KMs", align: "right" },
  { id: "extraKMs", group: "km", defaultHeader: "Extra KMs", align: "right" },
  { id: "billingKMs", group: "km", defaultHeader: "Billing KMs", align: "right" },
];

export const DEFAULT_COLUMN_ORDER: KmsColumnId[] = KMS_COLUMN_CATALOG.map((c) => c.id);

export type ColumnTemplateConfig = {
  header: string;
  visible: boolean;
};

export function resolveVisibleColumns(
  columnOrder: KmsColumnId[],
  columns: Partial<Record<KmsColumnId, ColumnTemplateConfig>>,
): Array<KmsColumnCatalogItem & ColumnTemplateConfig> {
  const catalog = new Map(KMS_COLUMN_CATALOG.map((c) => [c.id, c]));
  return columnOrder
    .map((id) => {
      const def = catalog.get(id);
      if (!def) return null;
      const cfg = columns[id];
      const visible = def.locked ? true : (cfg?.visible ?? true);
      if (!visible) return null;
      return {
        ...def,
        header: cfg?.header?.trim() || def.defaultHeader,
        visible: true,
      };
    })
    .filter((c): c is KmsColumnCatalogItem & ColumnTemplateConfig => c !== null);
}

export function getScheduleCellValue(
  row: ScheduleReportRow,
  colId: KmsColumnId,
  rowIndex: number,
): string | number {
  const m = row.metrics;
  switch (colId) {
    case "sr":
      return rowIndex + 1;
    case "date":
      return row.schedulingDate;
    case "driverId":
      return row.driverId;
    case "zone":
      return row.zone;
    case "runningBoard":
      return row.runningBoard;
    case "shift":
      return row.shift;
    case "busNo":
      return row.busNo;
    case "busType":
      return row.busType;
    case "vehicleType":
      return row.vehicleType;
    case "route":
      return row.route;
    case "service":
      return row.service;
    case "depotStartKm":
      return fmtKm(row.depotStartKm);
    case "aToBKm":
      return fmtKm(row.aToBKm);
    case "bToAKm":
      return fmtKm(row.bToAKm);
    case "closingDepotKm":
      return fmtKm(row.closingDepotKm);
    case "roundTripKm":
      return fmtKm(row.roundTripKm);
    case "scheduledTrips":
      return m.scheduledTrips;
    case "scheduleStartTime":
      return row.scheduleStartTime;
    case "scheduleEndTime":
      return row.scheduleEndTime;
    case "tripCompleted":
      return m.tripCompleted;
    case "shortTrip":
      return m.shortTrip;
    case "tripNotCompleted":
      return m.tripNotCompleted;
    case "lossA1":
      return m.lossA1;
    case "lossA2":
      return m.lossA2;
    case "lossB":
      return m.lossB;
    case "lossC":
      return m.lossC;
    case "lossE1":
      return m.lossE1;
    case "lossE2":
      return m.lossE2;
    case "totalLoss":
      return m.totalLoss;
    case "completedKMs":
      return fmtKm(m.completedKMs);
    case "lossKMs":
      return fmtKm(m.lossKMs);
    case "extraKMs":
      return fmtKm(m.extraKMs);
    case "billingKMs":
      return fmtKm(m.billingKMs);
    default:
      return "";
  }
}

export function getTotalCellValue(
  colId: KmsColumnId,
  totals: {
    tripCompleted: number;
    shortTrip: number;
    tripNotCompleted: number;
    totalLoss: number;
    completedKMs: number;
    lossKMs: number;
    extraKMs: number;
    billingKMs: number;
  },
): string | number {
  switch (colId) {
    case "tripCompleted":
      return totals.tripCompleted;
    case "shortTrip":
      return totals.shortTrip;
    case "tripNotCompleted":
      return totals.tripNotCompleted;
    case "totalLoss":
      return totals.totalLoss;
    case "completedKMs":
      return fmtKm(totals.completedKMs);
    case "lossKMs":
      return fmtKm(totals.lossKMs);
    case "extraKMs":
      return fmtKm(totals.extraKMs);
    case "billingKMs":
      return fmtKm(totals.billingKMs);
    case "sr":
      return "Totals";
    default:
      return "";
  }
}

export function groupBand(group: ColumnGroupKey): string {
  return COLUMN_GROUPS[group].band;
}
