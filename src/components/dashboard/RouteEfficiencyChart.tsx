import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Trip } from "@/lib/mock-data";
import { median } from "@/lib/analytics";
import { CHART_ENTER } from "@/lib/chart-motion";

export function RouteEfficiencyChart({ trips }: { trips: Trip[] }) {
  const rows = useMemo(() => {
    const byRoute = new Map<string, { sum: number; n: number }>();
    for (const t of trips) {
      const cur = byRoute.get(t.route_code) ?? { sum: 0, n: 0 };
      cur.sum += t.kwh_per_km;
      cur.n += 1;
      byRoute.set(t.route_code, cur);
    }
    return [...byRoute.entries()]
      .map(([code, { sum, n }]) => ({
        route: code,
        kwhPerKm: sum / n,
        trips: n,
      }))
      .sort((a, b) => b.kwhPerKm - a.kwhPerKm)
      .slice(0, 10);
  }, [trips]);

  const fleetMedian = rows.length ? median(rows.map((r) => r.kwhPerKm)) : 0;

  return (
    <div className="card-interactive chart-enter rounded-2xl border border-border/50 bg-card p-5 shadow-elevated">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold tracking-tight">Route efficiency ranking</h3>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          kWh/km per route vs fleet median{" "}
          <span className="num font-medium text-foreground">
            ({fleetMedian.toFixed(2)} kWh/km)
          </span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-[13px] text-muted-foreground">
          No trips match the current filters.
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" horizontal={false} opacity={0.45} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                domain={[0, "auto"]}
              />
              <YAxis
                type="category"
                dataKey="route"
                width={52}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)", fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine
                x={fleetMedian}
                stroke="var(--color-muted-foreground)"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: `Median ${fleetMedian.toFixed(2)}`,
                  position: "top",
                  fill: "var(--color-muted-foreground)",
                  fontSize: 10,
                }}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--primary) 8%, transparent)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as (typeof rows)[number];
                  return (
                    <div className="rounded-lg border border-border/70 bg-popover/95 px-3 py-2 text-[12px] shadow-elevated backdrop-blur-sm">
                      <div className="num font-semibold">{d.route}</div>
                      <div className="mt-1 num">{d.kwhPerKm.toFixed(2)} kWh/km</div>
                      <div className="text-muted-foreground">{d.trips} trips</div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="kwhPerKm" name="kWh/km" radius={[0, 4, 4, 0]} maxBarSize={22} {...CHART_ENTER}>
                {rows.map((r) => (
                  <Cell
                    key={r.route}
                    fill={
                      r.kwhPerKm > fleetMedian * 1.12
                        ? "var(--color-destructive)"
                        : r.kwhPerKm > fleetMedian
                          ? "var(--color-warning)"
                          : "var(--color-primary)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-0.5 bg-muted-foreground" /> Median
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-primary" /> At or below median
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-warning" /> Above median
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-destructive" /> High outlier
        </span>
      </div>
    </div>
  );
}
