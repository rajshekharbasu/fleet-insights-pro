import { Battery, Gauge, ThermometerSun, Timer, X, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Trip } from "@/lib/mock-data";

interface Props {
  trip: Trip | null;
  onClose: () => void;
}

export function TripDetailDrawer({ trip, onClose }: Props) {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-background/60 backdrop-blur-sm transition-opacity ${
          trip ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-screen w-full max-w-[460px] overflow-y-auto border-l border-border/60 bg-card shadow-2xl transition-transform duration-300 ${
          trip ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {trip && <DrawerContent trip={trip} onClose={onClose} />}
      </aside>
    </>
  );
}

function DrawerContent({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const energySplit = [
    { name: "Discharge", value: trip.gross_discharge_kwh, color: "var(--color-chart-2)" },
    { name: "Regen", value: trip.regen_kwh, color: "var(--color-chart-1)" },
  ];
  const packShare = [
    { name: "Pack A", value: trip.a_kwh_share * 100, color: "var(--color-chart-3)" },
    { name: "Pack B", value: trip.b_kwh_share * 100, color: "var(--color-chart-4)" },
  ];

  // Synthetic timeline using known telemetry endpoints
  const points = Array.from({ length: 24 }, (_, i) => {
    const t = i / 23;
    return {
      t: i,
      soc: trip.battery_pack_state_of_charge_start - (trip.battery_pack_state_of_charge_start - trip.battery_pack_state_of_charge_end) * t,
      power: trip.avg_power_kw * (0.6 + 0.8 * Math.sin(i / 3 + 1)),
    };
  });

  const flags = [
    { ok: !trip.high_temp_flag, label: "Thermal" },
    { ok: !trip.voltage_instability_flag, label: "Voltage" },
    { ok: !trip.pack_imbalance_flag, label: "Pack balance" },
    { ok: !trip.efficiency_anomaly_flag, label: "Efficiency" },
  ];

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/60 bg-card/95 px-5 py-4 backdrop-blur">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Trip detail</div>
          <h3 className="mt-0.5 text-[16px] font-semibold tracking-tight">{trip.trip_id}</h3>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            {trip.driver_name} · {trip.vehiclenumber} · {trip.route_code}
          </p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-2.5">
          <Stat icon={Gauge} label="Distance" value={`${trip.trip_distance_km.toFixed(1)} km`} />
          <Stat icon={Zap} label="Net energy" value={`${trip.net_kwh_consumed.toFixed(1)} kWh`} />
          <Stat icon={Battery} label="SOC" value={`${trip.battery_pack_state_of_charge_start.toFixed(0)} → ${trip.battery_pack_state_of_charge_end.toFixed(0)}%`} />
          <Stat icon={Timer} label="Idle" value={`${Math.round(trip.idle_time_sec / 60)}m · ${trip.idle_energy_share_pct.toFixed(1)}%`} />
        </div>

        <Section title="Energy breakdown">
          <div className="grid grid-cols-2 gap-3">
            <ChartBox>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={energySplit} dataKey="value" innerRadius={32} outerRadius={48} paddingAngle={2} stroke="none">
                    {energySplit.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <Legend rows={energySplit} suffix=" kWh" />
            </ChartBox>
            <ChartBox>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={packShare} dataKey="value" innerRadius={32} outerRadius={48} paddingAngle={2} stroke="none">
                    {packShare.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <Legend rows={packShare} suffix="%" decimals={1} />
            </ChartBox>
          </div>
        </Section>

        <Section title="Power & SOC timeline">
          <div className="h-32 rounded-lg border border-border/50 bg-card/40 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} opacity={0.4} />
                <XAxis dataKey="t" hide />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tipStyle} />
                <Bar dataKey="power" fill="var(--color-chart-1)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Thermal & voltage">
          <div className="grid grid-cols-2 gap-2.5">
            <Stat icon={ThermometerSun} label="Max cell temp" value={`${trip.max_cell_temp.toFixed(1)}°C`} accent={trip.high_temp_flag ? "destructive" : undefined} />
            <Stat icon={Zap} label="V (A / B)" value={`${trip.avg_a_voltage_v.toFixed(0)} / ${trip.avg_b_voltage_v.toFixed(0)}`} accent={trip.voltage_instability_flag ? "warning" : undefined} />
          </div>
        </Section>

        <Section title="Diagnostic flags">
          <div className="flex flex-wrap gap-1.5">
            {flags.map((f) => (
              <span
                key={f.label}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] ring-1 ${
                  f.ok ? "bg-success/10 text-success ring-success/20" : "bg-destructive/10 text-destructive ring-destructive/20"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${f.ok ? "bg-success" : "bg-destructive"}`} />
                {f.label} {f.ok ? "OK" : "ALERT"}
              </span>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

const tipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 11,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: "destructive" | "warning" }) {
  const tone = accent === "destructive" ? "text-destructive" : accent === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={`mt-1 num text-[14px] font-semibold tracking-tight ${tone}`}>{value}</div>
    </div>
  );
}

function ChartBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border/50 bg-card/40 p-2 h-32 flex flex-col">{children}</div>;
}

function Legend({ rows, suffix, decimals = 1 }: { rows: { name: string; value: number; color: string }[]; suffix?: string; decimals?: number }) {
  return (
    <div className="mt-1 grid grid-cols-2 gap-1 text-[10.5px]">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
          <span className="text-muted-foreground">{r.name}</span>
          <span className="ml-auto num text-foreground">{r.value.toFixed(decimals)}{suffix}</span>
        </div>
      ))}
    </div>
  );
}
