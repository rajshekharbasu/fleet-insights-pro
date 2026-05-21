import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Brain, Stethoscope } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Panel, fmt } from "@/components/charger/charger-shared";
import {
  busLatest,
  busPrevious,
  busTrend,
  curveSessionsForVehicle,
} from "@/lib/intelligence-data";

export function BusHealthStory({ vehicle_number }: { vehicle_number: string }) {
  const latest = busLatest(vehicle_number);
  const prev = busPrevious(vehicle_number);
  const trend = busTrend(vehicle_number);
  const sessions = curveSessionsForVehicle(vehicle_number);
  const last = sessions[sessions.length - 1];
  const pre = sessions[sessions.length - 2];

  if (!latest || !last) return null;
  const delta = latest.operational_health_score - (prev?.operational_health_score ?? latest.operational_health_score);
  const declining = delta < 0;
  const reasons: string[] = [];
  if (pre && last.cv_entry_soc < pre.cv_entry_soc - 2)
    reasons.push(`CV phase begins ${(pre.cv_entry_soc - last.cv_entry_soc).toFixed(0)}% earlier than yesterday`);
  if (latest.thermal_rise_per_kwh > 2.4)
    reasons.push(`Thermal rise ${latest.thermal_rise_per_kwh.toFixed(2)}°C/kWh — above fleet norm`);
  if (latest.charge_acceptance_rate < 75)
    reasons.push(`Charge acceptance declined to ${latest.charge_acceptance_rate.toFixed(0)}%`);
  if (latest.disconnect_sessions >= 2)
    reasons.push(`${latest.disconnect_sessions} disconnect events today — repeated instability`);
  if (latest.charging_consistency < 75)
    reasons.push(`Session-to-session consistency at ${latest.charging_consistency.toFixed(0)}/100`);
  if (!reasons.length) reasons.push("Operating within expected parameters — no abnormal drivers detected");

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/30">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Explainable bus health · Bus {vehicle_number}
            </div>
            <h3 className="mt-0.5 text-[18px] font-semibold tracking-tight">
              Operational story · {latest.depot_name}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card/50 px-4 py-2.5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Health today</div>
            <div className="num text-[22px] font-semibold leading-none">
              {fmt(latest.operational_health_score, 0)}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">/100</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">vs yesterday</div>
            <div
              className={`num flex items-center gap-1 text-[16px] font-semibold ${
                declining ? "text-destructive" : "text-success"
              }`}
            >
              {declining ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              {delta.toFixed(1)}
            </div>
          </div>
          <div className="h-10 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="story-spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="health"
                  stroke="var(--color-primary)"
                  strokeWidth={1.6}
                  fill="url(#story-spark)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-border/50 bg-muted/15 p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <Stethoscope className="h-3.5 w-3.5 text-primary" />
          Root cause intelligence — why health changed
        </div>
        <ul className="mt-3 space-y-2">
          {reasons.map((r, i) => (
            <motion.li
              key={r}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-start gap-2.5 text-[13px]"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-foreground/90">{r}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
