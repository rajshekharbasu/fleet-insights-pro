import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Search } from "lucide-react";
import { CHART_ENTER } from "@/lib/chart-motion";
import type { ChargerLeaderboardRow } from "@/lib/charger-analytics";
import { chargerDailyTrends, fleetMedians } from "@/lib/charger-analytics";
import type { ChargerHealthDaily } from "@/lib/charger-data";
import { AbnormalChargerTrendPanel } from "./AbnormalChargerTrendPanel";
import { fmt, Panel, PanelHeader, RiskBadge, TrendSpark } from "./charger-shared";

export function ChargerHealthSection({
  chargers,
  leaderboard,
}: {
  chargers: ChargerHealthDaily[];
  leaderboard: ChargerLeaderboardRow[];
}) {
  const [q, setQ] = useState("");
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null);
  const medians = useMemo(() => fleetMedians([], chargers), [chargers]);
  const daily = useMemo(() => chargerDailyTrends(chargers), [chargers]);

  const filtered = useMemo(() => {
    const rows = q
      ? leaderboard.filter((r) =>
          `${r.charger_id} ${r.depot_name}`.toLowerCase().includes(q.toLowerCase()),
        )
      : leaderboard;
    return [...rows].sort((a, b) => b.abnormality_score - a.abnormality_score);
  }, [leaderboard, q]);

  const reliability = useMemo(() => {
    return daily.map((d) => ({
      date: d.date,
      disconnects: d.disconnects,
      anomalyProxy: d.disconnects * 2.5 + (d.sessions > 0 ? d.disconnects / d.sessions : 0) * 40,
    }));
  }, [daily]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Charger health leaderboard"
          description="Underperforming & unstable chargers vs fleet median health."
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search charger…"
                className="h-8 w-44 rounded-lg border border-border/60 bg-background pl-8 pr-2 text-[12px]"
              />
            </div>
          }
        />
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-card/95 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/50">
                {["Charger", "Depot", "TX", "Sessions", "Buses", "Energy", "Avg kW", "Disc.", "Health", "Abnorm.", "Trend", "Risk"].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium last:text-right">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.charger_id}
                  onClick={() => r.risk !== "healthy" && setSelectedChargerId(r.charger_id)}
                  className={`border-b border-border/30 hover:bg-muted/30 ${r.risk !== "healthy" ? "cursor-pointer" : ""} ${selectedChargerId === r.charger_id ? "bg-primary/8 ring-1 ring-inset ring-primary/40" : ""}`}
                >
                  <td className="px-3 py-2 num font-medium">{r.charger_id}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.depot_name}</td>
                  <td className="px-3 py-2 num text-muted-foreground">{r.transformer_id}</td>
                  <td className="px-3 py-2 num">{r.sessions}</td>
                  <td className="px-3 py-2 num">{r.unique_buses}</td>
                  <td className="px-3 py-2 num">{fmt(r.total_energy_kwh, 0)}</td>
                  <td className={`px-3 py-2 num ${r.avg_power_kw < medians.chargerPower * 0.85 ? "text-warning" : ""}`}>
                    {fmt(r.avg_power_kw, 1)}
                  </td>
                  <td className="px-3 py-2 num text-destructive">{r.disconnect_sessions}</td>
                  <td className="px-3 py-2 num font-medium">{fmt(r.health_score, 0)}</td>
                  <td className="px-3 py-2 num">{fmt(r.abnormality_score, 0)}</td>
                  <td className="px-3 py-2"><TrendSpark values={r.trend} /></td>
                  <td className="px-3 py-2 text-right"><RiskBadge level={r.risk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <AbnormalChargerTrendPanel
        chargers={chargers}
        leaderboard={leaderboard}
        selectedChargerId={selectedChargerId}
        onSelectCharger={setSelectedChargerId}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel className="p-5">
          <PanelHeader title="Charger utilization trends" description="Sessions, energy & duration — 30D window." />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Line yAxisId="l" dataKey="sessions" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="Sessions" {...CHART_ENTER} />
                <Line yAxisId="r" dataKey="energy" stroke="var(--color-chart-3)" strokeWidth={2} dot={false} name="Energy kWh" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Reliability & instability" description="Disconnect frequency & anomaly proxy trend." />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reliability}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Line dataKey="disconnects" stroke="#f87171" strokeWidth={2} dot={false} name="Disconnects" {...CHART_ENTER} />
                <Line dataKey="anomalyProxy" stroke="#fbbf24" strokeWidth={1.5} dot={false} name="Instability index" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <PanelHeader
          title="Charger vs fleet benchmark"
          description={`Median power ${fmt(medians.chargerPower, 1)} kW · health ${fmt(medians.chargerHealth, 0)}`}
        />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filtered.slice(0, 12)} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.35} />
              <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} />
              <YAxis type="category" dataKey="charger_id" width={72} tick={{ fontSize: 10 }} />
              <ReferenceLine x={medians.chargerHealth} stroke="var(--color-muted-foreground)" strokeDasharray="4 4" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="health_score" name="Health" radius={[0, 4, 4, 0]} maxBarSize={16}>
                {filtered.slice(0, 12).map((r) => (
                  <Cell
                    key={r.charger_id}
                    fill={
                      r.health_score >= medians.chargerHealth
                        ? "var(--color-primary)"
                        : r.health_score >= medians.chargerHealth * 0.85
                          ? "var(--color-warning)"
                          : "var(--color-destructive)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
