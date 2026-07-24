import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CircleCheck,
  ClipboardList,
  Grid3X3,
  ShieldAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented } from "./Segmented";
import {
  cellStat,
  DOMAINS,
  ESAP_ACTIONS,
  ESG_GROUP,
  esapState,
  headline,
  personById,
  RECORDS,
  recordState,
  STATE_META,
  typeByKey,
  worstOf,
  type CellStat,
  type ComplianceRecord,
  type DomainKey,
  type EsgState,
} from "@/lib/esg-data";
import { fmtDate, inScope } from "@/lib/esg-data";
import { CriticalBeam, EmptyState, Gloss, LoadingRows, PanelCard, StatePill, useEsg, useStubLoad } from "./primitives";
import { WorkQueue } from "./WorkQueue";
import { buildNcRegister, ncItemPlace, NC_SOURCE_LABEL, type NcItem } from "@/lib/esg-nc";

/* --------------------------------- tiles ---------------------------------- */

type PanelSel =
  | { kind: "state"; state: EsgState }
  | { kind: "actions" }
  | { kind: "openNc" }
  | { kind: "breaches" }
  | { kind: "domain"; entityId: string; domain: DomainKey }
  | null;

function RiskTile({
  label,
  value,
  hint,
  accent,
  active,
  onClick,
  curated,
  className,
}: {
  label: React.ReactNode;
  value: string;
  hint: string;
  accent: string;
  active?: boolean;
  onClick?: () => void;
  curated?: boolean;
  className?: string;
}) {
  if (curated) {
    return (
      <div
        className={cn("rounded-2xl border border-dashed border-border/70 bg-card/50 p-5", className)}
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 5px, color-mix(in oklab, var(--muted-foreground) 5%, transparent) 5px, color-mix(in oklab, var(--muted-foreground) 5%, transparent) 6px)",
        }}
      >
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
        <div className="mt-1.5 text-[15px] font-semibold text-muted-foreground">Withheld</div>
        <div className="mt-1 text-[11.5px] text-muted-foreground">Curated out of the external view</div>
      </div>
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "cursor-pointer rounded-2xl border bg-card p-5 shadow-elevated transition-[transform,border-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.98]",
        active ? "" : "border-border/60",
        className,
      )}
      style={
        active
          ? {
              borderColor: accent,
              boxShadow: `0 0 0 1px ${accent}, 0 12px 32px -12px color-mix(in oklab, ${accent} 30%, transparent)`,
            }
          : undefined
      }
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="num text-[26px] font-semibold tracking-tight" style={{ color: accent }}>
          {value}
        </span>
      </div>
      <div className="mt-1 text-[11.5px] text-muted-foreground">{hint}</div>
    </div>
  );
}

/** Compact drill list for the Open NCs / Monitoring breaches tiles — same NcItem shape as the NC register. */
function NcItemList({ items, onOpen }: { items: NcItem[]; onOpen: (sub: string) => void }) {
  if (items.length === 0) return <EmptyState title="Nothing here" hint="No items match in this scope." />;
  return (
    <div className="max-h-[380px] overflow-auto">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item.backlink.kind === "esms" ? item.backlink.sub : "esap")}
          className="flex w-full items-center justify-between gap-4 border-b border-border/40 px-5 py-3 text-left transition-colors last:border-0 hover:bg-muted/40"
        >
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-medium">{item.title}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {NC_SOURCE_LABEL[item.source]} · {ncItemPlace(item)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className={cn("num text-[12px] font-semibold", item.ageDays > 30 ? "text-destructive" : "text-muted-foreground")}>
              {item.ageDays}d
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
          </div>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ matrix / graph ----------------------------- */

function CellChip({ stat, onClick, curated }: { stat: CellStat; onClick?: () => void; curated?: boolean }) {
  const total = stat.valid + stat.expiring + stat.overdue;
  if (total === 0)
    return <span className="inline-block rounded-md px-2 py-1 text-[11px] text-muted-foreground/60">—</span>;
  if (curated) {
    const pct = Math.round((stat.valid / total) * 100);
    const healthy = pct >= 95;
    return (
      <span
        className={cn(
          "num inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold",
          healthy ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
        )}
      >
        {healthy && <CircleCheck className="h-3 w-3" aria-hidden />}
        {pct}%
      </span>
    );
  }
  const worst = worstOf(stat);
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      style={{
        background: `color-mix(in oklab, ${STATE_META[worst].color} 12%, transparent)`,
        color: STATE_META[worst].color,
      }}
      aria-label={`${stat.valid} valid, ${stat.expiring} expiring, ${stat.overdue} overdue — drill down`}
    >
      {worst === "valid" ? (
        <>
          <CircleCheck className="h-3 w-3" aria-hidden />
          <span className="num">{stat.valid}</span>
        </>
      ) : (
        <>
          {stat.overdue > 0 && (
            <span className="num inline-flex items-center gap-0.5">
              <ShieldAlert className="h-3 w-3" aria-hidden />
              {stat.overdue}
            </span>
          )}
          {stat.expiring > 0 && (
            <span className="num inline-flex items-center gap-0.5 opacity-90">
              <CalendarClock className="h-3 w-3" aria-hidden />
              {stat.expiring}
            </span>
          )}
        </>
      )}
    </button>
  );
}

function StackBar({ stat }: { stat: CellStat }) {
  const total = Math.max(1, stat.valid + stat.expiring + stat.overdue);
  const seg = (n: number, state: EsgState) =>
    n > 0 && (
      <div
        className="flex h-full items-center justify-center rounded-[3px] transition-all"
        style={{ width: `${(n / total) * 100}%`, background: STATE_META[state].color }}
        title={`${STATE_META[state].label}: ${n}`}
      >
        {n / total > 0.12 && <span className="num text-[10px] font-bold text-white/95">{n}</span>}
      </div>
    );
  return (
    <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded-md bg-muted/40 p-[1px]">
      {seg(stat.valid, "valid")}
      {seg(stat.expiring, "expiring")}
      {seg(stat.overdue, "overdue")}
    </div>
  );
}

/* --------------------------------- overview -------------------------------- */

export function OverviewTab({ deepLinkRecordId }: { deepLinkRecordId?: string }) {
  const { scope, setScope, audience, goto, period, audit, monitoring } = useEsg();
  const [panel, setPanel] = useState<PanelSel>(null);
  const [view, setView] = useState<"matrix" | "graph">("matrix");
  const loading = useStubLoad(JSON.stringify(scope) + audience);
  const reduce = useReducedMotion();

  const agg = useMemo(() => headline(scope), [scope]);
  const external = audience === "external";

  // Live register — the same builder Phase 6/7 read, so these two new tiles
  // never disagree with the NC register or the Site Monitoring panel.
  const ncRegister = useMemo(
    () => buildNcRegister(scope, period, audit, monitoring),
    [scope, period, audit, monitoring],
  );
  const openNcItems = ncRegister.filter(
    (r) => (r.source === "internal-audit" || r.source === "external-audit") && r.actionStatus !== "closed",
  );
  const breachItems = ncRegister.filter((r) => r.source === "monitoring");

  // Notification deep-link: open the panel that contains the target record.
  useEffect(() => {
    if (!deepLinkRecordId) return;
    const rec = RECORDS.find((r) => r.id === deepLinkRecordId);
    if (rec) setPanel({ kind: "state", state: recordState(rec) });
  }, [deepLinkRecordId]);

  const entities = scope.entityId
    ? ESG_GROUP.entities.filter((e) => e.id === scope.entityId)
    : ESG_GROUP.entities;

  const panelRecords: ComplianceRecord[] = useMemo(() => {
    if (!panel) return [];
    if (panel.kind === "state") return agg.records.filter((r) => recordState(r) === panel.state);
    if (panel.kind === "domain") {
      const cat = panel.domain === "permits" ? "permit" : "site";
      return RECORDS.filter((r) => r.entityId === panel.entityId && typeByKey(r.typeKey)?.category === cat);
    }
    return [];
  }, [panel, agg.records]);

  const panelMeta =
    panel?.kind === "state"
      ? {
          accent: STATE_META[panel.state].color,
          title:
            panel.state === "overdue"
              ? "Overdue — the risk stock"
              : panel.state === "expiring"
                ? "Expiring — inside the renewal window"
                : "Valid — in force",
          blurb:
            panel.state === "overdue"
              ? "Every row here is a live lapse. Root cause is mandatory; remediation is tracked, not just disclosure."
              : panel.state === "expiring"
                ? "The maintainer's work queue — renew before the clock runs out."
                : "In-force items, furthest expiry last.",
        }
      : panel?.kind === "domain"
        ? {
            accent: "var(--color-primary)",
            title: `${ESG_GROUP.entities.find((e) => e.id === panel.entityId)?.short} · ${DOMAINS.find((d) => d.key === panel.domain)?.label}`,
            blurb: "Drill-down from the compliance cards — same records, higher resolution.",
          }
        : panel?.kind === "actions"
          ? {
              accent: "var(--color-chart-2)",
              title: "Open ESAP actions",
              blurb: "Corrective actions from ESDD / ESIA findings — the same numbers as the ESMS register.",
            }
          : panel?.kind === "openNc"
            ? {
                accent: "var(--color-destructive)",
                title: "Open non-conformities",
                blurb: "Internal & external audit NCs without a closed corrective action — the same register as NC Reports.",
              }
            : panel?.kind === "breaches"
              ? {
                  accent: "var(--color-warning)",
                  title: "Monitoring breaches",
                  blurb: "Site monitoring readings over their regulatory limit this period.",
                }
              : null;

  const openActions = ESAP_ACTIONS.filter((a) => a.status !== "closed");

  return (
    <div className="space-y-5">
      {/* Risk-first headline tiles — bad news gets the best real estate.
          Order: Overdue · Open NCs · Expiring soon · Monitoring breaches · Open actions · Compliant %. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <CriticalBeam
          active={!external && agg.overdue.length > 0}
          size="pulse-inner"
          className="h-full [&>div:not([data-beam-bloom])]:h-full"
        >
          <RiskTile
            className="h-full"
            label="Overdue items"
            value={String(agg.overdue.length)}
            hint="expired · non-compliant now"
            accent="var(--color-destructive)"
            active={panel?.kind === "state" && panel.state === "overdue"}
            onClick={() => setPanel(panel?.kind === "state" && panel.state === "overdue" ? null : { kind: "state", state: "overdue" })}
            curated={external}
          />
        </CriticalBeam>
        <RiskTile
          className="h-full"
          label={
            <>
              Open <Gloss text="NC" />s
            </>
          }
          value={String(openNcItems.length)}
          hint="audit non-conformities, no closed action"
          accent="var(--color-destructive)"
          active={panel?.kind === "openNc"}
          onClick={() => setPanel(panel?.kind === "openNc" ? null : { kind: "openNc" })}
          curated={external}
        />
        <RiskTile
          className="h-full"
          label="Expiring soon"
          value={String(agg.expiring.length)}
          hint="inside the renewal lead window"
          accent="var(--color-warning)"
          active={panel?.kind === "state" && panel.state === "expiring"}
          onClick={() => setPanel(panel?.kind === "state" && panel.state === "expiring" ? null : { kind: "state", state: "expiring" })}
        />
        <RiskTile
          className="h-full"
          label="Monitoring breaches"
          value={String(breachItems.length)}
          hint="over the regulatory limit this period"
          accent="var(--color-warning)"
          active={panel?.kind === "breaches"}
          onClick={() => setPanel(panel?.kind === "breaches" ? null : { kind: "breaches" })}
          curated={external}
        />
        <RiskTile
          className="h-full"
          label={
            <>
              Open <Gloss text="ESAP" /> actions
            </>
          }
          value={String(openActions.length)}
          hint={`${openActions.filter((a) => esapState(a) === "overdue").length} past due date`}
          accent="var(--color-chart-2)"
          active={panel?.kind === "actions"}
          onClick={() => setPanel(panel?.kind === "actions" ? null : { kind: "actions" })}
          curated={external}
        />
        <RiskTile
          className="h-full"
          label="Compliant"
          value={`${agg.compliantPct}%`}
          hint={`${agg.records.length - agg.overdue.length} of ${agg.records.length} tracked items in force`}
          accent="var(--color-success)"
          active={panel?.kind === "state" && panel.state === "valid"}
          onClick={() => setPanel(panel?.kind === "state" && panel.state === "valid" ? null : { kind: "state", state: "valid" })}
        />
      </div>

      {/* Drill panel — same treatment as the KPI-tile reveal on Driver Intelligence */}
      <AnimatePresence initial={false}>
        {panel && panelMeta && (
          <motion.div
            key={panel.kind === "state" ? panel.state : panel.kind === "domain" ? `${panel.entityId}-${panel.domain}` : "actions"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            style={{ overflow: "hidden" }}
          >
            <PanelCard accent={panelMeta.accent}>
          <div
            className="flex items-center justify-between gap-3 border-b px-5 py-3.5"
            style={{
              borderColor: `color-mix(in oklab, ${panelMeta.accent} 20%, transparent)`,
              background: `color-mix(in oklab, ${panelMeta.accent} 7%, transparent)`,
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 place-items-center rounded-xl"
                style={{
                  background: `color-mix(in oklab, ${panelMeta.accent} 14%, transparent)`,
                  color: panelMeta.accent,
                }}
              >
                <ClipboardList className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold tracking-tight">{panelMeta.title}</h3>
                  <span
                    className="num rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      background: `color-mix(in oklab, ${panelMeta.accent} 14%, transparent)`,
                      color: panelMeta.accent,
                    }}
                  >
                    {panel.kind === "actions"
                      ? openActions.length
                      : panel.kind === "openNc"
                        ? openNcItems.length
                        : panel.kind === "breaches"
                          ? breachItems.length
                          : panelRecords.length}
                  </span>
                </div>
                <p className="text-[12px] text-muted-foreground">{panelMeta.blurb}</p>
              </div>
            </div>
            <button
              onClick={() => setPanel(null)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close details"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {panel.kind === "actions" ? (
            <div className="max-h-[380px] overflow-auto">
              {openActions.map((a) => {
                const st = esapState(a);
                const owner = personById(a.ownerId);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => goto("esms")}
                    className="flex w-full items-center justify-between gap-4 border-b border-border/40 px-5 py-3 text-left transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-medium">{a.action}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {a.finding} · {owner?.name}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={cn("num text-[12px] font-semibold", st === "overdue" ? "text-destructive" : "text-muted-foreground")}
                      >
                        due {fmtDate(a.due)}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : panel.kind === "openNc" || panel.kind === "breaches" ? (
            <NcItemList items={panel.kind === "openNc" ? openNcItems : breachItems} onOpen={(sub) => goto("esms", { sub })} />
          ) : (
            <WorkQueue records={panelRecords} defaultFilter="all" highlightId={deepLinkRecordId} compact />
          )}
            </PanelCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards / graph — two views over the same rolled-up substance */}
      <PanelCard>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">Compliance by entity & area</h3>
            <p className="text-[12px] text-muted-foreground">
              {external
                ? "Curated view — aggregate health only; item-level lapses are withheld here."
                : "Click any area to drill into the records behind it. Same substance, higher resolution."}
            </p>
          </div>
          <Segmented
            ariaLabel="View"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { key: "matrix", label: "Cards", Icon: Grid3X3 },
              { key: "graph", label: "Graph", Icon: BarChart3 },
            ]}
          />
        </div>

        {loading ? (
          <LoadingRows rows={4} />
        ) : entities.length === 0 ? (
          <EmptyState title="No entities in scope" hint="Adjust the scope selector above." />
        ) : view === "matrix" ? (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {entities.map((e) => (
              <div key={e.id} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <button
                  type="button"
                  onClick={() => setScope({ entityId: e.id })}
                  className="text-left text-[13.5px] font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  {e.short}
                </button>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {e.depots.length} depot{e.depots.length > 1 ? "s" : ""}
                </div>
                <ul className="mt-3 space-y-2 border-t border-border/50 pt-3">
                  {DOMAINS.map((d) => {
                    const stat = cellStat(e.id, d.key);
                    return (
                      <li key={d.key} className="flex items-center justify-between gap-3">
                        <span className="text-[11.5px] text-muted-foreground">
                          <Gloss text={d.label} />
                        </span>
                        <CellChip
                          stat={stat}
                          curated={external}
                          onClick={() => {
                            if (d.key === "permits" || d.key === "site") setPanel({ kind: "domain", entityId: e.id, domain: d.key });
                            else if (d.key === "esms") goto("esms");
                            else if (d.key === "vendor") goto("vendors");
                            else goto("projects");
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {entities.map((e) => {
              const totals = DOMAINS.reduce(
                (acc, d) => {
                  const s = cellStat(e.id, d.key);
                  acc.valid += s.valid;
                  acc.expiring += s.expiring;
                  acc.overdue += s.overdue;
                  return acc;
                },
                { valid: 0, expiring: 0, overdue: 0 },
              );
              const total = Math.max(1, totals.valid + totals.expiring + totals.overdue);
              const pct = Math.round((totals.valid / total) * 100);
              return (
                <div key={e.id} className="grid grid-cols-[140px_1fr_56px] items-center gap-4">
                  <div className="truncate text-[12.5px] font-medium">{e.short}</div>
                  {external ? (
                    <div className="flex h-5 w-full overflow-hidden rounded-md bg-muted/40 p-[1px]">
                      <div className="h-full rounded-[3px] bg-success" style={{ width: `${pct}%` }} />
                    </div>
                  ) : (
                    <StackBar stat={totals} />
                  )}
                  <div className="num text-right text-[13px] font-semibold text-foreground">{pct}%</div>
                </div>
              );
            })}
            {!external && (
              <div className="flex items-center gap-4 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
                {(["valid", "expiring", "overdue"] as EsgState[]).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: STATE_META[s].color }} />
                    {STATE_META[s].label}
                  </span>
                ))}
                <span className="ml-auto">share of tracked items per entity</span>
              </div>
            )}
          </div>
        )}
      </PanelCard>
    </div>
  );
}
