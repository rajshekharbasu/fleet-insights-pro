import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GitCompare } from "lucide-react";
import { Panel, PanelHeader } from "@/components/charger/charger-shared";
import { compatibilityMatrix, type CompatibilityCell } from "@/lib/intelligence-data";

const SEV_BG: Record<CompatibilityCell["severity"], string> = {
  critical: "var(--color-destructive)",
  warning: "var(--color-warning)",
  healthy: "var(--color-success)",
};

export function CompatibilityMatrix() {
  const all = useMemo(() => compatibilityMatrix(), []);
  const depots = Array.from(new Set(all.map((c) => c.depot_name)));
  const [depot, setDepot] = useState(depots[0]);
  const [hover, setHover] = useState<CompatibilityCell | null>(null);

  const cells = all.filter((c) => c.depot_name === depot);
  const chargers = Array.from(new Set(cells.map((c) => c.charger_id)));
  const buses = Array.from(new Set(cells.map((c) => c.vehicle_number)));
  const grid = new Map<string, CompatibilityCell>();
  cells.forEach((c) => grid.set(`${c.vehicle_number}|${c.charger_id}`, c));

  return (
    <Panel>
      <PanelHeader
        title="Charger × Bus compatibility intelligence"
        description="Explains which buses behave poorly on which chargers"
        action={
          <div className="flex items-center gap-2">
            <GitCompare className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={depot}
              onChange={(e) => setDepot(e.target.value)}
              className="rounded-lg border border-border/60 bg-card/50 px-2 py-1 text-[11px]"
            >
              {depots.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        }
      />
      <div className="grid grid-cols-[auto_1fr] gap-4 p-4">
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="px-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground">Bus \ Charger</th>
                {chargers.map((c) => (
                  <th key={c} className="px-2 text-[10px] font-medium text-muted-foreground">
                    {c.split("-").slice(-1)[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buses.map((b) => (
                <tr key={b}>
                  <td className="pr-2 text-right text-[11px] font-medium text-muted-foreground">{b}</td>
                  {chargers.map((c) => {
                    const cell = grid.get(`${b}|${c}`);
                    if (!cell)
                      return <td key={c} className="h-9 w-9 rounded-md bg-muted/30" />;
                    const intensity =
                      cell.severity === "critical" ? 0.85 : cell.severity === "warning" ? 0.55 : 0.28;
                    return (
                      <td key={c} className="p-0">
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.12 }}
                          onMouseEnter={() => setHover(cell)}
                          onMouseLeave={() => setHover(null)}
                          className="relative h-9 w-9 rounded-md ring-1 ring-border/40 transition-shadow hover:shadow-elevated"
                          style={{
                            background: `color-mix(in oklab, ${SEV_BG[cell.severity]} ${intensity * 100}%, transparent)`,
                          }}
                          aria-label={`${b} on ${c}`}
                        >
                          <span className="num absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-foreground">
                            {cell.taper_delta_pct.toFixed(0)}
                          </span>
                        </motion.button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded" style={{ background: SEV_BG.healthy, opacity: 0.4 }} />
              Stable
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded" style={{ background: SEV_BG.warning, opacity: 0.55 }} />
              Elevated stress
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded" style={{ background: SEV_BG.critical, opacity: 0.85 }} />
              Incompatible
            </span>
            <span className="ml-auto">Cells show taper delta % vs fleet norm</span>
          </div>
        </div>
        <div className="hidden xl:block">
          <div className="sticky top-0 rounded-xl border border-border/50 bg-card/40 p-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {hover ? "Pair intelligence" : "Hover a cell"}
            </div>
            {hover ? (
              <div className="mt-2 space-y-2 text-[12px]">
                <div className="text-[14px] font-semibold">
                  Bus {hover.vehicle_number} × {hover.charger_id}
                </div>
                <p className="text-muted-foreground">{hover.note}</p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Mini label="Taper Δ" value={`${hover.taper_delta_pct > 0 ? "+" : ""}${hover.taper_delta_pct}%`} bad={hover.taper_delta_pct < -8} />
                  <Mini label="Thermal Δ" value={`${hover.thermal_delta_pct > 0 ? "+" : ""}${hover.thermal_delta_pct}%`} bad={hover.thermal_delta_pct > 15} />
                  <Mini label="Accept Δ" value={`${hover.acceptance_delta_pct > 0 ? "+" : ""}${hover.acceptance_delta_pct}%`} bad={hover.acceptance_delta_pct < -5} />
                </div>
                <div className="pt-1 text-[10.5px] text-muted-foreground">{hover.sessions} pairings observed</div>
              </div>
            ) : (
              <p className="mt-2 text-[11.5px] text-muted-foreground">
                Compatibility cells visualize where charger × bus pairings show taper, thermal, or acceptance divergence
                from the fleet baseline.
              </p>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Mini({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="rounded-md bg-muted/30 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`num text-[12.5px] font-semibold ${bad ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
