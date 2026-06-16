import { useState, useMemo } from "react";
import { AlertTriangle, Flame, Search, ShieldAlert, Waves, X, Zap } from "lucide-react";
import { ExportTableButton } from "@/components/insights/ExportTableButton";
import type { Trip } from "@/lib/mock-data";

interface Props {
  trips: Trip[];
  onSelect: (trip: Trip) => void;
}

const FLAGS = [
  { key: "high_temp_flag", label: "Thermal", icon: Flame, tone: "destructive" as const },
  { key: "voltage_instability_flag", label: "Voltage", icon: Zap, tone: "warning" as const },
  { key: "pack_imbalance_flag", label: "Imbalance", icon: Waves, tone: "warning" as const },
  { key: "efficiency_anomaly_flag", label: "Efficiency", icon: ShieldAlert, tone: "destructive" as const },
] as const;

export function AnomalyTable({ trips, onSelect }: Props) {
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const flagged = useMemo(() => {
    return trips.filter(
      (t) => t.high_temp_flag || t.voltage_instability_flag || t.pack_imbalance_flag || t.efficiency_anomaly_flag,
    );
  }, [trips]);

  const filteredFlagged = useMemo(() => {
    let result = flagged;
    if (selectedFlag) {
      result = result.filter((t) => t[selectedFlag as keyof Trip]);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.trip_id.toLowerCase().includes(term) ||
          t.driver_name.toLowerCase().includes(term) ||
          t.vehiclenumber.toLowerCase().includes(term) ||
          (t.route_code && t.route_code.toLowerCase().includes(term)),
      );
    }
    return result;
  }, [flagged, selectedFlag, searchTerm]);

  const counts = useMemo(() => {
    return FLAGS.map((f) => ({
      ...f,
      count: trips.filter((t) => t[f.key]).length,
    }));
  }, [trips]);

  const recent = useMemo(() => {
    return [...filteredFlagged].sort((a, b) => b.event_ts.localeCompare(a.event_ts)).slice(0, 12);
  }, [filteredFlagged]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-elevated">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 p-5">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Diagnostics & anomalies</h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {filteredFlagged.length !== flagged.length ? (
              <span>Showing {filteredFlagged.length} filtered anomalies (out of {flagged.length})</span>
            ) : (
              <span>{flagged.length} flagged trips out of {trips.length} in the current window.</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative mr-2">
            <input
              type="text"
              placeholder="Search driver, vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-52 rounded-xl border border-border/60 bg-background pl-8 pr-7 text-[12px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <ExportTableButton
            filename="voltline-anomalies"
            columns={[
              { key: "trip_id", header: "Trip" },
              { key: "scheduling_date", header: "Date" },
              { key: "driver_name", header: "Driver" },
              { key: "route_code", header: "Route" },
              { key: "vehiclenumber", header: "Vehicle" },
              { key: "kwh_per_km", header: "kWh/km" },
            ]}
            rows={filteredFlagged as unknown as Record<string, unknown>[]}
          />

          <div className="mx-1 h-5 w-px bg-border/60" />

          <button
            onClick={() => setSelectedFlag(null)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] transition-all ring-1 ${
              !selectedFlag
                ? "text-primary bg-primary/10 ring-primary/30 font-semibold"
                : "text-muted-foreground bg-muted/20 ring-border/50 hover:bg-muted/40"
            }`}
          >
            All
          </button>

          {counts.map((c) => {
            const Icon = c.icon;
            const isActive = selectedFlag === c.key;
            const isAnyActive = selectedFlag !== null;
            const tone =
              c.tone === "destructive"
                ? "text-destructive bg-destructive/10 ring-destructive/20"
                : "text-warning bg-warning/10 ring-warning/20";

            const activeClass = isActive
              ? "ring-2 scale-105 shadow-sm font-semibold opacity-100 animate-pulse-subtle"
              : isAnyActive
              ? "opacity-40 hover:opacity-80 scale-95"
              : "hover:scale-102 hover:shadow-sm opacity-100";

            return (
              <button
                key={c.key}
                onClick={() => setSelectedFlag(isActive ? null : c.key)}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px] ring-1 transition-all ${tone} ${activeClass}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium">{c.label}</span>
                <span className="num font-semibold">{c.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 bg-card/95 backdrop-blur">
            <tr className="border-b border-border/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium">Trip</th>
              <th className="px-4 py-2.5 text-left font-medium">Driver / Vehicle</th>
              <th className="px-4 py-2.5 text-left font-medium">Route</th>
              <th className="px-4 py-2.5 text-left font-medium">Flags</th>
              <th className="px-4 py-2.5 text-right font-medium">kWh/km</th>
              <th className="px-4 py-2.5 text-right font-medium">Severity</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((t) => {
              const sev =
                (t.efficiency_anomaly_flag ? 2 : 0) +
                (t.high_temp_flag ? 2 : 0) +
                (t.voltage_instability_flag ? 1 : 0) +
                (t.pack_imbalance_flag ? 1 : 0);
              return (
                <tr
                  key={t.trip_id}
                  className="border-b border-border/40 last:border-0 transition-colors hover:bg-muted/10"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{t.schedule_id || t.trip_id}</div>
                    <div className="text-[11px] text-muted-foreground">{t.scheduling_date}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-foreground">{t.driver_name}</div>
                    <div className="text-[11px] text-muted-foreground">{t.vehiclenumber}</div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.route_code}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {FLAGS.filter((f) => t[f.key]).map((f) => (
                        <span
                          key={f.key}
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] ring-1 ${
                            f.tone === "destructive" ? "bg-destructive/10 text-destructive ring-destructive/20" : "bg-warning/10 text-warning ring-warning/20"
                          }`}
                        >
                          <f.icon className="h-2.5 w-2.5" />
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right num text-foreground">{t.kwh_per_km.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <SeverityPill score={sev} />
                  </td>
                </tr>
              );
            })}
            {recent.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No anomalies in the current window. Fleet operating within thresholds.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeverityPill({ score }: { score: number }) {
  const level = score >= 4 ? "Critical" : score >= 2 ? "High" : "Low";
  const tone =
    level === "Critical" ? "bg-destructive/15 text-destructive ring-destructive/30"
      : level === "High" ? "bg-warning/15 text-warning ring-warning/30"
      : "bg-muted/60 text-muted-foreground ring-border";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ${tone}`}>
      <AlertTriangle className="h-3 w-3" /> {level}
    </span>
  );
}
