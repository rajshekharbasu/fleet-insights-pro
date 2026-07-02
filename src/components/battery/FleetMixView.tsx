/**
 * Fleet Mix — composition and performance by vehicle type, scoped to the
 * selected company. Clicking a vehicle type filters the bus list; clicking a
 * bus opens the shared drill drawer.
 */
import { useMemo, useState } from "react";
import { BatteryCharging, Gauge, Recycle, Bus } from "lucide-react";
import {
  BAND_COLOR,
  breakdownBy,
  depotColor,
  rowsForScope,
  type BatteryDataset,
  type BusRow,
} from "@/lib/battery-cycles";
import { Donut, fmt, HBar, Panel, VBars, type DonutSeg } from "./charts";

export function FleetMixView({
  dataset,
  company,
  monthName,
  onSelectBus,
}: {
  dataset: BatteryDataset;
  company: "ALL" | string;
  monthName: string;
  onSelectBus: (bus: BusRow) => void;
}) {
  const rows = useMemo(() => rowsForScope(dataset, monthName, company), [dataset, company, monthName]);
  const stats = useMemo(() => breakdownBy(rows, (r) => r.type), [rows]);
  const types = stats.map((s) => s.key);
  const [selType, setSelType] = useState<string>("ALL");

  const totalBuses = rows.length;
  const avgEfc = rows.length ? rows.reduce((a, r) => a + (r.efcGross ?? 0), 0) / rows.length : 0;
  const avgRte = rows.length ? rows.reduce((a, r) => a + (r.rte ?? 0), 0) / rows.length : 0;

  const donut: DonutSeg[] = stats.map((s) => ({ label: s.key, value: s.buses, color: depotColor(s.key, types) }));
  const maxEfc = Math.max(1, ...stats.map((s) => s.efcG));
  const maxGross = Math.max(1, ...stats.map((s) => s.gross));

  const listRows = useMemo(() => {
    const r = selType === "ALL" ? rows : rows.filter((x) => x.type === selType);
    return [...r].sort((a, b) => (b.efcGross ?? 0) - (a.efcGross ?? 0));
  }, [rows, selType]);

  if (!rows.length) {
    return <div className="rounded-2xl border border-border/60 bg-card p-12 text-center text-[13px] text-muted-foreground">No data for this scope.</div>;
  }

  return (
    <div className="chart-enter space-y-4">
      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MixStat Icon={Bus} label="Buses in scope" value={fmt(totalBuses)} color="var(--primary)" />
        <MixStat Icon={BatteryCharging} label="Avg EFC (gross)" value={fmt(avgEfc, 1)} color="var(--chart-4)" />
        <MixStat Icon={Gauge} label="Avg round-trip eff." value={`${fmt(avgRte, 1)}%`} color="var(--chart-2)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Composition donut */}
        <Panel title="Fleet composition" subtitle={`${monthName} · by vehicle type`}>
          <div className="flex items-center gap-5">
            <Donut segments={donut} centerTop={String(totalBuses)} centerSub="buses" />
            <div className="flex-1 space-y-2">
              {stats.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelType((cur) => (cur === s.key ? "ALL" : s.key))}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition hover:bg-muted/50 ${selType === s.key ? "bg-primary/5 ring-1 ring-primary/30" : ""}`}
                >
                  <span className="flex items-center gap-2 text-[12.5px] font-medium">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: depotColor(s.key, types) }} />
                    {s.key}
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">
                    <span className="num font-semibold text-foreground">{s.buses}</span> · {Math.round((s.buses / totalBuses) * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Panel>

        {/* Performance by type */}
        <Panel title="Performance by vehicle type" subtitle="Battery cycle load (EFC gross) per type">
          <VBars
            max={maxEfc}
            groups={stats.map((s) => ({ label: s.key, bars: [{ value: s.efcG, color: depotColor(s.key, types), tip: `${s.key}: ${s.efcG.toFixed(2)} EFC` }] }))}
          />
          <div className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {stats.map((s) => (
              <HBar key={s.key} label={`${s.key} · throughput`} value={s.gross} max={maxGross} color={depotColor(s.key, types)} suffix=" kWh" />
            ))}
          </div>
        </Panel>
      </div>

      {/* Efficiency detail by type */}
      <Panel
        title="Efficiency profile"
        subtitle="RTE, regen and idle load by vehicle type"
        right={<TypeFilter types={types} value={selType} onChange={setSelType} />}
      >
        <div className="grid gap-x-8 gap-y-2 md:grid-cols-3">
          {stats
            .filter((s) => selType === "ALL" || s.key === selType)
            .map((s) => (
              <div key={s.key} className="rounded-xl border border-border/50 p-3">
                <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: depotColor(s.key, types) }} />
                  {s.key}
                  <span className="ml-auto text-[11px] font-normal text-muted-foreground">{s.buses} buses</span>
                </div>
                <HBar label="Round-trip eff." value={s.rte} max={100} color="var(--primary)" suffix="%" />
                <HBar label="Energy regen" value={s.regen} max={25} color="var(--chart-2)" suffix="%" />
                <HBar label="Aux idle" value={s.idle} max={40} color="var(--warning)" suffix="%" />
              </div>
            ))}
        </div>
      </Panel>

      {/* Bus list (details on click) */}
      <Panel
        title={selType === "ALL" ? "All buses" : `${selType} buses`}
        subtitle={`${listRows.length} buses · click a bus for daily trend & trips`}
      >
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
            <thead className="bg-muted/50">
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3.5 py-2.5 text-left font-semibold">Bus</th>
                <th className="px-3.5 py-2.5 text-left font-semibold">Type</th>
                <th className="px-3.5 py-2.5 text-right font-semibold">EFC Gr</th>
                <th className="px-3.5 py-2.5 text-right font-semibold">RTE%</th>
                <th className="px-3.5 py-2.5 text-right font-semibold">Regen%</th>
                <th className="px-3.5 py-2.5 text-right font-semibold">Gross kWh</th>
                <th className="px-3.5 py-2.5 text-center font-semibold">Band</th>
              </tr>
            </thead>
            <tbody>
              {listRows.slice(0, 60).map((r) => {
                const bc = BAND_COLOR[r.band];
                return (
                  <tr key={r.reg} onClick={() => onSelectBus(r)} className="cursor-pointer border-b border-border/40 transition hover:bg-muted/40">
                    <td className="num whitespace-nowrap px-3.5 py-2 font-semibold">{r.reg}</td>
                    <td className="whitespace-nowrap px-3.5 py-2 text-muted-foreground">{r.type}</td>
                    <td className="num px-3.5 py-2 text-right font-semibold">{fmt(r.efcGross, 1)}</td>
                    <td className="num px-3.5 py-2 text-right">{fmt(r.rte, 1)}</td>
                    <td className="num px-3.5 py-2 text-right">{fmt(r.regen, 1)}</td>
                    <td className="num px-3.5 py-2 text-right text-muted-foreground">{fmt(r.grossKwh, 0)}</td>
                    <td className="px-3.5 py-2 text-center">
                      <span className="inline-block rounded-md px-2 py-[2px] text-[10px] font-semibold" style={{ color: bc, background: `color-mix(in oklab,${bc} 13%,transparent)` }}>
                        {r.band}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {listRows.length > 60 && <div className="px-1 pt-2 text-[11px] text-muted-foreground">Showing top 60 by EFC. Refine with the company / type filters.</div>}
      </Panel>
    </div>
  );
}

function MixStat({ Icon, label, value, color }: { Icon: typeof Bus; label: string; value: string; color: string }) {
  return (
    <div className="card-interactive accent-bar-top relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-elevated" style={{ ["--accent-color" as string]: color }}>
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl ring-1" style={{ color, background: `color-mix(in oklab,${color} 13%,transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab,${color} 25%,transparent)` }}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div>
        <div className="section-label">{label}</div>
        <div className="num mt-0.5 text-[22px] font-semibold">{value}</div>
      </div>
    </div>
  );
}

function TypeFilter({ types, value, onChange }: { types: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[30px] rounded-lg border border-border/60 bg-card px-2.5 text-[12px] font-semibold text-foreground outline-none"
    >
      <option value="ALL">All types</option>
      {types.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}
