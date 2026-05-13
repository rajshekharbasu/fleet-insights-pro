import { useMemo } from "react";
import type { Trip } from "@/lib/mock-data";

export function RouteHeatmap({ trips }: { trips: Trip[] }) {
  const { routes, days, matrix, max } = useMemo(() => {
    const routes = Array.from(new Set(trips.map((t) => t.route_code))).sort();
    const dayKeys = Array.from(new Set(trips.map((t) => t.scheduling_date))).sort().slice(-14);
    const grid: Record<string, Record<string, { sum: number; n: number }>> = {};
    for (const r of routes) {
      grid[r] = {};
      for (const d of dayKeys) grid[r][d] = { sum: 0, n: 0 };
    }
    for (const t of trips) {
      if (!grid[t.route_code]?.[t.scheduling_date]) continue;
      grid[t.route_code][t.scheduling_date].sum += t.kwh_per_km;
      grid[t.route_code][t.scheduling_date].n += 1;
    }
    const matrix = routes.map((r) =>
      dayKeys.map((d) => {
        const cell = grid[r][d];
        return cell.n ? cell.sum / cell.n : null;
      }),
    );
    const flat = matrix.flat().filter((v): v is number => v !== null);
    const max = flat.length ? Math.max(...flat) : 1;
    return { routes, days: dayKeys, matrix, max };
  }, [trips]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold tracking-tight">Route × Day efficiency</h3>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          Mean kWh/km per route over the last {days.length} days. Darker = higher consumption.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card pr-2 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">Route</th>
              {days.map((d) => (
                <th key={d} className="px-0.5 text-[9.5px] font-normal text-muted-foreground">
                  {d.slice(8)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routes.map((r, ri) => (
              <tr key={r}>
                <td className="sticky left-0 z-10 bg-card pr-2 text-[11.5px] num text-muted-foreground">{r}</td>
                {matrix[ri].map((v, di) => {
                  const intensity = v == null ? 0 : v / max;
                  const bg = v == null
                    ? "color-mix(in oklab, var(--muted) 40%, transparent)"
                    : `color-mix(in oklab, var(--color-primary) ${Math.round(intensity * 75)}%, transparent)`;
                  return (
                    <td
                      key={di}
                      title={v == null ? "no trips" : `${v.toFixed(2)} kWh/km`}
                      className="h-7 min-w-[18px] rounded-[3px] transition-transform hover:scale-110"
                      style={{ background: bg }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[10.5px] text-muted-foreground">
        <span>Low</span>
        <div className="h-1.5 w-32 rounded-full" style={{ background: "linear-gradient(to right, color-mix(in oklab, var(--color-primary) 5%, transparent), var(--color-primary))" }} />
        <span>High</span>
      </div>
    </div>
  );
}
