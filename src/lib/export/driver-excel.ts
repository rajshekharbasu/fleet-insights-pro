import type { DriverLeaderboardEntry } from "@/lib/graphql/drivers";
import type { DriverScore } from "@/lib/fleet-data";

// ExcelJS is loaded lazily (and only in the browser) so it never runs during SSR
// and stays out of the initial route bundle.
type ExcelJSModule = typeof import("exceljs");
type Workbook = import("exceljs").Workbook;
type Worksheet = import("exceljs").Worksheet;
type Cell = import("exceljs").Cell;

/* ---------------------------------- palette --------------------------------- */
// ARGB (alpha-first) hex values expected by ExcelJS.
const C = {
  brand: "FF6D28D9",
  brandDeep: "FF4C1D95",
  headerText: "FFFFFFFF",
  zebra: "FFF6F4FB",
  border: "FFE2E1EA",
  subtle: "FF6B7280",
  white: "FFFFFFFF",
} as const;

const BAND_STYLE: Record<DriverScore["risk_band"], { fill: string; font: string }> = {
  Elite: { fill: "FFDCFCE7", font: "FF166534" },
  Strong: { fill: "FFDBEAFE", font: "FF1E40AF" },
  Average: { fill: "FFFEF3C7", font: "FF92400E" },
  "At-risk": { fill: "FFFFEDD5", font: "FF9A3412" },
  Critical: { fill: "FFFEE2E2", font: "FF991B1B" },
};

const YES_STYLE = { fill: "FFDCFCE7", font: "FF166534" };
const NO_STYLE = { fill: "FFF3F4F6", font: "FF6B7280" };
const FLAG_STYLE = { fill: "FFFEE2E2", font: "FF991B1B" };

const solid = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const thinBorder = {
  top: { style: "thin" as const, color: { argb: C.border } },
  left: { style: "thin" as const, color: { argb: C.border } },
  bottom: { style: "thin" as const, color: { argb: C.border } },
  right: { style: "thin" as const, color: { argb: C.border } },
};

/* --------------------------------- columns ---------------------------------- */
type ColType = "text" | "int" | "num2" | "pct" | "pct100";
interface ColDef {
  header: string;
  width: number;
  type: ColType;
  value: (e: DriverLeaderboardEntry) => string | number | null;
}

const NUM_FORMAT: Record<ColType, string | undefined> = {
  text: undefined,
  int: "#,##0",
  num2: "0.00",
  pct: "0%",
  pct100: '0"%"',
};

const COLUMNS: ColDef[] = [
  { header: "Rank", width: 7, type: "int", value: (e) => e.extras.rank },
  { header: "Driver", width: 22, type: "text", value: (e) => e.driver_name },
  { header: "Company", width: 20, type: "text", value: (e) => e.company_name },
  { header: "Risk band", width: 12, type: "text", value: (e) => e.risk_band },
  { header: "Driver score", width: 11, type: "num2", value: (e) => e.contextual_score },
  { header: "Driving score", width: 12, type: "pct100", value: (e) => e.percentile },
  { header: "Score band", width: 10, type: "text", value: (e) => e.extras.rawScoreBand ?? e.risk_band },
  { header: "Trips driven", width: 12, type: "int", value: (e) => e.trips_30d },
  { header: "Trips scored", width: 12, type: "int", value: (e) => e.extras.tripsScored },
  { header: "Efficiency (kWh/km)", width: 17, type: "num2", value: (e) => e.efficiency_kwh_per_km },
  { header: "Exposure", width: 10, type: "num2", value: (e) => e.difficulty_exposure },
  { header: "Stars / trip", width: 11, type: "num2", value: (e) => e.extras.starsPerTripWeighted },
  { header: "High-risk ratio", width: 13, type: "pct", value: (e) => e.extras.highRiskRatio },
  { header: "Fatigue density", width: 13, type: "num2", value: (e) => e.extras.fatigueDensity },
  { header: "Braking density", width: 13, type: "num2", value: (e) => e.harsh_braking },
  { header: "Overspeed density", width: 15, type: "num2", value: (e) => e.overspeed },
  { header: "Distraction density", width: 16, type: "num2", value: (e) => e.distraction },
  { header: "Dominant risk", width: 16, type: "text", value: (e) => e.extras.dominantRisk },
  { header: "Score trend", width: 12, type: "text", value: (e) => e.extras.scoreTrend },
  { header: "Incentive eligible", width: 15, type: "text", value: (e) => (e.extras.incentiveEligible ? "Yes" : "No") },
  { header: "Needs review", width: 13, type: "text", value: (e) => (e.extras.reviewRequired ? "Yes" : "No") },
  { header: "Coaching module", width: 22, type: "text", value: (e) => e.extras.coachingModule },
  { header: "Coaching trigger", width: 26, type: "text", value: (e) => e.extras.coachingTrigger },
  { header: "Snapshot", width: 13, type: "text", value: (e) => e.extras.snapshotDate },
];

const COL_INDEX = (header: string) => COLUMNS.findIndex((c) => c.header === header) + 1;

/* --------------------------------- helpers ---------------------------------- */
function setCellFill(cell: Cell, fillArgb: string, fontArgb: string, bold = false) {
  cell.fill = solid(fillArgb);
  cell.font = { color: { argb: fontArgb }, bold, size: 10, name: "Calibri" };
}

function buildLeaderboardSheet(ws: Worksheet, title: string, subtitle: string, entries: DriverLeaderboardEntry[]) {
  const lastColLetter = ws.getColumn(COLUMNS.length).letter;

  // Title band (row 1) + subtitle (row 2), merged across all columns.
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

  // Header row (row 3).
  const headerRowIdx = 3;
  const headerRow = ws.getRow(headerRowIdx);
  COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    setCellFill(cell, C.brandDeep, C.white, true);
    cell.alignment = { vertical: "middle", horizontal: col.type === "text" ? "left" : "center", wrapText: true };
    cell.border = thinBorder;
    ws.getColumn(i + 1).width = col.width;
  });
  headerRow.height = 26;

  // Data rows.
  const bandCol = COL_INDEX("Risk band");
  const incCol = COL_INDEX("Incentive eligible");
  const revCol = COL_INDEX("Needs review");

  entries.forEach((e, rowIdx) => {
    const row = ws.getRow(headerRowIdx + 1 + rowIdx);
    const zebra = rowIdx % 2 === 1;
    COLUMNS.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      const raw = col.value(e);
      cell.value = raw == null || raw === "" ? "—" : raw;
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", horizontal: col.type === "text" ? "left" : "center" };
      cell.font = { size: 10, name: "Calibri", color: { argb: "FF1F2937" } };
      const fmt = NUM_FORMAT[col.type];
      if (fmt && typeof raw === "number") cell.numFmt = fmt;
      if (zebra) cell.fill = solid(C.zebra);
    });

    // Risk band coloring.
    const bandStyle = BAND_STYLE[e.risk_band];
    if (bandStyle) setCellFill(row.getCell(bandCol), bandStyle.fill, bandStyle.font, true);

    // Incentive eligible Yes/No coloring.
    const incStyle = e.extras.incentiveEligible ? YES_STYLE : NO_STYLE;
    setCellFill(row.getCell(incCol), incStyle.fill, incStyle.font, e.extras.incentiveEligible);

    // Needs review flag coloring.
    const revStyle = e.extras.reviewRequired ? FLAG_STYLE : NO_STYLE;
    setCellFill(row.getCell(revCol), revStyle.fill, revStyle.font, e.extras.reviewRequired);

    row.height = 18;
  });

  // Freeze title + header, enable filter on the header row.
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: headerRowIdx, topLeftCell: `C${headerRowIdx + 1}` }];
  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx, column: COLUMNS.length },
  };
}

function buildSummarySheet(ws: Worksheet, entries: DriverLeaderboardEntry[], generatedAt: string) {
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 16;

  ws.mergeCells("A1:C1");
  const title = ws.getCell("A1");
  title.value = "Driver Intelligence — Operations Report";
  title.font = { size: 16, bold: true, color: { argb: C.white }, name: "Calibri" };
  title.alignment = { vertical: "middle", indent: 1 };
  title.fill = solid(C.brand);
  ws.getRow(1).height = 32;

  ws.mergeCells("A2:C2");
  const sub = ws.getCell("A2");
  sub.value = generatedAt;
  sub.font = { size: 10, color: { argb: C.white }, name: "Calibri" };
  sub.alignment = { vertical: "middle", indent: 1 };
  sub.fill = solid(C.brandDeep);

  const total = entries.length;
  const avgPercentile = total ? entries.reduce((s, e) => s + e.percentile, 0) / total : 0;
  const avgEff = total ? entries.reduce((s, e) => s + e.efficiency_kwh_per_km, 0) / total : 0;
  const incentive = entries.filter((e) => e.extras.incentiveEligible).length;
  const review = entries.filter((e) => e.extras.reviewRequired).length;
  const coaching = entries.filter((e) => e.extras.coachingModule).length;

  // KPI table.
  const kpiHeaderRow = 4;
  const kh = ws.getRow(kpiHeaderRow);
  ["Metric", "Value"].forEach((h, i) => {
    const cell = kh.getCell(i + 1);
    cell.value = h;
    setCellFill(cell, C.brandDeep, C.white, true);
    cell.border = thinBorder;
    cell.alignment = { vertical: "middle" };
  });

  const kpis: { label: string; value: string | number; fmt?: string }[] = [
    { label: "Drivers in report", value: total },
    { label: "Average percentile", value: +avgPercentile.toFixed(1) },
    { label: "Average efficiency (kWh/km)", value: +avgEff.toFixed(2), fmt: "0.00" },
    { label: "Incentive eligible", value: incentive },
    { label: "Needs review", value: review },
    { label: "Coaching queue", value: coaching },
  ];
  kpis.forEach((k, i) => {
    const row = ws.getRow(kpiHeaderRow + 1 + i);
    const labelCell = row.getCell(1);
    labelCell.value = k.label;
    labelCell.border = thinBorder;
    labelCell.font = { size: 10, name: "Calibri" };
    if (i % 2 === 1) labelCell.fill = solid(C.zebra);
    const valCell = row.getCell(2);
    valCell.value = k.value;
    if (k.fmt && typeof k.value === "number") valCell.numFmt = k.fmt;
    valCell.border = thinBorder;
    valCell.font = { size: 10, bold: true, name: "Calibri" };
    valCell.alignment = { horizontal: "center" };
    if (i % 2 === 1) valCell.fill = solid(C.zebra);
  });

  // Risk band distribution table.
  const distHeaderRow = kpiHeaderRow + kpis.length + 3;
  const dh = ws.getRow(distHeaderRow);
  ["Risk band", "Drivers", "Share"].forEach((h, i) => {
    const cell = dh.getCell(i + 1);
    cell.value = h;
    setCellFill(cell, C.brandDeep, C.white, true);
    cell.border = thinBorder;
    cell.alignment = { vertical: "middle" };
  });

  const bands: DriverScore["risk_band"][] = ["Elite", "Strong", "Average", "At-risk", "Critical"];
  bands.forEach((band, i) => {
    const count = entries.filter((e) => e.risk_band === band).length;
    const row = ws.getRow(distHeaderRow + 1 + i);
    const style = BAND_STYLE[band];
    const c1 = row.getCell(1);
    c1.value = band;
    setCellFill(c1, style.fill, style.font, true);
    c1.border = thinBorder;
    const c2 = row.getCell(2);
    c2.value = count;
    c2.border = thinBorder;
    c2.alignment = { horizontal: "center" };
    c2.font = { size: 10, name: "Calibri" };
    const c3 = row.getCell(3);
    c3.value = total ? count / total : 0;
    c3.numFmt = "0%";
    c3.border = thinBorder;
    c3.alignment = { horizontal: "center" };
    c3.font = { size: 10, name: "Calibri" };
  });

  ws.views = [{ state: "frozen", ySplit: 3 }];
}

/* ------------------------------- entry point -------------------------------- */
export async function exportDriverWorkbook(entries: DriverLeaderboardEntry[]): Promise<void> {
  const mod = await import("exceljs");
  const ExcelJS = ((mod as { default?: ExcelJSModule }).default ?? mod) as ExcelJSModule;
  const workbook: Workbook = new ExcelJS.Workbook();
  workbook.creator = "Voltline · Fleet Insights";
  workbook.created = new Date();

  const now = new Date();
  const stamp = now.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const generatedAt = `Generated ${stamp} · ${entries.length} drivers`;

  buildSummarySheet(workbook.addWorksheet("Summary", { properties: { tabColor: { argb: C.brand } } }), entries, generatedAt);

  buildLeaderboardSheet(
    workbook.addWorksheet("Leaderboard", { properties: { tabColor: { argb: C.brandDeep } } }),
    "Driver Leaderboard",
    generatedAt,
    entries,
  );

  const incentive = entries.filter((e) => e.extras.incentiveEligible);
  buildLeaderboardSheet(
    workbook.addWorksheet("Incentive eligible", { properties: { tabColor: { argb: "FF16A34A" } } }),
    "Incentive Eligible Drivers",
    `Generated ${stamp} · ${incentive.length} drivers`,
    incentive,
  );

  const review = entries.filter((e) => e.extras.reviewRequired);
  buildLeaderboardSheet(
    workbook.addWorksheet("Needs review", { properties: { tabColor: { argb: "FFDC2626" } } }),
    "Drivers Needing Review",
    `Generated ${stamp} · ${review.length} drivers`,
    review,
  );

  const coaching = entries.filter((e) => e.extras.coachingModule);
  buildLeaderboardSheet(
    workbook.addWorksheet("Coaching queue", { properties: { tabColor: { argb: "FFD97706" } } }),
    "Coaching Queue",
    `Generated ${stamp} · ${coaching.length} drivers`,
    coaching,
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `driver-intelligence-${now.toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
