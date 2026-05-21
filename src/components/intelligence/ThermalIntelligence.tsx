import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Flame } from "lucide-react";
import { Panel, PanelHeader, fmt } from "@/components/charger/charger-shared";
import { curveSessionsForVehicle } from "@/lib/intelligence-data";

export function ThermalIntelligence({ vehicle_number }: { vehicle_number: string }) {
  const sessions = useMemo(() => curveSessionsForVehicle(vehicle_number), [vehicle_number]);
  const last = sessions[sessions.length - 1];
  if (!last) return null;

  // Power vs temperature scatter (current session points)
  const scatter = last.curve.map((p) => ({
    power: p.power_kw,
    temp: p.temp_c,
    soc: p.soc,
    phase: p.phase,
    abnormal: p.temp_c > 55,
  }));

  // Thermal evolution: temp over SOC, current vs previous
  const prev = sessions[sessions.length - 2];
  const evo = last.curve.map((p, i) => ({
    soc: p.soc,
    current: p.temp_c,
    previous: prev?.curve[i]?.temp_c ?? null,
  }));

  const ccTherm = last.curve.filter((p) => p.phase === "CC").reduce((s, p) => s + p.temp_c, 0) / Math.max(last.curve.filter((p) => p.phase === "CC").length, 1);
  const cvTherm = last.curve.filter((p) => p.phase !== "CC").reduce((s, p) => s + p.temp_c, 0) / Math.max(last.curve.filter((p) => p.phase !== "CC").length, 1);

  return (
    <Panel>
      <PanelHeader
        title="Thermal intelligence layer"
        description="How temperature evolves and where charging stress concentrates"
        action={<Flame className="h-4 w-4 text-destructive" />}
      />
      <div className="grid grid-cols-3 gap-2 border-b border-border/40 px-4 py-2.5">
        <Stat label="CC avg temp" value={`${fmt(ccTherm, 1)}°C`} accent />
        <Stat label="CV/Taper avg" value={`${fmt(cvTherm, 1)}°C`} hot={cvTherm - ccTherm > 8} />
        <Stat label="Thermal rise" value={`${fmt(last.thermal_rise, 1)}°C`} hot={last.thermal_rise > 18} />
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-2">
        <div className="h-64 rounded-xl bg-card/40 p-2 ring-1 ring-border/40">
          <div className="px-2 pt-1 text-[11px] font-medium text-muted-foreground">
            Power × Temperature scatter
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 12, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" dataKey="power" name="kW" tick={{ fontSize: 10 }} />
              <YAxis type="number" dataKey="temp" name="°C" tick={{ fontSize: 10 }} />
              <ZAxis type="number" dataKey="soc" range={[20, 80]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ payload }) => {
                  if (!payload?.[0]) return null;
                  const d = payload[0].payload as typeof scatter[0];
                  return (
                    <div className="rounded-lg border border-border bg-popover p-2 text-[11px]">
                      <div className="font-semibold">{d.phase} · SOC {d.soc}%</div>
                      <div>{d.power} kW @ {d.temp.toFixed(1)}°C</div>
                    </div>
                  );
                }}
              />
              <Scatter
                data={scatter.filter((s) => !s.abnormal)}
                fill="var(--color-chart-1)"
                fillOpacity={0.65}
              />
              <Scatter data={scatter.filter((s) => s.abnormal)} fill="var(--color-destructive)" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="h-64 rounded-xl bg-card/40 p-2 ring-1 ring-border/40">
          <div className="px-2 pt-1 text-[11px] font-medium text-muted-foreground">
            Thermal evolution by SOC (current vs previous session)
          </div>
          <ResponsiveContainer width="100%" height="90%">
            <ComposedChart data={evo} margin={{ top: 8, right: 12, bottom: 12, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="soc" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[20, 80]} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Line type="monotone" dataKey="previous" stroke="var(--color-muted-foreground)" strokeWidth={1.4} strokeDasharray="4 4" dot={false} />
              <Line type="monotone" dataKey="current" stroke="var(--color-destructive)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-b-2xl border-t border-border/40 bg-muted/15 px-4 py-2.5 text-[11.5px] text-muted-foreground">
        {last.thermal_rise > 18
          ? `Elevated thermal rise of ${last.thermal_rise.toFixed(1)}°C indicates BMS stress — most heat accumulates in CV/Taper phase.`
          : `Thermal profile within expected envelope — no immediate intervention required.`}
      </div>
    </Panel>
  );
}

function Stat({ label, value, hot, accent }: { label: string; value: string; hot?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-card/60 px-3 py-2 ring-1 ring-border/40">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`num text-[16px] font-semibold ${hot ? "text-destructive" : accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
