import type { EnergyFlowPattern } from "@/lib/charger-explainability";

export type FlowStage = "grid" | "charger" | "bus" | "grid_charger" | "charger_bus";

export interface FlowTrendPoint {
  label: string;
  grid: number;
  output: number;
  demand: number;
  gap: number;
  lossCharger?: number;
  lossBus?: number;
  stress?: number;
  efficiency?: number;
}

export interface FlowHoverState {
  index: number | null;
  stage: FlowStage | null;
}

export function pointEfficiency(p: FlowTrendPoint) {
  return p.grid > 0 ? (p.output / p.grid) * 100 : 0;
}

export function classifyPoint(p: FlowTrendPoint): EnergyFlowPattern {
  const grid = p.grid;
  const out = p.output;
  const demand = p.demand;
  if (demand > out * 1.12 && grid > out * 1.05) return "charger_bottleneck";
  if (p.gap > demand * 0.12) return "bus_instability";
  if ((p.stress ?? 0) > 70) return "grid_stress";
  return "stable";
}

export function explainBottleneck(
  p: FlowTrendPoint,
  pattern: EnergyFlowPattern,
  stage: FlowStage | null,
): string {
  const eff = pointEfficiency(p);
  const chargerLoss = p.lossCharger ?? Math.max(0, p.grid - p.output);
  const busLoss = p.lossBus ?? Math.max(0, p.output - p.demand + p.gap);

  if (stage === "grid") {
    return `Grid intake ${p.grid.toFixed(0)} kWh — upstream supply for this period. Delivery efficiency ${eff.toFixed(0)}%.`;
  }
  if (stage === "charger") {
    return `Chargers delivered ${p.output.toFixed(0)} kWh (${chargerLoss.toFixed(0)} kWh lost vs grid). ${pattern === "charger_bottleneck" ? "Output is capped — charger saturation likely." : "Throughput within expected range."}`;
  }
  if (stage === "bus") {
    return `Buses demanded ${p.demand.toFixed(0)} kWh — gap ${p.gap.toFixed(0)} kWh unmet. ${busLoss > chargerLoss ? "Bus-side acceptance or BMS limits dominate loss." : "Demand aligned with delivery."}`;
  }
  if (stage === "grid_charger") {
    return `Grid → charger leg: ${chargerLoss.toFixed(0)} kWh lost (${((chargerLoss / Math.max(p.grid, 1)) * 100).toFixed(0)}% of intake). Check transformer headroom and charger utilization.`;
  }
  if (stage === "charger_bus") {
    return `Charger → bus leg: gap ${p.gap.toFixed(0)} kWh · bus-stage loss ~${busLoss.toFixed(0)} kWh. ${pattern === "bus_instability" ? "Oscillating demand vs stable output." : "Flow balanced across this segment."}`;
  }

  switch (pattern) {
    case "charger_bottleneck":
      return `${p.label}: Charger bottleneck — grid ${p.grid.toFixed(0)} kWh, output ${p.output.toFixed(0)} kWh, demand ${p.demand.toFixed(0)} kWh. Energy piles up before buses.`;
    case "bus_instability":
      return `${p.label}: Bus-side stress — demand exceeds delivery by ${p.gap.toFixed(0)} kWh. Investigate acceptance and session stability.`;
    case "grid_stress":
      return `${p.label}: Infrastructure stress ${(p.stress ?? 0).toFixed(0)}% — upstream instability affecting all legs.`;
    default:
      return `${p.label}: Stable flow — grid ${p.grid.toFixed(0)}, chargers ${p.output.toFixed(0)}, buses ${p.demand.toFixed(0)} kWh (${eff.toFixed(0)}% efficiency).`;
  }
}

export function snapshotFromTotals(totals: {
  gridKwh: number;
  chargerKwh: number;
  busKwh: number;
  gapKwh: number;
}): FlowTrendPoint {
  return {
    label: "7D total",
    grid: totals.gridKwh,
    output: totals.chargerKwh,
    demand: totals.busKwh,
    gap: totals.gapKwh,
    efficiency: totals.gridKwh > 0 ? (totals.chargerKwh / totals.gridKwh) * 100 : 0,
  };
}

export function stageGlow(stage: FlowStage | null, target: FlowStage): boolean {
  if (!stage) return false;
  if (stage === target) return true;
  if (stage === "grid_charger" && (target === "grid" || target === "charger")) return true;
  if (stage === "charger_bus" && (target === "charger" || target === "bus")) return true;
  return false;
}
