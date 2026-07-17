import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Shield,
  XCircle,
} from "lucide-react";
import { PageShell } from "@/components/layout/AppNav";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/attribute-score")({
  head: () => ({
    meta: [
      { title: "Driver Attribute Score · Voltline" },
      {
        name: "description",
        content:
          "Monthly 100-point Driver Attribute Score — scoring specification for review and sign-off.",
      },
    ],
  }),
  component: AttributeScorePage,
});

/** Demo drivers for sign-off review. Logic will be replaced by live mart later. */
type DemoPillar = {
  id: string;
  label: string;
  max: number;
  marks: number;
  outcome: string;
};

type DemoDriver = {
  id: string;
  name: string;
  month: string;
  depot: string;
  attendanceDays: number;
  trips: number;
  eligible: boolean;
  gateFailReason?: string;
  pillars: DemoPillar[];
};

const WEIGHTS = [
  { id: "accidents", label: "Accidents", max: 30, color: "#ef4444" },
  { id: "energy", label: "soc/km", max: 20, color: "#2dd4bf" },
  { id: "adas", label: "ADAS behaviour", max: 20, color: "#5B8CFF" },
  { id: "attendance", label: "Attendance", max: 15, color: "#f59e0b" },
  { id: "mobile", label: "Mobile usage", max: 10, color: "#a855f7" },
  { id: "alcohol", label: "Alcohol", max: 5, color: "#94a3b8" },
] as const;

const DEMO_DRIVERS: DemoDriver[] = [
  {
    id: "d1",
    name: "Ramesh Patil",
    month: "June 2026",
    depot: "MBMT",
    attendanceDays: 24,
    trips: 118,
    eligible: true,
    pillars: [
      { id: "accidents", label: "Accidents", max: 30, marks: 30, outcome: "No accidents" },
      { id: "energy", label: "soc/km", max: 20, marks: 20, outcome: "2.1% above route avg (≤5%)" },
      {
        id: "adas",
        label: "ADAS",
        max: 20,
        marks: 16.5,
        outcome: "Braking 3.5/7 · Accel 7/7 · Seatbelt 6/6",
      },
      { id: "attendance", label: "Attendance", max: 15, marks: 10, outcome: "92.3% of 26-day month" },
      { id: "mobile", label: "Mobile", max: 10, marks: 10, outcome: "1 phone event (<3)" },
      { id: "alcohol", label: "Alcohol", max: 5, marks: 5, outcome: "Placeholder — full marks" },
    ],
  },
  {
    id: "d2",
    name: "Suresh Jadhav",
    month: "June 2026",
    depot: "MBMT",
    attendanceDays: 22,
    trips: 96,
    eligible: true,
    pillars: [
      { id: "accidents", label: "Accidents", max: 30, marks: 20, outcome: "1 minor accident" },
      { id: "energy", label: "soc/km", max: 20, marks: 10, outcome: "7.4% above route avg" },
      {
        id: "adas",
        label: "ADAS",
        max: 20,
        marks: 10,
        outcome: "Braking 3.5/7 · Accel 0/7 · Seatbelt 6/6",
      },
      { id: "attendance", label: "Attendance", max: 15, marks: 5, outcome: "84.6% of 26-day month" },
      { id: "mobile", label: "Mobile", max: 10, marks: 5, outcome: "4 phone events (3–5)" },
      { id: "alcohol", label: "Alcohol", max: 5, marks: 5, outcome: "Placeholder — full marks" },
    ],
  },
  {
    id: "d3",
    name: "Ajay More",
    month: "June 2026",
    depot: "MBMT",
    attendanceDays: 8,
    trips: 31,
    eligible: false,
    gateFailReason: "Attendance days 8 < 10 and trips 31 < 50 — discarded (no score)",
    pillars: [],
  },
];

function totalMarks(d: DemoDriver) {
  return d.pillars.reduce((s, p) => s + p.marks, 0);
}

function BandTable({
  rows,
}: {
  rows: { condition: string; marks: string; note?: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2 font-medium">Outcome / band</th>
            <th className="px-3 py-2 font-medium">Marks</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.condition} className="border-b border-border/30 last:border-0">
              <td className="px-3 py-2.5 text-foreground">{r.condition}</td>
              <td className="num px-3 py-2.5 font-semibold">{r.marks}</td>
              <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">
                {r.note ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PillarCard({
  title,
  marks,
  max,
  color,
  children,
  callout,
}: {
  title: string;
  marks: string;
  max: number;
  color: string;
  children: ReactNode;
  callout?: { tone: "info" | "warn"; text: string };
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Out of {max} marks</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
          style={{
            color,
            background: `color-mix(in oklab, ${color} 14%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 28%, transparent)`,
          }}
        >
          {marks} / {max}
        </span>
      </div>
      {children}
      {callout && (
        <div
          className={cn(
            "mt-4 flex gap-2 rounded-xl px-3 py-2.5 text-[12px] leading-relaxed",
            callout.tone === "warn"
              ? "bg-warning/10 text-warning"
              : "bg-primary/10 text-primary",
          )}
        >
          {callout.tone === "warn" ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{callout.text}</span>
        </div>
      )}
    </section>
  );
}

function AttributeScorePage() {
  const [selectedId, setSelectedId] = useState(DEMO_DRIVERS[0].id);
  const selected = useMemo(
    () => DEMO_DRIVERS.find((d) => d.id === selectedId) ?? DEMO_DRIVERS[0],
    [selectedId],
  );
  const score = selected.eligible ? totalMarks(selected) : null;

  return (
    <PageShell
      eyebrow="MBMT Depot · v2 · Review & sign-off"
      title="Driver Attribute Score"
      description="A monthly, 100-point score from attendance, accidents, driving behaviour, and energy efficiency — separate from the telemetry behaviour score."
      meta={
        <Link
          to="/drivers"
          className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2.5 text-[13px] font-medium shadow-elevated transition-all hover:-translate-y-0.5 hover:border-primary/40"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leaderboard
        </Link>
      }
    >
      {/* Headline weights */}
      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">100 marks — headline weights</h2>
            <p className="text-[12.5px] text-muted-foreground">
              Accidents 30 · soc/km 20 · ADAS 20 · Attendance 15 · Mobile 10 · Alcohol 5 (placeholder)
            </p>
          </div>
          <span className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground">
            Grain: one score per driver per month
          </span>
        </div>
        <div className="flex h-4 overflow-hidden rounded-full">
          {WEIGHTS.map((w) => (
            <div
              key={w.id}
              title={`${w.label}: ${w.max}`}
              style={{ width: `${w.max}%`, background: w.color }}
              className="relative"
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px]">
          {WEIGHTS.map((w) => (
            <span key={w.id} className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: w.color }} />
              {w.label}
              <span className="num font-medium text-foreground">{w.max}</span>
            </span>
          ))}
        </div>
        <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
          This answers “what kind of month did this driver have overall.” The existing telemetry
          score answers “how well did they drive on this trip vs peers in the same conditions.”
          Attendance and accidents only make sense monthly — they are deliberately not in the
          trip score.
        </p>
      </section>

      {/* Worked example */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight">Worked example — how marks add up</h2>
            <p className="text-[12.5px] text-muted-foreground">
              Demo drivers for review. Live scoring logic will replace this later.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl border border-border/60 bg-card/70 p-1">
            {DEMO_DRIVERS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
                  selectedId === d.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d.name.split(" ")[0]}
                {!d.eligible && " · unscored"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {selected.depot} · {selected.month}
                </div>
                <h3 className="mt-1 text-[18px] font-semibold tracking-tight">{selected.name}</h3>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {selected.attendanceDays} attendance days · {selected.trips} trips
                </p>
              </div>
              {selected.eligible ? (
                <div className="text-right">
                  <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    Attribute score
                  </div>
                  <div className="num text-[32px] font-semibold tracking-tight">{score}</div>
                  <div className="text-[11px] text-muted-foreground">/ 100</div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-xl bg-muted/40 px-3 py-2 text-[12px] font-medium text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  No score
                </div>
              )}
            </div>

            {!selected.eligible && (
              <div className="mt-4 flex gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {selected.gateFailReason}
              </div>
            )}

            {selected.eligible && (
              <>
                <div className="mt-5 space-y-2.5">
                  {selected.pillars.map((p) => {
                    const w = WEIGHTS.find((x) => x.id === p.id);
                    const pct = (p.marks / p.max) * 100;
                    return (
                      <div key={p.id}>
                        <div className="mb-1 flex items-center justify-between text-[12px]">
                          <span className="font-medium">{p.label}</span>
                          <span className="num text-muted-foreground">
                            {p.marks}
                            <span className="text-muted-foreground/70"> / {p.max}</span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted/40">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: w?.color ?? "var(--color-primary)",
                            }}
                          />
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{p.outcome}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-4 text-[13px]">
                  <span className="text-muted-foreground">Sum of pillars</span>
                  <span className="num text-[16px] font-semibold">{score} / 100</span>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <h3 className="text-[15px] font-semibold tracking-tight">Eligibility gates</h3>
            </div>
            <p className="mb-4 text-[12.5px] leading-relaxed text-muted-foreground">
              All three must pass. Failing any gate means the driver is{" "}
              <span className="font-medium text-foreground">discarded for the month</span> — they
              receive no score, not zero. A zero would unfairly drag the leaderboard.
            </p>
            <div className="space-y-2">
              {[
                { gate: "Depot", threshold: "MBMT only", why: "Scope of this rollout" },
                { gate: "Attendance days", threshold: "≥ 10 days", why: "Enough of a month to judge" },
                { gate: "Trips", threshold: "≥ 50 trips", why: "Behaviour & energy signals reliable" },
              ].map((g) => (
                <div
                  key={g.gate}
                  className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5"
                >
                  <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium">{g.gate}</span>
                      <span className="num text-[12px] text-foreground">{g.threshold}</span>
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">{g.why}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2 rounded-xl bg-muted/25 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Data quality: lost, dead, deleted, short, or efficiency-outlier trips are excluded from
              every metric and from route benchmarks. Minimum trip distance: 5 km.
            </div>
          </div>
        </div>
      </section>

      {/* Pillar specs */}
      <section className="space-y-3">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight">Evidence streams — scoring bands</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Exact mark tables for sign-off. Challenge anything that does not match intent.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PillarCard title="2.1 Accidents" marks="0–30" max={30} color="#ef4444">
            <BandTable
              rows={[
                { condition: "No accidents", marks: "30" },
                { condition: "1 minor accident", marks: "20" },
                { condition: "2 minor accidents", marks: "5" },
                {
                  condition: ">2 minor, OR any major",
                  marks: "0",
                  note: "Hard zero",
                },
              ]}
            />
            <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
              Major = severity “A” or “Fatal” on any injured party (passenger, staff, or third
              party). One major zeroes the full 30.
            </p>
            <div className="mt-3 flex gap-2 rounded-xl bg-success/10 px-3 py-2.5 text-[12px] text-success">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Bug fixed vs prior version: major-accident string mismatch no longer scores fatalities
              as minor (was incorrectly awarding 20).
            </div>
          </PillarCard>

          <PillarCard title="2.2 Energy efficiency (soc/km)" marks="0–20" max={20} color="#2dd4bf">
            <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
              Compared to{" "}
              <span className="font-medium text-foreground">route monthly average soc/km</span> —
              never driver-to-driver across different routes. At or below average is never
              penalised.
            </p>
            <BandTable
              rows={[
                { condition: "≤ average, up to 5% above", marks: "20" },
                { condition: "5–10% above", marks: "10" },
                { condition: "10–15% above", marks: "5" },
                { condition: "> 15% above", marks: "0" },
              ]}
            />
          </PillarCard>

          <PillarCard
            title="2.3 Driving behaviour (ADAS)"
            marks="0–20"
            max={20}
            color="#5B8CFF"
            callout={{
              tone: "warn",
              text: "Hard acceleration is sparse (pass/fail). Seatbelt nearly pass/fail. Most drivers auto-collect ~13/20; differentiation is mostly the 7 hard-braking marks.",
            }}
          >
            <BandTable
              rows={[
                {
                  condition: "Hard braking (7)",
                  marks: "7 / 3.5 / 0",
                  note: "vs route avg: ≤5% → 7; 5–10% → 3.5; >10% → 0",
                },
                {
                  condition: "Hard acceleration (7)",
                  marks: "7 or 0",
                  note: "Pass/fail — any event → 0",
                },
                {
                  condition: "Seatbelt (6)",
                  marks: "6 / 3 / 0",
                  note: "vs route avg: ≤5% → 6; 5–10% → 3; >10% → 0",
                },
              ]}
            />
          </PillarCard>

          <PillarCard title="2.4 Mobile phone usage" marks="0–10" max={10} color="#a855f7">
            <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
              Absolute count — not route-normalised. Looking at phone + talking on phone.
            </p>
            <BandTable
              rows={[
                { condition: "Fewer than 3 events", marks: "10" },
                { condition: "3 to 5 events", marks: "5" },
                { condition: "More than 5 events", marks: "0" },
              ]}
            />
          </PillarCard>

          <PillarCard
            title="2.5 Attendance"
            marks="0–15"
            max={15}
            color="#f59e0b"
            callout={{
              tone: "info",
              text: "Currently days scheduled vs 26-day month. Confirm whether an actual-attendance flag exists — if it does, we should use it.",
            }}
          >
            <BandTable
              rows={[
                { condition: "Above 98%", marks: "15" },
                { condition: "95–98%", marks: "10" },
                { condition: "90–95%", marks: "5" },
                { condition: "75–90%", marks: "3" },
                { condition: "40–75%", marks: "2" },
                { condition: "Below 40%", marks: "0" },
              ]}
            />
          </PillarCard>

          <PillarCard
            title="2.6 Alcohol (placeholder)"
            marks="5"
            max={5}
            color="#94a3b8"
            callout={{
              tone: "info",
              text: "No breathalyser source yet. Every eligible driver gets 5 marks — shifts all scores equally, differentiates nobody. Live scale today is effectively 95 marks of real signal + 5 constant.",
            }}
          >
            <BandTable
              rows={[{ condition: "All eligible drivers (until data exists)", marks: "5", note: "Placeholder" }]}
            />
          </PillarCard>
        </div>
      </section>

      {/* Sign-off */}
      <section className="rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">For review & sign-off</h2>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted-foreground">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            Confirm gate thresholds (MBMT, ≥10 days, ≥50 trips) and “unscored ≠ zero” behaviour.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            Confirm accident major definition (severity A / Fatal) and mark ladder for minors.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            Confirm soc/km route-benchmark bands and ADAS sub-weights (including sparse accel/seatbelt).
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            Confirm attendance uses scheduled vs actual presence; alcohol remains placeholder at 5.
          </li>
        </ul>
        <p className="mt-4 text-[12px] text-muted-foreground">
          UI only for now — calculation will be wired to the monthly mart when ready.
        </p>
      </section>
    </PageShell>
  );
}
