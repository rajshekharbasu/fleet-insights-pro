import { Panel, PanelHeader, fmt } from "@/components/charger/charger-shared";
import { curveSessionsForVehicle, fleetAverageCurve } from "@/lib/intelligence-data";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";

interface Metric {
  label: string;
  value: number;
  unit: string;
  baseline: number;
  betterWhen: "higher" | "lower";
  explain: string;
}

export function CurveExplainability({ vehicle_number }: { vehicle_number: string }) {
  const sessions = curveSessionsForVehicle(vehicle_number);
  const last = sessions[sessions.length - 1];
  const fleet = fleetAverageCurve();
  if (!last) return null;

  const fleetPeak = Math.max(...fleet.map((p) => p.power_kw));
  const metrics: Metric[] = [
    { label: "CC duration", value: last.cc_duration_min, unit: "min", baseline: 38, betterWhen: "higher",
      explain: "Longer CC phase = healthier charge acceptance" },
    { label: "CV duration", value: last.cv_duration_min, unit: "min", baseline: 22, betterWhen: "lower",
      explain: "Extended CV phase indicates premature current taper" },
    { label: "CV entry SOC", value: last.cv_entry_soc, unit: "%", baseline: 72, betterWhen: "higher",
      explain: "Earlier CV entry signals reduced acceptance" },
    { label: "Taper rate", value: last.taper_rate, unit: "kW/%", baseline: 1.2, betterWhen: "lower",
      explain: "Aggressive taper = thermal or BMS stress" },
    { label: "Acceptance", value: last.charge_acceptance, unit: "%", baseline: 82, betterWhen: "higher",
      explain: "BMS-reported charge acceptance vs fleet norm" },
    { label: "Peak power", value: last.peak_power, unit: "kW", baseline: fleetPeak, betterWhen: "higher",
      explain: "Max power achieved during CC phase" },
    { label: "Peak current", value: last.peak_current, unit: "A", baseline: 220, betterWhen: "higher",
      explain: "Current capacity reaching the pack" },
    { label: "Peak voltage", value: last.peak_voltage, unit: "V", baseline: 620, betterWhen: "higher",
      explain: "Pack voltage at peak charge" },
    { label: "Thermal rise", value: last.thermal_rise, unit: "°C", baseline: 14, betterWhen: "lower",
      explain: "Temperature delta start-to-end of session" },
    { label: "Curve stability", value: last.curve_stability, unit: "/100", baseline: 82, betterWhen: "higher",
      explain: "Session-to-session consistency score" },
    { label: "Curve abnormality", value: last.curve_abnormality, unit: "/100", baseline: 30, betterWhen: "lower",
      explain: "Composite divergence from healthy profile" },
  ];

  return (
    <Panel>
      <PanelHeader
        title="Curve explainability layer"
        description="Each metric translates curve geometry into an operational implication"
      />
      <div className="grid grid-cols-1 gap-px bg-border/40 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((m, i) => {
          const delta = ((m.value - m.baseline) / m.baseline) * 100;
          const good = m.betterWhen === "higher" ? delta >= -3 : delta <= 3;
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              className="bg-card p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {m.label}
                </span>
                <span
                  className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                    good ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"
                  }`}
                >
                  {good ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(0)}%
                </span>
              </div>
              <div className="num mt-1 text-[18px] font-semibold leading-tight">
                {fmt(m.value, m.unit === "%" || m.unit === "kW" || m.unit === "A" || m.unit === "V" || m.unit === "min" || m.unit === "/100" ? 0 : 1)}
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">{m.unit}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Baseline {fmt(m.baseline, 0)} {m.unit}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground/90">{m.explain}</p>
            </motion.div>
          );
        })}
      </div>
    </Panel>
  );
}
