import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { Activity, Layers, Thermometer, Zap } from "lucide-react";
import { Panel, PanelHeader, fmt } from "@/components/charger/charger-shared";
import {
  chargerAverageCurve,
  curveSessionsForVehicle,
  fleetAverageCurve,
  type ChargingCurveSession,
  type CurvePoint,
} from "@/lib/intelligence-data";

type Overlay = "current" | "previous" | "fleet" | "charger";
type Channel = "power_kw" | "current_a" | "voltage_v" | "temp_c";

const CHANNEL_META: Record<Channel, { label: string; unit: string; color: string }> = {
  power_kw: { label: "Power", unit: "kW", color: "var(--color-chart-1)" },
  current_a: { label: "Current", unit: "A", color: "var(--color-chart-2)" },
  voltage_v: { label: "Voltage", unit: "V", color: "var(--color-chart-3)" },
  temp_c: { label: "Temperature", unit: "°C", color: "var(--color-destructive)" },
};

export function ChargingCurveHero({ vehicle_number }: { vehicle_number: string }) {
  const sessions = useMemo(() => curveSessionsForVehicle(vehicle_number), [vehicle_number]);
  const current = sessions[sessions.length - 1];
  const previous = sessions[sessions.length - 2];
  const fleet = useMemo(() => fleetAverageCurve(), []);
  const chargerAvg = useMemo(() => current ? chargerAverageCurve(current.charger_id) : [], [current]);

  const [overlays, setOverlays] = useState<Record<Overlay, boolean>>({
    current: true,
    previous: true,
    fleet: true,
    charger: false,
  });
  const [channel, setChannel] = useState<Channel>("power_kw");

  const merged = useMemo(() => {
    if (!current) return [];
    const map = new Map<number, Record<string, number | string>>();
    const put = (curve: CurvePoint[], key: string) => {
      curve.forEach((p) => {
        const row = map.get(p.soc) ?? { soc: p.soc };
        row[key] = p[channel];
        if (key === "current") row.phase = p.phase;
        map.set(p.soc, row);
      });
    };
    if (overlays.current) put(current.curve, "current");
    if (overlays.previous && previous) put(previous.curve, "previous");
    if (overlays.fleet) put(fleet, "fleet");
    if (overlays.charger) put(chargerAvg, "charger");
    return [...map.values()].sort((a, b) => (a.soc as number) - (b.soc as number));
  }, [current, previous, fleet, chargerAvg, overlays, channel]);

  if (!current) return null;

  const cvEntry = current.cv_entry_soc;
  const taperStart = cvEntry + 18;
  const fleetCvEntry = 70;
  const earlierBy = +(fleetCvEntry - cvEntry).toFixed(1);

  const meta = CHANNEL_META[channel];

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Charging curve evolution intelligence"
        description={`SOC × ${meta.label} (${meta.unit}) — phase overlays explain charging behavior`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border/60 p-0.5">
              {(["power_kw", "current_a", "voltage_v", "temp_c"] as Channel[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannel(c)}
                  className={`rounded-md px-2 py-1 text-[10.5px] font-medium transition-all ${
                    channel === c ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {CHANNEL_META[c].label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 border-b border-border/40 px-4 py-2.5 text-[10.5px] sm:grid-cols-4">
        {([
          ["current", "Current session", "var(--color-chart-1)"],
          ["previous", "Previous session", "var(--color-chart-2)"],
          ["fleet", "Fleet average", "var(--color-muted-foreground)"],
          ["charger", `Charger ${current.charger_id}`, "var(--color-warning)"],
        ] as [Overlay, string, string][]).map(([id, label, color]) => (
          <button
            key={id}
            type="button"
            onClick={() => setOverlays((o) => ({ ...o, [id]: !o[id] }))}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
              overlays[id] ? "border-border/60 bg-muted/40 text-foreground" : "border-border/30 text-muted-foreground/70"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: color, opacity: overlays[id] ? 1 : 0.3 }} />
            <span className="truncate text-[10.5px] font-medium">{label}</span>
          </button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative h-[360px] px-2 pt-3"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={merged} margin={{ top: 10, right: 24, bottom: 18, left: 4 }}>
            <defs>
              <linearGradient id="curve-current" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" opacity={0.35} vertical={false} />
            <XAxis
              dataKey="soc"
              type="number"
              domain={[10, 100]}
              tick={{ fontSize: 10 }}
              label={{ value: "SOC %", position: "insideBottom", offset: -4, fontSize: 10, fill: "var(--color-muted-foreground)" }}
            />
            <YAxis tick={{ fontSize: 10 }} label={{ value: meta.unit, angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--color-muted-foreground)" }} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid var(--border)", background: "var(--popover)" }}
              labelFormatter={(v) => `SOC ${v}%`}
            />
            <ReferenceArea x1={10} x2={cvEntry} y1={0} y2={9999} fill="var(--color-success)" fillOpacity={0.05} />
            <ReferenceArea x1={cvEntry} x2={taperStart} y1={0} y2={9999} fill="var(--color-warning)" fillOpacity={0.07} />
            <ReferenceArea x1={taperStart} x2={100} y1={0} y2={9999} fill="var(--color-destructive)" fillOpacity={0.06} />
            {overlays.fleet && (
              <Line
                type="monotone"
                dataKey="fleet"
                stroke="var(--color-muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive
                animationDuration={900}
              />
            )}
            {overlays.charger && (
              <Line
                type="monotone"
                dataKey="charger"
                stroke="var(--color-warning)"
                strokeWidth={1.6}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive
                animationDuration={900}
              />
            )}
            {overlays.previous && (
              <Line
                type="monotone"
                dataKey="previous"
                stroke="var(--color-chart-2)"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive
                animationDuration={900}
              />
            )}
            {overlays.current && (
              <Area
                type="monotone"
                dataKey="current"
                stroke="var(--color-chart-1)"
                strokeWidth={2.2}
                fill="url(#curve-current)"
                isAnimationActive
                animationDuration={1100}
              />
            )}
            <Legend
              verticalAlign="top"
              height={0}
              content={() => null}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute left-4 top-3 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="rounded-md bg-success/10 px-1.5 py-0.5 font-medium text-success ring-1 ring-success/30">CC phase</span>
          <span className="rounded-md bg-warning/10 px-1.5 py-0.5 font-medium text-warning ring-1 ring-warning/30">CV phase</span>
          <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 font-medium text-destructive ring-1 ring-destructive/30">Taper region</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-2 border-t border-border/40 bg-muted/15 px-4 py-3 text-[11px] sm:grid-cols-4">
        <StatPill icon={Layers} label="CV entry" value={`${fmt(cvEntry, 0)}%`} hint={earlierBy > 0 ? `${earlierBy.toFixed(0)}% earlier than fleet` : "Aligned with fleet"} negative={earlierBy > 5} />
        <StatPill icon={Zap} label="Peak power" value={`${fmt(current.peak_power, 0)} kW`} hint={`Acceptance ${fmt(current.charge_acceptance, 0)}%`} negative={current.charge_acceptance < 70} />
        <StatPill icon={Thermometer} label="Thermal rise" value={`${fmt(current.thermal_rise, 1)}°C`} hint={current.thermal_rise > 18 ? "Elevated vs baseline" : "Within range"} negative={current.thermal_rise > 18} />
        <StatPill icon={Activity} label="Curve stability" value={`${fmt(current.curve_stability, 0)}/100`} hint={`Abnormality ${fmt(current.curve_abnormality, 0)}`} negative={current.curve_stability < 70} />
      </div>
    </Panel>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  hint,
  negative,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
  hint: string;
  negative?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-card/60 px-2.5 py-2 ring-1 ring-border/40">
      <Icon className={`mt-0.5 h-3.5 w-3.5 ${negative ? "text-destructive" : "text-primary"}`} />
      <div className="min-w-0">
        <div className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
        <div className="num text-[14px] font-semibold leading-tight">{value}</div>
        <div className={`mt-0.5 text-[10px] ${negative ? "text-destructive" : "text-muted-foreground"}`}>{hint}</div>
      </div>
    </div>
  );
}
