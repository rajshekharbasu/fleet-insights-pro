import type { RemarkCode } from "./types";

export const REMARK_LABELS: Record<RemarkCode, string> = {
  0: "None",
  1: "A1 Conductor",
  2: "A2 Driver",
  3: "B Traffic",
  4: "C Accident",
  5: "E1 Vehicle Defect",
  6: "E2 Battery Issue",
};

export const REASON_OPTIONS = [
  { value: 1 as RemarkCode, label: "A1 - Due to Conductor" },
  { value: 2 as RemarkCode, label: "A2 - Due to Driver" },
  { value: 3 as RemarkCode, label: "B - Due to Traffic" },
  { value: 4 as RemarkCode, label: "C - Due to Accident" },
  { value: 5 as RemarkCode, label: "E1 - Due to Vehicle Defect" },
  { value: 6 as RemarkCode, label: "E2 - Due to Battery Issue" },
] as const;

export const PIVOT_DIMENSIONS: { id: import("./types").PivotDimension; label: string }[] = [
  { id: "date", label: "Date" },
  { id: "route", label: "Route" },
  { id: "driver", label: "Driver" },
  { id: "vehicle", label: "Vehicle" },
  { id: "shift", label: "Shift" },
  { id: "busType", label: "Bus Type" },
  { id: "lossCategory", label: "Loss Category" },
  { id: "zone", label: "Zone" },
  { id: "fromStage", label: "From Stage" },
  { id: "toStage", label: "To Stage" },
  { id: "runningBoard", label: "Running Board" },
];

export const PIVOT_METRICS: { id: import("./types").PivotMetric; label: string }[] = [
  { id: "scheduledTrips", label: "Scheduled Trips" },
  { id: "completedTrips", label: "Completed Trips" },
  { id: "shortTrips", label: "Short Trips" },
  { id: "lostTrips", label: "Lost Trips" },
  { id: "extraTrips", label: "Extra Trips" },
  { id: "completionPct", label: "Completion %" },
  { id: "scheduledKMs", label: "Scheduled KMs" },
  { id: "completedKMs", label: "Completed KMs" },
  { id: "lossKMs", label: "Loss KMs" },
  { id: "extraKMs", label: "Extra KMs" },
  { id: "billingKMs", label: "Billing KMs" },
  { id: "lossPct", label: "Loss %" },
  { id: "lossA1", label: "Loss A1 count" },
  { id: "lossA2", label: "Loss A2 count" },
  { id: "lossB", label: "Loss B count" },
  { id: "lossC", label: "Loss C count" },
  { id: "lossE1", label: "Loss E1 count" },
  { id: "lossE2", label: "Loss E2 count" },
];

export const DEFAULT_COMPANY_ID = "transvolt-mobility";
