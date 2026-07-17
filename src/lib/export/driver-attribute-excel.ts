import {
  ATTRIBUTE_PILLAR_MAX,
  formatAttributeMonth,
  type DriverAttributeLeaderboardEntry,
} from "@/lib/graphql/driver-attribute-score";

type ExcelJSModule = typeof import("exceljs");
type Workbook = import("exceljs").Workbook;
type Worksheet = import("exceljs").Worksheet;
type Cell = import("exceljs").Cell;

const C = {
  brand: "FF0F766E",
  brandDeep: "FF134E4A",
  headerText: "FFFFFFFF",
  zebra: "FFF0FDFA",
  border: "FFCCFBF1",
  subtle: "FF6B7280",
  white: "FFFFFFFF",
  ink: "FF1F2937",
} as const;

const RATING_STYLE: Record<string, { fill: string; font: string }> = {
  Excellent: { fill: "FFDCFCE7", font: "FF166534" },
  Good: { fill: "FFDBEAFE", font: "FF1E40AF" },
  Average: { fill: "FFFEF3C7", font: "FF92400E" },
  Poor: { fill: "FFFEE2E2", font: "FF991B1B" },
};

const solid = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const thinBorder = {
  top: { style: "thin" as const, color: { argb: C.border } },
  left: { style: "thin" as const, color: { argb: C.border } },
  bottom: { style: "thin" as const, color: { argb: C.border } },
  right: { style: "thin" as const, color: { argb: C.border } },
};

type ColType = "text" | "int" | "num1" | "num2" | "num3" | "pct";
interface ColDef {
  header: string;
  width: number;
  type: ColType;
  value: (e: DriverAttributeLeaderboardEntry) => string | number | null;
}

const NUM_FORMAT: Record<ColType, string | undefined> = {
  text: undefined,
  int: "#,##0",
  num1: "0.0",
  num2: "0.00",
  num3: "0.000",
  pct: '0.0"%"',
};

const COLUMNS: ColDef[] = [
  { header: "Rank", width: 7, type: "int", value: (e) => e.attribute.rank },
  { header: "Driver", width: 24, type: "text", value: (e) => e.driver_name },
  { header: "Company", width: 12, type: "text", value: (e) => e.company_name },
  { header: "Year", width: 8, type: "int", value: (e) => e.attribute.year },
  { header: "Month", width: 8, type: "int", value: (e) => e.attribute.month },
  { header: "Attribute score", width: 14, type: "num1", value: (e) => e.attribute.totalAttributeScore },
  { header: "Rating", width: 12, type: "text", value: (e) => e.attribute.rating },
  { header: "Marks lost", width: 11, type: "num1", value: (e) => e.attribute.marksLost },
  { header: "Dominant weakness", width: 18, type: "text", value: (e) => e.attribute.dominantWeakness },
  { header: "Accidents /30", width: 12, type: "num1", value: (e) => e.attribute.accidentScore },
  { header: "Accident count", width: 12, type: "int", value: (e) => e.attribute.accidentCount },
  { header: "Major accidents", width: 13, type: "int", value: (e) => e.attribute.majorAccidentCount },
  { header: "soc/km /20", width: 11, type: "num1", value: (e) => e.attribute.socScore },
  { header: "soc/km", width: 10, type: "num3", value: (e) => e.attribute.socPerKm },
  { header: "soc excess %", width: 12, type: "pct", value: (e) => e.attribute.socExcessPct },
  { header: "ADAS /20", width: 10, type: "num1", value: (e) => e.attribute.adasScore },
  { header: "Hard braking /7", width: 13, type: "num1", value: (e) => e.attribute.hardBrakingScore },
  { header: "Hard accel /7", width: 12, type: "num1", value: (e) => e.attribute.hardAccelScore },
  { header: "Hard accel events", width: 14, type: "int", value: (e) => e.attribute.hardAccelEvents },
  { header: "Seatbelt /6", width: 11, type: "num1", value: (e) => e.attribute.seatbeltScore },
  { header: "Attendance /15", width: 13, type: "num1", value: (e) => e.attribute.attendanceScore },
  { header: "Attendance %", width: 12, type: "pct", value: (e) => e.attribute.attendancePct },
  { header: "Working days", width: 12, type: "int", value: (e) => e.attribute.workingDays },
  { header: "Mobile /10", width: 10, type: "num1", value: (e) => e.attribute.mobileScore },
  { header: "Mobile events", width: 12, type: "int", value: (e) => e.attribute.mobileEvents },
  { header: "Alcohol /5", width: 10, type: "num1", value: (e) => e.attribute.alcoholScore },
  { header: "Trips", width: 9, type: "int", value: (e) => e.attribute.tripsInMonth },
  { header: "Duties", width: 9, type: "int", value: (e) => e.attribute.dutiesInMonth },
  { header: "Km in month", width: 12, type: "num1", value: (e) => e.attribute.kmInMonth },
  { header: "Routes driven", width: 12, type: "int", value: (e) => e.attribute.routesDriven },
];

function setCellFill(cell: Cell, fillArgb: string, fontArgb: string, bold = false) {
  cell.fill = solid(fillArgb);
  cell.font = { color: { argb: fontArgb }, bold, size: 10, name: "Calibri" };
}

function paintTitleBand(ws: Worksheet, lastCol: string, title: string, subtitle: string) {
  ws.mergeCells(`A1:${lastCol}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true, color: { argb: C.white }, name: "Calibri" };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titleCell.fill = solid(C.brand);
  ws.getRow(1).height = 30;

  ws.mergeCells(`A2:${lastCol}2`);
  const subCell = ws.getCell("A2");
  subCell.value = subtitle;
  subCell.font = { size: 10, color: { argb: C.white }, name: "Calibri" };
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  subCell.fill = solid(C.brandDeep);
  ws.getRow(2).height = 18;
}

function buildLeaderboardSheet(
  ws: Worksheet,
  monthLabel: string,
  entries: DriverAttributeLeaderboardEntry[],
  generatedAt: string,
) {
  const lastColLetter = ws.getColumn(COLUMNS.length).letter;
  paintTitleBand(
    ws,
    lastColLetter,
    "Driver Attribute Score — Leaderboard",
    `MBMT depot · ${monthLabel} · ${entries.length} scored drivers · Generated ${generatedAt}`,
  );

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
  headerRow.height = 28;

  const ratingCol = COLUMNS.findIndex((c) => c.header === "Rating") + 1;
  const scoreCol = COLUMNS.findIndex((c) => c.header === "Attribute score") + 1;

  entries.forEach((e, rowIdx) => {
    const row = ws.getRow(headerRowIdx + 1 + rowIdx);
    const zebra = rowIdx % 2 === 1;
    COLUMNS.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      const raw = col.value(e);
      cell.value = raw == null || raw === "" ? "—" : raw;
      cell.border = thinBorder;
      cell.alignment = { vertical: "middle", horizontal: col.type === "text" ? "left" : "center" };
      cell.font = { size: 10, name: "Calibri", color: { argb: C.ink } };
      const fmt = NUM_FORMAT[col.type];
      if (fmt && typeof raw === "number") cell.numFmt = fmt;
      if (zebra) cell.fill = solid(C.zebra);
    });

    const rating = String(e.attribute.rating);
    const ratingStyle = RATING_STYLE[rating] ?? RATING_STYLE.Average;
    setCellFill(row.getCell(ratingCol), ratingStyle.fill, ratingStyle.font, true);

    const scoreCell = row.getCell(scoreCol);
    scoreCell.font = { size: 11, bold: true, name: "Calibri", color: { argb: C.ink } };

    row.height = 18;
  });

  ws.views = [{ state: "frozen", xSplit: 2, ySplit: headerRowIdx, topLeftCell: `C${headerRowIdx + 1}` }];
  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx, column: COLUMNS.length },
  };
}

function buildSummarySheet(
  ws: Worksheet,
  monthLabel: string,
  entries: DriverAttributeLeaderboardEntry[],
  generatedAt: string,
) {
  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 16;
  paintTitleBand(ws, "C", "Driver Attribute Score — Summary", `MBMT · ${monthLabel} · ${generatedAt}`);

  const total = entries.length;
  const avgScore = total
    ? entries.reduce((s, e) => s + e.attribute.totalAttributeScore, 0) / total
    : 0;
  const avgSoc = total
    ? entries.reduce((s, e) => s + e.attribute.socPerKm, 0) / total
    : 0;
  const avgLost = total
    ? entries.reduce((s, e) => s + e.attribute.marksLost, 0) / total
    : 0;

  const kpis: { label: string; value: string | number; fmt?: string }[] = [
    { label: "Scored drivers", value: total },
    { label: "Average attribute score", value: +avgScore.toFixed(1), fmt: "0.0" },
    { label: "Average soc/km", value: +avgSoc.toFixed(3), fmt: "0.000" },
    { label: "Average marks lost", value: +avgLost.toFixed(1), fmt: "0.0" },
    { label: "Excellent", value: entries.filter((e) => /excellent/i.test(e.attribute.rating)).length },
    { label: "Good", value: entries.filter((e) => /^good$/i.test(e.attribute.rating)).length },
    { label: "Average", value: entries.filter((e) => /average/i.test(e.attribute.rating)).length },
    { label: "Poor", value: entries.filter((e) => /poor/i.test(e.attribute.rating)).length },
    {
      label: "With dominant weakness",
      value: entries.filter(
        (e) => e.attribute.dominantWeakness && e.attribute.dominantWeakness !== "None" && e.attribute.marksLost > 0,
      ).length,
    },
  ];

  const kpiHeaderRow = 4;
  const kh = ws.getRow(kpiHeaderRow);
  ["Metric", "Value"].forEach((h, i) => {
    const cell = kh.getCell(i + 1);
    cell.value = h;
    setCellFill(cell, C.brandDeep, C.white, true);
    cell.border = thinBorder;
  });

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

  // Average pillar marks
  const pillarStart = kpiHeaderRow + kpis.length + 3;
  const ph = ws.getRow(pillarStart);
  ["Pillar", "Max marks", "Fleet avg marks"].forEach((h, i) => {
    const cell = ph.getCell(i + 1);
    cell.value = h;
    setCellFill(cell, C.brandDeep, C.white, true);
    cell.border = thinBorder;
  });

  const pillars: { label: string; max: number; avg: number }[] = [
    {
      label: "Accidents",
      max: ATTRIBUTE_PILLAR_MAX.accidents,
      avg: total ? entries.reduce((s, e) => s + e.attribute.accidentScore, 0) / total : 0,
    },
    {
      label: "soc/km",
      max: ATTRIBUTE_PILLAR_MAX.soc,
      avg: total ? entries.reduce((s, e) => s + e.attribute.socScore, 0) / total : 0,
    },
    {
      label: "ADAS behaviour",
      max: ATTRIBUTE_PILLAR_MAX.adas,
      avg: total ? entries.reduce((s, e) => s + e.attribute.adasScore, 0) / total : 0,
    },
    {
      label: "Attendance",
      max: ATTRIBUTE_PILLAR_MAX.attendance,
      avg: total ? entries.reduce((s, e) => s + e.attribute.attendanceScore, 0) / total : 0,
    },
    {
      label: "Mobile usage",
      max: ATTRIBUTE_PILLAR_MAX.mobile,
      avg: total ? entries.reduce((s, e) => s + e.attribute.mobileScore, 0) / total : 0,
    },
    {
      label: "Alcohol (placeholder)",
      max: ATTRIBUTE_PILLAR_MAX.alcohol,
      avg: total ? entries.reduce((s, e) => s + e.attribute.alcoholScore, 0) / total : 0,
    },
  ];

  pillars.forEach((p, i) => {
    const row = ws.getRow(pillarStart + 1 + i);
    const c1 = row.getCell(1);
    c1.value = p.label;
    c1.border = thinBorder;
    c1.font = { size: 10, name: "Calibri" };
    const c2 = row.getCell(2);
    c2.value = p.max;
    c2.border = thinBorder;
    c2.alignment = { horizontal: "center" };
    c2.font = { size: 10, name: "Calibri" };
    const c3 = row.getCell(3);
    c3.value = +p.avg.toFixed(1);
    c3.numFmt = "0.0";
    c3.border = thinBorder;
    c3.alignment = { horizontal: "center" };
    c3.font = { size: 10, bold: true, name: "Calibri" };
    if (i % 2 === 1) {
      c1.fill = solid(C.zebra);
      c2.fill = solid(C.zebra);
      c3.fill = solid(C.zebra);
    }
  });
}

function buildLegendSheet(ws: Worksheet) {
  ws.getColumn(1).width = 42;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 48;
  paintTitleBand(
    ws,
    "C",
    "Scoring specification (v2)",
    "100 marks · Accidents 30 · soc/km 20 · ADAS 20 · Attendance 15 · Mobile 10 · Alcohol 5",
  );

  const rows: [string, string, string][] = [
    ["Section", "Marks", "Notes"],
    ["Eligibility gates", "—", "MBMT only · ≥10 attendance days · ≥50 trips. Fail any gate → unscored (not zero)."],
    ["Data quality", "—", "Exclude lost/dead/deleted/short/outlier trips; min 5 km. Applied to route benchmarks too."],
    ["Accidents — no accidents", "30", ""],
    ["Accidents — 1 minor", "20", ""],
    ["Accidents — 2 minor", "5", ""],
    ["Accidents — >2 minor OR any major", "0", "Major = severity A or Fatal on any injured party."],
    ["soc/km — ≤ avg up to 5% above", "20", "Compared to route monthly average, not cross-route."],
    ["soc/km — 5–10% above", "10", ""],
    ["soc/km — 10–15% above", "5", ""],
    ["soc/km — >15% above", "0", "Better than average is never penalised."],
    ["ADAS — hard braking", "7 / 3.5 / 0", "vs route avg: ≤5% → 7; 5–10% → 3.5; >10% → 0"],
    ["ADAS — hard acceleration", "7 or 0", "Pass/fail — any event → 0"],
    ["ADAS — seatbelt", "6 / 3 / 0", "vs route avg: ≤5% → 6; 5–10% → 3; >10% → 0"],
    ["Mobile — <3 events", "10", "Looking at phone + talking on phone"],
    ["Mobile — 3 to 5 events", "5", ""],
    ["Mobile — >5 events", "0", ""],
    ["Attendance — >98%", "15", "Scheduled days vs 26-day working month"],
    ["Attendance — 95–98%", "10", ""],
    ["Attendance — 90–95%", "5", ""],
    ["Attendance — 75–90%", "3", ""],
    ["Attendance — 40–75%", "2", ""],
    ["Attendance — <40%", "0", ""],
    ["Alcohol", "5", "Placeholder — every eligible driver gets 5 until breathalyser data exists"],
  ];

  rows.forEach((cols, i) => {
    const row = ws.getRow(3 + i);
    cols.forEach((v, j) => {
      const cell = row.getCell(j + 1);
      cell.value = v;
      cell.border = thinBorder;
      cell.font = {
        size: i === 0 ? 10 : 9.5,
        bold: i === 0 || j === 1,
        name: "Calibri",
        color: { argb: i === 0 ? C.white : C.ink },
      };
      if (i === 0) {
        setCellFill(cell, C.brandDeep, C.white, true);
      } else if (i % 2 === 0) {
        cell.fill = solid(C.zebra);
      }
      cell.alignment = {
        vertical: "middle",
        horizontal: j === 1 ? "center" : "left",
        wrapText: true,
      };
    });
    row.height = i === 0 ? 22 : 20;
  });
}

async function downloadWorkbook(wb: Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Downloads a styled Attribute Score workbook:
 * Summary · Leaderboard (full pillar marks) · Scoring legend.
 */
export async function exportAttributeScoreWorkbook(
  entries: DriverAttributeLeaderboardEntry[],
  year: number,
  month: number,
): Promise<void> {
  const ExcelJS = (await import("exceljs")) as ExcelJSModule;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Voltline";
  wb.created = new Date();

  const monthLabel = formatAttributeMonth(year, month);
  const generatedAt = new Date().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const summary = wb.addWorksheet("Summary", { properties: { defaultRowHeight: 18 } });
  buildSummarySheet(summary, monthLabel, entries, generatedAt);

  const board = wb.addWorksheet("Leaderboard", { properties: { defaultRowHeight: 18 } });
  buildLeaderboardSheet(board, monthLabel, entries, generatedAt);

  const legend = wb.addWorksheet("Scoring legend", { properties: { defaultRowHeight: 18 } });
  buildLegendSheet(legend);

  const slug = `${year}-${String(month).padStart(2, "0")}`;
  await downloadWorkbook(wb, `driver-attribute-score-${slug}.xlsx`);
}
