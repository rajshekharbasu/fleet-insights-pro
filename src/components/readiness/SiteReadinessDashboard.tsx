import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, Calendar, CheckCircle2, Clock, Filter, Search, Sparkles, TrendingUp,
  Building2, Layers, Activity, Settings2, RotateCcw, MessageSquare,
} from "lucide-react";
import {
  PieChart, Pie, Cell as RCell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, BarChart, Bar, Legend,
} from "recharts";
import {
  READINESS_ITEMS, SITES, type Site, type Cell, overallReadiness, typeBreakdown, statusBreakdown,
  weeklyProgress, upcomingDeadlines, daysUntil, categoryBreakdown,
} from "@/lib/readiness-data";
import { useReadinessConfig, type CellState } from "@/lib/readiness-store";
import { EditCellDialog } from "./EditCellDialog";
import { ManageColumnsDialog } from "./ManageColumnsDialog";
import { Button } from "@/components/ui/button";

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const STATUS_COLORS: Record<string, string> = {
  "Completed": "var(--success)",
  "On Track": "var(--chart-1)",
  "At Risk": "var(--warning)",
  "Delayed": "var(--destructive)",
};
const PRIO_COLORS: Record<string, string> = {
  Critical: "var(--destructive)",
  High: "var(--warning)",
  Medium: "var(--chart-2)",
  Low: "var(--muted-foreground)",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ eyebrow, title, icon: Icon, action }: {
  eyebrow?: string; title: string; icon?: React.ComponentType<{ className?: string }>; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div>
          {eyebrow && <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</div>}
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        </div>
      </div>
      {action}
    </div>
  );
}

function CellBadge({ v }: { v: "yes" | "no" | "na" }) {
  if (v === "yes") return <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md bg-success/15 px-1.5 text-[10.5px] font-semibold text-success ring-1 ring-success/25">YES</span>;
  if (v === "no") return <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md bg-destructive/12 px-1.5 text-[10.5px] font-semibold text-destructive ring-1 ring-destructive/25">NO</span>;
  return <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md bg-muted/40 px-1.5 text-[10.5px] font-medium text-muted-foreground">—</span>;
}

export function SiteReadinessDashboard() {
  const overall = useMemo(() => overallReadiness(), []);
  const byType = useMemo(() => typeBreakdown(), []);
  const byStatus = useMemo(() => statusBreakdown(), []);
  const byCategory = useMemo(() => categoryBreakdown(), []);
  const weekly = useMemo(() => weeklyProgress(12), []);
  const deadlines = useMemo(() => upcomingDeadlines(8), []);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<Site | "all">("all");

  const filtered = useMemo(() => {
    return READINESS_ITEMS.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (query && !`${r.item} ${r.team} ${r.owner}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (siteFilter !== "all" && r.cells[siteFilter] === "na") return false;
      return true;
    });
  }, [query, statusFilter, siteFilter]);

  const overallPct = Math.round(overall.pct * 100);

  return (
    <div className="space-y-8">
      {/* HERO */}
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-border/50 px-6 py-8"
        style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--primary) 10%, var(--card)) 0%, var(--card) 60%)" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: "radial-gradient(circle at 12% 20%, color-mix(in oklab, var(--primary) 30%, transparent), transparent 55%)" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-primary">
              <Sparkles className="h-3 w-3" /> Site readiness · IT / IT Infra master
            </div>
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight md:text-[34px]">
              Transvolt Mobility — Site Readiness
            </h1>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Centralised, live web view of the IT &amp; ITMS readiness matrix across {SITES.length} sites and{" "}
              {READINESS_ITEMS.length} workstreams. Replaces the master Excel sheet.
            </p>
          </div>
          {/* Overall progress ring */}
          <div className="flex items-center gap-5">
            <ProgressRing pct={overallPct} />
            <div className="space-y-1.5 text-[12px]">
              <Stat label="Items in scope" value={String(overall.totalItems)} />
              <Stat label="Applicable cells" value={String(overall.totalApplicable)} />
              <Stat label="Cells ready" value={String(overall.totalYes)} accent="success" />
            </div>
          </div>
        </div>
      </motion.header>

      {/* KPI ribbon */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={CheckCircle2} label="Completed" value={byStatus.find((s) => s.status === "Completed")?.count ?? 0} tone="success" />
        <KpiCard icon={Activity} label="On Track" value={byStatus.find((s) => s.status === "On Track")?.count ?? 0} tone="primary" />
        <KpiCard icon={AlertTriangle} label="At Risk" value={byStatus.find((s) => s.status === "At Risk")?.count ?? 0} tone="warning" />
        <KpiCard icon={Clock} label="Delayed" value={byStatus.find((s) => s.status === "Delayed")?.count ?? 0} tone="destructive" />
      </section>

      {/* Charts row */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardTitle eyebrow="Distribution" title="Status mix" icon={Layers} />
          <div className="h-[260px] px-2 pb-2 pt-3">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={byStatus} dataKey="count" nameKey="status"
                  innerRadius={55} outerRadius={90} paddingAngle={3} stroke="var(--card)"
                >
                  {byStatus.map((s) => (
                    <RCell key={s.status} fill={STATUS_COLORS[s.status]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="xl:col-span-1">
          <CardTitle eyebrow="Workstream" title="Readiness by type" icon={Building2} />
          <div className="h-[260px] px-2 pb-2 pt-3">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byType} dataKey="yes" nameKey="type" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="var(--card)">
                  {byType.map((_, i) => <RCell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number, _n, p) => [`${v} ready / ${(p.payload as { total: number }).total} applicable`, p.payload?.type]}
                />
                <Legend wrapperStyle={{ fontSize: 10.5 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="xl:col-span-1">
          <CardTitle eyebrow="Spend mix" title="CAPEX / OPEX split" icon={Layers} />
          <div className="h-[260px] px-2 pb-2 pt-3">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCategory} dataKey="count" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="var(--card)">
                  {byCategory.map((_, i) => <RCell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* Weekly trend + Deadlines */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardTitle eyebrow="Trend · 12 weeks" title="Week-by-week readiness progress" icon={TrendingUp} />
          <div className="h-[300px] px-3 pb-3 pt-4">
            <ResponsiveContainer>
              <AreaChart data={weekly} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="ovr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="overall" name="Overall" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#ovr)" />
                <Area type="monotone" dataKey="assetInfra" name="Asset Infra" stroke="var(--chart-2)" strokeWidth={1.6} fill="transparent" />
                <Area type="monotone" dataKey="vehicle" name="Vehicle" stroke="var(--chart-3)" strokeWidth={1.6} fill="transparent" />
                <Area type="monotone" dataKey="software" name="Software" stroke="var(--chart-4)" strokeWidth={1.6} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle eyebrow="Calendar" title="Upcoming deadlines" icon={Calendar} />
          <div className="space-y-2 px-3 pb-4 pt-4">
            {deadlines.map((d) => {
              const days = daysUntil(d.deadline);
              const overdue = days < 0;
              return (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/40 px-3 py-2.5 transition-colors hover:border-primary/30">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-medium">{d.item}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                      <span>{d.owner}</span>
                      <span>·</span>
                      <span>{new Date(d.deadline).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</span>
                    </div>
                  </div>
                  <div className={`shrink-0 rounded-md px-2 py-1 text-[10.5px] font-semibold ring-1 ${overdue
                      ? "bg-destructive/12 text-destructive ring-destructive/25"
                      : days < 7
                        ? "bg-warning/15 text-warning-foreground ring-warning/30"
                        : "bg-muted/40 text-muted-foreground ring-border/40"
                  }`}>
                    {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `${days}d`}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Per-site bars */}
      <Card>
        <CardTitle eyebrow="By site" title="Readiness % across sites" icon={Building2} />
        <div className="h-[280px] px-3 pb-3 pt-4">
          <ResponsiveContainer>
            <BarChart data={overall.sites.map((s) => ({ site: s.site, pct: +(s.pct * 100).toFixed(1), yes: s.yes, no: s.no }))} margin={{ top: 8, right: 16, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
              <XAxis dataKey="site" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="pct" name="Readiness %" radius={[6, 6, 0, 0]}>
                {overall.sites.map((s, i) => (
                  <RCell key={s.site} fill={s.pct >= 0.7 ? "var(--success)" : s.pct >= 0.45 ? "var(--chart-1)" : s.pct >= 0.2 ? "var(--warning)" : "var(--destructive)"} opacity={0.85 - (i % 3) * 0.05} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* MATRIX */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Master matrix</div>
            <h3 className="text-[15px] font-semibold tracking-tight">Item × Site readiness</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search item, owner…"
                className="h-8 w-[200px] rounded-lg border border-border/60 bg-background/60 pl-7 pr-2 text-[12px] outline-none focus:border-primary/40"
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-lg border border-border/60 bg-background/60 px-2 text-[12px] outline-none">
              <option value="all">All status</option>
              <option>On Track</option><option>At Risk</option><option>Delayed</option><option>Completed</option>
            </select>
            <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value as Site | "all")} className="h-8 rounded-lg border border-border/60 bg-background/60 px-2 text-[12px] outline-none">
              <option value="all">All sites</option>
              {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="hidden items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1 text-[10.5px] text-muted-foreground md:flex">
              <Filter className="h-3 w-3" /> {filtered.length} rows
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-[12px]">
            <thead>
              <tr className="border-b border-border/40 text-left text-[10.5px] uppercase tracking-wider text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card/80 px-4 py-2.5 backdrop-blur-sm">Item</th>
                <th className="px-2 py-2.5">Team</th>
                <th className="px-2 py-2.5">Owner</th>
                <th className="px-2 py-2.5">Priority</th>
                <th className="px-2 py-2.5">Deadline</th>
                <th className="px-2 py-2.5">Status</th>
                {SITES.map((s) => (
                  <th key={s} className="px-1.5 py-2.5 text-center">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const d = daysUntil(r.deadline);
                return (
                  <tr key={r.id} className="border-b border-border/30 transition-colors hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-card/80 px-4 py-2 backdrop-blur-sm">
                      <div className="font-medium">{r.item}</div>
                      <div className="text-[10.5px] text-muted-foreground">{r.category} · {r.type}</div>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{r.team}</td>
                    <td className="px-2 py-2">{r.owner}</td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10.5px] font-semibold ring-1" style={{ color: PRIO_COLORS[r.priority], borderColor: "transparent", background: `color-mix(in oklab, ${PRIO_COLORS[r.priority]} 12%, transparent)` }}>
                        {r.priority}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {new Date(r.deadline).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" })}
                      <div className={`text-[10px] ${d < 0 ? "text-destructive" : d < 7 ? "text-warning" : "text-muted-foreground/70"}`}>
                        {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "today" : `in ${d}d`}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10.5px] font-semibold ring-1" style={{ color: STATUS_COLORS[r.status], background: `color-mix(in oklab, ${STATUS_COLORS[r.status]} 14%, transparent)`, borderColor: "transparent" }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[r.status] }} />
                        {r.status}
                      </span>
                    </td>
                    {SITES.map((s) => (
                      <td key={s} className="px-1.5 py-2 text-center"><CellBadge v={r.cells[s]} /></td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "success" }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${accent === "success" ? "text-success" : ""}`}>{value}</span>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative h-[140px] w-[140px]">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={r} stroke="var(--border)" strokeWidth="10" fill="none" opacity={0.4} />
        <circle
          cx="70" cy="70" r={r} stroke="url(#g1)" strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" />
            <stop offset="100%" stopColor="var(--chart-2)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[28px] font-semibold tracking-tight">{pct}%</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Overall</div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number;
  tone: "success" | "primary" | "warning" | "destructive";
}) {
  const tones: Record<string, string> = {
    success: "text-success bg-success/12 ring-success/25",
    primary: "text-primary bg-primary/12 ring-primary/25",
    warning: "text-warning bg-warning/15 ring-warning/30",
    destructive: "text-destructive bg-destructive/12 ring-destructive/25",
  };
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
          <div className="text-[22px] font-semibold tracking-tight">{value}</div>
        </div>
      </div>
    </Card>
  );
}
