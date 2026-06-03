// Site Readiness — IT/IT Infra master tracker
// Source: internal Excel sheet (Transvolt Mobility Pvt Ltd). Mocked deadlines & weekly progress.

export const SITES = [
  "MBM", "TUM", "TSCL", "Ultratech", "VECV", "TLPL",
  "MGG", "TI", "Kandla", "Khapri", "Wathoda", "Lakkdganj",
] as const;
/** Site depot code — configurable beyond seed list via readiness-store. */
export type Site = string;

export type Cell = "yes" | "no" | "na";
export type ItemType = "Asset Infra" | "Vehicle" | "Software Platform" | "Asset Infra + Software Platform" | "Miscellaneous";
export type Cost = "CAPEX" | "OPEX" | "CAPEX + OPEX" | "SOFTWARE" | "APP";

export interface ReadinessItem {
  id: number;
  item: string;
  category: Cost;
  team: string;
  type: ItemType;
  owner: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  deadline: string; // ISO date
  status: "On Track" | "At Risk" | "Delayed" | "Completed";
  cells: Record<string, Cell>;
}

// Raw matrix derived from the sheet. Empty entries are coerced to "na".
const RAW: Array<[number, string, Cost, string, ItemType, Array<Cell | "">]> = [
  [1, "Firewall", "CAPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["no","no","no","no","no","no","no","no","no","no","no",""]],
  [2, "Biometric", "CAPEX", "Operation / HR", "Asset Infra",
    ["yes","yes","no","no","yes","no","no","no","no","no","no",""]],
  [3, "CCTV — Depot / Charging / Guest House", "CAPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["yes","yes","yes","yes","yes","yes","no","no","no","no","no",""]],
  [4, "IT Asset — Rack (Server)", "CAPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["no","no","no","no","","no","no","no","no","no","no",""]],
  [6, "Admin Asset — TV", "CAPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["yes","yes","yes","no","","yes","no","no","no","no","no",""]],
  [7, "Admin Asset — Tablet", "CAPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["yes","yes","yes","no","yes","yes","no","no","yes","no","no",""]],
  [8, "Admin Asset — Android Mobile + SIM", "CAPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["yes","yes","yes","yes","","no","no","no","yes","yes","yes",""]],
  [9, "UPS", "CAPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["no","no","no","yes","no","no","no","no","no","no","no",""]],
  [10, "Projector & Screen", "CAPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["yes","no","no","no","no","no","no","no","no","no","no",""]],
  [11, "Internet", "OPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["yes","yes","yes","yes","yes","yes","no","no","yes","no","yes",""]],
  [12, "AMC — CCTV", "OPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["no","no","yes","yes","yes","no","no","no","no","no","no",""]],
  [13, "AMC — Printer", "OPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["no","no","yes","no","yes","yes","no","no","yes","no","yes",""]],
  [14, "AMC — Laptop", "OPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["no","no","yes","yes","yes","yes","yes","yes","no","no","no",""]],
  [15, "AMC — Desktop", "OPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["no","no","no","yes","yes","no","no","no","no","","",""]],
  [16, "AMC — CAN / OBD Device", "OPEX", "ITMS - Hardware / Network", "Vehicle",
    ["no","no","no","no","no","","","","","","",""]],
  [17, "AMC — Firewall", "OPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["no","no","no","no","no","no","no","no","no","no","no",""]],
  [18, "IPM — Hardware Asset Tracking", "OPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["yes","no","no","no","no","no","no","no","no","no","no",""]],
  [19, "Ticketing System", "OPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["no","no","no","no","no","no","no","no","no","no","no",""]],
  [20, "Email", "OPEX", "ITMS - Hardware / Network", "Asset Infra",
    ["yes","yes","yes","yes","yes","yes","yes","yes","yes","yes","yes",""]],
  [21, "OBD Device", "CAPEX + OPEX", "ITMS Data Team", "Vehicle",
    ["yes","yes","yes","yes","","","","","","","",""]],
  [22, "Vehicle Telemetry Integration", "OPEX", "ITMS Data Team", "Vehicle",
    ["yes","yes","yes","","","","","","","","",""]],
  [23, "ADAS / DMS Integration + Call Centre", "OPEX", "ITMS Data Team", "Vehicle",
    ["yes","yes","yes","","","","","","","","",""]],
  [24, "Passenger Announcement System (ITMS)", "OPEX", "ITMS Data Team", "Vehicle",
    ["yes","yes","","","","","","","","","",""]],
  [25, "Depot Security Analytics", "CAPEX + OPEX", "ITMS - Hardware / Network", "Asset Infra + Software Platform",
    ["no","no","no","no","no","no","no","no","no","no","no",""]],
  [26, "SAP Configuration", "OPEX", "ITMS - Hardware / Network", "Software Platform",
    ["no","no","no","no","no","no","no","no","no","no","no",""]],
  [27, "TIMS — Enterprise Application", "SOFTWARE", "ITMS", "Software Platform",
    ["yes","yes","yes","yes","yes","","","","","","",""]],
  [28, "Ecovolt App", "APP", "ITMS", "Software Platform",
    ["yes","yes","yes","yes","yes","yes","","","","","",""]],
  [29, "CMS", "SOFTWARE", "ITMS Data Team", "Software Platform",
    ["yes","no","yes","yes","","","","","","","",""]],
  [30, "System Training for Users", "SOFTWARE", "ITMS - Hardware / Network", "Miscellaneous",
    ["no","no","","","","","","","","","",""]],
];

const OWNERS = ["A. Mehta", "S. Iyer", "R. Kapoor", "N. Sharma", "V. Patel", "K. Rao"];
const PRIO: ReadinessItem["priority"][] = ["Critical", "High", "High", "Medium", "Medium", "Low"];

function dayOffset(base: Date, d: number): string {
  const dt = new Date(base);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}

const TODAY = new Date("2026-05-22");

export const READINESS_ITEMS: ReadinessItem[] = RAW.map(([id, item, category, team, type, cells], idx) => {
  const cellsObj = {} as Record<string, Cell>;
  SITES.forEach((s, i) => {
    const v = cells[i];
    cellsObj[s] = v === "yes" ? "yes" : v === "no" ? "no" : "na";
  });
  const yesCount = Object.values(cellsObj).filter((c) => c === "yes").length;
  const totalApplicable = Object.values(cellsObj).filter((c) => c !== "na").length;
  const pct = totalApplicable ? yesCount / totalApplicable : 0;
  const deadlineOffset = ((idx * 7) % 95) - 12; // some past, some future
  let status: ReadinessItem["status"];
  if (pct >= 0.95) status = "Completed";
  else if (deadlineOffset < 0 && pct < 0.85) status = "Delayed";
  else if (pct < 0.45) status = "At Risk";
  else status = "On Track";

  return {
    id,
    item,
    category,
    team,
    type,
    owner: OWNERS[idx % OWNERS.length],
    priority: PRIO[idx % PRIO.length],
    deadline: dayOffset(TODAY, deadlineOffset),
    status,
    cells: cellsObj,
  };
});

// ---- Aggregations ----

export function siteReadiness(site: Site) {
  let yes = 0, no = 0, na = 0;
  READINESS_ITEMS.forEach((r) => {
    const c = r.cells[site];
    if (c === "yes") yes++;
    else if (c === "no") no++;
    else na++;
  });
  const applicable = yes + no;
  return { site, yes, no, na, applicable, pct: applicable ? yes / applicable : 0 };
}

export function overallReadiness() {
  const sites = SITES.map(siteReadiness);
  const totalYes = sites.reduce((s, r) => s + r.yes, 0);
  const totalApp = sites.reduce((s, r) => s + r.applicable, 0);
  return {
    sites,
    pct: totalApp ? totalYes / totalApp : 0,
    totalYes,
    totalApplicable: totalApp,
    totalItems: READINESS_ITEMS.length,
  };
}

export function typeBreakdown() {
  const map = new Map<ItemType, { yes: number; no: number }>();
  READINESS_ITEMS.forEach((r) => {
    const cur = map.get(r.type) ?? { yes: 0, no: 0 };
    Object.values(r.cells).forEach((c) => {
      if (c === "yes") cur.yes++;
      else if (c === "no") cur.no++;
    });
    map.set(r.type, cur);
  });
  return [...map.entries()].map(([type, v]) => ({
    type,
    yes: v.yes,
    no: v.no,
    total: v.yes + v.no,
    pct: v.yes + v.no ? v.yes / (v.yes + v.no) : 0,
  }));
}

export function categoryBreakdown() {
  const map = new Map<Cost, number>();
  READINESS_ITEMS.forEach((r) => {
    map.set(r.category, (map.get(r.category) ?? 0) + 1);
  });
  return [...map.entries()].map(([category, count]) => ({ category, count }));
}

export function statusBreakdown() {
  const map = new Map<ReadinessItem["status"], number>();
  READINESS_ITEMS.forEach((r) => map.set(r.status, (map.get(r.status) ?? 0) + 1));
  return [...map.entries()].map(([status, count]) => ({ status, count }));
}

// Weekly trend — deterministic synthetic progression toward current % readiness
export function weeklyProgress(weeks = 12) {
  const overall = overallReadiness().pct * 100;
  const out: { week: string; overall: number; assetInfra: number; vehicle: number; software: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - i * 7);
    const label = `W${weeks - i}`;
    const t = (weeks - i) / weeks;
    const ease = 1 - Math.pow(1 - t, 1.6);
    out.push({
      week: label,
      overall: +(overall * ease).toFixed(1),
      assetInfra: +(Math.min(100, overall * ease * 1.05)).toFixed(1),
      vehicle: +(Math.max(0, overall * ease * 0.78)).toFixed(1),
      software: +(Math.max(0, overall * ease * 0.9)).toFixed(1),
    });
  }
  return out;
}

export function upcomingDeadlines(limit = 8) {
  return [...READINESS_ITEMS]
    .filter((r) => r.status !== "Completed")
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, limit);
}

export function daysUntil(iso: string): number {
  const d = new Date(iso);
  const diff = (d.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24);
  return Math.round(diff);
}
