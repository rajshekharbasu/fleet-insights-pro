import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CircleCheck,
  CircleDashed,
  CircleDot,
  ClipboardCheck,
  FileSearch,
  Link2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ASSESSMENTS,
  ESAP_ACTIONS,
  entityById,
  esapState,
  fmtDate,
  personById,
  POLICIES,
  SOPS,
  daysUntil,
  type EsapAction,
} from "@/lib/esg-data";
import { A, DocChip, EmptyState, Gloss, PanelCard, useEsg, useStubLoad, LoadingRows } from "./primitives";

type Sub = "policies" | "sops" | "esdd" | "esia" | "esap";

const DOC_STATUS: Record<string, { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "bg-success/12 text-success" },
  "under-review": { label: "Under review", cls: "bg-warning/14 text-warning" },
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
};

function DocStatusPill({ status }: { status: string }) {
  const m = DOC_STATUS[status] ?? DOC_STATUS.draft;
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", m.cls)}>
      {m.label}
    </span>
  );
}

const PARAM_ICON = {
  ok: { Icon: CircleCheck, color: "var(--color-success)", label: "Adequate" },
  gap: { Icon: TriangleAlert, color: "var(--color-warning)", label: "Gap found" },
  pending: { Icon: CircleDashed, color: "var(--color-muted-foreground)", label: "Pending" },
} as const;

export function EsmsTab({ initialSub }: { initialSub?: string }) {
  const { scope, audience } = useEsg();
  const [sub, setSub] = useState<Sub>((initialSub as Sub) || "policies");
  const [actionOverrides, setActionOverrides] = useState<Record<string, EsapAction["status"]>>({});
  const [esapFilter, setEsapFilter] = useState<"all" | "open" | "overdue" | "closed">("all");
  const loading = useStubLoad(sub + JSON.stringify(scope));

  const subs: { key: Sub; label: React.ReactNode }[] = [
    { key: "policies", label: "Policies" },
    { key: "sops", label: "SOPs" },
    { key: "esdd", label: <A t="ESDD" /> },
    { key: "esia", label: <A t="ESIA" /> },
    {
      key: "esap",
      label: (
        <>
          <A t="ESAP" /> register
        </>
      ),
    },
  ];

  const policies = POLICIES.filter((p) => !scope.entityId || p.entityId === scope.entityId);
  const sops = SOPS.filter((s) => !scope.entityId || s.entityId === scope.entityId);
  const assessments = ASSESSMENTS.filter((a) => !scope.entityId || a.entityId === scope.entityId).filter(
    (a) => a.kind === (sub === "esia" ? "ESIA" : "ESDD"),
  );

  const actions = useMemo(() => {
    const withStatus = ESAP_ACTIONS.map((a) => ({ ...a, status: actionOverrides[a.id] ?? a.status }));
    const scoped = withStatus.filter((a) => {
      if (!scope.entityId) return true;
      const asmt = ASSESSMENTS.find((x) => x.id === a.assessmentId);
      return asmt?.entityId === scope.entityId;
    });
    if (esapFilter === "all") return scoped;
    if (esapFilter === "closed") return scoped.filter((a) => a.status === "closed");
    if (esapFilter === "overdue") return scoped.filter((a) => a.status !== "closed" && daysUntil(a.due) < 0);
    return scoped.filter((a) => a.status !== "closed");
  }, [scope.entityId, esapFilter, actionOverrides]);

  const advance = (a: EsapAction) => {
    const next = a.status === "open" ? "in-progress" : "closed";
    setActionOverrides((o) => ({ ...o, [a.id]: next }));
    toast.success(next === "closed" ? "Action closed" : "Action moved to in-progress", {
      description: `${a.action} (UI stub — will sync when the backend lands)`,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-0.5 overflow-x-auto rounded-xl border border-border/60 bg-card/60 p-1" role="tablist" aria-label="ESMS sections">
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

      {loading ? (
        <PanelCard>
          <LoadingRows rows={5} />
        </PanelCard>
      ) : sub === "policies" ? (
        <PanelCard>
          <div className="border-b border-border/60 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden /> Policies
            </h3>
            <p className="text-[12px] text-muted-foreground">Document-centric: upload, version, and status-track — organised by entity.</p>
          </div>
          {policies.length === 0 ? (
            <EmptyState title="No policies in this scope" hint="Corporate policies live under the Corporate (HQ) entity." />
          ) : (
            <div className="divide-y divide-border/40">
              {policies.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium">{p.name}</span>
                      <span className="num rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{p.version}</span>
                      <DocStatusPill status={p.status} />
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {entityById(p.entityId)?.short} · updated {fmtDate(p.updated)} · owner {personById(p.ownerId)?.name}
                    </div>
                  </div>
                  <DocChip name={`${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${p.version}.pdf`} />
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      ) : sub === "sops" ? (
        <PanelCard>
          <div className="border-b border-border/60 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden /> Standard Operating Procedures
            </h3>
            <p className="text-[12px] text-muted-foreground">Organised by entity, then activity — the shop-floor layer of the <A t="ESMS" />.</p>
          </div>
          {sops.length === 0 ? (
            <EmptyState title="No SOPs in this scope" />
          ) : (
            <div className="divide-y divide-border/40">
              {Object.entries(
                sops.reduce<Record<string, typeof sops>>((acc, s) => {
                  const k = `${entityById(s.entityId)?.short} · ${s.activity}`;
                  (acc[k] ||= []).push(s);
                  return acc;
                }, {}),
              ).map(([groupLabel, list]) => (
                <div key={groupLabel} className="px-5 py-3.5">
                  <div className="section-label mb-2">{groupLabel}</div>
                  <div className="space-y-2">
                    {list.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-[13px] font-medium">{s.name}</span>
                          <span className="num ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{s.version}</span>
                          <DocStatusPill status={s.status} />
                        </div>
                        <span className="text-[11px] text-muted-foreground">updated {fmtDate(s.updated)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      ) : sub === "esdd" || sub === "esia" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {assessments.length === 0 && (
            <PanelCard className="lg:col-span-2">
              <EmptyState
                title={`No ${sub === "esia" ? "ESIA" : "ESDD"} assessments in this scope`}
                hint={sub === "esia" ? "ESIA covers greenfield builds." : "ESDD covers brownfield acquisitions."}
              />
            </PanelCard>
          )}
          {assessments.map((a) => {
            const findings = ESAP_ACTIONS.filter((x) => x.assessmentId === a.id);
            const open = findings.filter((x) => x.status !== "closed").length;
            return (
              <PanelCard key={a.id}>
                <div className="border-b border-border/60 px-5 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        <A t={a.kind} />
                      </span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {a.projectType}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-semibold",
                        a.status === "complete" ? "text-success" : "text-warning",
                      )}
                    >
                      {a.status === "complete" ? <CircleCheck className="h-3 w-3" aria-hidden /> : <CircleDot className="h-3 w-3" aria-hidden />}
                      {a.status === "complete" ? `Complete · ${fmtDate(a.completedOn!)}` : "In progress"}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-[14px] font-semibold leading-snug tracking-tight">{a.project}</h3>
                </div>
                <div className="space-y-1.5 px-5 py-3.5">
                  <div className="section-label mb-2">Assessment parameters — configurable by project type</div>
                  {a.params.map((p) => {
                    const m = PARAM_ICON[p.result];
                    return (
                      <div key={p.name} className="flex items-center justify-between gap-3 text-[12.5px]">
                        <span className="text-foreground">{p.name}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 font-medium" style={{ color: m.color }}>
                          <m.Icon className="h-3.5 w-3.5" aria-hidden />
                          {m.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-5 py-3">
                  {a.reportDoc ? <DocChip name={a.reportDoc} /> : <span className="text-[11.5px] text-muted-foreground">Report pending</span>}
                  {findings.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSub("esap")}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      {open} open of {findings.length} findings <ArrowUpRight className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </div>
              </PanelCard>
            );
          })}
        </div>
      ) : (
        <PanelCard>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
            <div>
              <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                <FileSearch className="h-4 w-4 text-primary" aria-hidden />
                <A t="ESAP" /> — action register
              </h3>
              <p className="text-[12px] text-muted-foreground">
                A living worklist derived from <A t="ESDD" /> / <A t="ESIA" /> findings — not a static uploaded document.
              </p>
            </div>
            <div className="flex items-center gap-1">
              {(["all", "open", "overdue", "closed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setEsapFilter(f)}
                  aria-pressed={esapFilter === f}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11.5px] font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    esapFilter === f ? "nav-pill-active" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {actions.length === 0 ? (
            <EmptyState title="No actions match" hint="Change the filter or scope." />
          ) : (
            <div className="divide-y divide-border/40">
              {actions.map((a) => {
                const st = esapState(a);
                const owner = personById(a.ownerId);
                const asmt = ASSESSMENTS.find((x) => x.id === a.assessmentId);
                const closed = a.status === "closed";
                return (
                  <div key={a.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3.5", closed && "opacity-60")}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium leading-snug">{a.action}</div>
                      <button
                        type="button"
                        onClick={() => setSub(asmt?.kind === "ESIA" ? "esia" : "esdd")}
                        className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[11.5px] text-muted-foreground underline-offset-2 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        title="Open the source assessment"
                      >
                        <Link2 className="h-3 w-3 shrink-0" aria-hidden />
                        {a.finding} · from {asmt?.kind} — {asmt?.project}
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">{owner?.name}</div>
                        <div className={cn("num text-[12px] font-semibold", st === "overdue" ? "text-destructive" : "text-muted-foreground")}>
                          {closed ? `closed ${fmtDate(a.closedOn!)}` : `due ${fmtDate(a.due)}`}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex w-[86px] items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                          closed
                            ? "bg-success/12 text-success"
                            : st === "overdue"
                              ? "bg-destructive/12 text-destructive"
                              : a.status === "in-progress"
                                ? "bg-warning/14 text-warning"
                                : "bg-muted text-muted-foreground",
                        )}
                      >
                        {closed ? "Closed" : st === "overdue" ? "Overdue" : a.status === "in-progress" ? "In progress" : "Open"}
                      </span>
                      {!closed && audience === "internal" && (
                        <button
                          type="button"
                          onClick={() => advance(a)}
                          className="rounded-lg border border-border/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                          {a.status === "open" ? "Start" : "Close"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PanelCard>
      )}
    </div>
  );
}
