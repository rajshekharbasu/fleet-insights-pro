import type { DriverDailyTripRow, DriverTripDetailRow } from "@/lib/graphql/driver-trip-behavior";
import { formatUtcTripTime } from "@/lib/driver-trip-datetime";

type ExcelJSModule = typeof import("exceljs");
type Workbook = import("exceljs").Workbook;
type Worksheet = import("exceljs").Worksheet;
type Cell = import("exceljs").Cell;

const C = {
  brand: "FF0E7C86",
  brandDeep: "FF0A5F66",
  headerText: "FFFFFFFF",
  zebra: "FFF0FAFA",
  border: "FFE2E8F0",
  white: "FFFFFFFF",
  highRisk: "FFFEE2E2",
  highRiskFont: "FF991B1B",
  lowRisk: "FFDCFCE7",
  lowRiskFont: "FF166534",
  goodEff: "FFDCFCE7",
  goodEffFont: "FF166534",
  warnEff: "FFFEF3C7",
  warnEffFont: "FF92400E",
  stars: "FFECFDF5",
  starsFont: "FF047857",
} as const;

const solid = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const thinBorder = {
  top: { style: "thin" as const, color: { argb: C.border } },
  left: { style: "thin" as const, color: { argb: C.border } },
  bottom: { style: "thin" as const, color: { argb: C.border } },
  right: { style: "thin" as const, color: { argb: C.border } },
};

type ColType = "text" | "int" | "num1" | "num2" | "num4" | "pct";
interface ColDef<T> {
  header: string;
  width: number;
  type: ColType;
  value: (r: T) => string | number | null;
}

const NUM_FORMAT: Record<ColType, string | undefined> = {
  text: undefined,
  int: "#,##0",
  num1: "0.0",
  num2: "0.00",
  num4: "0.0000",
  pct: "0.0%",
};

function setCellFill(cell: Cell, fillArgb: string, fontArgb: string, bold = false) {
  cell.fill = solid(fillArgb);
  cell.font = { color: { argb: fontArgb }, bold, size: 10, name: "Calibri" };
}

function tripVehicleLabel(t: DriverTripDetailRow): string {
  return t.vehicleNumber ?? t.busCode ?? "—";
}

const TRIP_COLUMNS: ColDef<DriverTripDetailRow>[] = [
  { header: "Date", width: 12, type: "text", value: (r) => r.schedulingDate },
  { header: "Trip ID", width: 14, type: "text", value: (r) => r.tripId || null },
  { header: "Route", width: 22, type: "text", value: (r) => r.routeName },
  { header: "Route code", width: 11, type: "text", value: (r) => r.routeCode },
  { header: "Time bucket", width: 12, type: "text", value: (r) => r.timeBucket },
  { header: "Vehicle size", width: 11, type: "text", value: (r) => r.vehicleSize },
  { header: "Vehicle", width: 12, type: "text", value: (r) => tripVehicleLabel(r) },
  { header: "Sched. start", width: 10, type: "text", value: (r) => formatUtcTripTime(r.tripStartTime) },
  { header: "Sched. end", width: 10, type: "text", value: (r) => formatUtcTripTime(r.tripEndTime) },
  { header: "Actual start", width: 10, type: "text", value: (r) => formatUtcTripTime(r.actualTripStartTime) },
  { header: "Actual end", width: 10, type: "text", value: (r) => formatUtcTripTime(r.actualTripEndTime) },
  { header: "Actual dur. (min)", width: 12, type: "num1", value: (r) => r.actualTripDurationMin },
  { header: "Actual dist. (km)", width: 13, type: "num1", value: (r) => r.actualDistanceKm },
  { header: "Efficiency (kWh/km)", width: 15, type: "num2", value: (r) => r.kwhPerKm },
  { header: "Difficulty", width: 10, type: "num1", value: (r) => r.routeDifficultyScore },
  { header: "Driver score", width: 12, type: "num1", value: (r) => (r.contextualDriverScore != null && r.contextualDriverScore > 0 ? r.contextualDriverScore : null) },
  { header: "Driving score", width: 12, type: "int", value: (r) => (r.drivingScore > 0 ? r.drivingScore : null) },
  { header: "Score band", width: 10, type: "text", value: (r) => r.driverScoreBand },
  { header: "Alerts", width: 9, type: "int", value: (r) => r.totalDmsEvents },
  { header: "Braking /100km", width: 12, type: "num1", value: (r) => r.hardBrakingDensity },
  { header: "Overspeed /100km", width: 13, type: "num1", value: (r) => r.overspeedDensity },
  { header: "Distraction /100km", width: 14, type: "num1", value: (r) => r.distractionDensity },
  { header: "Fatigue /100km", width: 12, type: "num1", value: (r) => r.fatigueDensity },
  { header: "Regen ratio", width: 10, type: "pct", value: (r) => (r.regenRatio > 0 ? r.regenRatio : null) },
  { header: "Driver stars", width: 10, type: "int", value: (r) => r.driverStarCount },
  { header: "Risk flag", width: 10, type: "text", value: (r) => r.behaviorRiskFlag },
];

const TRIP_RISK_COL = TRIP_COLUMNS.findIndex((c) => c.header === "Risk flag") + 1;
const TRIP_EFF_COL = TRIP_COLUMNS.findIndex((c) => c.header === "Efficiency (kWh/km)") + 1;
const TRIP_STARS_COL = TRIP_COLUMNS.findIndex((c) => c.header === "Driver stars") + 1;

const DAILY_COLUMNS: ColDef<DriverDailyTripRow>[] = [
  { header: "Date", width: 13, type: "text", value: (r) => r.schedulingDate },
  { header: "Trips", width: 8, type: "int", value: (r) => r.tripCount },
  { header: "Distance (km)", width: 13, type: "num2", value: (r) => r.totalDistanceKm },
  { header: "Efficiency (kWh/km)", width: 16, type: "num2", value: (r) => r.avgEfficiencyKwhPerKm },
  { header: "Median eff. (kWh/km)", width: 16, type: "num2", value: (r) => r.medianEfficiencyKwhPerKm },
  { header: "Route exposure", width: 13, type: "num2", value: (r) => r.avgRouteDifficulty },
  { header: "Driver score", width: 11, type: "num1", value: (r) => (r.avgContextualDriverScore > 0 ? r.avgContextualDriverScore : null) },
  { header: "Driving score", width: 12, type: "int", value: (r) => (r.avgDrivingScore > 0 ? r.avgDrivingScore : null) },
  { header: "Alerts", width: 9, type: "int", value: (r) => r.dmsEvents },
  { header: "Braking /100km", width: 13, type: "num2", value: (r) => r.avgBrakingDensity },
  { header: "Overspeed /100km", width: 14, type: "num2", value: (r) => r.avgOverspeedDensity },
  { header: "Distraction /100km", width: 15, type: "num2", value: (r) => r.avgDistractionDensity },
  { header: "Fatigue /100km", width: 13, type: "num2", value: (r) => r.avgFatigueDensity },
  { header: "Regen %", width: 10, type: "num2", value: (r) => r.avgRegenPct },
  { header: "Driver stars", width: 11, type: "int", value: (r) => r.driverStars },
  { header: "High-risk trips", width: 13, type: "int", value: (r) => r.highRiskTrips },
];

const DAILY_HIGH_RISK_COL = DAILY_COLUMNS.findIndex((c) => c.header === "High-risk trips") + 1;
const DAILY_EFF_COL = DAILY_COLUMNS.findIndex((c) => c.header === "Efficiency (kWh/km)") + 1;
const DAILY_STARS_COL = DAILY_COLUMNS.findIndex((c) => c.header === "Driver stars") + 1;

function buildSheet<T>(
  ws: Worksheet,
  title: string,
  subtitle: string,
  columns: ColDef<T>[],
  rows: T[],
  opts?: {
    riskCol?: number;
    isHighRisk?: (r: T) => boolean;
    effCol?: number;
    getEff?: (r: T) => number;
    starsCol?: number;
    getStars?: (r: T) => number;
    windowAvgEff?: number;
    lowRiskWhen?: (r: T) => boolean;
  },
) {
  const lastColLetter = ws.getColumn(columns.length).letter;

  ws.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true, color: { argb: C.white }, name: "Calibri" };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titleCell.fill = solid(C.brand);
  ws.getRow(1).height = 30;

  ws.mergeCells(`A2:${lastColLetter}2`);
  const subCell = ws.getCell("A2");
  subCell.value = subtitle;
  subCell.font = { size: 10, color: { argb: C.white }, name: "Calibri" };
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  subCell.fill = solid(C.brandDeep);
  ws.getRow(2).height = 18;

  const headerRowIdx = 3;
  const headerRow = ws.getRow(headerRowIdx);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    setCellFill(cell, C.brandDeep, C.white, true);
    cell.alignment = { vertical: "middle", horizontal: col.type === "text" ? "left" : "center", wrapText: true };
    cell.border = thinBorder;
    ws.getColumn(i + 1).width = col.width;
  });
  headerRow.height = 26;

  rows.forEach((row, rowIdx) => {
    const excelRow = ws.getRow(headerRowIdx + 1 + rowIdx);
    const zebra = rowIdx % 2 === 1;
    columns.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      const raw = col.value(row);
      cell.value = raw == null || raw === "" ? "—" : raw;
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", horizontal: col.type === "text" ? "left" : "center" };
      cell.font = { size: 10, name: "Calibri", color: { argb: "FF1F2937" } };
      const fmt = NUM_FORMAT[col.type];
      if (fmt && typeof raw === "number") cell.numFmt = fmt;
      if (zebra) cell.fill = solid(C.zebra);
    });

    if (opts?.riskCol && opts.isHighRisk) {
      const riskCell = excelRow.getCell(opts.riskCol);
      if (opts.isHighRisk(row)) {
        setCellFill(riskCell, C.highRisk, C.highRiskFont, true);
      } else if (opts.lowRiskWhen?.(row)) {
        setCellFill(riskCell, C.lowRisk, C.lowRiskFont);
      }
    }

    if (opts?.effCol && opts.getEff && opts.windowAvgEff && opts.windowAvgEff > 0) {
      const eff = opts.getEff(row);
      if (eff > 0) {
        const ratio = eff / opts.windowAvgEff;
        const effCell = excelRow.getCell(opts.effCol);
        if (ratio <= 0.95) setCellFill(effCell, C.goodEff, C.goodEffFont, true);
        else if (ratio >= 1.05) setCellFill(effCell, C.warnEff, C.warnEffFont, true);
      }
    }

    if (opts?.starsCol && opts.getStars) {
      const stars = opts.getStars(row);
      if (stars > 0) {
        setCellFill(excelRow.getCell(opts.starsCol), C.stars, C.starsFont, true);
      }
    }

    excelRow.height = 18;
  });

  ws.views = [{ state: "frozen", xSplit: 1, ySplit: headerRowIdx, topLeftCell: `B${headerRowIdx + 1}` }];
  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx, column: columns.length },
  };
}

function buildTripSheet(ws: Worksheet, driverName: string, subtitle: string, rows: DriverTripDetailRow[]) {
  const windowAvgEff =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.kwhPerKm, 0) / rows.length
      : 0;

  buildSheet(ws, `Trip detail — ${driverName}`, subtitle, TRIP_COLUMNS, rows, {
    riskCol: TRIP_RISK_COL,
    isHighRisk: (r) => (r.behaviorRiskFlag ?? "").toUpperCase() === "HIGH",
    lowRiskWhen: (r) => r.totalDmsEvents === 0,
    effCol: TRIP_EFF_COL,
    getEff: (r) => r.kwhPerKm,
    windowAvgEff,
    starsCol: TRIP_STARS_COL,
    getStars: (r) => r.driverStarCount,
  });
}

function buildDailySheet(ws: Worksheet, driverName: string, subtitle: string, rows: DriverDailyTripRow[]) {
  const windowAvgEff =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.avgEfficiencyKwhPerKm * r.tripCount, 0)
        / Math.max(1, rows.reduce((s, r) => s + r.tripCount, 0))
      : 0;

  buildSheet(ws, `Daily summary — ${driverName}`, subtitle, DAILY_COLUMNS, rows, {
    riskCol: DAILY_HIGH_RISK_COL,
    isHighRisk: (r) => r.highRiskTrips > 0,
    lowRiskWhen: (r) => r.dmsEvents === 0,
    effCol: DAILY_EFF_COL,
    getEff: (r) => r.avgEfficiencyKwhPerKm,
    windowAvgEff,
    starsCol: DAILY_STARS_COL,
    getStars: (r) => r.driverStars,
  });
}

export interface ExportDriverTripsOptions {
  dailySummary?: DriverDailyTripRow[];
  dateSpan?: string;
}

export async function exportDriverTrips(
  driverName: string,
  tripRows: DriverTripDetailRow[],
  options?: ExportDriverTripsOptions,
): Promise<void> {
  const mod = await import("exceljs");
  const ExcelJS = ((mod as { default?: ExcelJSModule }).default ?? mod) as ExcelJSModule;
  const workbook: Workbook = new ExcelJS.Workbook();
  workbook.creator = "Voltline · Fleet Insights";
  workbook.created = new Date();

  const now = new Date();
  const stamp = now.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const dateSpan =
    options?.dateSpan
    ?? (tripRows.length > 0
      ? `${tripRows[0].schedulingDate} → ${tripRows[tripRows.length - 1].schedulingDate}`
      : "no dates");
  const tripSubtitle = `Generated ${stamp} · ${tripRows.length} trips · ${dateSpan}`;

  const safeName = driverName.replace(/[\\/*?:[\]]/g, "").slice(0, 28);
  const tripSheetName = `Trips — ${safeName}`.slice(0, 31);

  buildTripSheet(
    workbook.addWorksheet(tripSheetName, { properties: { tabColor: { argb: C.brand } } }),
    driverName,
    tripSubtitle,
    tripRows,
  );

  const dailyRows = options?.dailySummary ?? [];
  if (dailyRows.length > 0) {
    const dailySubtitle = `Generated ${stamp} · ${dailyRows.length} days · ${dateSpan}`;
    const dailySheetName = `Daily summary — ${safeName}`.slice(0, 31);
    buildDailySheet(
      workbook.addWorksheet(dailySheetName, { properties: { tabColor: { argb: C.brandDeep } } }),
      driverName,
      dailySubtitle,
      dailyRows,
    );
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const fileSafe = driverName.replace(/[\\/*?:[\]]/g, "").trim() || "driver";
  a.download = `Driver trips — ${fileSafe} — ${now.toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** @deprecated Use exportDriverTrips — kept for compatibility */
export async function exportDriverDailyTrips(
  driverName: string,
  rows: DriverDailyTripRow[],
): Promise<void> {
  await exportDriverTrips(driverName, [], { dailySummary: rows });
}
