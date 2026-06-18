import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle, Building2, Calendar, CheckCircle2, Clock,
  LayoutGrid, List, Table2, Settings2, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlobalReadinessMatrix } from "./GlobalReadinessMatrix";
import { EditCellDialog, type EditCellValue } from "./EditCellDialog";
import { SiteDetailsSheet } from "./SiteDetailsSheet";
import { toast } from "sonner";
import {
  useGlobalStats, useMatrix, usePendingQueue, useUpdateSiteReadiness, useDashboardStats
} from "@/lib/readiness/queries";

type ViewMode = "sites" | "pending" | "matrix";
type EditingCell = { id: string; itemName: string; siteName: string; siteId: string; value: EditCellValue };

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
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export function CeoReadinessDashboard() {
  const { data: stats, isLoading: loadingStats } = useDashboardStats();
  const { data: globalStats, isLoading: loadingGlobal } = useGlobalStats();
  const { data: matrixItems, isLoading: loadingMatrix } = useMatrix();
  const { data: pendingQueue, isLoading: loadingPending } = usePendingQueue();
  const { mutate: updateReadiness, isPending: isUpdating } = useUpdateSiteReadiness();

  const [view, setView] = useState<ViewMode>("sites");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [siteSearch, setSiteSearch] = useState<string>("");
  const [pendingSearch, setPendingSearch] = useState<string>("");
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [selectedSiteForDetails, setSelectedSiteForDetails] = useState<any>(null);

  const openEdit = (cell: EditingCell) => setEditing(cell);

  const { sitesList, siteCards } = useMemo(() => {
    if (!matrixItems) return { sitesList: [], siteCards: [] };
    
    const siteMap = new Map<string, any>();
    
    matrixItems.forEach(m => {
      if (!siteMap.has(m.site_id)) {
        siteMap.set(m.site_id, {
          siteId: m.site_id,
          site: m.site_name,
          readinessPct: 0,
          totalItems: 0,
          doneCount: 0,
          pendingCount: 0,
          overdueCount: 0,
          done: [],
          pending: []
        });
      }

      if (m.status === "NA") return;

      const s = siteMap.get(m.site_id);
      s.totalItems++;
      const isDone = m.status === "YES";
      if (isDone) {
        s.doneCount++;
        s.done.push({ itemId: m.checklist_item_id, readiness_id: m.readiness_id, item: m.checklist_name, status: m.status, deadline: m.deadline });
      } else {
        s.pendingCount++;
        const d = m.deadline ? daysUntil(m.deadline) : Infinity;
        if (d < 0) s.overdueCount++;
        s.pending.push({
          itemId: m.checklist_item_id,
          readiness_id: m.readiness_id,
          item: m.checklist_name,
          site: m.site_name,
          deadline: m.deadline,
          owner: m.owner || "Unassigned",
          daysUntil: m.deadline ? d : 999,
          status: m.status
        });
      }
    });

    const cards = Array.from(siteMap.values());
    cards.forEach(c => {
      c.readinessPct = c.totalItems > 0 ? c.doneCount / c.totalItems : 0;
      c.pending.sort((a: any, b: any) => a.daysUntil - b.daysUntil);
    });

    return {
      sitesList: cards.map(c => c.site).sort(),
      siteCards: cards.sort((a,b) => a.readinessPct - b.readinessPct) // worst first
    };
  }, [matrixItems]);

  const filteredPending = useMemo(() => {
    if (!pendingQueue) return [];
    let items = pendingQueue;
    if (siteFilter !== "all") {
      items = items.filter((p) => p.site_name === siteFilter);
    }
    if (pendingSearch) {
      const lower = pendingSearch.toLowerCase();
      items = items.filter((p) => 
        `${p.site_name} ${p.checklist_name} ${p.team} ${p.owner}`.toLowerCase().includes(lower)
      );
    }
    return items;
  }, [pendingQueue, siteFilter, pendingSearch]);

  if (loadingStats || loadingMatrix || loadingPending || loadingGlobal) {
    return <div className="flex h-[400px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!stats) return null;

  const fleetPct = Math.round(stats.overall_readiness_pct);
  const worstSite = siteCards.length > 0 ? siteCards[0] : null;
  const overdueCount = pendingQueue?.filter(p => p.deadline && daysUntil(p.deadline) < 0).length || 0;
  const due7Count = pendingQueue?.filter(p => p.deadline && daysUntil(p.deadline) >= 0 && daysUntil(p.deadline) <= 7).length || 0;

  const handleSaveCell = (val: EditCellValue) => {
    if (!editing) return;
    let backendStatus = "NA";
    if (val.status === "yes") backendStatus = "YES";
    else if (val.status === "no") backendStatus = "NO";
    updateReadiness(
      { id: editing.id, data: { status: backendStatus, deadline: val.deadline, owner: val.owner, notes: val.notes } },
      {
        onSuccess: () => {
          toast.success("Cell updated");
          setEditing(null);
        },
        onError: (err) => toast.error(err.message)
      }
    );
  };

  return (
    <div className="readiness-executive mx-auto max-w-[1800px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            Executive view
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight md:text-[30px]">
            Site readiness — all locations
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">
            Global status across {sitesList.length} sites. Click any item in site cards to
            edit status and deadline.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border/50 p-0.5">
            <ViewToggle active={view === "sites"} onClick={() => setView("sites")} icon={LayoutGrid} label="All sites" />
            <ViewToggle active={view === "pending"} onClick={() => setView("pending")} icon={List} label="Pending queue" />
            <ViewToggle active={view === "matrix"} onClick={() => setView("matrix")} icon={Table2} label="Global matrix" />
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/readiness/config" preload="intent">
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Configuration
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/readiness/ops">Operations detail</Link>
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryKpi label="Fleet ready" value={`${fleetPct}%`} sub={`${stats.cells_ready} / ${stats.applicable_cells} items`} tone="primary" />
        <SummaryKpi label="Pending" value={String(stats.applicable_cells - stats.cells_ready)} sub="Across all sites" tone="warning" />
        <SummaryKpi label="Overdue" value={String(overdueCount)} sub="Needs escalation" tone="destructive" />
        <SummaryKpi label="Due ≤ 7 days" value={String(due7Count)} sub="Near-term risk" tone="warning" />
        <SummaryKpi label="Sites" value={String(sitesList.length)} sub="In scope" tone="muted" />
        <SummaryKpi label="Lowest readiness" value={worstSite ? `${Math.round(worstSite.readinessPct * 100)}%` : "—"} sub={worstSite?.site ?? "—"} tone="muted" />
      </section>

      {view === "matrix" ? (
        <GlobalReadinessMatrix />
      ) : view === "sites" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/50 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold">Sites Overview</h2>
              <p className="text-[12px] text-muted-foreground">Filter by specific sites</p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search sites by name..."
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                className="h-9 w-56 bg-background/60 text-[12px]"
              />
              <select
                value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}
                className="h-9 rounded-lg border border-border/60 bg-background/60 px-3 text-[12px] outline-none focus:border-primary/40"
              >
                <option value="all">All sites</option>
                {sitesList.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {(() => {
              const filtered = siteCards
                .filter(s => siteFilter === "all" || s.site === siteFilter)
                .filter(s => !siteSearch || s.site.toLowerCase().includes(siteSearch.toLowerCase()));
              
              if (filtered.length === 0) {
                return (
                  <div className="col-span-full rounded-2xl border border-dashed border-border/60 bg-card/20 py-16 text-center">
                    <p className="text-[13px] text-muted-foreground">No sites found matching your search.</p>
                    <Button variant="link" onClick={() => { setSiteSearch(""); setSiteFilter("all"); }} className="mt-2 text-[12px]">
                      Clear filters
                    </Button>
                  </div>
                );
              }
              return filtered.map((site) => (
                <SiteCard key={site.site} site={site} onEdit={openEdit} onViewDetails={() => setSelectedSiteForDetails(site)} />
              ));
            })()}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border/50 bg-card/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold">Fleet-wide pending queue</h2>
              <p className="text-[12px] text-muted-foreground">Sorted by deadline — overdue first</p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search tasks, teams, owners..."
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                className="h-9 w-64 bg-background/60 text-[12px]"
              />
              <select
                value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}
                className="h-9 rounded-lg border border-border/60 bg-background/60 px-3 text-[12px] outline-none focus:border-primary/40"
              >
                <option value="all">All sites</option>
                {sitesList.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="max-h-[70vh] divide-y divide-border/30 overflow-auto">
            {filteredPending.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">No pending items for this filter.</p>
            ) : (
              filteredPending.map((task) => (
                <PendingRow
                  key={`${task.readiness_id}`}
                  task={task}
                  onEdit={() => openEdit({ id: task.readiness_id, itemName: task.checklist_name, siteName: task.site_name, siteId: task.site_id, value: { status: "no", deadline: task.deadline } })}
                />
              ))
            )}
          </div>
        </section>
      )}

      {editing && (
        <EditCellDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          itemName={editing.itemName}
          site={editing.siteName}
          value={editing.value}
          onSave={handleSaveCell}
          isSaving={isUpdating}
        />
      )}

      <SiteDetailsSheet 
        site={selectedSiteForDetails} 
        open={!!selectedSiteForDetails} 
        onClose={() => setSelectedSiteForDetails(null)} 
        onEdit={openEdit} 
      />
    </div>
  );
}

function SiteCard({ site, onEdit, onViewDetails }: { site: any; onEdit: (cell: EditingCell) => void; onViewDetails: () => void; }) {
  const pct = Math.round(site.readinessPct * 100);
  const barColor = pct >= 70 ? "bg-success" : pct >= 45 ? "bg-primary" : pct >= 20 ? "bg-warning" : "bg-destructive";

  return (
    <article className="flex flex-col rounded-2xl border border-border/50 bg-card/60">
      <button 
        type="button" 
        onClick={onViewDetails}
        className="w-full text-left border-b border-border/40 px-4 py-4 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">{site.site}</h3>
              <p className="text-[11px] text-muted-foreground">{site.doneCount} done · {site.pendingCount} pending</p>
            </div>
          </div>
          <span className="num text-[22px] font-semibold">{pct}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        {site.overdueCount > 0 && (
          <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-destructive">
            <AlertTriangle className="h-3 w-3" /> {site.overdueCount} overdue
          </p>
        )}
      </button>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border/30 bg-success/5 px-4 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-success">
            <CheckCircle2 className="h-3 w-3" /> Done ({site.doneCount})
          </div>
        </div>
        <ul className="max-h-[100px] space-y-1 overflow-auto px-4 py-2">
          {site.done.length === 0 ? (
            <li className="text-[11px] text-muted-foreground">No items complete yet</li>
          ) : site.done.length > 8 ? (
            <li className="text-[11px] text-muted-foreground">{site.doneCount} workstreams complete</li>
          ) : (
            site.done.map((d: any) => (
              <li key={d.readiness_id}>
                <button
                  type="button"
                  onClick={() => onEdit({ id: d.readiness_id, itemName: d.item, siteName: site.site, siteId: site.siteId, value: { status: "yes", deadline: d.deadline } })}
                  className="w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-muted-foreground transition hover:bg-muted/40 hover:text-foreground before:mr-1.5 before:text-success before:content-['✓']"
                >
                  {d.item}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="border-y border-border/30 bg-destructive/5 px-4 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
            <Clock className="h-3 w-3" /> Pending ({site.pendingCount})
          </div>
        </div>
        <ul className="max-h-[220px] flex-1 overflow-auto px-3 py-2 space-y-2">
          {site.pending.length === 0 ? (
            <li className="px-1 py-2 text-[11px] text-muted-foreground">All applicable items complete</li>
          ) : (
            site.pending.map((task: any) => (
              <SitePendingItem
                key={task.readiness_id}
                task={task}
                onEdit={() => onEdit({ id: task.readiness_id, itemName: task.item, siteName: site.site, siteId: site.siteId, value: { status: "no", deadline: task.deadline } })}
              />
            ))
          )}
        </ul>
      </div>
    </article>
  );
}

function SitePendingItem({ task, onEdit }: { task: any; onEdit: () => void }) {
  const badge = deadlineBadge(task.daysUntil);
  const toneClass = badge.tone === "overdue" ? "bg-destructive/12 text-destructive ring-destructive/25" : badge.tone === "soon" ? "bg-warning/15 text-warning-foreground ring-warning/30" : "bg-muted/50 text-muted-foreground ring-border/40";
  return (
    <li>
      <button type="button" onClick={onEdit} className="w-full rounded-lg border border-border/30 bg-background/40 px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-muted/30">
        <div className="text-[12px] font-medium leading-snug">{task.item}</div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" /> {task.deadline ? formatDeadlineLabel(task.deadline) : "No date"}
          </span>
          {task.deadline && <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${toneClass}`}>{badge.label}</span>}
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">{task.owner}</div>
      </button>
    </li>
  );
}

function PendingRow({ task, onEdit }: { task: any; onEdit: () => void }) {
  const d = task.deadline ? daysUntil(task.deadline) : Infinity;
  const badge = task.deadline ? deadlineBadge(d) : null;
  const toneClass = badge?.tone === "overdue" ? "bg-destructive/12 text-destructive ring-destructive/25" : badge?.tone === "soon" ? "bg-warning/15 text-warning-foreground ring-warning/30" : "bg-muted/50 text-muted-foreground ring-border/40";
  return (
    <button type="button" onClick={onEdit} className="flex w-full flex-wrap items-center gap-4 pl-5 pr-8 py-3 text-left transition hover:bg-muted/20">
      <span className="w-20 shrink-0 text-[12px] font-semibold">{task.site_name}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{task.checklist_name}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{task.team} · {task.owner || "Unassigned"} · {task.priority}</div>
      </div>
      <div className="text-right">
        <div className="text-[12px] font-medium">{task.deadline ? formatDeadlineLabel(task.deadline) : "—"}</div>
        {badge && <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${toneClass}`}>{badge.label}</span>}
      </div>
    </button>
  );
}

function SummaryKpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "primary" | "warning" | "destructive" | "muted"; }) {
  const tones: Record<string, string> = { primary: "border-primary/25 bg-primary/5", warning: "border-warning/30 bg-warning/8", destructive: "border-destructive/30 bg-destructive/8", muted: "border-border/40 bg-card/40" };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="num mt-1 text-[22px] font-semibold">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function ViewToggle({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string; }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
