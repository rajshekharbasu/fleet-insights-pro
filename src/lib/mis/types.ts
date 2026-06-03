/** MIS trip row from GET /mis/trips */

export type RemarkCode = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface MisTripRow {
  companyId: string;
  siteId: string;
  schedulingDate: string;
  scheduleCode: string;
  shift: "Morning" | "Evening";
  vehicleType: string;
  busType: string;
  vehicleNumber: string;
  startTime: string;
  endTime: string;
  fromStage: string;
  toStage: string;
  distanceInKM: number;
  aDistanceInKM: number;
  employeeCode: string;
  driverName: string;
  isLost: 0 | 1;
  isShort: 0 | 1;
  remark: RemarkCode;
  reason: string;
  tripNumber: number;
  isScheduleCodeChanged: 0 | 1;
  /** Derived / enriched */
  zone?: string;
  runningBoard?: string;
  route?: string;
  service?: string;
}

export type TripOverride = {
  isLost?: 0 | 1;
  isShort?: 0 | 1;
  remark?: RemarkCode;
  reason?: string;
  isExtra?: boolean;
  fromStage?: string;
  toStage?: string;
  distanceInKM?: number;
  startTime?: string;
  endTime?: string;
  vehicleNumber?: string;
};

export type MergedTrip = MisTripRow & {
  tripKey: string;
  hasOverride: boolean;
  status: "completed" | "lost" | "short" | "extra";
};

export interface ScheduleMetrics {
  scheduledTrips: number;
  tripCompleted: number;
  tripNotCompleted: number;
  shortTrip: number;
  lossA1: number;
  lossA2: number;
  lossB: number;
  lossC: number;
  lossE1: number;
  lossE2: number;
  totalLoss: number;
  completedKMs: number;
  lossKMs: number;
  extraKMs: number;
  billingKMs: number;
  extraTripCount: number;
}

export interface ScheduleReportRow {
  key: string;
  scheduleCode: string;
  shift: MisTripRow["shift"];
  schedulingDate: string;
  driverId: string;
  driverName: string;
  zone: string;
  runningBoard: string;
  busNo: string;
  busType: string;
  vehicleType: string;
  route: string;
  service: string;
  depotStartKm: number;
  aToBKm: number;
  bToAKm: number;
  closingDepotKm: number;
  roundTripKm: number;
  scheduleStartTime: string;
  scheduleEndTime: string;
  metrics: ScheduleMetrics;
  trips: MergedTrip[];
  hasAdjustment: boolean;
}

export type PivotDimension =
  | "date"
  | "route"
  | "driver"
  | "vehicle"
  | "shift"
  | "busType"
  | "lossCategory"
  | "zone"
  | "fromStage"
  | "toStage"
  | "runningBoard";

export type PivotMetric =
  | "scheduledTrips"
  | "completedTrips"
  | "shortTrips"
  | "lostTrips"
  | "extraTrips"
  | "completionPct"
  | "scheduledKMs"
  | "completedKMs"
  | "lossKMs"
  | "extraKMs"
  | "billingKMs"
  | "lossPct"
  | "lossA1"
  | "lossA2"
  | "lossB"
  | "lossC"
  | "lossE1"
  | "lossE2";

export interface PivotConfig {
  rowDim: PivotDimension;
  colDim: PivotDimension | "none";
  metrics: PivotMetric[];
}

export type PivotColDim = PivotConfig["colDim"];

export interface PivotTemplate {
  id: string;
  name: string;
  config: PivotConfig;
}
