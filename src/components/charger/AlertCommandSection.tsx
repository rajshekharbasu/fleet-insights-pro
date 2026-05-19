import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Radio } from "lucide-react";
import { CHART_ENTER } from "@/lib/chart-motion";
import type { AbnormalityEvent } from "@/lib/charger-data";
import type { BusLeaderboardRow, ChargerLeaderboardRow } from "@/lib/charger-analytics";
import { dailyFleetTrends } from "@/lib/charger-analytics";
import type { BusOperationalHealthDaily, DepotEnergyDaily } from "@/lib/charger-data";
import { fmt, Panel, PanelHeader, RiskBadge } from "./charger-shared";

export function AlertCommandSection({
  events,
  buses,
  depots,
  busRisks,
  chargerRisks,
  depotRisks,
}: {
  events: AbnormalityEvent[];
  buses: BusOperationalHealthDaily[];
  depots: DepotEnergyDaily[];
  busRisks: BusLeaderboardRow[];
  chargerRisks: ChargerLeaderboardRow[];
  depotRisks: ReturnType<typeof import("@/lib/charger-analytics").depotComparison>;
}) {
  const trends = dailyFleetTrends(buses, depots);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Live abnormality feed"
          description="Operational war-room stream — severity-ranked events."
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[10px] font-medium text-destructive">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          }
        />
        <div className="max-h-[320px] divide-y divide-border/40 overflow-auto">
          {events.map((e) => (
            <div key={e.id} className="flex gap-3 px-5 py-3 transition-colors hover:bg-muted/30">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={e.severity} />
                  <span className="text-[11px] text-muted-foreground num">
                    {new Date(e.timestamp).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-primary">{e.depot_name}</span>
                </div>
                <div className="mt-1 text-[13px] font-semibold">{e.entity_label}</div>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{e.message}</p>
                <p className="mt-1 text-[11px] text-primary/90">→ {e.recommended_action}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          { title: "Critical buses", rows: busRisks, label: (r: BusLeaderboardRow) => r.vehicle_number, score: (r: BusLeaderboardRow) => r.abnormality_score },
          { title: "Critical chargers", rows: chargerRisks, label: (r: ChargerLeaderboardRow) => r.charger_id, score: (r: ChargerLeaderboardRow) => r.abnormality_score },
          { title: "Critical depots", rows: depotRisks, label: (r: { depot: string }) => r.depot, score: (r: { anomalies: number }) => r.anomalies },
        ].map((col) => (
          <Panel key={col.title}>
            <PanelHeader title={col.title} description="Ranked by operational impact." />
            <ol className="space-y-1.5 p-4 pt-0">
              {col.rows.slice(0, 5).map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-[12px]"
                >
                  <span className="font-medium">{col.label(r as never)}</span>
                  <span className="num text-destructive">{fmt(col.score(r as never), 0)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        ))}
      </div>

      <Panel className="p-5">
        <PanelHeader
          title="Trend of abnormal behavior"
          description="30-day rolling intelligence — abnormality & health degradation."
        />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends}>
              <defs>
                <linearGradient id="abn-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Area
                type="monotone"
                dataKey="abnormalityScore"
                name="Abnormality"
                stroke="#f87171"
                fill="url(#abn-grad)"
                strokeWidth={2}
                {...CHART_ENTER}
              />
              <Line dataKey="operationalHealth" name="Ops health" stroke="#2dd4bf" strokeWidth={2} dot={false} {...CHART_ENTER} />
              <Line dataKey="abnormalBuses" name="Abnormal buses" stroke="#fbbf24" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
