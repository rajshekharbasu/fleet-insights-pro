import { useMemo, useState } from "react";
import { FileSearch, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  daysUntil,
  ESAP_ACTIONS,
  esapActionEntityId,
  esapSourceLabel,
  esapState,
  fmtDate,
  isEsmsSubAvailable,
  personById,
  type EsapAction,
} from "@/lib/esg-data";
import { A, EmptyState, PanelCard, useEsg } from "../primitives";

type EsapFilter = "all" | "open" | "overdue" | "closed";

/**
 * The ESAP action register — a living worklist of corrective actions converging
 * from assessments, audits, and policies. Source-agnostic: each row backlinks to
 * its origin via {@link esapSourceLabel}.
 */
export function EsapPanel({ onOpenSource }: { onOpenSource: (sub: string) => void }) {
  const { scope, audience, policy, audit } = useEsg();
  const [actionOverrides, setActionOverrides] = useState<Record<string, EsapAction["status"]>>({});
  const [filter, setFilter] = useState<EsapFilter>("all");

  const actions = useMemo(() => {
    // Static assessment + audit actions, plus live convergence from approved
    // policies and session-created audit corrective actions.
    const base = [...ESAP_ACTIONS, ...policy.policyEsapActions(), ...audit.auditEsapActions()];
    const withStatus = base.map((a) => ({ ...a, status: actionOverrides[a.id] ?? a.status }));
    const scoped = withStatus.filter((a) => {
      if (!scope.entityId) return true;
      return esapActionEntityId(a) === scope.entityId;
    });
    if (filter === "all") return scoped;
    if (filter === "closed") return scoped.filter((a) => a.status === "closed");
    if (filter === "overdue") return scoped.filter((a) => a.status !== "closed" && daysUntil(a.due) < 0);
    return scoped.filter((a) => a.status !== "closed");
  }, [scope.entityId, filter, actionOverrides, policy, audit]);

  const advance = (a: EsapAction) => {
    const next = a.status === "open" ? "in-progress" : "closed";
    setActionOverrides((o) => ({ ...o, [a.id]: next }));
    toast.success(next === "closed" ? "Action closed" : "Action moved to in-progress", {
      description: `${a.action} (UI stub — will sync when the backend lands)`,
    });
  };

  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <FileSearch className="h-4 w-4 text-primary" aria-hidden />
            <A t="ESAP" /> — action register
          </h3>
          <p className="text-[12px] text-muted-foreground">
            A living worklist converging from <A t="ESDD" /> / <A t="ESIA" /> findings, audit <A t="NC" />s, and approved
            policies — not a static uploaded document.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(["all", "open", "overdue", "closed"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11.5px] font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                filter === f ? "nav-pill-active" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
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
            const src = esapSourceLabel(a.source);
            const linkable = isEsmsSubAvailable(src.sub);
            const closed = a.status === "closed";
            return (
              <div key={a.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3.5", closed && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-[13px] font-medium leading-snug">{a.action}</div>
                    {a.ncRef && (
                      <span className="num shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {a.ncRef}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => linkable && onOpenSource(src.sub)}
                    disabled={!linkable}
                    className={cn(
                      "mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[11.5px] text-muted-foreground underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                      linkable ? "hover:text-primary hover:underline" : "cursor-default",
                    )}
                    title={linkable ? "Open the source" : "Source view lands in a later phase"}
                  >
                    <Link2 className="h-3 w-3 shrink-0" aria-hidden />
                    {a.finding} · from {src.label}
                  </button>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">{owner?.name}</div>
                    <div
                      className={cn(
                        "num text-[12px] font-semibold",
                        st === "overdue" ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
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
  );
}
