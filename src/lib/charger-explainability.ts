import { median } from "@/lib/analytics";
import type {
  BusLeaderboardRow,
  ChargerLeaderboardRow,
  CommandKpiCard,
  ExecutiveKpis,
} from "@/lib/charger-analytics";
import type { ChargerFilters } from "@/lib/charger-analytics";
import type {
  BusOperationalHealthDaily,
  ChargerBusCompatibility,
  ChargerHealthDaily,
  ChargingCurveAnalytics,
  ChargingCurvePoint,
  ChargingSession,
  DepotEnergyDaily,
  EnergyFlowIntelligenceDaily,
  RiskLevel,
  TrendWindow,
} from "@/lib/charger-data";
import { CHARGING_CURVE_ANALYTICS } from "@/lib/charger-data";

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

export function filterEnergyFlowRows(
  rows: EnergyFlowIntelligenceDaily[],
  f: ChargerFilters,
) {
  return rows.filter((r) => {
    if (!inRange(r.date, f.from, f.to)) return false;
    if (f.depotIds.length && !f.depotIds.includes(r.depot_id)) return false;
    if (f.transformers.length && !f.transformers.includes(r.transformer_id)) return false;
    return true;
  });
}

/** Per-day grid → charger → bus flow for one bus or charger (loss investigation). */
export interface EntityEnergyFlowDay {
  date: string;
  label: string;
  grid: number;
  output: number;
  demand: number;
  gap: number;
  loss_charger_kwh: number;
  loss_bus_kwh: number;
}

export interface EntityEnergyFlowSummary {
  entityType: "bus" | "charger";
  entityId: string;
  entityLabel: string;
  depotName: string;
  days: EntityEnergyFlowDay[];
  totals: {
    grid: number;
    output: number;
    demand: number;
    gap: number;
    lossCharger: number;
    lossBus: number;
    lossTotal: number;
  };
  lossInsight: string;
  dominantLoss: "charger" | "bus" | "balanced";
}

function lastNDates(sessions: ChargingSession[], n: number): string[] {
  return [...new Set(sessions.map((s) => s.date))].sort().slice(-n);
}

function sessionEnergyFlow(
  sessions: ChargingSession[],
  entityType: "bus" | "charger",
  entityId: string,
  abnormal: boolean,
): EntityEnergyFlowDay[] {
  const dates = lastNDates(sessions, 7);
  const lossChargerPct = entityType === "charger" && abnormal ? 0.14 : abnormal ? 0.06 : 0.04;
  const lossBusPct = entityType === "bus" && abnormal ? 0.12 : abnormal ? 0.03 : 0.02;

  return dates.map((date) => {
    const day = sessions.filter((s) => {
      if (s.date !== date) return false;
      return entityType === "bus" ? s.vehicle_id === entityId : s.charger_id === entityId;
    });
    const delivered = day.reduce((s, x) => s + x.energy_kwh, 0);
    const disconnectWaste = day.filter((x) => x.disconnect).length * (abnormal ? 18 : 6);
    const socShortfall = day.reduce((s, x) => s + Math.max(0, 42 - x.soc_delta) * 0.4, 0);
    const chargerEff = entityType === "charger" && abnormal ? 0.86 : 0.96;
    const output = Math.max(0, delivered * chargerEff - disconnectWaste * 0.2);
    const grid = output * (1 + lossChargerPct) + disconnectWaste * 0.3;
    const storedProxy = day.reduce((s, x) => s + x.soc_delta * 0.85 * (abnormal ? 0.75 : 0.94), 0);
    const demand =
      entityType === "bus"
        ? Math.max(storedProxy + socShortfall, output * (1 + lossBusPct))
        : day.reduce((s, x) => s + x.energy_kwh * (1.03 + (x.soc_delta < 28 ? 0.12 : 0)), 0);
    const loss_charger_kwh = Math.max(0, grid - output);
    const loss_bus_kwh = Math.max(0, output - storedProxy) + socShortfall * 0.5;
    const gap = Math.max(0, demand - output);

    return {
      date,
      label: date.slice(5),
      grid: +grid.toFixed(1),
      output: +output.toFixed(1),
      demand: +demand.toFixed(1),
      gap: +gap.toFixed(1),
      loss_charger_kwh: +loss_charger_kwh.toFixed(1),
      loss_bus_kwh: +loss_bus_kwh.toFixed(1),
    };
  });
}

function summarizeEntityFlow(
  entityType: "bus" | "charger",
  entityId: string,
  entityLabel: string,
  depotName: string,
  days: EntityEnergyFlowDay[],
  abnormal: boolean,
): EntityEnergyFlowSummary {
  const totals = days.reduce(
    (acc, d) => ({
      grid: acc.grid + d.grid,
      output: acc.output + d.output,
      demand: acc.demand + d.demand,
      gap: acc.gap + d.gap,
      lossCharger: acc.lossCharger + d.loss_charger_kwh,
      lossBus: acc.lossBus + d.loss_bus_kwh,
    }),
    { grid: 0, output: 0, demand: 0, gap: 0, lossCharger: 0, lossBus: 0 },
  );
  const lossTotal = totals.lossCharger + totals.lossBus + totals.gap;
  const dominantLoss: EntityEnergyFlowSummary["dominantLoss"] =
    totals.lossCharger > totals.lossBus * 1.25
      ? "charger"
      : totals.lossBus > totals.lossCharger * 1.25
        ? "bus"
        : "balanced";

  let lossInsight = "Energy losses distributed evenly across charger and bus stages.";
  if (dominantLoss === "charger") {
    lossInsight = `Primary loss at charger stage (${totals.lossCharger.toFixed(0)} kWh over 7d) — delivery inefficiency, disconnects, or hardware saturation on ${entityLabel}.`;
  } else if (dominantLoss === "bus") {
    lossInsight = `Primary loss at bus stage (${totals.lossBus.toFixed(0)} kWh over 7d) — low SOC acceptance, BMS limits, or thermal derating on ${entityLabel}.`;
  }
  if (totals.gap > totals.output * 0.1) {
    lossInsight += ` Unmet demand gap ${totals.gap.toFixed(0)} kWh suggests demand exceeded delivered energy.`;
  }

  return {
    entityType,
    entityId,
    entityLabel,
    depotName,
    days,
    totals: { ...totals, lossTotal: +lossTotal.toFixed(1) },
    lossInsight,
    dominantLoss,
  };
}

export function entityEnergyFlow7d(
  sessions: ChargingSession[],
  entityType: "bus" | "charger",
  entityId: string,
  entityLabel: string,
  depotName: string,
  abnormal: boolean,
): EntityEnergyFlowSummary {
  const scoped = sessions.filter((s) =>
    entityType === "bus" ? s.vehicle_id === entityId : s.charger_id === entityId,
  );
  const pool = scoped.length ? scoped : sessions;
  const dates = lastNDates(pool, 7);
  const days = sessionEnergyFlow(pool, entityType, entityId, abnormal).filter((d) =>
    dates.includes(d.date),
  );
  return summarizeEntityFlow(entityType, entityId, entityLabel, depotName, days, abnormal);
}

export function faultyBusEnergyFlows(
  sessions: ChargingSession[],
  faultyBuses: BusLeaderboardRow[],
): EntityEnergyFlowSummary[] {
  return faultyBuses.slice(0, 12).map((b) =>
    entityEnergyFlow7d(
      sessions,
      "bus",
      b.vehicle_id,
      `Bus ${b.vehicle_number}`,
      b.depot_name,
      b.risk !== "healthy",
    ),
  );
}

export function faultyChargerEnergyFlows(
  sessions: ChargingSession[],
  faultyChargers: ChargerLeaderboardRow[],
): EntityEnergyFlowSummary[] {
  return faultyChargers.slice(0, 12).map((c) =>
    entityEnergyFlow7d(
      sessions,
      "charger",
      c.charger_id,
      c.charger_id,
      c.depot_name,
      c.risk !== "healthy",
    ),
  );
}

export function entityFlowToTrend(days: EntityEnergyFlowDay[]) {
  return days.map((d) => ({
    label: d.label,
    grid: d.grid,
    output: d.output,
    demand: d.demand,
    gap: d.gap,
    lossCharger: d.loss_charger_kwh,
    lossBus: d.loss_bus_kwh,
  }));
}

function fleetAvgCurve(): ChargingCurvePoint[] {
  const current = CHARGING_CURVE_ANALYTICS.filter((c) => !c.is_reference);
  const bySoc = new Map<number, number[]>();
  current.forEach((c) =>
    c.points.forEach((p) => {
      const arr = bySoc.get(p.soc_pct) ?? [];
      arr.push(p.power_kw);
      bySoc.set(p.soc_pct, arr);
    }),
  );
  return [...bySoc.entries()]
    .sort(([a], [b]) => a - b)
    .map(([soc_pct, vals]) => ({
      soc_pct,
      power_kw: +avg(vals).toFixed(2),
      current_a: 0,
      voltage_v: 420,
      temperature_c: 32,
      phase: "CC" as const,
    }));
}

export interface BusOperationalStory {
  vehicleId: string;
  vehicleNumber: string;
  depotName: string;
  currentHealth: number;
  previousHealth: number;
  healthDelta: number;
  abnormalityScore: number;
  severity: RiskLevel;
  whyChanged: string[];
  diagnostics: { label: string; detail: string; severity: RiskLevel }[];
}

export function busOperationalStory(
  buses: BusOperationalHealthDaily[],
  vehicleId: string,
): BusOperationalStory | null {
  const rows = buses.filter((b) => b.vehicle_id === vehicleId).sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return null;
  const latest = rows[rows.length - 1]!;
  const prev = rows[rows.length - 2] ?? latest;
  const healthDelta = latest.operational_health_score - prev.operational_health_score;
  const why: string[] = [];
  const diagnostics: BusOperationalStory["diagnostics"] = [];

  if (latest.charge_acceptance_rate < prev.charge_acceptance_rate - 5) {
    why.push("Charge acceptance declining over the rolling window");
    diagnostics.push({
      label: "Charge acceptance",
      detail: `Down to ${latest.charge_acceptance_rate.toFixed(0)}% — CV taper likely beginning earlier`,
      severity: "warning",
    });
  }
  if (latest.thermal_stress > 55) {
    why.push("Thermal rise increasing during sustained charging");
    diagnostics.push({
      label: "Thermal stress",
      detail: `Thermal index ${latest.thermal_stress.toFixed(0)}/100 — elevated vs fleet norm`,
      severity: latest.thermal_stress > 70 ? "critical" : "warning",
    });
  }
  if (latest.disconnect_sessions >= 2) {
    why.push("Repeated disconnect instability detected");
    diagnostics.push({
      label: "Disconnects",
      detail: `${latest.disconnect_sessions} disconnect events in latest day`,
      severity: "critical",
    });
  }
  if (latest.energy_per_soc_pct > 2.6) {
    why.push("Energy per SOC% above fleet efficiency band");
    diagnostics.push({
      label: "Efficiency",
      detail: `${latest.energy_per_soc_pct.toFixed(2)} kWh/% — charging consistency deteriorating`,
      severity: "warning",
    });
  }
  if (latest.charging_consistency < 60) {
    why.push("Charging consistency deteriorating session-to-session");
    diagnostics.push({
      label: "Consistency",
      detail: `Stability score ${latest.charging_consistency.toFixed(0)}%`,
      severity: "warning",
    });
  }
  if (!why.length) {
    why.push("Operational metrics within expected variance — monitor abnormality trend");
  }

  const severity: RiskLevel =
    latest.abnormality_score >= 72 || latest.operational_health_score < 45
      ? "critical"
      : latest.abnormality_score >= 48
        ? "warning"
        : "healthy";

  return {
    vehicleId,
    vehicleNumber: latest.vehicle_number,
    depotName: latest.depot_name,
    currentHealth: latest.operational_health_score,
    previousHealth: prev.operational_health_score,
    healthDelta,
    abnormalityScore: latest.abnormality_score,
    severity,
    whyChanged: why,
    diagnostics,
  };
}

export interface CurveOverlaySeries {
  soc_pct: number;
  current?: number;
  previous?: number;
  fleet?: number;
  chargerAvg?: number;
  temperature?: number;
  current_a?: number;
  voltage_v?: number;
}

export function chargingCurveOverlays(
  vehicleId: string,
  chargerAvgBySoc?: Map<number, number>,
): {
  current: ChargingCurveAnalytics | null;
  previous: ChargingCurveAnalytics | null;
  fleet: ChargingCurvePoint[];
  series: CurveOverlaySeries[];
  metrics: ChargingCurveAnalytics | null;
} {
  const current = CHARGING_CURVE_ANALYTICS.find((c) => c.vehicle_id === vehicleId && !c.is_reference) ?? null;
  const previous = CHARGING_CURVE_ANALYTICS.find((c) => c.vehicle_id === vehicleId && c.is_reference) ?? null;
  const fleet = fleetAvgCurve();
  const socSet = new Set<number>();
  [current, previous, { points: fleet }].forEach((c) => c?.points.forEach((p) => socSet.add(p.soc_pct)));
  const series: CurveOverlaySeries[] = [...socSet].sort((a, b) => a - b).map((soc_pct) => {
    const cPt = current?.points.find((p) => p.soc_pct === soc_pct);
    const pPt = previous?.points.find((p) => p.soc_pct === soc_pct);
    const fPt = fleet.find((p) => p.soc_pct === soc_pct);
    return {
      soc_pct,
      current: cPt?.power_kw,
      previous: pPt?.power_kw,
      fleet: fPt?.power_kw,
      chargerAvg: chargerAvgBySoc?.get(soc_pct),
      temperature: cPt?.temperature_c,
      current_a: cPt?.current_a,
      voltage_v: cPt?.voltage_v,
    };
  });
  return { current, previous, fleet, series, metrics: current };
}

export interface ChargerOperationalStory {
  chargerId: string;
  depotName: string;
  transformerId: string;
  currentHealth: number;
  previousHealth: number;
  healthDelta: number;
  abnormalityScore: number;
  severity: RiskLevel;
  whyChanged: string[];
  diagnostics: { label: string; detail: string; severity: RiskLevel }[];
  representativeBus?: string;
}

export function chargerOperationalStory(
  chargers: ChargerHealthDaily[],
  chargerId: string,
): ChargerOperationalStory | null {
  const rows = chargers.filter((c) => c.charger_id === chargerId).sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return null;
  const latest = rows[rows.length - 1]!;
  const prev = rows[rows.length - 2] ?? latest;
  const healthDelta = latest.health_score - prev.health_score;
  const why: string[] = [];
  const diagnostics: ChargerOperationalStory["diagnostics"] = [];

  if (latest.disconnect_sessions > prev.disconnect_sessions) {
    why.push("Disconnect frequency increasing on this charger");
    diagnostics.push({
      label: "Disconnects",
      detail: `${latest.disconnect_sessions} disconnects in latest day vs ${prev.disconnect_sessions} prior`,
      severity: latest.disconnect_sessions >= 3 ? "critical" : "warning",
    });
  }
  if (latest.avg_power_kw < prev.avg_power_kw - 4) {
    why.push("Average delivery power declining");
    diagnostics.push({
      label: "Avg power",
      detail: `${latest.avg_power_kw.toFixed(1)} kW — below prior ${prev.avg_power_kw.toFixed(1)} kW`,
      severity: "warning",
    });
  }
  if (latest.utilization_pct > 88) {
    why.push("High utilization may be saturating output");
    diagnostics.push({
      label: "Utilization",
      detail: `${latest.utilization_pct.toFixed(0)}% — congestion risk during peak windows`,
      severity: "warning",
    });
  }
  if (latest.abnormality_score > 55) {
    why.push("Curve and session stability degrading vs fleet");
    diagnostics.push({
      label: "Abnormality",
      detail: `Score ${latest.abnormality_score.toFixed(0)}/100 on latest operational day`,
      severity: latest.abnormality_score >= 72 ? "critical" : "warning",
    });
  }
  if (!why.length) {
    why.push("Charger metrics within variance — review paired bus behavior on curve overlay");
  }

  const severity: RiskLevel =
    latest.abnormality_score >= 72 || latest.health_score < 45
      ? "critical"
      : latest.abnormality_score >= 48 || latest.health_score < 62
        ? "warning"
        : "healthy";

  const repCurve = CHARGING_CURVE_ANALYTICS.filter(
    (c) => c.charger_id === chargerId && !c.is_reference,
  ).sort((a, b) => b.curve_abnormality_score - a.curve_abnormality_score)[0];

  return {
    chargerId,
    depotName: latest.depot_name,
    transformerId: latest.transformer_id,
    currentHealth: latest.health_score,
    previousHealth: prev.health_score,
    healthDelta,
    abnormalityScore: latest.abnormality_score,
    severity,
    whyChanged: why,
    diagnostics,
    representativeBus: repCurve?.vehicle_number,
  };
}

/** Representative session curve for a charger (highest abnormality bus on that charger). */
export function chargingCurveOverlaysForCharger(chargerId: string): ReturnType<typeof chargingCurveOverlays> {
  const candidates = CHARGING_CURVE_ANALYTICS.filter(
    (c) => c.charger_id === chargerId && !c.is_reference,
  );
  const current =
    [...candidates].sort((a, b) => b.curve_abnormality_score - a.curve_abnormality_score)[0] ?? null;
  if (!current) {
    return { current: null, previous: null, fleet: fleetAvgCurve(), series: [], metrics: null };
  }
  const previous =
    CHARGING_CURVE_ANALYTICS.find(
      (c) => c.charger_id === chargerId && c.is_reference && c.vehicle_id === current.vehicle_id,
    ) ??
    CHARGING_CURVE_ANALYTICS.find((c) => c.charger_id === chargerId && c.is_reference) ??
    null;
  const fleet = fleetAvgCurve();
  const socSet = new Set<number>();
  [current, previous, { points: fleet }].forEach((c) => c?.points.forEach((p) => socSet.add(p.soc_pct)));
  const series: CurveOverlaySeries[] = [...socSet].sort((a, b) => a - b).map((soc_pct) => {
    const cPt = current.points.find((p) => p.soc_pct === soc_pct);
    const pPt = previous?.points.find((p) => p.soc_pct === soc_pct);
    const fPt = fleet.find((p) => p.soc_pct === soc_pct);
    return {
      soc_pct,
      current: cPt?.power_kw,
      previous: pPt?.power_kw,
      fleet: fPt?.power_kw,
      temperature: cPt?.temperature_c,
      current_a: cPt?.current_a,
      voltage_v: cPt?.voltage_v,
    };
  });
  return { current, previous, fleet, series, metrics: current };
}

export interface CurveExplainMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  fleetAvg: number;
  impact: string;
}

export function curveExplainability(metrics: ChargingCurveAnalytics): CurveExplainMetric[] {
  const fleetCv = 80;
  const fleetTaper = 1.6;
  const fleetAccept = 76;
  const cvDelta = ((metrics.cv_entry_soc - fleetCv) / fleetCv) * 100;
  return [
    {
      key: "cc",
      label: "CC duration",
      value: metrics.cc_duration_min,
      unit: "min",
      fleetAvg: 28,
      impact:
        metrics.cc_duration_min < 22
          ? "Short constant-current phase — limited bulk energy delivery"
          : "Bulk delivery phase within operational norms",
    },
    {
      key: "cv",
      label: "CV duration",
      value: metrics.cv_duration_min,
      unit: "min",
      fleetAvg: 42,
      impact:
        metrics.cv_duration_min > 50
          ? "Extended CV — charge acceptance may be declining"
          : "CV phase duration aligned with fleet",
    },
    {
      key: "cv_soc",
      label: "CV entry SOC",
      value: metrics.cv_entry_soc,
      unit: "%",
      fleetAvg: fleetCv,
      impact:
        cvDelta < -8
          ? `CV begins ${Math.abs(cvDelta).toFixed(0)}% earlier than fleet average — reduced charge acceptance`
          : "CV transition aligned with fleet average",
    },
    {
      key: "taper",
      label: "Taper rate",
      value: metrics.taper_rate_pct_per_soc,
      unit: "%/SOC",
      fleetAvg: fleetTaper,
      impact:
        metrics.taper_rate_pct_per_soc > fleetTaper * 1.25
          ? "Aggressive taper — charging stability at risk"
          : "Taper slope within expected band",
    },
    {
      key: "accept",
      label: "Charge acceptance",
      value: metrics.charge_acceptance_rate,
      unit: "%",
      fleetAvg: fleetAccept,
      impact:
        metrics.charge_acceptance_rate < fleetAccept - 10
          ? "BMS accepting less charge — investigate curve evolution"
          : "Acceptance rate supports operational health",
    },
    {
      key: "peak_kw",
      label: "Peak power",
      value: metrics.peak_power_kw,
      unit: "kW",
      fleetAvg: 72,
      impact: `Peak ${metrics.peak_power_kw} kW · ${metrics.peak_current_a} A @ ${metrics.peak_voltage_v} V`,
    },
    {
      key: "thermal",
      label: "Thermal rise",
      value: metrics.thermal_rise_c,
      unit: "°C",
      fleetAvg: 28,
      impact:
        metrics.thermal_rise_c > 35
          ? "Elevated thermal rise during CV — charging inefficiency likely"
          : "Thermal profile within operational envelope",
    },
    {
      key: "stability",
      label: "Curve stability",
      value: metrics.curve_stability_score,
      unit: "/100",
      fleetAvg: 78,
      impact:
        metrics.curve_stability_score < 60
          ? "Unstable curve shape — operational health impact"
          : "Curve stability supports fleet norms",
    },
    {
      key: "abnormality",
      label: "Curve abnormality",
      value: metrics.curve_abnormality_score,
      unit: "/100",
      fleetAvg: 22,
      impact:
        metrics.curve_abnormality_score > 55
          ? "Abnormal curve evolution detected — root cause review recommended"
          : "Curve within normal evolution band",
    },
  ];
}

export function energyFlowDailyTrend(
  rows: EnergyFlowIntelligenceDaily[],
  granularity: "hourly" | "daily" = "daily",
) {
  if (granularity === "hourly") {
    return rows
      .slice(-48)
      .map((r) => ({
        label: `${r.date.slice(5)} ${String(r.hour).padStart(2, "0")}:00`,
        grid: r.grid_intake_kwh,
        output: r.charger_output_kwh,
        demand: r.bus_demand_kwh,
        gap: r.energy_gap_kwh,
        stress: r.infrastructure_stress,
        efficiency: r.delivery_efficiency_pct,
      }));
  }
  const byDate = new Map<string, EnergyFlowIntelligenceDaily[]>();
  rows.forEach((r) => {
    const arr = byDate.get(r.date) ?? [];
    arr.push(r);
    byDate.set(r.date, arr);
  });
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, day]) => ({
      label: date.slice(5),
      grid: avg(day.map((d) => d.grid_intake_kwh)),
      output: avg(day.map((d) => d.charger_output_kwh)),
      demand: avg(day.map((d) => d.bus_demand_kwh)),
      gap: avg(day.map((d) => d.energy_gap_kwh)),
      stress: avg(day.map((d) => d.infrastructure_stress)),
      efficiency: avg(day.map((d) => d.delivery_efficiency_pct)),
    }));
}

export type EnergyFlowPattern =
  | "stable"
  | "charger_bottleneck"
  | "bus_instability"
  | "grid_stress";

export function classifyEnergyFlow(
  trend: ReturnType<typeof energyFlowDailyTrend>,
): { pattern: EnergyFlowPattern; interpretation: string } {
  const last = trend.slice(-7);
  if (!last.length) return { pattern: "stable", interpretation: "Insufficient data in window." };
  const grid = avg(last.map((t) => t.grid));
  const out = avg(last.map((t) => t.output));
  const demand = avg(last.map((t) => t.demand));
  const gridVar = Math.max(...last.map((t) => t.grid)) - Math.min(...last.map((t) => t.grid));
  const demandVar = Math.max(...last.map((t) => t.demand)) - Math.min(...last.map((t) => t.demand));

  if (gridVar > grid * 0.2 && gridVar > demandVar) {
    return {
      pattern: "grid_stress",
      interpretation: "Grid fluctuations impacting chargers — transformer or upstream power instability.",
    };
  }
  if (demand > out * 1.12 && grid > out * 1.05) {
    return {
      pattern: "charger_bottleneck",
      interpretation: "Charger saturation limiting delivery — grid and demand high, output capped.",
    };
  }
  if (demandVar > demand * 0.18 && out < grid * 0.95) {
    return {
      pattern: "bus_instability",
      interpretation: "Bus demand oscillating while infrastructure stable — charging instability likely bus-side.",
    };
  }
  return {
    pattern: "stable",
    interpretation: "Grid intake, charger output, and bus demand aligned — stable charging ecosystem.",
  };
}

export interface OperationalNarrative {
  id: string;
  severity: RiskLevel;
  title: string;
  body: string;
  action?: string;
  entity?: string;
}

export function operationalNarratives(
  buses: BusOperationalHealthDaily[],
  chargers: ChargerHealthDaily[],
  flow: EnergyFlowIntelligenceDaily[],
  busLb: BusLeaderboardRow[],
  chargerLb: ChargerLeaderboardRow[],
  kpis: ExecutiveKpis,
): OperationalNarrative[] {
  const narratives: OperationalNarrative[] = [];
  const trend = energyFlowDailyTrend(flow, "daily");
  const { interpretation, pattern } = classifyEnergyFlow(trend);

  narratives.push({
    id: "flow",
    severity: pattern === "stable" ? "healthy" : pattern === "charger_bottleneck" ? "warning" : "critical",
    title: "Energy flow intelligence",
    body: interpretation,
    action: pattern === "charger_bottleneck" ? "Rebalance charger allocation during peak windows" : undefined,
  });

  const worstBus = [...busLb].sort((a, b) => b.abnormality_score - a.abnormality_score)[0];
  if (worstBus && worstBus.risk !== "healthy") {
    const story = busOperationalStory(buses, worstBus.vehicle_id);
    narratives.push({
      id: "bus",
      severity: worstBus.risk,
      title: `Bus ${worstBus.vehicle_number} operational degradation`,
      body: story?.whyChanged.join(". ") ?? "Abnormality thresholds breached.",
      action: "Open charging curve intelligence and thermal layer",
      entity: worstBus.vehicle_number,
    });
  }

  const worstCharger = [...chargerLb].sort((a, b) => b.abnormality_score - a.abnormality_score)[0];
  if (worstCharger && worstCharger.risk !== "healthy") {
    narratives.push({
      id: "charger",
      severity: worstCharger.risk,
      title: `Charger ${worstCharger.charger_id} instability`,
      body: `Health ${worstCharger.health_score.toFixed(0)}/100 with ${worstCharger.disconnect_sessions} disconnects — declining charge acceptance behavior likely.`,
      action: "Inspect CCS connector and comms module",
      entity: worstCharger.charger_id,
    });
  }

  if (kpis.avgFleetHealth < 65) {
    narratives.push({
      id: "fleet",
      severity: "warning",
      title: "Fleet operational health under pressure",
      body: `Fleet health ${kpis.avgFleetHealth.toFixed(0)}/100 — ${kpis.abnormalBuses} buses abnormal. Earlier taper onset and thermal stress are primary drivers.`,
    });
  }

  return narratives;
}

export interface PredictiveCard {
  id: string;
  entity: string;
  entityType: "bus" | "charger" | "depot";
  forecast: string;
  confidence: number;
  trend: "up" | "down" | "flat";
  severity: RiskLevel;
}

export function predictiveIntelligence(
  busLb: BusLeaderboardRow[],
  chargerLb: ChargerLeaderboardRow[],
  depots: { depot_name: string; operational_score: number; abnormality_count: number }[],
): PredictiveCard[] {
  const cards: PredictiveCard[] = [];
  const bus = [...busLb].sort((a, b) => b.abnormality_score - a.abnormality_score)[0];
  if (bus) {
    cards.push({
      id: "pred_bus",
      entity: `Bus ${bus.vehicle_number}`,
      entityType: "bus",
      forecast: "Increasing degradation trajectory over next 7 days if thermal trend continues",
      confidence: 78,
      trend: "down",
      severity: bus.risk === "healthy" ? "warning" : bus.risk,
    });
  }
  const ch = [...chargerLb].filter((c) => c.risk !== "healthy")[0];
  if (ch) {
    cards.push({
      id: "pred_charger",
      entity: ch.charger_id,
      entityType: "charger",
      forecast: "Likely to become operationally unstable without connector inspection",
      confidence: 71,
      trend: "down",
      severity: ch.risk,
    });
  }
  const depot = [...depots].sort((a, b) => a.operational_score - b.operational_score)[0];
  if (depot && depot.operational_score < 72) {
    cards.push({
      id: "pred_depot",
      entity: depot.depot_name,
      entityType: "depot",
      forecast: "Expected charging congestion during tomorrow peak window",
      confidence: 65,
      trend: "up",
      severity: "warning",
    });
  }
  return cards;
}

export function compatibilityInsights(pairs: ChargerBusCompatibility[]) {
  return pairs.slice(0, 6).map((p) => ({
    ...p,
    headline:
      p.performance_delta_pct < -20
        ? `Bus ${p.vehicle_number} underperforms on ${p.charger_id}`
        : p.disconnect_rate_pct > 10
          ? `${p.charger_id} elevated disconnects with Bus ${p.vehicle_number}`
          : p.note,
  }));
}

export function thermalCurveData(curve: ChargingCurveAnalytics | null) {
  if (!curve) return [];
  return curve.points.map((p) => ({
    soc: p.soc_pct,
    temp: p.temperature_c,
    power: p.power_kw,
    phase: p.phase,
  }));
}

/** Extended ribbon KPIs aligned to explainable operational health spec */
export function explainabilityRibbonKpis(
  buses: BusOperationalHealthDaily[],
  chargers: ChargerHealthDaily[],
  base: ExecutiveKpis,
  existing: CommandKpiCard[],
): CommandKpiCard[] {
  const curves = CHARGING_CURVE_ANALYTICS.filter((c) => !c.is_reference);
  const curveStability = avg(curves.map((c) => c.curve_stability_score));
  const curveStabDelta = -2.4;
  const thermalStability = 100 - avg(buses.map((b) => b.thermal_stress));
  const thermalDelta = -4.1;
  const deliveryStab = avg(
    buses.map((b) => b.charging_consistency),
  );
  const chargeEff = buses.length
    ? 100 - avg(buses.map((b) => b.energy_per_soc_pct)) * 28
    : 0;
  const chargingEffDelta = 1.2;

  const sev = (v: number, warn: number, crit: number): RiskLevel | "neutral" => {
    if (v <= crit) return "critical";
    if (v <= warn) return "warning";
    return "neutral";
  };

  const extra: CommandKpiCard[] = [
    {
      id: "curve_stability",
      label: "Curve stability",
      value: curveStability.toFixed(0),
      unit: "/100",
      delta: curveStabDelta,
      positiveIsGood: true,
      severity: sev(curveStability, 62, 48),
      spark: base.sparkHealth,
      insight:
        curveStabDelta < 0
          ? "Charging stability deteriorated due to increased taper aggressiveness across abnormal sessions."
          : "Charging curve shapes stable vs fleet — CC/CV transitions within norms.",
    },
    {
      id: "charging_efficiency",
      label: "Charging efficiency",
      value: clamp(chargeEff, 0, 99).toFixed(0),
      unit: "/100",
      delta: chargingEffDelta,
      positiveIsGood: true,
      severity: sev(clamp(chargeEff, 0, 99), 58, 45),
      spark: base.sparkEnergy,
      insight: `Energy per SOC% fleet band — ${chargingEffDelta >= 0 ? "improving" : "declining"} delivery efficiency vs prior period.`,
    },
    {
      id: "thermal_stability",
      label: "Thermal stability",
      value: thermalStability.toFixed(0),
      unit: "/100",
      delta: thermalDelta,
      positiveIsGood: true,
      severity: sev(thermalStability, 55, 42),
      spark: base.sparkHealth,
      insight:
        thermalDelta < 0
          ? "Thermal rise increasing during CV phase — charging inefficiency likely on stressed buses."
          : "Thermal envelope within operational limits fleet-wide.",
    },
    {
      id: "delivery_stability",
      label: "Energy delivery",
      value: deliveryStab.toFixed(0),
      unit: "/100",
      delta: -1.8,
      positiveIsGood: true,
      severity: sev(deliveryStab, 60, 48),
      spark: base.sparkSessions,
      insight: "Session-to-session delivery consistency — proxy for infrastructure + bus stability.",
    },
  ];

  const coreIds = new Set([
    "fleet_health",
    "charger_health",
    "depot_score",
    "active_chargers",
    "abnormal_buses",
    "abnormal_chargers",
    "curve_stability",
    "charging_efficiency",
    "thermal_stability",
    "delivery_stability",
  ]);
  const core = existing.filter((k) => coreIds.has(k.id));
  const merged = [...core];
  extra.forEach((e) => {
    if (!merged.find((m) => m.id === e.id)) merged.push(e);
  });
  return merged;
}

function avg(nums: number[]) {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
