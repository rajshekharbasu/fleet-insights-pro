import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { Activity, Info } from "lucide-react";
import { Panel, PanelHeader, fmt } from "@/components/charger/charger-shared";
import { energyFlowDaily, energyFlowHourly, type EnergyFlowDaily } from "@/lib/intelligence-data";
import type { DepotEnergyDaily } from "@/lib/charger-data";

type Window = "1D" | "7D" | "30D";

export function TripleSyncTrend({ depots }: { depots: DepotEnergyDaily[] }) {
  const [window, setWindow] = useState<Window>("30D");
  const daily = useMemo(() => energyFlowDaily(depots), [depots]);
  const hourly = useMemo(() => energyFlowHourly(), []);

  const data = useMemo(() => {
    if (window === "1D") return hourly.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00`, grid: h.grid, charger: h.charger, bus: h.bus }));
    const slice = window === "7D" ? daily.slice(-7) : daily;
    return slice.map((d) => ({ label: d.date.slice(5), grid: d.grid_intake_kwh, charger: d.charger_output_kwh, bus: d.bus_demand_kwh }));
  }, [window, daily, hourly]);

  const interpretation = useMemo(() => interpret(data), [data]);

  return (
    <Panel>
      <PanelHeader
        title="Triple synchronized energy intelligence"
        description="Grid intake · Charger output · Bus demand — divergence reveals bottlenecks"
        action={
          <div className="flex rounded-lg border border-border/60 p-0.5">
            {(["1D", "7D", "30D"] as Window[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindow(w)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                  window === w ? "bg-muted text-foreground" : "text-muted-foreground"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        }
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="h-72 px-2 pt-3"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" opacity={0.3} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid var(--border)", background: "var(--popover)" }}
              formatter={(v: number, n) => [`${fmt(v, 0)} kWh`, n]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
            <Line type="monotone" dataKey="grid" name="Grid intake" stroke="var(--color-chart-3)" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} animationDuration={900} />
            <Line type="monotone" dataKey="charger" name="Charger output" stroke="var(--color-primary)" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} animationDuration={900} />
            <Line type="monotone" dataKey="bus" name="Bus demand" stroke="var(--color-success)" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} animationDuration={900} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
      <div className="flex items-start gap-2 border-t border-border/40 bg-muted/15 px-4 py-3 text-[12px] text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          <strong className="text-foreground">{interpretation.headline}</strong> — {interpretation.detail}
        </span>
      </div>
    </Panel>
  );
}

function interpret(data: { grid: number; charger: number; bus: number }[]) {
  if (!data.length) return { headline: "No data", detail: "" };
  const last = data.slice(-Math.min(data.length, 5));
  const avg = (k: "grid" | "charger" | "bus") => last.reduce((s, d) => s + d[k], 0) / last.length;
  const g = avg("grid"), c = avg("charger"), b = avg("bus");
  const cap = (c - b) / c;
  const inflow = (g - c) / g;
  if (cap > 0.12 && inflow < 0.08) {
    return { headline: "Charger bottleneck detected", detail: `Charger output capped while grid intake holds — ${(cap * 100).toFixed(0)}% delivery gap suggests saturation.` };
  }
  if (cap < 0.04 && inflow < 0.05) {
    return { headline: "Stable charging ecosystem", detail: "Grid, charger, and bus curves are aligned — infrastructure delivering within expected envelope." };
  }
  // bus oscillation: stddev of bus / mean
  const mean = b;
  const variance = last.reduce((s, d) => s + Math.pow(d.bus - mean, 2), 0) / last.length;
  if (Math.sqrt(variance) / mean > 0.08) {
    return { headline: "Bus-side charging instability", detail: "Grid and charger output stable while bus demand oscillates — likely BMS variability across pack states." };
  }
  return { headline: "Infrastructure stress likely upstream", detail: `Grid fluctuations propagating to chargers — investigate transformer health.` };
}
