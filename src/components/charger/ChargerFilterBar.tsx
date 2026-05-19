import { Calendar, Filter, Zap } from "lucide-react";
import type { ChargerFilters } from "@/lib/charger-analytics";
import { CHARGER_FILTER_OPTIONS } from "@/lib/charger-data";
import type { RiskLevel, TrendWindow } from "@/lib/charger-data";

const WINDOWS: TrendWindow[] = ["1D", "7D", "30D"];
const SEVERITIES: (RiskLevel | "all")[] = ["all", "healthy", "warning", "critical"];

export function ChargerFilterBar({
  filters,
  onChange,
}: {
  filters: ChargerFilters;
  onChange: (f: ChargerFilters) => void;
}) {
  const set = <K extends keyof ChargerFilters>(key: K, value: ChargerFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleArr = (key: "depotIds" | "chargerIds" | "vehicleIds" | "transformers", id: string) => {
    const arr = filters[key];
    set(key, arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-4 shadow-elevated backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
        <Filter className="h-3.5 w-3.5 text-primary" />
        Operational filters
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">From</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => set("from", e.target.value)}
            className="block h-9 rounded-lg border border-border/60 bg-background px-2.5 text-[12px] num"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">To</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => set("to", e.target.value)}
            className="block h-9 rounded-lg border border-border/60 bg-background px-2.5 text-[12px] num"
          />
        </label>
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Trend window</span>
          <div className="flex rounded-lg border border-border/60 p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => set("trendWindow", w)}
                className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium ${
                  filters.trendWindow === w ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Severity</span>
          <select
            value={filters.severity}
            onChange={(e) => set("severity", e.target.value as RiskLevel | "all")}
            className="h-9 rounded-lg border border-border/60 bg-background px-2.5 text-[12px]"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All severities" : s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Depots</span>
        {CHARGER_FILTER_OPTIONS.depots.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => toggleArr("depotIds", d.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] ring-1 transition-colors ${
              filters.depotIds.includes(d.id)
                ? "bg-primary/15 text-primary ring-primary/35"
                : "bg-muted/30 text-muted-foreground ring-border/50"
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10.5px] text-muted-foreground">
        <Calendar className="h-3 w-3" />
        Default 30-day intelligence window · cross-filter enabled
        <Zap className="ml-auto h-3 w-3 text-primary" />
      </div>
    </div>
  );
}
