import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Search, Wrench } from "lucide-react";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { CHART_ENTER } from "@/lib/chart-motion";
import type { BusLeaderboardRow } from "@/lib/charger-analytics";
import { busPeerScatter, busThermalHeatmap, dailyFleetTrends, fleetMedians } from "@/lib/charger-analytics";
import type { BusOperationalHealthDaily } from "@/lib/charger-data";
import { MAINTENANCE_RECOMMENDATIONS } from "@/lib/charger-data";
import { AbnormalBusTrendPanel } from "./AbnormalBusTrendPanel";
import { fmt, Panel, PanelHeader, RiskBadge, TrendSpark } from "./charger-shared";

const RISK_COLOR = { healthy: "#2dd4bf", warning: "#fbbf24", critical: "#f87171" };

export function BusHealthSection({
  buses,
  leaderboard,
}: {
  buses: BusOperationalHealthDaily[];
  leaderboard: BusLeaderboardRow[];
}) {
  const [q, setQ] = useState("");
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const medians = useMemo(() => fleetMedians(buses, []), [buses]);
  const trends = useMemo(() => dailyFleetTrends(buses, []), [buses]);
  const scatter = useMemo(() => busPeerScatter(buses), [buses]);
  const heatmap = useMemo(() => busThermalHeatmap(buses), [buses]);

  const filtered = useMemo(() => {
    const rows = q
      ? leaderboard.filter((r) =>
          `${r.vehicle_number} ${r.depot_name}`.toLowerCase().includes(q.toLowerCase()),
        )
      : leaderboard;
    return [...rows].sort((a, b) => b.abnormality_score - a.abnormality_score);
  }, [leaderboard, q]);

  const dates = heatmap[0]?.days.map((d) => d.date) ?? [];

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Fleet operational health leaderboard"
          description="Ranked by abnormality — peer median power & thermal baselines applied."
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search bus…"
                className="h-8 w-40 rounded-lg border border-border/60 bg-background pl-8 pr-2 text-[12px]"
              />
            </div>
          }
        />
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-card/95 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/50">
                {["Vehicle", "Depot", "Sessions", "Avg kW", "SOC Δ", "Thermal", "Disconnects", "Health", "Abnormality", "30D", "Risk"].map(
                  (h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium last:text-right">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.vehicle_id}
                  onClick={() => r.risk !== "healthy" && setSelectedBusId(r.vehicle_id)}
                  className={`border-b border-border/30 hover:bg-muted/30 ${r.risk !== "healthy" ? "cursor-pointer" : ""} ${selectedBusId === r.vehicle_id ? "bg-primary/8 ring-1 ring-inset ring-primary/40" : ""}`}
                >
                  <td className="px-3 py-2.5 font-medium num">{r.vehicle_number}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.depot_name}</td>
                  <td className="px-3 py-2.5 num">{r.sessions}</td>
                  <td className={`px-3 py-2.5 num ${r.avg_charging_power_kw > medians.busPower ? "text-warning" : "text-success"}`}>
                    {fmt(r.avg_charging_power_kw, 1)}
                  </td>
                  <td className="px-3 py-2.5 num">{fmt(r.avg_soc_delta, 0)}%</td>
                  <td className={`px-3 py-2.5 num ${r.thermal_stress > medians.busThermal ? "text-destructive" : ""}`}>
                    {fmt(r.thermal_stress, 0)}
                  </td>
                  <td className="px-3 py-2.5 num">{r.disconnect_sessions}</td>
                  <td className="px-3 py-2.5 num font-medium">{fmt(r.operational_health_score, 0)}</td>
                  <td className="px-3 py-2.5 num text-destructive">{fmt(r.abnormality_score, 0)}</td>
                  <td className="px-3 py-2.5"><TrendSpark values={r.trend} /></td>
                  <td className="px-3 py-2.5 text-right"><RiskBadge level={r.risk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <AbnormalBusTrendPanel
        buses={buses}
        leaderboard={leaderboard}
        selectedVehicleId={selectedBusId}
        onSelectVehicle={setSelectedBusId}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <PanelHeader title="Fleet abnormality trend" description="Abnormal buses, health, disconnects & thermal stress." />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 11 }} />
                <ReferenceLine y={medians.busHealth} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" label={{ value: "Health median", fontSize: 9, fill: "var(--color-muted-foreground)" }} />
                <Line dataKey="abnormalBuses" name="Abnormal buses" stroke="#f87171" strokeWidth={2} dot={false} {...CHART_ENTER} />
                <Line dataKey="operationalHealth" name="Ops health" stroke="#2dd4bf" strokeWidth={2} dot={false} {...CHART_ENTER} />
                <Line dataKey="disconnects" name="Disconnects" stroke="#fbbf24" strokeWidth={1.5} dot={false} />
                <Line dataKey="thermalStress" name="Thermal" stroke="#a855f7" strokeWidth={1.5} dot={false} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader
            title="Bus peer benchmarking"
            description={`Median power ${fmt(medians.busPower, 1)} kW · thermal ${fmt(medians.busThermal, 0)}`}
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                <XAxis type="number" dataKey="avgPower" name="Avg kW" tick={{ fontSize: 10 }} />
                <YAxis type="number" dataKey="thermal" name="Thermal" tick={{ fontSize: 10 }} />
                <ZAxis type="number" dataKey="energy" range={[40, 400]} />
                <ReferenceLine x={medians.busPower} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
                <ReferenceLine y={medians.busThermal} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Scatter
                  name="Buses"
                  data={scatter}
                  fill="var(--color-primary)"
                  shape={(props: { cx?: number; cy?: number; payload?: { risk: keyof typeof RISK_COLOR } }) => {
                    const { cx = 0, cy = 0, payload } = props;
                    const c = RISK_COLOR[payload?.risk ?? "healthy"];
                    return <circle cx={cx} cy={cy} r={6} fill={c} fillOpacity={0.85} stroke="#fff" strokeWidth={1} />;
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Bus thermal intelligence" description="Persistent thermal stress — darker = higher rise." />
        <div className="overflow-x-auto p-4">
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="p-1 text-left text-muted-foreground">Bus</th>
                {dates.map((d) => (
                  <th key={d} className="p-1 text-center font-normal text-muted-foreground">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.map((row) => (
                <tr key={row.label}>
                  <td className="p-1 font-medium num">{row.label}</td>
                  {row.days.map((d) => (
                    <td key={d.date} className="p-0.5">
                      <div
                        className="h-5 min-w-[18px] rounded-sm"
                        style={{
                          background: `color-mix(in oklab, var(--color-destructive) ${Math.min(95, d.thermal)}%, var(--color-muted) ${100 - Math.min(95, d.thermal)}%)`,
                        }}
                        title={`${d.thermal.toFixed(0)} thermal`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {MAINTENANCE_RECOMMENDATIONS.map((m) => (
          <InsightCard
            key={m.id}
            icon={Wrench}
            tone={m.severity === "critical" ? "destructive" : m.severity === "warning" ? "warning" : "primary"}
            tag={m.vehicle_number}
            title={m.title}
            body={`${m.root_cause} — ${m.action}`}
          />
        ))}
      </div>
    </div>
  );
}
