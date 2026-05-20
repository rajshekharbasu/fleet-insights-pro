import {
  busLeaderboard,
  chargerLeaderboard,
  criticalRisks,
  dailyFleetTrends,
  depotComparison,
  executiveKpis,
  filterBusRows,
  filterChargerRows,
  filterDepotRows,
  filterEvents,
} from "@/lib/charger-analytics";
import {
  ABNORMALITY_EVENTS,
  BUS_HEALTH_DAILY,
  CHARGER_HEALTH_DAILY,
  DEPOT_ENERGY_DAILY,
} from "@/lib/charger-data";
import { DEFAULT_CHARGER_FILTERS } from "@/lib/charger-analytics";
import { median, pivot, summarize, trendByDay, type PivotRow } from "@/lib/analytics";
import { DRIVERS, FLEET_KPIS, ROUTES } from "@/lib/fleet-data";
import type { Trip } from "@/lib/mock-data";

export type InsightAudience = "operations" | "revenue";
export type InsightSeverity = "critical" | "warning" | "info";
export type InsightDomain = "trips" | "routes" | "drivers" | "charging" | "depot" | "fleet";

export interface InsightTrendPoint {
  date: string;
  value: number;
}

export interface InsightEvidenceRow {
  [key: string]: string | number;
}

export interface DailyInsight {
  id: string;
  audience: InsightAudience[];
  severity: InsightSeverity;
  domain: InsightDomain;
  title: string;
  summary: string;
  metric: string;
  vsBaseline: string;
  deltaPct: number;
  positiveIsGood: boolean;
  action: string;
  deepLink?: string;
  spark: number[];
  trend: InsightTrendPoint[];
  evidence: InsightEvidenceRow[];
  evidenceColumns: { key: string; header: string }[];
}

function deltaPct(curr: number, base: number) {
  if (!base) return 0;
  return ((curr - base) / base) * 100;
}

function severityFromDelta(delta: number, positiveIsGood: boolean, warn = 8, crit = 15): InsightSeverity {
  const bad = positiveIsGood ? delta < 0 : delta > 0;
  if (!bad) return "info";
  const mag = Math.abs(delta);
  if (mag >= crit) return "critical";
  if (mag >= warn) return "warning";
  return "info";
}

function kwhKmTrend(trips: Trip[]): InsightTrendPoint[] {
  return trendByDay(trips)
    .slice(-14)
    .map((d) => ({ date: d.date.slice(5), value: +d.kwhPerKm.toFixed(3) }));
}

function pivotEvidence(rows: PivotRow[], limit = 8): InsightEvidenceRow[] {
  return rows.slice(0, limit).map((r) => ({
    Entity: r.label,
    Trips: r.trips,
    "kWh/km": +r.kwhPerKm.toFixed(3),
    "Idle %": +r.idleShare.toFixed(1),
    Anomalies: r.anomalies,
    "Net kWh": +r.netKwh.toFixed(0),
  }));
}

const PIVOT_COLS = [
  { key: "Entity", header: "Entity" },
  { key: "Trips", header: "Trips" },
  { key: "kWh/km", header: "kWh/km" },
  { key: "Idle %", header: "Idle %" },
  { key: "Anomalies", header: "Anomalies" },
  { key: "Net kWh", header: "Net kWh" },
];

export function buildTripInsights(trips: Trip[]): DailyInsight[] {
  if (!trips.length) return [];

  const summary = summarize(trips);
  const routeRows = pivot(trips, "route_code").filter((r) => r.trips >= 3);
  const companyRows = pivot(trips, "company_name").filter((r) => r.trips >= 3);
  const driverRows = pivot(trips, "driver_name").filter((r) => r.trips >= 3);
  const kwhMedian = median(routeRows.map((r) => r.kwhPerKm));
  const idleMedian = median(routeRows.map((r) => r.idleShare));
  const trend = kwhKmTrend(trips);
  const spark = trend.map((t) => t.value);

  const insights: DailyInsight[] = [];

  const anomalyDelta = summary.anomalyRatePct;
  insights.push({
    id: "trip-anomaly-rate",
    audience: ["operations"],
    severity: anomalyDelta > 12 ? "critical" : anomalyDelta > 7 ? "warning" : "info",
    domain: "trips",
    title: "Trip anomaly rate elevated",
    summary: `${summary.anomalyRatePct.toFixed(1)}% of trips flagged for efficiency or telemetry issues in the selected window.`,
    metric: `${summary.anomalyRatePct.toFixed(1)}%`,
    vsBaseline: "target < 6%",
    deltaPct: anomalyDelta - 6,
    positiveIsGood: false,
    action: "Review diagnostics feed and assign route owners for top flagged trips.",
    deepLink: "/#anomalies",
    spark,
    trend,
    evidence: trips
      .filter((t) => t.efficiency_anomaly_flag || t.high_temp_flag)
      .slice(0, 8)
      .map((t) => ({
        Trip: t.trip_id,
        Route: t.route_code,
        Driver: t.driver_name,
        "kWh/km": +t.kwh_per_km.toFixed(2),
        Vehicle: t.vehiclenumber,
      })),
    evidenceColumns: [
      { key: "Trip", header: "Trip" },
      { key: "Route", header: "Route" },
      { key: "Driver", header: "Driver" },
      { key: "kWh/km", header: "kWh/km" },
      { key: "Vehicle", header: "Vehicle" },
    ],
  });

  const worstRoutes = [...routeRows].sort((a, b) => b.kwhPerKm - a.kwhPerKm).slice(0, 6);
  if (worstRoutes[0]) {
    const top = worstRoutes[0];
    const d = deltaPct(top.kwhPerKm, kwhMedian);
    insights.push({
      id: "route-efficiency-leak",
      audience: ["revenue", "operations"],
      severity: severityFromDelta(d, false),
      domain: "routes",
      title: `Route ${top.label} burning more energy than peers`,
      summary: `${top.label} at ${top.kwhPerKm.toFixed(2)} kWh/km vs fleet route median ${kwhMedian.toFixed(2)} — direct margin impact.`,
      metric: `${top.kwhPerKm.toFixed(2)} kWh/km`,
      vsBaseline: `median ${kwhMedian.toFixed(2)}`,
      deltaPct: d,
      positiveIsGood: false,
      action: "Open Route Intelligence — compare against best-performing route on same corridor.",
      deepLink: "/routes",
      spark,
      trend,
      evidence: pivotEvidence(worstRoutes),
      evidenceColumns: PIVOT_COLS,
    });
  }

  const idleHeavy = [...routeRows].sort((a, b) => b.idleShare - a.idleShare).slice(0, 6);
  if (idleHeavy[0]) {
    const top = idleHeavy[0];
    const d = deltaPct(top.idleShare, idleMedian);
    insights.push({
      id: "idle-energy-waste",
      audience: ["revenue"],
      severity: severityFromDelta(d, false),
      domain: "routes",
      title: `Idle energy waste on ${top.label}`,
      summary: `${top.idleShare.toFixed(1)}% idle share vs median ${idleMedian.toFixed(1)}% — recoverable energy not moving passengers.`,
      metric: `${top.idleShare.toFixed(1)}% idle`,
      vsBaseline: `median ${idleMedian.toFixed(1)}%`,
      deltaPct: d,
      positiveIsGood: false,
      action: "Schedule dispatch review — tighten turnaround and pre-conditioning windows.",
      deepLink: "/#explore",
      spark: routeRows.map((r) => r.idleShare).slice(-14),
      trend: idleHeavy.map((r, i) => ({ date: `R${i + 1}`, value: r.idleShare })),
      evidence: pivotEvidence(idleHeavy),
      evidenceColumns: PIVOT_COLS,
    });
  }

  const worstDrivers = [...driverRows].sort((a, b) => b.kwhPerKm - a.kwhPerKm).slice(0, 5);
  if (worstDrivers[0]) {
    const top = worstDrivers[0];
    const d = deltaPct(top.kwhPerKm, kwhMedian);
    insights.push({
      id: "driver-efficiency-outlier",
      audience: ["revenue", "operations"],
      severity: severityFromDelta(d, false, 10, 18),
      domain: "drivers",
      title: `Driver ${top.label} above fleet efficiency norm`,
      summary: `Contextual coaching candidate — ${top.kwhPerKm.toFixed(2)} kWh/km across ${top.trips} trips.`,
      metric: `${top.kwhPerKm.toFixed(2)} kWh/km`,
      vsBaseline: `route median ${kwhMedian.toFixed(2)}`,
      deltaPct: d,
      positiveIsGood: false,
      action: "Open Driver Intelligence for peer comparison and coaching plan.",
      deepLink: "/drivers",
      spark,
      trend,
      evidence: pivotEvidence(worstDrivers),
      evidenceColumns: PIVOT_COLS,
    });
  }

  const companyLeak = [...companyRows].sort((a, b) => b.netKwh / Math.max(b.distance, 1) - a.netKwh / Math.max(a.distance, 1)).slice(0, 5);
  if (companyLeak[0]) {
    const c = companyLeak[0];
    insights.push({
      id: "company-energy-intensity",
      audience: ["revenue"],
      severity: "warning",
      domain: "fleet",
      title: `${c.label} highest energy intensity`,
      summary: `${c.netKwh.toFixed(0)} kWh over ${c.distance.toFixed(0)} km — contract profitability review recommended.`,
      metric: `${(c.netKwh / Math.max(c.distance, 1)).toFixed(2)} kWh/km`,
      vsBaseline: "fleet contract norms",
      deltaPct: deltaPct(c.kwhPerKm, kwhMedian),
      positiveIsGood: false,
      action: "Align SLA and charging windows with operations for this operator.",
      deepLink: "/#explore",
      spark,
      trend,
      evidence: pivotEvidence(companyLeak),
      evidenceColumns: PIVOT_COLS,
    });
  }

  const highRiskRoutes = ROUTES.filter((r) => r.difficulty_score > 72).slice(0, 5);
  if (highRiskRoutes.length) {
    const r = highRiskRoutes[0];
    insights.push({
      id: "segment-risk-routes",
      audience: ["operations"],
      severity: "warning",
      domain: "routes",
      title: `${highRiskRoutes.length} high-risk routes need ops attention`,
      summary: `${r.route_code} difficulty ${r.difficulty_score}/100 — DMS and segment risk elevated.`,
      metric: String(r.difficulty_score),
      vsBaseline: "threshold 72",
      deltaPct: r.difficulty_score - 72,
      positiveIsGood: false,
      action: "Review Segment Risk map and assign supervisor ride-alongs.",
      deepLink: "/segments",
      spark: highRiskRoutes.map((x) => x.difficulty_score),
      trend: highRiskRoutes.map((x, i) => ({ date: x.route_code.slice(0, 6), value: x.difficulty_score })),
      evidence: highRiskRoutes.map((x) => ({
        Route: x.route_code,
        Difficulty: x.difficulty_score,
        "Leakage kWh": x.energy_leakage_kwh,
        "DMS index": x.peak_dms_index,
      })),
      evidenceColumns: [
        { key: "Route", header: "Route" },
        { key: "Difficulty", header: "Difficulty" },
        { key: "Leakage kWh", header: "Leakage kWh" },
        { key: "DMS index", header: "DMS index" },
      ],
    });
  }

  const leakage = FLEET_KPIS.total_energy_leakage_kwh;
  insights.push({
    id: "fleet-energy-leakage",
    audience: ["revenue"],
    severity: leakage > 12000 ? "critical" : "warning",
    domain: "fleet",
    title: "Fleet-wide energy leakage above target",
    summary: `Modeled ${leakage.toLocaleString()} kWh leakage across active routes — impacts unit economics.`,
    metric: `${(leakage / 1000).toFixed(1)}k kWh`,
    vsBaseline: "target < 10k kWh",
    deltaPct: deltaPct(leakage, 10000),
    positiveIsGood: false,
    action: "Prioritize top 3 routes from Route Intelligence compare view.",
    deepLink: "/routes",
    spark,
    trend,
    evidence: ROUTES.sort((a, b) => b.energy_leakage_kwh - a.energy_leakage_kwh)
      .slice(0, 6)
      .map((r) => ({
        Route: r.route_code,
        "Leakage kWh": r.energy_leakage_kwh,
        Difficulty: r.difficulty_score,
      })),
    evidenceColumns: [
      { key: "Route", header: "Route" },
      { key: "Leakage kWh", header: "Leakage kWh" },
      { key: "Difficulty", header: "Difficulty" },
    ],
  });

  const inefficientDrivers = [...DRIVERS]
    .sort((a, b) => b.efficiency_kwh_per_km - a.efficiency_kwh_per_km)
    .slice(0, 5);
  if (inefficientDrivers[0]) {
    const d = inefficientDrivers[0];
    insights.push({
      id: "driver-efficiency-revenue",
      audience: ["revenue"],
      severity: "warning",
      domain: "drivers",
      title: `${inefficientDrivers.length} drivers above efficiency target`,
      summary: `${d.driver_name} at ${d.efficiency_kwh_per_km.toFixed(2)} kWh/km — ${d.efficiency_delta_pct.toFixed(0)}% vs route-normalized expectation.`,
      metric: `${d.efficiency_kwh_per_km.toFixed(2)} kWh/km`,
      vsBaseline: "contract target",
      deltaPct: d.efficiency_delta_pct,
      positiveIsGood: false,
      action: "Coach anticipatory driving; review route assignment difficulty.",
      deepLink: "/drivers",
      spark: d.score_evolution,
      trend: d.score_evolution.map((v, i) => ({ date: `W${i + 1}`, value: v })),
      evidence: inefficientDrivers.map((x) => ({
        Driver: x.driver_name,
        "kWh/km": +x.efficiency_kwh_per_km.toFixed(2),
        "Delta %": +x.efficiency_delta_pct.toFixed(0),
        Score: x.contextual_score,
      })),
      evidenceColumns: [
        { key: "Driver", header: "Driver" },
        { key: "kWh/km", header: "kWh/km" },
        { key: "Delta %", header: "Delta %" },
        { key: "Score", header: "Score" },
      ],
    });
  }

  return insights;
}

export function buildChargingInsights(): DailyInsight[] {
  const f = DEFAULT_CHARGER_FILTERS;
  const buses = filterBusRows(BUS_HEALTH_DAILY, f);
  const chargers = filterChargerRows(CHARGER_HEALTH_DAILY, f);
  const depots = filterDepotRows(DEPOT_ENERGY_DAILY, f);
  const kpis = executiveKpis(buses, chargers, depots);
  const busLb = busLeaderboard(buses);
  const chargerLb = chargerLeaderboard(chargers);
  const depotAgg = depotComparison(depots);
  const risks = criticalRisks(busLb, chargerLb, depotAgg);
  const fleetTrend = dailyFleetTrends(buses, depots).slice(-14);
  const sparkOps = fleetTrend.map((d) => d.abnormalityScore);

  const insights: DailyInsight[] = [];

  if (kpis.abnormalBuses > 0) {
    insights.push({
      id: "abnormal-buses",
      audience: ["operations"],
      severity: kpis.abnormalBuses > 4 ? "critical" : "warning",
      domain: "charging",
      title: `${kpis.abnormalBuses} buses charging outside norms`,
      summary: "Thermal, disconnect, or efficiency KPIs breaching thresholds — maintenance queue risk.",
      metric: String(kpis.abnormalBuses),
      vsBaseline: "target ≤ 2",
      deltaPct: kpis.abnormalBuses - 2,
      positiveIsGood: false,
      action: "Open Charger Command → Fleet health matrix and schedule inspections.",
      deepLink: "/charging#bus-intel",
      spark: sparkOps,
      trend: fleetTrend.map((d) => ({ date: d.date, value: d.abnormalBuses })),
      evidence: risks.buses.slice(0, 6).map((b) => ({
        Bus: b.vehicle_number,
        Depot: b.depot_name,
        Health: +b.operational_health_score.toFixed(0),
        Abnormality: +b.abnormality_score.toFixed(0),
      })),
      evidenceColumns: [
        { key: "Bus", header: "Bus" },
        { key: "Depot", header: "Depot" },
        { key: "Health", header: "Health" },
        { key: "Abnormality", header: "Abnormality" },
      ],
    });
  }

  const worstCharger = risks.chargers[0];
  if (worstCharger) {
    insights.push({
      id: "charger-instability",
      audience: ["operations"],
      severity: worstCharger.abnormality_score > 70 ? "critical" : "warning",
      domain: "charging",
      title: `Charger ${worstCharger.charger_id} instability`,
      summary: `${worstCharger.disconnect_sessions} disconnects in window — throughput and session reliability at risk.`,
      metric: worstCharger.charger_id,
      vsBaseline: `health ${worstCharger.health_score.toFixed(0)}/100`,
      deltaPct: worstCharger.abnormality_score,
      positiveIsGood: false,
      action: "Inspect CCS connector and comms module; check bus pairing matrix.",
      deepLink: "/charging#charger-infra",
      spark: worstCharger.trend,
      trend: worstCharger.trend.map((v, i) => ({ date: `D${i + 1}`, value: v })),
      evidence: risks.chargers.slice(0, 6).map((c) => ({
        Charger: c.charger_id,
        Depot: c.depot_name,
        Disconnects: c.disconnect_sessions,
        Health: +c.health_score.toFixed(0),
      })),
      evidenceColumns: [
        { key: "Charger", header: "Charger" },
        { key: "Depot", header: "Depot" },
        { key: "Disconnects", header: "Disconnects" },
        { key: "Health", header: "Health" },
      ],
    });
  }

  const stressedDepot = [...depotAgg].sort((a, b) => b.anomalies - a.anomalies)[0];
  if (stressedDepot && stressedDepot.anomalies > 15) {
    insights.push({
      id: "depot-stress",
      audience: ["operations"],
      severity: stressedDepot.anomalies > 25 ? "critical" : "warning",
      domain: "depot",
      title: `Depot ${stressedDepot.depot} anomaly density high`,
      summary: `${stressedDepot.anomalies} anomalies aggregated — congestion or transformer stress likely.`,
      metric: String(stressedDepot.anomalies),
      vsBaseline: "peer median ~12",
      deltaPct: stressedDepot.anomalies - 12,
      positiveIsGood: false,
      action: "Review depot command center and transformer stress charts.",
      deepLink: "/charging#depot-ops",
      spark: sparkOps,
      trend: fleetTrend.map((d) => ({ date: d.date, value: d.abnormalityScore })),
      evidence: depotAgg.map((d) => ({
        Depot: d.depot,
        Anomalies: d.anomalies,
        "Ops score": +d.operational_score.toFixed(0),
        Sessions: d.sessions,
      })),
      evidenceColumns: [
        { key: "Depot", header: "Depot" },
        { key: "Anomalies", header: "Anomalies" },
        { key: "Ops score", header: "Ops score" },
        { key: "Sessions", header: "Sessions" },
      ],
    });
  }

  const events = filterEvents(ABNORMALITY_EVENTS, f).slice(0, 5);
  if (events[0]) {
    insights.push({
      id: "live-charging-alerts",
      audience: ["operations"],
      severity: "critical",
      domain: "charging",
      title: "Active charging alerts in war room",
      summary: events[0].message,
      metric: String(events.length),
      vsBaseline: "live feed",
      deltaPct: events.length,
      positiveIsGood: false,
      action: events[0].recommended_action,
      deepLink: "/charging#war-room",
      spark: sparkOps,
      trend: fleetTrend.map((d) => ({ date: d.date, value: d.disconnects })),
      evidence: events.map((e) => ({
        Entity: e.entity_label,
        Severity: e.severity,
        Message: e.message.slice(0, 80),
      })),
      evidenceColumns: [
        { key: "Entity", header: "Entity" },
        { key: "Severity", header: "Severity" },
        { key: "Message", header: "Message" },
      ],
    });
  }

  const lowUtil = chargerLb.filter((c) => c.sessions < 40).slice(0, 5);
  if (lowUtil[0]) {
    insights.push({
      id: "charger-underutilized",
      audience: ["revenue"],
      severity: "warning",
      domain: "charging",
      title: `${lowUtil.length} chargers underutilized`,
      summary: `${lowUtil[0].charger_id} only ${lowUtil[0].sessions} sessions — capacity not monetized.`,
      metric: String(lowUtil[0].sessions),
      vsBaseline: "target > 50 sessions",
      deltaPct: deltaPct(lowUtil[0].sessions, 50),
      positiveIsGood: true,
      action: "Rebalance bus assignments and peak-window scheduling.",
      deepLink: "/charging#charger-infra",
      spark: lowUtil[0].trend,
      trend: lowUtil[0].trend.map((v, i) => ({ date: `D${i + 1}`, value: v })),
      evidence: lowUtil.map((c) => ({
        Charger: c.charger_id,
        Sessions: c.sessions,
        "Energy kWh": +c.total_energy_kwh.toFixed(0),
        Health: +c.health_score.toFixed(0),
      })),
      evidenceColumns: [
        { key: "Charger", header: "Charger" },
        { key: "Sessions", header: "Sessions" },
        { key: "Energy kWh", header: "Energy kWh" },
        { key: "Health", header: "Health" },
      ],
    });
  }

  return insights;
}

export function buildDailyInsights(trips: Trip[], opts?: { charging?: boolean }): DailyInsight[] {
  const all = [...buildTripInsights(trips)];
  if (opts?.charging !== false) {
    all.push(...buildChargingInsights());
  }
  const rank = { critical: 0, warning: 1, info: 2 };
  return all.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function filterInsightsByAudience(
  insights: DailyInsight[],
  audience: InsightAudience | "all",
): DailyInsight[] {
  if (audience === "all") return insights;
  return insights.filter((i) => i.audience.includes(audience));
}
