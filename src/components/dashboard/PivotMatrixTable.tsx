import { ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MedianLegend, PivotMedianFooter, VsMedianCell } from "@/components/dashboard/MedianBaseline";
import { ExportTableButton } from "@/components/insights/ExportTableButton";
import { computePivotMedians, type PivotDim, type PivotRow } from "@/lib/analytics";

const DIMS: { key: PivotDim; label: string }[] = [
  { key: "driver_name", label: "Driver" },
  { key: "route_code", label: "Route" },
  { key: "vehiclenumber", label: "Vehicle" },
  { key: "company_name", label: "Company" },
  { key: "scheduling_date", label: "Date" },
];

const COLS: { key: keyof PivotRow; label: string; suffix?: string; align?: "right" | "left" }[] = [
  { key: "label", label: "Entity", align: "left" },
  { key: "trips", label: "Trips", align: "right" },
  { key: "distance", label: "Distance", suffix: " km", align: "right" },
  { key: "netKwh", label: "Net kWh", align: "right" },
  { key: "kwhPerKm", label: "kWh/km", align: "right" },
  { key: "regenRatio", label: "Regen", suffix: "%", align: "right" },
  { key: "idleShare", label: "Idle", suffix: "%", align: "right" },
  { key: "anomalies", label: "Anomalies", align: "right" },
];

export function PivotMatrixTable({
  rowsByDim, onRowClick,
}: {
  rowsByDim: (dim: PivotDim) => PivotRow[];
  onRowClick: (dim: PivotDim, row: PivotRow) => void;
}) {
  const [dim, setDim] = useState<PivotDim>("driver_name");
  const [sortKey, setSortKey] = useState<keyof PivotRow>("netKwh");
  const [asc, setAsc] = useState(false);
  const [q, setQ] = useState("");

  const rows = rowsByDim(dim);

  const sorted = useMemo(() => {
    const filtered = q ? rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : rows;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
      return asc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [rows, sortKey, asc, q]);

  const maxNetKwh = Math.max(1, ...rows.map((r) => r.netKwh));
  const medians = useMemo(() => computePivotMedians(rows), [rows]);

  return (
    <div className="card-interactive overflow-hidden rounded-2xl border border-border/50 bg-card shadow-elevated">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Pivot exploration</h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Aggregate metrics across any dimension. Values are colored vs the pivot median baseline.
          </p>
          <div className="mt-2">
            <MedianLegend />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border/60 bg-card/80 p-0.5">
            {DIMS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDim(d.key)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] transition-colors ${
                  dim === d.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <ExportTableButton
            filename={`voltline-pivot-${dim}`}
            columns={COLS.filter((c) => c.key !== "label").map((c) => ({
              key: c.key,
              header: c.label,
            })).concat([{ key: "label", header: "Entity" }])}
            rows={sorted as unknown as Record<string, unknown>[]}
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="h-8 w-44 rounded-lg border border-border/60 bg-card/70 pl-8 pr-2 text-[12.5px] outline-none placeholder:text-muted-foreground focus:border-ring/60"
            />
          </div>
        </div>
      </div>

      <div className="max-h-[440px] overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <tr className="border-b border-border/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              {COLS.map((c) => (
                <th
                  key={String(c.key)}
                  className={`px-4 py-2.5 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}
                >
                  <button
                    onClick={() => {
                      if (sortKey === c.key) setAsc((v) => !v);
                      else { setSortKey(c.key); setAsc(false); }
                    }}
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    {c.label}
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.key}
                onClick={() => onRowClick(dim, r)}
                className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40"
              >
                <td className="relative px-4 py-2.5">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-primary/5"
                    style={{ width: `${(r.netKwh / maxNetKwh) * 100}%` }}
                  />
                  <span className="relative font-medium text-foreground">{r.label}</span>
                </td>
                <td className="px-4 py-2.5 text-right num text-muted-foreground">{r.trips}</td>
                <td className="px-4 py-2.5 text-right num text-muted-foreground">{r.distance.toLocaleString()} km</td>
                <td className="px-4 py-2.5 text-right num text-foreground">{r.netKwh.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">
                  <VsMedianCell value={r.kwhPerKm} median={medians.kwhPerKm} lowerIsBetter />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <VsMedianCell
                    value={r.regenRatio}
                    median={medians.regenRatio}
                    lowerIsBetter={false}
                    format={(v) => `${v.toFixed(1)}%`}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <VsMedianCell
                    value={r.idleShare}
                    median={medians.idleShare}
                    format={(v) => `${v.toFixed(1)}%`}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span
                    className={`num inline-flex min-w-[28px] items-center justify-center rounded-md px-1.5 py-0.5 text-[11.5px] font-medium ${
                      r.anomalies === 0
                        ? "bg-muted/50 text-muted-foreground"
                        : r.anomalies < 4
                        ? "bg-warning/15 text-warning"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {r.anomalies}
                  </span>
                </td>
              </tr>
            ))}
            {sorted.length > 0 && <PivotMedianFooter medians={medians} />}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-12 text-center text-muted-foreground">
                  No rows match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
