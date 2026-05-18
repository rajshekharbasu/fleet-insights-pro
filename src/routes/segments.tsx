import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle, Brain, Layers, Activity, Sparkles, ShieldAlert, TrendingDown, TrendingUp, X,
} from "lucide-react";
import {
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart,
} from "recharts";
import { PageShell } from "@/components/layout/AppNav";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { GeoCanvas, type HotspotKind } from "@/components/maps/GeoCanvas";
import { ROUTES, SEGMENTS, type SegmentRisk } from "@/lib/fleet-data";

export const Route = createFileRoute("/segments")({
  head: () => ({
    meta: [
      { title: "Segment Risk · Voltline" },
      { name: "description", content: "Spatial operational risk intelligence per route segment." },
      { property: "og:title", content: "Segment Risk · Voltline" },
      { property: "og:description", content: "Heat layers, dangerous segments, drilldowns and trend analytics." },
    ],
  }),
  component: SegmentRiskPage,
});

const fmt = (n: number, d = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

const KINDS: { key: HotspotKind; label: string }[] = [
  { key: "risk", label: "Composite risk" },
  { key: "harsh_braking", label: "Harsh braking" },
  { key: "overspeed", label: "Overspeed" },
  { key: "distraction", label: "Distraction" },
  { key: "drowsiness", label: "Drowsiness" },
  { key: "rough_road", label: "Rough road" },
];

function Sparkline({ data, color = "var(--color-primary)" }: { data: { v: number }[]; color?: string }) {
  return (
    <div className="h-9 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={`seg-sp-${color}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.4} fill={`url(#seg-sp-${color})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CorrelationMatrix({ segments }: { segments: SegmentRisk[] }) {
  const fields = ["harsh_braking", "overspeed", "distraction", "drowsiness", "rough_road", "energy_leakage_kwh"] as const;
  const labels = ["Braking", "Overspeed", "Distraction", "Drowsy", "Rough", "Leakage"];
  const matrix = fields.map((a) =>
    fields.map((b) => {
      const xs = segments.map((s) => (s as any)[a] as number);
      const ys = segments.map((s) => (s as any)[b] as number);
      const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
      const my = ys.reduce((s, v) => s + v, 0) / ys.length;
      let num = 0, dx = 0, dy = 0;
      for (let i = 0; i < xs.length; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        dx += (xs[i] - mx) ** 2;
        dy += (ys[i] - my) ** 2;
      }
      const corr = num / Math.sqrt(dx * dy || 1);
      return +corr.toFixed(2);
    }),
  );
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
      <div className="mb-3">
        <h3 className="text-[15px] font-semibold tracking-tight">Risk correlation matrix</h3>
        <p className="text-[12.5px] text-muted-foreground">Pearson correlation between event classes across segments.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
          <thead>
            <tr>
              <th />
              {labels.map((l) => (
                <th key={l} className="text-[10.5px] font-normal uppercase tracking-wider text-muted-foreground">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td className="pr-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">{labels[i]}</td>
                {row.map((v, j) => {
                  const t = Math.abs(v);
                  const positive = v >= 0;
                  const bg = positive
                    ? `color-mix(in oklab, var(--color-primary) ${Math.round(t * 75)}%, transparent)`
                    : `color-mix(in oklab, var(--color-destructive) ${Math.round(t * 75)}%, transparent)`;
                  return (
                    <td
                      key={j}
                      className="h-12 w-12 rounded-lg text-center text-[11px] num text-foreground transition-transform hover:scale-105"
                      style={{ background: bg }}
                      title={`${labels[i]} ↔ ${labels[j]}: ${v}`}
                    >
                      {v.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SegmentRiskPage() {
  const [active, setActive] = useState<HotspotKind[]>(["risk"]);
  const [hover, setHover] = useState<SegmentRisk | null>(null);
  const [selected, setSelected] = useState<SegmentRisk | null>(null);

  const top = useMemo(() => [...SEGMENTS].sort((a, b) => b.risk_score - a.risk_score).slice(0, 10), []);
  const worsening = useMemo(() => [...SEGMENTS].sort((a, b) => b.trend_30d - a.trend_30d).slice(0, 6), []);
  const improving = useMemo(() => [...SEGMENTS].sort((a, b) => a.trend_30d - b.trend_30d).slice(0, 6), []);

  const fmtSpark = (s: SegmentRisk) =>
    Array.from({ length: 12 }, (_, i) => ({
      v: Math.max(0, s.risk_score + Math.sin(i + s.seq) * 8 + s.trend_30d * (i / 12)),
    }));

  return (
    <PageShell
      eyebrow="Live · gold.route_segment_fact"
      title="Segment Risk Intelligence"
      description="Spatial operational risk. Surface dangerous corridors, recurring hotspots and correlated event clusters."
      meta={
        <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-right">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Tracked segments</div>
          <div className="num mt-0.5 text-[20px] font-semibold tracking-tight">{SEGMENTS.length}</div>
          <div className="text-[11px] num text-muted-foreground">{ROUTES.length} routes</div>
        </div>
      }
    >
      {/* A. Hero map */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-card/70 p-0.5">
            {KINDS.map((k) => {
              const isActive = active.includes(k.key);
              return (
                <button
                  key={k.key}
                  onClick={() =>
                    setActive((prev) =>
                      prev.includes(k.key) && prev.length > 1
                        ? prev.filter((x) => x !== k.key)
                        : prev.includes(k.key)
                        ? prev
                        : [k.key],
                    )
                  }
                  className={`rounded-md px-2.5 py-1 text-[11.5px] transition-colors ${
                    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k.label}
                </button>
              );
            })}
          </div>
          {hover && (
            <div className="rounded-xl border border-border/60 bg-card/80 px-3 py-1.5 text-[11.5px] backdrop-blur-md">
              <span className="num text-primary">{hover.segment_id}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="num">risk {fmt(hover.risk_score)}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground">{hover.length_km} km</span>
            </div>
          )}
        </div>
        <GeoCanvas
          routes={ROUTES}
          segments={SEGMENTS}
          activeKinds={active}
          onSegmentHover={setHover}
          onSegmentClick={setSelected}
          height={560}
        />
      </section>

      {/* B + D */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Top dangerous segments</h3>
              <p className="text-[12.5px] text-muted-foreground">Composite risk weighted across DMS, braking and rough-road events.</p>
            </div>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </div>
          <div className="divide-y divide-border/40">
            {top.map((s, i) => (
              <button
                key={s.segment_id}
                onClick={() => setSelected(s)}
                className="grid w-full grid-cols-[1.6rem_1fr_auto_auto_auto] items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/30 rounded-md px-1.5"
              >
                <span className="num text-[12px] text-muted-foreground">{i + 1}</span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium num">{s.segment_id}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {s.length_km} km · {s.harsh_braking} brake · {s.distraction} distraction · {s.rough_road} rough
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-[13px] font-semibold">{fmt(s.risk_score)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">risk</div>
                </div>
                <div className={`num text-[11.5px] ${s.trend_30d > 0 ? "text-destructive" : "text-success"}`}>
                  {s.trend_30d > 0 ? "+" : ""}{fmt(s.trend_30d)}%
                </div>
                <Sparkline
                  data={fmtSpark(s)}
                  color={s.trend_30d > 0 ? "var(--color-destructive)" : "var(--color-success)"}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-tight">Worsening</h3>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </div>
            <div className="space-y-2">
              {worsening.map((s) => (
                <div key={s.segment_id} className="flex items-center justify-between text-[12px]">
                  <span className="num">{s.segment_id}</span>
                  <span className="num text-destructive">+{fmt(s.trend_30d)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-tight">Improving</h3>
              <TrendingDown className="h-4 w-4 text-success" />
            </div>
            <div className="space-y-2">
              {improving.map((s) => (
                <div key={s.segment_id} className="flex items-center justify-between text-[12px]">
                  <span className="num">{s.segment_id}</span>
                  <span className="num text-success">{fmt(s.trend_30d)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* E. Correlation matrix + insights */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CorrelationMatrix segments={SEGMENTS} />
        </div>
        <div className="space-y-3">
          <InsightCard
            icon={Layers}
            tone="warning"
            title="Rough road and harsh braking strongly co-occur"
            body="Segments with elevated rough-road counts show a 0.6+ Pearson correlation with braking intensity — pavement is the upstream cause."
          />
          <InsightCard
            icon={AlertTriangle}
            tone="destructive"
            title="Drowsiness clusters on long-haul evening segments"
            body="Drowsiness spikes correlate with segments > 4 km on long routes after 6 PM — schedule micro-breaks."
          />
          <InsightCard
            icon={Sparkles}
            title="Distraction is independent of road condition"
            body="Low correlation (< 0.2) with rough-road density. Coaching, not engineering, is the right lever."
          />
        </div>
      </section>

      {selected && <SegmentDrawer segment={selected} onClose={() => setSelected(null)} />}
    </PageShell>
  );
}

function SegmentDrawer({ segment, onClose }: { segment: SegmentRisk; onClose: () => void }) {
  const route = ROUTES.find((r) => r.route_id === segment.route_id);
  const events = [
    { k: "Harsh braking", v: segment.harsh_braking, c: "var(--color-destructive)" },
    { k: "Overspeed", v: segment.overspeed, c: "var(--color-warning)" },
    { k: "Distraction", v: segment.distraction, c: "var(--color-chart-4)" },
    { k: "Drowsiness", v: segment.drowsiness, c: "var(--color-chart-2)" },
    { k: "Rough road", v: segment.rough_road, c: "var(--color-chart-3)" },
  ];
  const max = Math.max(...events.map((e) => e.v));
  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-border/60 bg-card shadow-elevated animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Segment drilldown</div>
            <div className="num text-[16px] font-semibold">{segment.segment_id}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Risk score</div>
              <div className="num text-[22px] font-semibold">{fmt(segment.risk_score)}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">30d trend</div>
              <div className={`num text-[22px] font-semibold ${segment.trend_30d > 0 ? "text-destructive" : "text-success"}`}>
                {segment.trend_30d > 0 ? "+" : ""}{fmt(segment.trend_30d)}%
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">Route association</div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-[13px]">
              <div className="num text-primary">{route?.route_code}</div>
              <div className="text-muted-foreground">{route?.route_name}</div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">Event composition</div>
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.k}>
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="text-muted-foreground">{e.k}</span>
                    <span className="num">{e.v}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                    <div className="h-full rounded-full" style={{ width: `${(e.v / max) * 100}%`, background: e.c }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">Recommendation</div>
            <p className="text-[12.5px] text-muted-foreground">
              {segment.rough_road > 20
                ? "Coordinate with civil ops — pavement quality is the leading upstream cause."
                : segment.distraction > 15
                ? "High driver-attention risk; prioritise this corridor for in-cab coaching nudges."
                : "Steady operational profile; monitor for trend reversal over the next 14 days."}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
