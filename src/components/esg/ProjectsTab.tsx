import { useEffect, useMemo, useState } from "react";
import { Factory, FileBadge, Flame, Leaf, RefreshCw, Save, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AMR_FIELDS,
  AMR_VALUES,
  CARBON,
  GHG_QTY,
  PERIODS,
  RECORDS,
  inScope,
  typeByKey,
} from "@/lib/esg-data";
import { A, CriticalBeam, EmptyState, Gloss, PanelCard, ProvenanceChip, useEsg, useStubLoad, LoadingRows } from "./primitives";
import { WorkQueue } from "./WorkQueue";
import { NcPanel } from "./projects/NcPanel";

type Sub = "permits" | "site" | "nc" | "amr" | "ghg" | "carbon";

const nf = new Intl.NumberFormat("en-IN");

function PeriodBadge() {
  const { period } = useEsg();
  const label = PERIODS.find((p) => p.id === period)?.label;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/8 px-2.5 py-1 text-[11.5px] font-medium text-primary">
      <RefreshCw className="h-3 w-3" aria-hidden />
      Reporting period: {label} — capture stays open all month; the digest goes out on the 7th
    </span>
  );
}

/* ----------------------------------- AMR ----------------------------------- */

function AmrSection() {
  const { period } = useEsg();
  const stub = AMR_VALUES[period] ?? {};
  const [manual, setManual] = useState<Record<string, string>>({});
  useEffect(() => setManual({}), [period]);

  const save = () => {
    const filled = AMR_FIELDS.filter((f) => f.mode === "manual" && (manual[f.id] ?? stub[f.id]?.value != null)).length;
    toast.success("AMR inputs saved", {
      description: `${filled} of ${AMR_FIELDS.filter((f) => f.mode === "manual").length} manual fields captured for ${PERIODS.find((p) => p.id === period)?.label}. (UI stub)`,
    });
  };

  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">
            <A t="AMR" /> input capture
          </h3>
          <p className="text-[12px] text-muted-foreground">
            Field list is lender-configured (Masters). Auto-fetched values arrive read-only with provenance; anything can be challenged.
          </p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 rounded-lg text-[12px]" onClick={save}>
          <Save className="h-3.5 w-3.5" /> Save period inputs
        </Button>
      </div>
      <div className="divide-y divide-border/40">
        {AMR_FIELDS.map((f) => {
          const v = stub[f.id];
          const auto = f.mode === "auto";
          const errored = !!v?.prov?.error;
          return (
            <div key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium">{f.label}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="num">{f.unit}</span>
                  {auto && v?.prov && (
                    <ProvenanceChip
                      prov={v.prov}
                      onFlag={() => toast("Value flagged", { description: `${f.label} — challenge recorded against ${f.source}. (UI stub)` })}
                    />
                  )}
                  {!auto && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium">manual entry</span>}
                </div>
                {errored && (
                  <p className="mt-1 text-[11px] font-medium text-destructive">
                    {v?.prov?.error}.{" "}
                    <button type="button" className="underline underline-offset-2" onClick={() => toast("Retry queued", { description: "Meter gateway re-poll requested. (UI stub)" })}>
                      Retry fetch
                    </button>{" "}
                    or enter manually below.
                  </p>
                )}
              </div>
              <div className="w-[160px] shrink-0">
                {auto && !errored ? (
                  <div className="num rounded-lg border border-primary/20 bg-accent/50 px-3 py-1.5 text-right text-[13px] font-semibold text-accent-foreground" title="Read from source — not hand-typed">
                    {v?.value != null ? nf.format(v.value) : "—"}
                  </div>
                ) : (
                  <CriticalBeam active={errored} size="sm">
                    <Input
                      inputMode="decimal"
                      value={manual[f.id] ?? (v?.value != null && !auto ? String(v.value) : "")}
                      onChange={(e) => setManual((m) => ({ ...m, [f.id]: e.target.value }))}
                      placeholder="Enter value"
                      aria-label={`${f.label} (${f.unit})`}
                      className="num h-9 bg-muted/40 text-right text-[13px] font-semibold"
                    />
                  </CriticalBeam>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}

/* ----------------------------------- GHG ----------------------------------- */

function GhgSection() {
  const { period, masters } = useEsg();
  const [qty, setQty] = useState<Record<string, string>>({});
  useEffect(() => setQty({}), [period]);

  // Masters is the single source for factors/active state — editing or
  // deactivating a parameter there is reflected here, not a parallel copy.
  const params = masters.ghgParams().filter((p) => p.active);

  const rows = useMemo(
    () =>
      params.map((p) => {
        const base = GHG_QTY[period]?.[p.id];
        const raw = qty[p.id];
        const q = raw !== undefined && raw !== "" ? Number(raw) : base;
        const valid = q != null && Number.isFinite(q);
        return { p, q: valid ? (q as number) : null, kg: valid ? (q as number) * p.factor : null };
      }),
    [params, period, qty],
  );

  const scopeTotal = (s: 1 | 2 | 3) => rows.filter((r) => r.p.scope === s).reduce((acc, r) => acc + (r.kg ?? 0), 0);
  const grand = scopeTotal(1) + scopeTotal(2) + scopeTotal(3);

  const SCOPE_META: Record<1 | 2 | 3, { label: string; hint: string; Icon: typeof Flame }> = {
    1: { label: "Scope 1 — direct", hint: "Fuel burned and refrigerants on our sites", Icon: Flame },
    2: { label: "Scope 2 — purchased energy", hint: "Grid electricity for charging and depots", Icon: Zap },
    3: { label: "Scope 3 — value chain", hint: "Commute, upstream fuel, waste", Icon: Factory },
  };

  return (
    <PanelCard>
        <div className="border-b border-border/60 px-5 py-3.5">
          <h3 className="text-[15px] font-semibold tracking-tight">
            <A t="GHG" /> inventory — parameter × factor
          </h3>
          <p className="text-[12px] text-muted-foreground">
            Emission = quantity × factor. Factors are supplied externally (<A t="CEA" />, <A t="DEFRA" />) and configured in Masters — never hardcoded.
          </p>
        </div>

        {([1, 2, 3] as const).map((s) => {
          const meta = SCOPE_META[s];
          const scopeRows = rows.filter((r) => r.p.scope === s);
          return (
            <div key={s} className="border-b border-border/40 last:border-0">
              <div className="flex items-center justify-between gap-3 bg-muted/30 px-5 py-2">
                <div className="flex items-center gap-2">
                  <meta.Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">{meta.label}</span>
                  <span className="hidden text-[11px] text-muted-foreground sm:inline">· {meta.hint}</span>
                </div>
                <span className="num text-[12px] font-semibold text-foreground">
                  {nf.format(Math.round(scopeTotal(s) / 100) / 10)} <span className="text-[10px] font-medium text-muted-foreground">tCO₂e</span>
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {scopeRows.map(({ p, q, kg }) => {
                  const auto = p.mode === "auto";
                  return (
                    <div key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-2.5 sm:grid-cols-[minmax(0,1.4fr)_150px_minmax(120px,0.8fr)_110px]">
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-medium">{p.label}</div>
                        <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                          <span className="num">
                            × {p.factor} kgCO₂e/{p.unit}
                          </span>
                          <span className="rounded-md bg-accent px-1 py-px font-medium text-accent-foreground ring-1 ring-inset ring-primary/15">{p.factorSource}</span>
                        </div>
                      </div>
                      <div className="row-start-2 sm:row-start-auto">
                        {auto ? (
                          <div className="num rounded-lg border border-primary/20 bg-accent/50 px-3 py-1.5 text-right text-[12.5px] font-semibold text-accent-foreground" title={`Auto-fetched from ${p.source}`}>
                            {q != null ? nf.format(q) : "—"}
                          </div>
                        ) : (
                          <Input
                            inputMode="decimal"
                            value={qty[p.id] ?? (GHG_QTY[period]?.[p.id] != null ? String(GHG_QTY[period][p.id]) : "")}
                            onChange={(e) => setQty((m) => ({ ...m, [p.id]: e.target.value }))}
                            placeholder="qty"
                            aria-label={`${p.label} quantity (${p.unit})`}
                            className="num h-8 bg-muted/40 text-right text-[12.5px] font-semibold"
                          />
                        )}
                      </div>
                      <div className="hidden text-[10.5px] text-muted-foreground sm:block">
                        {auto ? `auto · ${p.source}` : "manual entry"} · {p.unit}
                      </div>
                      <div className="num text-right text-[12.5px] font-semibold">
                        {kg != null ? nf.format(Math.round(kg)) : "—"} <span className="text-[10px] font-medium text-muted-foreground">kg</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between bg-primary/6 px-5 py-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Period total</span>
          <span className="num text-[18px] font-semibold text-foreground">
            {nf.format(Math.round(grand / 100) / 10)} <span className="text-[11px] font-medium text-muted-foreground">tCO₂e</span>
          </span>
        </div>
    </PanelCard>
  );
}

/* --------------------------------- carbon ---------------------------------- */

function CarbonSection() {
  return (
    <PanelCard>
      <div className="grid gap-0 sm:grid-cols-[1fr_auto]">
        <div className="px-5 py-4">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <Leaf className="h-4 w-4 text-success" aria-hidden /> Carbon savings — baseline vs actual
          </h3>
          <p className="mt-1 max-w-[560px] text-[12px] leading-relaxed text-muted-foreground">{CARBON.methodology}</p>
          <div className="mt-3 flex flex-wrap gap-5">
            {CARBON.monthly.map((m) => (
              <div key={m.period}>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {PERIODS.find((p) => p.id === m.period)?.label}
                  {m.period === "2026-07" ? " (MTD)" : ""}
                </div>
                <div className="num mt-0.5 text-[17px] font-semibold text-success">
                  {nf.format(m.savedT)} <span className="text-[10.5px] font-medium text-muted-foreground">t avoided</span>
                </div>
                <div className="num text-[10.5px] text-muted-foreground">{nf.format(m.fleetKm)} km</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center gap-1 border-t border-border/40 bg-success/8 px-6 py-4 sm:border-l sm:border-t-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cumulative avoided</div>
          <div className="num text-[28px] font-semibold leading-none text-success">{nf.format(CARBON.cumulativeSavedT)}</div>
          <div className="text-[11px] font-medium text-muted-foreground">
            tCO₂e — reconciled to the public website figure ({nf.format(CARBON.websiteFigureT)} t), one methodology, one number
          </div>
        </div>
      </div>
    </PanelCard>
  );
}

/* --------------------------------- projects -------------------------------- */

export function ProjectsTab({ initialSub }: { initialSub?: string }) {
  const { scope } = useEsg();
  const [sub, setSub] = useState<Sub>((initialSub as Sub) || "permits");
  const loading = useStubLoad(sub + JSON.stringify(scope));

  const subs: { key: Sub; label: React.ReactNode }[] = [
    { key: "permits", label: "Permits & Licences" },
    { key: "site", label: "Compliance status" },
    {
      key: "nc",
      label: (
        <>
          <A t="NC" /> Reports
        </>
      ),
    },
    { key: "amr", label: <A t="AMR" /> },
    { key: "ghg", label: <A t="GHG" /> },
    { key: "carbon", label: "Carbon savings" },
  ];

  const records = useMemo(
    () =>
      RECORDS.filter((r) => inScope(r, scope)).filter(
        (r) => typeByKey(r.typeKey)?.category === (sub === "permits" ? "permit" : "site"),
      ),
    [scope, sub],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-0.5 overflow-x-auto rounded-xl border border-border/60 bg-card/60 p-1" role="tablist" aria-label="Project compliance sections">
          {subs.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={sub === s.key}
              onClick={() => setSub(s.key)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                sub === s.key ? "nav-pill-active" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {(sub === "amr" || sub === "ghg" || sub === "carbon") && <PeriodBadge />}
      </div>

      {loading ? (
        <PanelCard>
          <LoadingRows rows={5} />
        </PanelCard>
      ) : sub === "permits" || sub === "site" ? (
        <PanelCard>
          <div className="border-b border-border/60 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <FileBadge className="h-4 w-4 text-primary" aria-hidden />
              {sub === "permits" ? "Permits, licences & certificates" : "Site compliance items"}
            </h3>
            <p className="text-[12px] text-muted-foreground">
              {sub === "permits" ? (
                <>
                  Incorporation, <A t="ROC" />, <A t="MOA/AOA" />, <A t="CTO" />, <A t="COE" /> — one record type, one expiry clock, one owner each.
                </>
              ) : (
                <>
                  Fire <A t="NOC" />, <A t="SWM" />, <A t="STP" />, <A t="ETP" />, <A t="ISO" />, <A t="PCC" /> — the same atomic record with a different type master.
                </>
              )}
            </p>
          </div>
          {records.length === 0 ? (
            <EmptyState title="No items in this scope" hint="Widen the scope selector to see group-level records." />
          ) : (
            <WorkQueue records={records} />
          )}
        </PanelCard>
      ) : sub === "nc" ? (
        <NcPanel />
      ) : sub === "amr" ? (
        <AmrSection />
      ) : sub === "ghg" ? (
        <GhgSection />
      ) : (
        <CarbonSection />
      )}
    </div>
  );
}
