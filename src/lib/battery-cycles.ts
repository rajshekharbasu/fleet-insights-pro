/**
 * Battery Cycle Intelligence — data model + analytics + Excel export.
 *
 * The dashboard is driven by a single `BatteryDataset` value. It can be:
 *   - built live from the `cycle` analytics table (`buildBatteryDataset`), or
 *   - the bundled `SAMPLE_DATASET` (transcribed from the source workbook),
 *     used as a graceful fallback when the API is unavailable.
 *
 * Everything (sites, months, gauges, KPIs, comparison, EFC chart, explorer,
 * Excel export) reads from the dataset, so the UI scales to any number of
 * sites/months without code changes. Trip metrics are excluded from every
 * surfaced view per product requirement.
 */
import type { CycleRow } from "./graphql/cycles";

export type Band = "HEALTHY" | "MONITOR" | "ATTENTION";

export type BusRow = {
  reg: string;
  type: string;
  activeDays: number | null;
  trips: number | null; // present in source data; never surfaced
  flagged: number | null; // present in source data; never surfaced
  grossKwh: number | null;
  chargedKwh: number | null;
  efcGross: number | null;
  efcNet: number | null;
  efcAnnual: number | null;
  regen: number | null;
  idle: number | null;
  rte: number | null;
  spread: number | null;
  peakTemp: number | null;
  subzero: number | null;
  healthScore: number | null;
  band: Band;
};

export type DetailData = Record<string, BusRow[]>; // key: `${Site}|${MonthName}`

export type DepotMonth = {
  buses: number;
  gross: number;
  efcG: number;
  efcN: number;
  regen: number;
  idle: number;
  rte: number;
  spread: number;
  temp: number;
};

export type FleetAgg = DepotMonth;

/** The complete data surface the dashboard renders from. */
export interface BatteryDataset {
  source: "live" | "sample";
  /** Site identifiers (e.g. SPV codes), in display order. */
  depots: string[];
  /** Month names that have data, in chronological order. */
  dataMonths: string[];
  /** Full month-key timeline (incl. leading "no data" placeholders). */
  timeline: string[];
  /** Month keys that actually carry data. */
  dataKeys: string[];
  /** key → month name (covers every timeline key). */
  mname: Record<string, string>;
  /** key → short month label (covers every timeline key). */
  mshort: Record<string, string>;
  /** month name → "MM" (data months only). */
  mm: Record<string, string>;
  /** site → monthName → aggregate. */
  summary: Record<string, Record<string, DepotMonth>>;
  /** site → monthName → [healthy, monitor, attention]. */
  health: Record<string, Record<string, [number, number, number]>>;
  /** `${site}|${monthName}` → per-bus rows. */
  detail: DetailData;
}

export const BAND_COLOR: Record<Band, string> = {
  HEALTHY: "var(--success)",
  MONITOR: "var(--warning)",
  ATTENTION: "var(--destructive)",
};

export const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/**
 * Site color by position in the dataset's `depots` list — cycles the chart
 * palette, then derives evenly-spaced hues so any number of sites stays legible.
 */
export function depotColor(site: string, depots: readonly string[]): string {
  const i = depots.indexOf(site);
  if (i > -1 && i < PALETTE.length) return PALETTE[i];
  const hue = (195 + (Math.max(i, 0) - PALETTE.length + 1) * 47) % 360;
  return `oklch(0.62 0.16 ${hue})`;
}

/* ------------------------------------------------------------------ *
 * Month-key helpers (keys are "YYYY-MM")                             *
 * ------------------------------------------------------------------ */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function keyToName(key: string): string {
  const m = Number(key.slice(5, 7));
  return MONTH_NAMES[m - 1] ?? key;
}
export function keyToShort(key: string): string {
  return keyToName(key).slice(0, 3);
}
function keyToMM(key: string): string {
  return key.slice(5, 7);
}
function prevMonthKey(key: string): string {
  let y = Number(key.slice(0, 4));
  let m = Number(key.slice(5, 7)) - 1;
  if (m < 1) { m = 12; y -= 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Ensure the timeline has at least 3 slots by prepending earlier (empty) months. */
function padTimeline(dataKeys: string[]): string[] {
  const tl = [...dataKeys];
  while (tl.length < 3) tl.unshift(prevMonthKey(tl[0]));
  return tl;
}

const mean = (vals: (number | null | undefined)[]): number => {
  const v = vals.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
};

function normBand(raw: string | null | undefined): Band {
  const b = String(raw ?? "").toUpperCase();
  if (b.startsWith("ATT") || b.includes("CRIT") || b.includes("ALERT")) return "ATTENTION";
  if (b.startsWith("MON") || b.includes("WARN")) return "MONITOR";
  return "HEALTHY";
}

function mapCycleToBus(r: CycleRow): BusRow {
  return {
    reg: r.registration_number,
    type: r.vehicle_type ?? "—",
    activeDays: r.active_days,
    trips: r.total_trips,
    flagged: r.flagged_trips,
    grossKwh: r.total_gross_discharge_kwh,
    chargedKwh: r.total_charged_kwh,
    efcGross: r.efc_gross,
    efcNet: r.efc_net,
    efcAnnual: r.efc_gross_annual,
    regen: r.regen_pct,
    idle: r.idle_aux_pct,
    rte: r.avg_daily_rte_pct,
    spread: r.avg_cell_spread_mv,
    peakTemp: r.avg_peak_temp_c,
    subzero: r.subzero_days,
    healthScore: r.health_score,
    band: normBand(r.health_band),
  };
}

function aggregate(rows: BusRow[]): DepotMonth {
  return {
    buses: rows.length,
    gross: mean(rows.map((r) => r.grossKwh)),
    efcG: mean(rows.map((r) => r.efcGross)),
    efcN: mean(rows.map((r) => r.efcNet)),
    regen: mean(rows.map((r) => r.regen)),
    idle: mean(rows.map((r) => r.idle)),
    rte: mean(rows.map((r) => r.rte)),
    spread: mean(rows.map((r) => r.spread)),
    temp: mean(rows.map((r) => r.peakTemp)),
  };
}

function bandCounts(rows: BusRow[]): [number, number, number] {
  let h = 0, m = 0, a = 0;
  for (const r of rows) {
    if (r.band === "HEALTHY") h++;
    else if (r.band === "MONITOR") m++;
    else a++;
  }
  return [h, m, a];
}

/** Build the dashboard dataset from raw `cycle` rows (one per bus × month). */
export function buildBatteryDataset(rows: CycleRow[]): BatteryDataset {
  const detail: DetailData = {};
  const siteSet = new Set<string>();
  const keySet = new Set<string>();

  for (const r of rows) {
    const site = (r.spv || r.depot || "").trim();
    const key = (r.report_month || "").trim();
    if (!site || !/^\d{4}-\d{2}$/.test(key)) continue;
    siteSet.add(site);
    keySet.add(key);
    const dkey = `${site}|${keyToName(key)}`;
    (detail[dkey] ||= []).push(mapCycleToBus(r));
  }

  const depots = [...siteSet].sort((a, b) => a.localeCompare(b));
  const dataKeys = [...keySet].sort();
  const dataMonths = dataKeys.map(keyToName);
  const timeline = padTimeline(dataKeys);

  const mname: Record<string, string> = {};
  const mshort: Record<string, string> = {};
  for (const k of timeline) { mname[k] = keyToName(k); mshort[k] = keyToShort(k); }
  const mm: Record<string, string> = {};
  for (const k of dataKeys) mm[keyToName(k)] = keyToMM(k);

  const summary: BatteryDataset["summary"] = {};
  const health: BatteryDataset["health"] = {};
  for (const site of depots) {
    summary[site] = {};
    health[site] = {};
    for (const name of dataMonths) {
      const r = detail[`${site}|${name}`] || [];
      summary[site][name] = aggregate(r);
      health[site][name] = bandCounts(r);
    }
  }

  return { source: "live", depots, dataMonths, timeline, dataKeys, mname, mshort, mm, summary, health, detail };
}

/* ------------------------------------------------------------------ *
 * Dataset-scoped analytics helpers                                   *
 * ------------------------------------------------------------------ */
export function hasData(ds: BatteryDataset, key: string): boolean {
  return ds.dataKeys.includes(key);
}

export function anchorBounds(ds: BatteryDataset): { min: number; max: number } {
  return { min: 2, max: ds.timeline.length - 1 };
}

export function windowKeys(ds: BatteryDataset, anchorIdx: number): string[] {
  return ds.timeline.slice(anchorIdx - 2, anchorIdx + 1);
}

export function lastDataInWindow(ds: BatteryDataset, keys: string[]): string {
  const ds2 = keys.filter((k) => hasData(ds, k));
  return ds2.length ? ds2[ds2.length - 1] : keys[keys.length - 1];
}

export function prevDataKey(ds: BatteryDataset, key: string): string | null {
  const i = ds.dataKeys.indexOf(key);
  return i > 0 ? ds.dataKeys[i - 1] : null;
}

export function keyForMonthName(ds: BatteryDataset, name: string): string | null {
  for (const k of ds.dataKeys) if (ds.mname[k] === name) return k;
  return null;
}

/** Fleet-wide, bus-weighted average across every site for a month key. */
export function fleetAgg(ds: BatteryDataset, key: string): FleetAgg | null {
  if (!hasData(ds, key)) return null;
  const m = ds.mname[key];
  let buses = 0;
  const acc = { gross: 0, efcG: 0, efcN: 0, regen: 0, idle: 0, rte: 0, spread: 0, temp: 0 };
  for (const d of ds.depots) {
    const s = ds.summary[d]?.[m];
    if (!s) continue;
    buses += s.buses;
    (Object.keys(acc) as (keyof typeof acc)[]).forEach((k) => (acc[k] += s[k] * s.buses));
  }
  const out = { buses } as FleetAgg;
  (Object.keys(acc) as (keyof typeof acc)[]).forEach((k) => ((out as Record<string, number>)[k] = buses ? acc[k] / buses : 0));
  return out;
}

/** Aggregate for a single site, or the whole fleet when scope === "ALL". */
export function siteAgg(ds: BatteryDataset, key: string, scope: "ALL" | string): FleetAgg | null {
  if (!scope || scope === "ALL") return fleetAgg(ds, key);
  if (!hasData(ds, key)) return null;
  return ds.summary[scope]?.[ds.mname[key]] ?? null;
}

/** All per-bus rows for a month name, scoped to one company or the whole fleet. */
export function rowsForScope(ds: BatteryDataset, monthName: string, company: "ALL" | string): BusRow[] {
  if (!company || company === "ALL") return ds.depots.flatMap((d) => ds.detail[`${d}|${monthName}`] || []);
  return ds.detail[`${company}|${monthName}`] || [];
}

export type CategoryStat = {
  key: string;
  buses: number;
  efcG: number;
  efcN: number;
  rte: number;
  regen: number;
  idle: number;
  gross: number;
  health: [number, number, number];
};

/** Group rows by an arbitrary key (e.g. vehicle type) and aggregate KPIs. */
export function breakdownBy(rows: BusRow[], keyOf: (r: BusRow) => string): CategoryStat[] {
  const map = new Map<string, BusRow[]>();
  for (const r of rows) {
    const k = keyOf(r) || "—";
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  const out: CategoryStat[] = [];
  for (const [key, rs] of map) {
    const agg = aggregate(rs);
    out.push({
      key,
      buses: rs.length,
      efcG: agg.efcG,
      efcN: agg.efcN,
      rte: agg.rte,
      regen: agg.regen,
      idle: agg.idle,
      gross: agg.gross,
      health: bandCounts(rs),
    });
  }
  return out.sort((a, b) => b.buses - a.buses);
}

/** Roll up health bands across a set of rows. */
export function healthTotals(rows: BusRow[]): { healthy: number; monitor: number; attention: number; total: number } {
  const [healthy, monitor, attention] = bandCounts(rows);
  return { healthy, monitor, attention, total: rows.length };
}

/* ================================================================== *
 * SAMPLE_DATASET — bundled fallback (source workbook, Mar–May 2026)  *
 * ================================================================== */
const SAMPLE_SUMMARY: Record<string, Record<string, DepotMonth>> = {
  MBMT: {
    March: { buses: 53, gross: 5273, efcG: 21.2, efcN: 17.4, regen: 18.2, idle: 8, rte: 90, spread: 33.2, temp: 44.4 },
    April: { buses: 54, gross: 5696, efcG: 22.63, efcN: 18.8, regen: 17.3, idle: 8, rte: 90, spread: 28.5, temp: 44.4 },
    May: { buses: 54, gross: 5534, efcG: 22.37, efcN: 18.7, regen: 17, idle: 7.4, rte: 89.7, spread: 29.8, temp: 45 },
  },
  UMT: {
    March: { buses: 19, gross: 7532, efcG: 28.64, efcN: 24.8, regen: 14.6, idle: 22.4, rte: 89.8, spread: 31, temp: 44.5 },
    April: { buses: 19, gross: 6726, efcG: 25.73, efcN: 22.4, regen: 13.7, idle: 25.2, rte: 88.2, spread: 31.2, temp: 44.5 },
    May: { buses: 19, gross: 7236, efcG: 28, efcN: 24.2, regen: 14.2, idle: 25.3, rte: 90.7, spread: 30.2, temp: 45.6 },
  },
  NTSPL: {
    March: { buses: 183, gross: 4466, efcG: 14.89, efcN: 13.2, regen: 7.9, idle: 37.8, rte: 91.9, spread: 17.7, temp: 39.7 },
    April: { buses: 194, gross: 4776, efcG: 15.92, efcN: 14.2, regen: 10.7, idle: 16.8, rte: 82, spread: 18.5, temp: 43.3 },
    May: { buses: 241, gross: 6731, efcG: 22.44, efcN: 20, regen: 10.5, idle: 18, rte: 90.4, spread: 17.65, temp: 44.34 },
  },
};

const SAMPLE_HEALTH: Record<string, Record<string, [number, number, number]>> = {
  MBMT: { March: [27, 24, 2], April: [32, 22, 0], May: [29, 25, 0] },
  UMT: { March: [10, 9, 0], April: [12, 7, 0], May: [11, 8, 0] },
  NTSPL: { March: [170, 11, 2], April: [190, 4, 0], May: [208, 33, 0] },
};

/** Build the bundled fallback dataset from the static workbook tables + JSON detail. */
export function buildSampleDataset(detail: DetailData): BatteryDataset {
  const depots = ["MBMT", "UMT", "NTSPL"];
  const dataKeys = ["2026-03", "2026-04", "2026-05"];
  const dataMonths = ["March", "April", "May"];
  const timeline = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"];
  const mname: Record<string, string> = {};
  const mshort: Record<string, string> = {};
  for (const k of timeline) { mname[k] = keyToName(k); mshort[k] = keyToShort(k); }
  const mm: Record<string, string> = { March: "03", April: "04", May: "05" };
  return {
    source: "sample",
    depots,
    dataMonths,
    timeline,
    dataKeys,
    mname,
    mshort,
    mm,
    summary: SAMPLE_SUMMARY,
    health: SAMPLE_HEALTH,
    detail,
  };
}

/* ------------------------------------------------------------------ *
 * Excel export — regenerates the source workbook structure for the   *
 * active window, same format, with all trip columns removed.         *
 * Requires:  npm i xlsx-js-style                                     *
 * ------------------------------------------------------------------ */

export async function exportBatteryWorkbook(ds: BatteryDataset, monthsIn?: string[]) {
  const XLSX = (await import("xlsx-js-style")).default ?? (await import("xlsx-js-style"));
  const months = (monthsIn && monthsIn.length ? monthsIn : ds.dataMonths).filter((m) => ds.mm[m]);
  const DEPOTS = ds.depots;
  const SUMMARY = ds.summary;
  const HEALTH = ds.health;
  const detail = ds.detail;

  const bd = { style: "thin", color: { rgb: "D7DCE3" } };
  const BORDER = { top: bd, bottom: bd, left: bd, right: bd };
  const S = {
    title: { font: { bold: true, sz: 13, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0E7C86" } }, alignment: { vertical: "center", horizontal: "left" } },
    sub: { font: { italic: true, sz: 10, color: { rgb: "5B6573" } }, alignment: { vertical: "center" } },
    section: { font: { bold: true, sz: 11, color: { rgb: "0E7C86" } } },
    head: { font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "1F2A37" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: BORDER },
    subhead: { font: { bold: true, sz: 10, color: { rgb: "24303D" } }, fill: { fgColor: { rgb: "E7EDF1" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: BORDER },
    val: { font: { sz: 10, color: { rgb: "24303D" } }, fill: { fgColor: { rgb: "F4F7F9" } }, alignment: { horizontal: "center" }, border: BORDER },
    cell: { font: { sz: 10 }, alignment: { horizontal: "right" }, border: BORDER },
    cellL: { font: { sz: 10, bold: true }, alignment: { horizontal: "left" }, border: BORDER },
    cellC: { font: { sz: 10 }, alignment: { horizontal: "center" }, border: BORDER },
    band: {
      HEALTHY: { font: { bold: true, sz: 10, color: { rgb: "1B7A4B" } }, fill: { fgColor: { rgb: "DAF1E4" } }, alignment: { horizontal: "center" }, border: BORDER },
      MONITOR: { font: { bold: true, sz: 10, color: { rgb: "966310" } }, fill: { fgColor: { rgb: "FBECCC" } }, alignment: { horizontal: "center" }, border: BORDER },
      ATTENTION: { font: { bold: true, sz: 10, color: { rgb: "B23121" } }, fill: { fgColor: { rgb: "F7D9D4" } }, alignment: { horizontal: "center" }, border: BORDER },
    } as Record<Band, unknown>,
  };
  const setC = (ws: Record<string, any>, r: number, c: number, style?: unknown, z?: string) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    const cell = ws[ref];
    if (!cell) return;
    if (style) cell.s = style;
    if (z != null) cell.z = z;
  };

  const wb = XLSX.utils.book_new();

  // ---- ANALYSIS SHEET ----
  {
    const A: unknown[][] = [];
    A.push(["TRANSVOLT MOBILITY — HV BATTERY CYCLE ANALYSIS"]);
    A.push([`Recent ${months.length} months · ${months.join(" · ")} 2026 · Trip metrics excluded`]);
    A.push([]);
    const rEfc = A.length;
    A.push(["EFC TRACKING — GROSS BY SITE"]);
    A.push(["Site", ...months]);
    for (const dep of DEPOTS) A.push([dep, ...months.map((m) => SUMMARY[dep]?.[m]?.efcG ?? 0)]);
    A.push([]);
    const rSum = A.length;
    A.push(["1.  FLEET SUMMARY — MONTHLY AVERAGES BY SITE"]);
    const sumHead = ["Site", "Month", "Buses", "Avg Gross kWh", "EFC Gross", "EFC Net", "Regen %", "Idle %", "RTE %", "Cell Spread (mV)", "Peak Temp (°C)"];
    A.push(sumHead);
    const sumStart = A.length;
    for (const dep of DEPOTS) for (const m of months) {
      const s = SUMMARY[dep]?.[m]; if (!s) continue;
      A.push([dep, m, s.buses, Math.round(s.gross), s.efcG, s.efcN, s.regen, s.idle, s.rte, s.spread, s.temp]);
    }
    const sumEnd = A.length;
    A.push([]);
    const rH = A.length;
    A.push(["2.  HEALTH BAND DISTRIBUTION BY SITE & MONTH"]);
    const hHead = ["Site", "Month", "Total Buses", "Healthy", "Monitor", "Attention", "Healthy %", "Monitor %", "Attention %"];
    A.push(hHead);
    const hStart = A.length;
    for (const dep of DEPOTS) for (const m of months) {
      const h = HEALTH[dep]?.[m]; if (!h) continue;
      const tot = h[0] + h[1] + h[2] || 1;
      A.push([dep, m, tot, h[0], h[1], h[2], h[0] / tot, h[1] / tot, h[2] / tot]);
    }
    const hEnd = A.length;
    const ws = XLSX.utils.aoa_to_sheet(A);
    ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
      { s: { r: rEfc, c: 0 }, e: { r: rEfc, c: 10 } }, { s: { r: rSum, c: 0 }, e: { r: rSum, c: 10 } }, { s: { r: rH, c: 0 }, e: { r: rH, c: 10 } },
    ];
    ws["!rows"] = []; ws["!rows"][0] = { hpt: 24 };
    setC(ws, 0, 0, S.title); setC(ws, 1, 0, S.sub);
    setC(ws, rEfc, 0, S.section); setC(ws, rSum, 0, S.section); setC(ws, rH, 0, S.section);
    for (let c = 0; c <= months.length; c++) setC(ws, rEfc + 1, c, S.head);
    for (let i = 0; i < DEPOTS.length; i++) { setC(ws, rEfc + 2 + i, 0, S.cellL); for (let c = 1; c <= months.length; c++) setC(ws, rEfc + 2 + i, c, S.cell, "0.00"); }
    for (let c = 0; c < sumHead.length; c++) setC(ws, rSum + 1, c, S.head);
    const zSum = [null, null, "0", "#,##0", "0.00", "0.00", "0.0", "0.0", "0.0", "0.0", "0.0"];
    for (let r = sumStart; r < sumEnd; r++) { setC(ws, r, 0, S.cellL); setC(ws, r, 1, S.cellC); for (let c = 2; c < sumHead.length; c++) setC(ws, r, c, S.cell, zSum[c] as string); }
    for (let c = 0; c < hHead.length; c++) setC(ws, rH + 1, c, S.head);
    const zH = [null, null, "0", "0", "0", "0", "0.0%", "0.0%", "0.0%"];
    for (let r = hStart; r < hEnd; r++) { setC(ws, r, 0, S.cellL); setC(ws, r, 1, S.cellC); for (let c = 2; c < hHead.length; c++) setC(ws, r, c, S.cell, zH[c] as string); }
    XLSX.utils.book_append_sheet(wb, ws, "Analysis");
  }

  // ---- DETAIL SHEETS (site × month, trips removed) ----
  const COLS = ["Registration No.", "Vehicle Type", "Active Days", "Gross Discharge (kWh)", "Charged (kWh)", "EFC (Gross)", "EFC (Net)", "EFC (Gross Annual)", "Regen %", "Idle % (Aux)", "Daily RTE %", "Cell Spread (mV)", "Peak Temp (°C)", "Subzero Days", "Health Score", "Health Band"];
  const NC = COLS.length;
  const zCol = [null, null, "0", "#,##0", "#,##0", "0.00", "0.00", "0", "0.0", "0.0", "0.0", "0.0", "0.0", "0", "0.0", null];
  const widths = [16, 12, 10, 17, 12, 11, 10, 15, 9, 11, 11, 13, 12, 11, 11, 13].map((w) => ({ wch: w }));

  for (const dep of DEPOTS) for (const mo of months) {
    const rows = detail[`${dep}|${mo}`] || [];
    const s = SUMMARY[dep]?.[mo];
    if (!s) continue;
    const totalGross = rows.reduce((a, r) => a + (r.grossKwh || 0), 0);
    const mm = ds.mm[mo];
    const A: unknown[][] = [];
    A.push([`TRANSVOLT MOBILITY — HV DISCHARGE CYCLE DATA  ·  ${dep}  ·  2026-${mm}`]);
    A.push([`FLEET AVERAGE — 2026-${mm}`]);
    A.push(["Site", "Buses", "Avg Gross kWh", "Avg EFC Gross", "Avg EFC Net", "Avg Regen %", "Avg Idle %", "Avg RTE %", "Avg Spread mV", "Avg Peak Temp", "Total Gross kWh"]);
    A.push([dep, s.buses, Math.round(s.gross), s.efcG, s.efcN, s.regen, s.idle, s.rte, s.spread, s.temp, Math.round(totalGross)]);
    A.push([]);
    A.push(COLS);
    for (const r of rows) A.push([r.reg, r.type, r.activeDays, r.grossKwh, r.chargedKwh, r.efcGross, r.efcNet, r.efcAnnual, r.regen, r.idle, r.rte, r.spread, r.peakTemp, r.subzero, r.healthScore, r.band]);
    const ws = XLSX.utils.aoa_to_sheet(A);
    ws["!cols"] = widths;
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: NC - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: NC - 1 } }];
    ws["!rows"] = []; ws["!rows"][0] = { hpt: 22 }; ws["!rows"][5] = { hpt: 30 };
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 5, c: 0 }, e: { r: 5 + rows.length, c: NC - 1 } }) };
    ws["!freeze"] = { xSplit: 0, ySplit: 6, topLeftCell: "A7", activePane: "bottomLeft", state: "frozen" };
    setC(ws, 0, 0, S.title); setC(ws, 1, 0, S.sub);
    for (let c = 0; c <= 10; c++) setC(ws, 2, c, S.subhead);
    const zFleet = [null, "0", "#,##0", "0.00", "0.00", "0.0", "0.0", "0.0", "0.0", "0.0", "#,##0"];
    setC(ws, 3, 0, S.cellL); for (let c = 1; c <= 10; c++) setC(ws, 3, c, S.val, zFleet[c] as string);
    for (let c = 0; c < NC; c++) setC(ws, 5, c, S.head);
    for (let i = 0; i < rows.length; i++) {
      const rr = 6 + i;
      const band = rows[i].band;
      setC(ws, rr, 0, S.cellL); setC(ws, rr, 1, S.cellC);
      for (let c = 2; c < NC - 1; c++) setC(ws, rr, c, S.cell, zCol[c] as string);
      setC(ws, rr, NC - 1, S.band[band] || S.cellC);
    }
    XLSX.utils.book_append_sheet(wb, ws, `${dep}-${mo}26`.replace(/[\\/?*[\]:]/g, "").slice(0, 31));
  }

  const first = (months[0] ?? "").slice(0, 3);
  const last = (months[months.length - 1] ?? "").slice(0, 3);
  XLSX.writeFile(wb, `HV Battery Cycles (no trips) — ${first}-${last} 2026.xlsx`);
}
