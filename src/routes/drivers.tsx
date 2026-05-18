import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Award, BadgeCheck, Brain, Crown, Flame, Gauge, GraduationCap,
  Sparkles, TrendingDown, TrendingUp, Users, X,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart,
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import { PageShell } from "@/components/layout/AppNav";
import { InsightCard } from "@/components/dashboard/InsightCard";
import { DRIVERS, type DriverScore } from "@/lib/fleet-data";

export const Route = createFileRoute("/drivers")({
  head: () => ({
    meta: [
      { title: "Driver Intelligence · Voltline" },
      { name: "description", content: "Driver coaching, benchmarking and operational optimization." },
      { property: "og:title", content: "Driver Intelligence · Voltline" },
      { property: "og:description", content: "Contextual driver scoring, behavior fingerprints and peer benchmarking." },
    ],
  }),
  component: DriverIntelligencePage,
});

const fmt = (n: number, d = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

const BAND_COLOR: Record<DriverScore["risk_band"], string> = {
  Elite: "var(--color-success)",
  Strong: "var(--color-primary)",
  Average: "var(--color-chart-2)",
  "At-risk": "var(--color-warning)",
  Critical: "var(--color-destructive)",
};

function MiniStat({ label, value, unit, hint, tone = "default" }: {
  label: string; value: string; unit?: string; hint?: string;
  tone?: "default" | "warning" | "success" | "destructive";
}) {
  const toneClass =
    tone === "warning" ? "text-warning"
      : tone === "success" ? "text-success"
      : tone === "destructive" ? "text-destructive"
      : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`num text-[26px] font-semibold tracking-tight ${toneClass}`}>{value}</span>
        {unit && <span className="text-[12px] font-medium text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function DriverCard({ d, onOpen, comparing, onToggleCompare }: {
  d: DriverScore; onOpen: () => void; comparing: boolean; onToggleCompare: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-elevated transition-all hover:-translate-y-0.5 hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="flex items-center gap-2.5 text-left">
          <div className="flex h-9 w-9 items-center justify-center rounded-full text-[11.5px] font-semibold tracking-tight"
            style={{ background: `color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 18%, var(--color-card))`, color: BAND_COLOR[d.risk_band], boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 35%, transparent)` }}
          >
            {d.driver_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </div>
          <div>
            <div className="text-[13.5px] font-semibold tracking-tight">{d.driver_name}</div>
            <div className="text-[11px] text-muted-foreground">{d.company_name} · {d.trips_30d} trips</div>
          </div>
        </button>
        <span className="rounded-md px-1.5 py-0.5 text-[10.5px] uppercase tracking-wider"
          style={{ background: `color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 15%, transparent)`, color: BAND_COLOR[d.risk_band] }}>
          {d.risk_band}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Contextual</div>
          <div className="num text-[22px] font-semibold tracking-tight">{fmt(d.contextual_score)}</div>
          <div className="text-[11px] num text-muted-foreground">P{d.percentile} · diff exposure {fmt(d.difficulty_exposure, 0)}</div>
        </div>
        <div className="h-10 w-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.score_evolution.map((v) => ({ v }))} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={`drv-${d.driver_id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={BAND_COLOR[d.risk_band]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={BAND_COLOR[d.risk_band]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area dataKey="v" type="monotone" stroke={BAND_COLOR[d.risk_band]} strokeWidth={1.4} fill={`url(#drv-${d.driver_id})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className={`num inline-flex items-center gap-1 ${d.efficiency_delta_pct < 0 ? "text-success" : "text-destructive"}`}>
          {d.efficiency_delta_pct < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
          {fmt(Math.abs(d.efficiency_delta_pct))}% eff Δ
        </span>
        <button
          onClick={onToggleCompare}
          className={`rounded-md border px-2 py-0.5 text-[10.5px] transition-colors ${
            comparing ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          {comparing ? "Comparing" : "Compare"}
        </button>
      </div>
    </div>
  );
}

function DriverIntelligencePage() {
  const [open, setOpen] = useState<DriverScore | null>(null);
  const [compare, setCompare] = useState<string[]>([DRIVERS[0].driver_id]);
  const [sort, setSort] = useState<"score" | "efficiency" | "exposure">("score");

  const sorted = useMemo(() => {
    const arr = [...DRIVERS];
    if (sort === "score") arr.sort((a, b) => b.contextual_score - a.contextual_score);
    if (sort === "efficiency") arr.sort((a, b) => a.efficiency_kwh_per_km - b.efficiency_kwh_per_km);
    if (sort === "exposure") arr.sort((a, b) => b.difficulty_exposure - a.difficulty_exposure);
    return arr;
  }, [sort]);

  const elite = DRIVERS.filter((d) => d.risk_band === "Elite").length;
  const critical = DRIVERS.filter((d) => d.risk_band === "Critical" || d.risk_band === "At-risk").length;
  const avgScore = DRIVERS.reduce((s, d) => s + d.contextual_score, 0) / DRIVERS.length;
  const avgEff = DRIVERS.reduce((s, d) => s + d.efficiency_kwh_per_km, 0) / DRIVERS.length;

  function toggleCompare(id: string) {
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? [...prev.slice(1), id] : [...prev, id],
    );
  }
  const comparing = DRIVERS.filter((d) => compare.includes(d.driver_id));
  const radar = ["harsh_braking", "harsh_accel", "overspeed", "distraction", "drowsiness", "phone_use"].map((k) => {
    const row: any = { dim: k.replace("_", " ") };
    for (const d of comparing) row[d.driver_name] = (d as any)[k];
    return row;
  });

  return (
    <PageShell
      eyebrow="Live · gold.driver_trip_behavior_fact + driver_contextual_score_fact"
      title="Driver Intelligence"
      description="Contextual driver scoring, behavior fingerprints and peer benchmarking — calibrated to route difficulty."
      meta={
        <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-right">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Active drivers</div>
          <div className="num mt-0.5 text-[20px] font-semibold tracking-tight">{DRIVERS.length}</div>
          <div className="text-[11px] num text-muted-foreground">Across 4 operators</div>
        </div>
      }
    >
      {/* A. Command center */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MiniStat label="Avg score" value={fmt(avgScore)} unit="/100" hint="Route-normalized" />
        <MiniStat label="Elite drivers" value={String(elite)} tone="success" hint="Top tier" />
        <MiniStat label="High-risk" value={String(critical)} tone="destructive" hint="Coaching priority" />
        <MiniStat label="Fleet efficiency" value={fmt(avgEff, 2)} unit="kWh/km" />
        <MiniStat label="Coaching slots" value={String(Math.max(3, Math.round(critical * 1.5)))} tone="warning" hint="Auto-scheduled" />
      </section>

      {/* B. Leaderboard */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight">Driver leaderboard</h2>
            <p className="text-[12.5px] text-muted-foreground">Click a driver for the deep dive or add to behavior comparison.</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/70 p-0.5">
            {(["score", "efficiency", "exposure"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] capitalize transition-colors ${
                  sort === s ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((d) => (
            <DriverCard
              key={d.driver_id}
              d={d}
              onOpen={() => setOpen(d)}
              comparing={compare.includes(d.driver_id)}
              onToggleCompare={() => toggleCompare(d.driver_id)}
            />
          ))}
        </div>
      </section>

      {/* D. Behavior comparison */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">Behavior fingerprint comparison</h3>
              <p className="text-[12.5px] text-muted-foreground">DMS event density per 100 trips for selected drivers.</p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radar} outerRadius="78%">
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                {comparing.map((d, i) => (
                  <Radar
                    key={d.driver_id}
                    name={d.driver_name}
                    dataKey={d.driver_name}
                    stroke={`var(--color-chart-${(i % 5) + 1})`}
                    fill={`var(--color-chart-${(i % 5) + 1})`}
                    fillOpacity={0.18}
                    isAnimationActive={false}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* F. Peer benchmarking */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight">Peer benchmarking</h3>
            <Award className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2.5">
            {sorted.slice(0, 6).map((d, i) => (
              <div key={d.driver_id} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2">
                    {i === 0 && <Crown className="h-3 w-3 text-warning" />}
                    <span className="truncate">{d.driver_name}</span>
                  </span>
                  <span className="num text-muted-foreground">P{d.percentile}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${d.percentile}%`,
                      background: `linear-gradient(90deg, ${BAND_COLOR[d.risk_band]}, color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 40%, transparent))`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* E. Coaching */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted
          .filter((d) => d.contextual_score < 70)
          .slice(0, 3)
          .map((d) => (
            <InsightCard
              key={d.driver_id}
              icon={GraduationCap}
              tone={d.contextual_score < 50 ? "destructive" : "warning"}
              tag={d.driver_name.split(" ")[0]}
              title={
                d.harsh_braking > d.distraction
                  ? `${d.driver_name}: high braking intensity on congestion-heavy routes`
                  : `${d.driver_name}: distraction spikes on peak-hour difficult routes`
              }
              body={`Contextual score ${fmt(d.contextual_score)} · exposure ${fmt(d.difficulty_exposure)}. Recommend 2-session coaching focused on ${
                d.harsh_braking > d.distraction ? "regen-aware deceleration" : "attentional reset routines"
              }.`}
            />
          ))}
        {sorted
          .filter((d) => d.risk_band === "Elite")
          .slice(0, 2)
          .map((d) => (
            <InsightCard
              key={d.driver_id}
              icon={BadgeCheck}
              tone="success"
              tag={d.driver_name.split(" ")[0]}
              title={`${d.driver_name} sustains elite efficiency on high-altitude routes`}
              body={`Use as benchmark for cohort training; pair as mentor for two at-risk drivers in the same depot.`}
            />
          ))}
        <InsightCard
          icon={Brain}
          title="Cohort-level pattern: peak-hour distraction"
          body="Distraction events rise 38% during 5–7 PM across at-risk drivers. Push proactive nudges 10 minutes before departure."
        />
      </section>

      {open && <DriverDrawer d={open} onClose={() => setOpen(null)} />}
    </PageShell>
  );
}

function DriverDrawer({ d, onClose }: { d: DriverScore; onClose: () => void }) {
  const evo = d.score_evolution.map((v, i) => ({ wk: `W${i + 1}`, score: v }));
  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-lg overflow-y-auto border-l border-border/60 bg-card shadow-elevated animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-semibold"
              style={{ background: `color-mix(in oklab, ${BAND_COLOR[d.risk_band]} 18%, var(--color-card))`, color: BAND_COLOR[d.risk_band] }}>
              {d.driver_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-tight">{d.driver_name}</div>
              <div className="text-[11.5px] text-muted-foreground">{d.company_name} · {d.trips_30d} trips · P{d.percentile}</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Score</div>
              <div className="num text-[22px] font-semibold">{fmt(d.contextual_score)}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Eff.</div>
              <div className="num text-[22px] font-semibold">{fmt(d.efficiency_kwh_per_km, 2)}</div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Exposure</div>
              <div className="num text-[22px] font-semibold">{fmt(d.difficulty_exposure, 0)}</div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">12-week score evolution</div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evo} margin={{ top: 6, right: 6, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
                  <XAxis dataKey="wk" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} domain={[20, 100]} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" stroke={BAND_COLOR[d.risk_band]} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">Behavior fingerprint</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Harsh braking", d.harsh_braking, "var(--color-destructive)"],
                ["Harsh accel", d.harsh_accel, "var(--color-warning)"],
                ["Overspeed", d.overspeed, "var(--color-chart-3)"],
                ["Distraction", d.distraction, "var(--color-chart-4)"],
                ["Drowsiness", d.drowsiness, "var(--color-chart-2)"],
                ["Phone use", d.phone_use, "var(--color-chart-5)"],
              ].map(([k, v, c]) => (
                <div key={k as string} className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{k as string}</span>
                    <span className="num">{fmt(v as number)}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/50">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (v as number) * 2)}%`, background: c as string }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
