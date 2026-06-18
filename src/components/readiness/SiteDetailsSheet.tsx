import { Building2, Calendar, CheckCircle2, Clock, AlertTriangle, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { type EditCellValue } from "./EditCellDialog";

function daysUntil(isoDate: string) {
  if (!isoDate) return 0;
  const [y, m, d] = isoDate.split('T')[0].split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const now = new Date();
  date.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  return Math.round((date.getTime() - now.getTime()) / 86400000);
}

function deadlineBadge(days: number) {
  if (days < 0) return { tone: "overdue", label: `${Math.abs(days)}d overdue` };
  if (days === 0) return { tone: "soon", label: "Due today" };
  if (days <= 7) return { tone: "soon", label: `Due in ${days}d` };
  return { tone: "normal", label: `Due in ${days}d` };
}

function formatDeadlineLabel(isoDate: string) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split('T')[0].split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function SiteDetailsSheet({ 
  site, 
  open, 
  onClose,
  onEdit 
}: { 
  site: any; 
  open: boolean; 
  onClose: () => void;
  onEdit: (cell: { id: string; itemName: string; siteName: string; siteId: string; value: EditCellValue }) => void;
}) {
  if (!site) return null;

  const pct = Math.round(site.readinessPct * 100);
  const barColor = pct >= 70 ? "bg-success" : pct >= 45 ? "bg-primary" : pct >= 20 ? "bg-warning" : "bg-destructive";
  const textColor = pct >= 70 ? "text-success" : pct >= 45 ? "text-primary" : pct >= 20 ? "text-warning" : "text-destructive";

  return (
    <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 border-l border-border/40">
        <div className="flex flex-col min-h-full bg-background/50 backdrop-blur-md">
          <SheetHeader className="sticky top-0 z-10 px-6 py-5 border-b border-border/40 bg-card/80 backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle className="text-xl">{site.site}</SheetTitle>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {site.totalItems} total workstreams · {site.doneCount} completed
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Readiness</div>
                <div className={`mt-1 text-2xl font-semibold ${textColor}`}>{pct}%</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-warning-foreground">Pending</div>
                <div className="mt-1 text-2xl font-semibold">{site.pendingCount}</div>
              </div>
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-destructive">Overdue</div>
                <div className="mt-1 text-2xl font-semibold">{site.overdueCount}</div>
              </div>
            </div>
          </SheetHeader>

          <div className="p-6 space-y-8">
            {/* PENDING ITEMS */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-warning/15 text-warning-foreground">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight">Pending Tasks</h3>
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {site.pendingCount}
                </span>
              </div>
              
              <div className="space-y-2.5">
                {site.pending.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground bg-muted/20 rounded-xl p-4 text-center border border-dashed border-border/40">
                    All applicable tasks are complete!
                  </p>
                ) : (
                  site.pending.map((task: any) => {
                    const badge = deadlineBadge(task.daysUntil);
                    const toneClass = badge.tone === "overdue" ? "bg-destructive/12 text-destructive ring-destructive/25" : badge.tone === "soon" ? "bg-warning/15 text-warning-foreground ring-warning/30" : "bg-muted/50 text-muted-foreground ring-border/40";
                    
                    return (
                      <button 
                        key={task.readiness_id}
                        type="button" 
                        onClick={() => onEdit({ id: task.readiness_id, itemName: task.item, siteName: site.site, siteId: site.siteId, value: { status: "no", deadline: task.deadline } })}
                        className="group flex w-full flex-col items-start gap-2 rounded-xl border border-border/40 bg-card/40 p-4 text-left transition-all hover:border-primary/40 hover:bg-card hover:shadow-sm"
                      >
                        <div className="flex w-full items-start justify-between gap-4">
                          <div className="text-[14px] font-medium leading-snug group-hover:text-primary transition-colors">
                            {task.item}
                          </div>
                          {task.deadline && (
                            <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${toneClass}`}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                              {task.owner ? task.owner[0].toUpperCase() : "?"}
                            </span>
                            {task.owner || "Unassigned"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {task.deadline ? formatDeadlineLabel(task.deadline) : "No date set"}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </section>

            {/* DONE ITEMS */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-success/15 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight">Completed</h3>
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {site.doneCount}
                </span>
              </div>
              
              <div className="rounded-xl border border-border/40 bg-card/40 divide-y divide-border/30 overflow-hidden">
                {site.done.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground p-4 text-center">
                    No items completed yet.
                  </p>
                ) : (
                  site.done.map((d: any) => (
                    <button
                      key={d.readiness_id}
                      type="button"
                      onClick={() => onEdit({ id: d.readiness_id, itemName: d.item, siteName: site.site, siteId: site.siteId, value: { status: "yes", deadline: d.deadline } })}
                      className="w-full flex items-center justify-between p-3 text-left transition hover:bg-muted/40 group"
                    >
                      <span className="text-[13px] font-medium text-muted-foreground group-hover:text-foreground">
                        {d.item}
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-success opacity-70 group-hover:opacity-100" />
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
