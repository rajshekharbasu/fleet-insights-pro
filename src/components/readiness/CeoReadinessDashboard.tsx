import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  Table2,
  Settings2,
} from "lucide-react";
import {
  buildExecutiveModel,
  deadlineBadge,
  formatDeadlineLabel,
  type SiteExecutiveView,
  type SiteTask,
} from "@/lib/readiness-analytics";
import { useReadinessConfig } from "@/lib/readiness-store";
import type { Site } from "@/lib/readiness-config";
import { Button } from "@/components/ui/button";
import { GlobalReadinessMatrix } from "./GlobalReadinessMatrix";
import { EditCellDialog } from "./EditCellDialog";

type ViewMode = "sites" | "pending" | "matrix";

type EditingCell = { itemId: number; itemName: string; site: Site };

export function CeoReadinessDashboard() {
  const { cfg, getCell, setCell } = useReadinessConfig();
  const model = useMemo(() => buildExecutiveModel(cfg), [cfg]);
  const [view, setView] = useState<ViewMode>("sites");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [editing, setEditing] = useState<EditingCell | null>(null);

  const openEdit = (cell: EditingCell) => setEditing(cell);

  const filteredPending = useMemo(() => {
    if (siteFilter === "all") return model.allPending;
    return model.allPending.filter((p) => p.site === siteFilter);
  }, [model.allPending, siteFilter]);

  const fleetPct = Math.round(model.summary.fleetReadinessPct * 100);

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
            Global status across {model.summary.siteCount} sites. Click any item in site cards to
            edit status and deadline.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border/50 p-0.5">
            <ViewToggle
              active={view === "sites"}
              onClick={() => setView("sites")}
              icon={LayoutGrid}
              label="All sites"
            />
            <ViewToggle
              active={view === "pending"}
              onClick={() => setView("pending")}
              icon={List}
              label="Pending queue"
            />
            <ViewToggle
              active={view === "matrix"}
              onClick={() => setView("matrix")}
              icon={Table2}
              label="Global matrix"
            />
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
        <SummaryKpi
          label="Fleet ready"
          value={`${fleetPct}%`}
          sub={`${model.summary.totalDone} / ${model.summary.totalApplicable} items`}
          tone="primary"
        />
        <SummaryKpi
          label="Pending"
          value={String(model.summary.totalPending)}
          sub="Across all sites"
          tone="warning"
        />
        <SummaryKpi
          label="Overdue"
          value={String(model.summary.overdueCount)}
          sub="Needs escalation"
          tone="destructive"
        />
        <SummaryKpi
          label="Due ≤ 7 days"
          value={String(model.summary.dueWithin7Days)}
          sub="Near-term risk"
          tone="warning"
        />
        <SummaryKpi
          label="Sites"
          value={String(model.summary.siteCount)}
          sub="In scope"
          tone="muted"
        />
        <SummaryKpi
          label="Lowest readiness"
          value={model.summary.worstSite ? `${Math.round(model.summary.worstSite.readinessPct * 100)}%` : "—"}
          sub={model.summary.worstSite?.site ?? "—"}
          tone="muted"
        />
      </section>

      {view === "matrix" ? (
        <GlobalReadinessMatrix />
      ) : view === "sites" ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {model.sites.map((site) => (
            <SiteCard key={site.site} site={site} onEdit={openEdit} />
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border border-border/50 bg-card/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold">Fleet-wide pending queue</h2>
              <p className="text-[12px] text-muted-foreground">
                Sorted by deadline — overdue first
              </p>
            </div>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="h-9 rounded-lg border border-border/60 bg-background/60 px-3 text-[12px] outline-none focus:border-primary/40"
            >
              <option value="all">All sites</option>
              {model.sites.map((s) => (
                <option key={s.site} value={s.site}>
                  {s.site}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-[70vh] divide-y divide-border/30 overflow-auto">
            {filteredPending.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">
                No pending items for this filter.
              </p>
            ) : (
              filteredPending.map((task) => (
                <PendingRow
                  key={`${task.site}-${task.itemId}`}
                  task={task}
                  onEdit={() =>
                    openEdit({ itemId: task.itemId, itemName: task.item, site: task.site })
                  }
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
          site={editing.site}
          value={getCell(editing.itemId, editing.site)}
          onSave={(v) => setCell(editing.itemId, editing.site, v)}
        />
      )}
    </div>
  );
}

function SiteCard({
  site,
  onEdit,
}: {
  site: SiteExecutiveView;
  onEdit: (cell: EditingCell) => void;
}) {
  const pct = Math.round(site.readinessPct * 100);
  const barColor =
    pct >= 70 ? "bg-success" : pct >= 45 ? "bg-primary" : pct >= 20 ? "bg-warning" : "bg-destructive";

  return (
    <article className="flex flex-col rounded-2xl border border-border/50 bg-card/60">
      <div className="border-b border-border/40 px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight">{site.site}</h3>
              <p className="text-[11px] text-muted-foreground">
                {site.doneCount} done · {site.pendingCount} pending
              </p>
            </div>
          </div>
          <span className="num text-[22px] font-semibold">{pct}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        {site.overdueCount > 0 && (
          <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {site.overdueCount} overdue
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border/30 bg-success/5 px-4 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-success">
            <CheckCircle2 className="h-3 w-3" />
            Done ({site.doneCount})
          </div>
        </div>
        <ul className="max-h-[100px] space-y-1 overflow-auto px-4 py-2">
          {site.done.length === 0 ? (
            <li className="text-[11px] text-muted-foreground">No items complete yet</li>
          ) : site.done.length > 8 ? (
            <li className="text-[11px] text-muted-foreground">
              {site.doneCount} workstreams complete
            </li>
          ) : (
            site.done.map((d) => (
              <li key={d.itemId}>
                <button
                  type="button"
                  onClick={() =>
                    onEdit({ itemId: d.itemId, itemName: d.item, site: site.site })
                  }
                  className="w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-muted-foreground transition hover:bg-muted/40 hover:text-foreground before:mr-1.5 before:text-success before:content-['✓']"
                  title="Click to change status or deadline"
                >
                  {d.item}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="border-y border-border/30 bg-destructive/5 px-4 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
            <Clock className="h-3 w-3" />
            Pending ({site.pendingCount})
          </div>
        </div>
        <ul className="max-h-[220px] flex-1 overflow-auto px-3 py-2">
          {site.pending.length === 0 ? (
            <li className="px-1 py-2 text-[11px] text-muted-foreground">All applicable items complete</li>
          ) : (
            site.pending.map((task) => (
              <SitePendingItem
                key={task.itemId}
                task={task}
                onEdit={() =>
                  onEdit({ itemId: task.itemId, itemName: task.item, site: task.site })
                }
              />
            ))
          )}
        </ul>
      </div>
    </article>
  );
}

function SitePendingItem({ task, onEdit }: { task: SiteTask; onEdit: () => void }) {
  const badge = deadlineBadge(task.daysUntil);
  const toneClass =
    badge.tone === "overdue"
      ? "bg-destructive/12 text-destructive ring-destructive/25"
      : badge.tone === "soon"
        ? "bg-warning/15 text-warning-foreground ring-warning/30"
        : "bg-muted/50 text-muted-foreground ring-border/40";

  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        className="w-full rounded-lg border border-border/30 bg-background/40 px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-muted/30"
        title="Click to edit status and deadline"
      >
      <div className="text-[12px] font-medium leading-snug">{task.item}</div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatDeadlineLabel(task.deadline)}
        </span>
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${toneClass}`}>
          {badge.label}
        </span>
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{task.owner}</div>
      </button>
    </li>
  );
}

function PendingRow({ task, onEdit }: { task: SiteTask; onEdit: () => void }) {
  const badge = deadlineBadge(task.daysUntil);
  const toneClass =
    badge.tone === "overdue"
      ? "bg-destructive/12 text-destructive ring-destructive/25"
      : badge.tone === "soon"
        ? "bg-warning/15 text-warning-foreground ring-warning/30"
        : "bg-muted/50 text-muted-foreground ring-border/40";

  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full flex-wrap items-center gap-4 px-5 py-3 text-left transition hover:bg-muted/20"
      title="Click to edit"
    >
      <span className="w-16 shrink-0 text-[12px] font-semibold">{task.site}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{task.item}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {task.team} · {task.owner} · {task.priority}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[12px] font-medium">{formatDeadlineLabel(task.deadline)}</div>
        <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${toneClass}`}>
          {badge.label}
        </span>
      </div>
    </button>
  );
}

function SummaryKpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "primary" | "warning" | "destructive" | "muted";
}) {
  const tones: Record<string, string> = {
    primary: "border-primary/25 bg-primary/5",
    warning: "border-warning/30 bg-warning/8",
    destructive: "border-destructive/30 bg-destructive/8",
    muted: "border-border/40 bg-card/40",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="num mt-1 text-[22px] font-semibold">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
