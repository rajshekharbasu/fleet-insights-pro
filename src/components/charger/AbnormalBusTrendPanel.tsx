import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import { CHART_ENTER } from "@/lib/chart-motion";
import {
  abnormalBusRows,
  BUS_KPI_TREND_KEYS,
  BUS_KPI_TREND_META,
  busKpiTrends30d,
  type BusKpiTrendKey,
  type BusLeaderboardRow,
} from "@/lib/charger-analytics";
import type { BusOperationalHealthDaily } from "@/lib/charger-data";
import { fmt, RiskBadge } from "./charger-shared";

function KpiTrendChart({
  metric,
  data,
}: {
  metric: BusKpiTrendKey;
  data: { date: string; value: number; fleetMedian: number }[];
}) {
  const meta = BUS_KPI_TREND_META[metric];
  const latest = data[data.length - 1]?.value ?? 0;
  const median = data[data.length - 1]?.fleetMedian ?? 0;
  const worse =
    meta.lowerIsBetter ? latest > median * 1.05 : latest < median * 0.95;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {meta.label}
        </span>
        <span className={`num text-[12px] font-semibold ${worse ? "text-destructive" : "text-foreground"}`}>
          {fmt(latest, metric === "avg_soc_delta" ? 1 : metric.includes("score") ? 0 : 1)}
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{meta.unit}</span>
        </span>
      </div>
      <div className="mt-2 h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.35} />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9 }} width={32} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ fontSize: 10, borderRadius: 8 }}
              formatter={(v: number, name: string) => [
                `${fmt(v, 2)} ${meta.unit}`,
                name === "value" ? "Bus" : "Fleet median",
              ]}
            />
            <ReferenceLine y={median} stroke="var(--color-muted-foreground)" strokeDasharray="4 3" />
            <Line
              type="monotone"
              dataKey="fleetMedian"
              stroke="var(--color-muted-foreground)"
              strokeWidth={1}
              strokeDasharray="4 3"
              dot={false}
              name="Fleet median"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={worse ? "var(--color-destructive)" : "var(--color-primary)"}
              strokeWidth={2}
              dot={false}
              name="value"
              {...CHART_ENTER}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AbnormalBusTrendPanel({
  buses,
  leaderboard,
  selectedVehicleId,
  onSelectVehicle,
  className = "",
  variant = "card",
}: {
  buses: BusOperationalHealthDaily[];
  leaderboard: BusLeaderboardRow[];
  selectedVehicleId?: string | null;
  onSelectVehicle?: (vehicleId: string) => void;
  className?: string;
  variant?: "card" | "glass";
}) {
  const abnormal = useMemo(() => abnormalBusRows(buses, leaderboard), [buses, leaderboard]);
  const [internalId, setInternalId] = useState<string | null>(null);
  const selectedId = selectedVehicleId ?? internalId;
  const setSelectedId = onSelectVehicle ?? setInternalId;

  useEffect(() => {
    if (!abnormal.length) {
      setInternalId(null);
      return;
    }
    if (!selectedId || !abnormal.some((b) => b.vehicle_id === selectedId)) {
      setSelectedId(abnormal[0].vehicle_id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-pick top abnormal bus when list changes
  }, [abnormal, selectedId]);

  const selected = abnormal.find((b) => b.vehicle_id === selectedId);
  const trends = useMemo(
    () => (selectedId ? busKpiTrends30d(buses, selectedId, 30) : null),
    [buses, selectedId],
  );

  if (!abnormal.length) {
    return null;
  }

  const inner = (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 py-3">
        <Activity className="h-4 w-4 text-destructive" />
        <div className="min-w-[200px] flex-1">
          <h3 className="text-[14px] font-semibold">Unhealthy bus KPI trends</h3>
          <p className="text-[11px] text-muted-foreground">
            30-day daily series vs fleet median — energy, duration, power, SOC, thermal, health & abnormality
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border/30 px-4 py-3">
        {abnormal.map((b) => (
          <button
            key={b.vehicle_id}
            type="button"
            onClick={() => setSelectedId(b.vehicle_id)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              selectedId === b.vehicle_id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/50 bg-card/50 text-muted-foreground hover:border-primary/30"
            }`}
          >
            <span className="num">Bus {b.vehicle_number}</span>
            <RiskBadge level={b.risk} />
          </button>
        ))}
      </div>

      {selected && trends && (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <div>
              <span className="num font-semibold">Bus {selected.vehicle_number}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground">{selected.depot_name}</span>
            </div>
            <span className="text-muted-foreground">
              Abnormality <span className="num font-medium text-destructive">{fmt(selected.abnormality_score, 0)}</span>
              {" · "}
              Health <span className="num font-medium">{fmt(selected.operational_health_score, 0)}</span>
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {BUS_KPI_TREND_KEYS.map((k) => (
              <KpiTrendChart key={k} metric={k} data={trends[k]} />
            ))}
          </div>
        </div>
      )}
    </>
  );

  if (variant === "glass") {
    return (
      <section className={`overflow-hidden rounded-2xl border border-destructive/25 bg-card/40 ${className}`}>
        {inner}
      </section>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-destructive/25 bg-card shadow-elevated ${className}`}>
      {inner}
    </div>
  );
}
