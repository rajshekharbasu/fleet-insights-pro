import { ArrowUpRight, CircleCheck, CircleDashed, CircleDot, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { ASSESSMENTS, ESAP_ACTIONS, fmtDate } from "@/lib/esg-data";
import { A, DocChip, EmptyState, PanelCard, useEsg } from "../primitives";

const PARAM_ICON = {
  ok: { Icon: CircleCheck, color: "var(--color-success)", label: "Adequate" },
  gap: { Icon: TriangleAlert, color: "var(--color-warning)", label: "Gap found" },
  pending: { Icon: CircleDashed, color: "var(--color-muted-foreground)", label: "Pending" },
} as const;

/** ESDD / ESIA assessment cards. `kind` selects which study type this panel shows. */
export function AssessmentsPanel({ kind, onOpenEsap }: { kind: "ESDD" | "ESIA"; onOpenEsap: () => void }) {
  const { scope } = useEsg();
  const assessments = ASSESSMENTS.filter((a) => !scope.entityId || a.entityId === scope.entityId).filter(
    (a) => a.kind === kind,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {assessments.length === 0 && (
        <PanelCard className="lg:col-span-2">
          <EmptyState
            title={`No ${kind} assessments in this scope`}
            hint={kind === "ESIA" ? "ESIA covers greenfield builds." : "ESDD covers brownfield acquisitions."}
          />
        </PanelCard>
      )}
      {assessments.map((a) => {
        const findings = ESAP_ACTIONS.filter((x) => x.source.kind === "assessment" && x.source.id === a.id);
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
                  {a.status === "complete" ? (
                    <CircleCheck className="h-3 w-3" aria-hidden />
                  ) : (
                    <CircleDot className="h-3 w-3" aria-hidden />
                  )}
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
              {a.reportDoc ? (
                <DocChip name={a.reportDoc} />
              ) : (
                <span className="text-[11.5px] text-muted-foreground">Report pending</span>
              )}
              {findings.length > 0 && (
                <button
                  type="button"
                  onClick={onOpenEsap}
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
  );
}
