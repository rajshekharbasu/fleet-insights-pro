import { Fragment, useMemo, useState } from "react";
import { EditCellDialog, type EditCellValue } from "./EditCellDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMatrix, useSites, useUpdateSiteReadiness, useChecklistItems } from "@/lib/readiness/queries";
import { Loader2 } from "lucide-react";

const depotStartBorder = "border-l-[4px] border-foreground/55";
const depotGroupBg = (index: number) => index % 2 === 0 ? "bg-muted/12" : "bg-muted/28";

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

function CellBadge({ v }: { v: "yes" | "no" | "na" }) {
  if (v === "yes")
    return <span className="inline-flex h-5 min-w-[2rem] items-center justify-center rounded bg-success/15 px-1 text-[9px] font-bold text-success">Y</span>;
  if (v === "no")
    return <span className="inline-flex h-5 min-w-[2rem] items-center justify-center rounded bg-destructive/12 px-1 text-[9px] font-bold text-destructive">N</span>;
  return <span className="inline-flex h-5 min-w-[2rem] items-center justify-center rounded bg-muted/50 px-1 text-[9px] font-bold text-muted-foreground">N/A</span>;
}

export function GlobalReadinessMatrix() {
  const { data: matrixItems, isLoading: loadingMatrix } = useMatrix();
  const { data: sitesDropdown, isLoading: loadingSites } = useSites();
  const { data: checklistData } = useChecklistItems();
  const { mutate: updateReadiness, isPending: isUpdating } = useUpdateSiteReadiness();

  const [editing, setEditing] = useState<{
    id: string;
    itemName: string;
    siteName: string;
    siteId: string;
    value: EditCellValue;
  } | null>(null);

  const { sites, items } = useMemo(() => {
    if (!matrixItems) return { sites: [], items: [] };
    
    const uniqueSites = new Set<string>();
    if (sitesDropdown) {
      sitesDropdown.forEach(s => uniqueSites.add(s.name));
    }
    matrixItems.forEach(m => {
      if (m.site_name) uniqueSites.add(m.site_name);
    });
    const siteNames = Array.from(uniqueSites);
    
    const itemMap = new Map<string, any>();
    
    matrixItems.forEach(m => {
      if (!itemMap.has(m.checklist_item_id)) {
        itemMap.set(m.checklist_item_id, {
          id: m.checklist_item_id,
          item: m.checklist_name,
          category: m.spend_type,
          team: m.team,
          cells: {}
        });
      }
      const row = itemMap.get(m.checklist_item_id);
      row.cells[m.site_name] = {
        readiness_id: m.readiness_id,
        site_id: m.site_id,
        status: m.status === "YES" ? "yes" : (m.status === "NO" ? "no" : "na"),
        deadline: m.deadline,
        notes: null
      };
    });

    return { sites: siteNames, items: Array.from(itemMap.values()) };
  }, [matrixItems, sitesDropdown]);

  const colPairs = useMemo(
    () =>
      sites.flatMap((site) => [
        { key: `${site}-status`, site, kind: "status" as const },
        { key: `${site}-due`, site, kind: "due" as const },
      ]),
    [sites]
  );

  if (loadingMatrix || loadingSites) {
    return <div className="flex h-[300px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

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
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card/40">
      <div className="border-b border-border/40 px-4 py-3">
        <h2 className="text-[15px] font-semibold">Global matrix</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Checklist items in rows · each site has <strong>Status</strong> and <strong>Deadline</strong> columns. Click a cell to edit.
        </p>
      </div>
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full min-w-max border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30">
              <th rowSpan={2} className="sticky left-0 z-20 min-w-[220px] border-r border-border/40 bg-muted/95 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">
                Checklist item
              </th>
              <th rowSpan={2} className="min-w-[100px] border-r border-border/30 px-2 py-2 text-left text-[10px] font-semibold uppercase">
                Team
              </th>
              <th rowSpan={2} className="min-w-[72px] border-r border-border/30 px-2 py-2 text-center text-[10px] font-semibold uppercase">
                SLA (days)
              </th>
              {sites.map((site, siteIndex) => (
                <th key={site} colSpan={2} className={cn(depotStartBorder, depotGroupBg(siteIndex), "border-r border-foreground/25 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-primary")}>
                  {site}
                </th>
              ))}
            </tr>
            <tr className="border-b border-border/40 bg-muted/20 text-[9px] uppercase text-muted-foreground">
              {colPairs.map((col, colIndex) => {
                const siteIndex = Math.floor(colIndex / 2);
                return (
                  <th key={col.key} className={cn(
                    col.kind === "status" && depotStartBorder,
                    col.kind === "due" && "border-l border-border/50",
                    col.kind === "due" && siteIndex < sites.length - 1 && "border-r border-foreground/20",
                    depotGroupBg(siteIndex),
                    "px-1 py-1.5 font-medium",
                    col.kind === "status" ? "min-w-[52px]" : "min-w-[88px]"
                  )}>
                    {col.kind === "status" ? "St" : "Due"}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const master = checklistData?.items.find(m => m.id === row.id);
              const sla = master?.default_sla_days;
              return (
                <tr key={row.id} className="border-b border-border/25 hover:bg-muted/15">
                  <td className="sticky left-0 z-10 border-r border-border/30 bg-card/95 px-3 py-2 backdrop-blur-sm">
                    <div className="font-medium leading-snug">{row.item}</div>
                    <div className="text-[10px] text-muted-foreground">{row.category}</div>
                  </td>
                  <td className="border-r border-border/20 px-2 py-2 text-muted-foreground">{row.team}</td>
                  <td className="border-r border-border/20 px-2 py-2 text-center tabular-nums text-muted-foreground">{sla != null ? sla : "—"}</td>
                  {sites.map((site, siteIndex) => {
                    const cell = row.cells[site];
                    if (!cell) return <Fragment key={`${row.id}-${site}`}><td /><td /></Fragment>;
                    
                    const deadline = cell.deadline;
                    const days = deadline ? daysUntil(deadline) : null;
                    const badge = days != null ? deadlineBadge(days) : null;
                    
                    return (
                      <Fragment key={`${row.id}-${site}`}>
                        <td className={cn(depotStartBorder, depotGroupBg(siteIndex), "px-1 py-1.5 text-center align-middle")}>
                          <button type="button" className="rounded p-0.5 hover:bg-muted/50" onClick={() => setEditing({ id: cell.readiness_id, itemName: row.item, siteName: site, siteId: cell.site_id, value: cell })}>
                            <CellBadge v={cell.status} />
                          </button>
                        </td>
                        <td className={cn("border-l border-border/50 px-1.5 py-1.5 align-middle", depotGroupBg(siteIndex), siteIndex < sites.length - 1 && "border-r border-foreground/20")}>
                          {cell.status === "yes" ? (
                            <button type="button" className="block w-full text-left hover:bg-muted/40 rounded px-1 py-0.5" onClick={() => setEditing({ id: cell.readiness_id, itemName: row.item, siteName: site, siteId: cell.site_id, value: cell })}>
                              <div className="whitespace-nowrap tabular-nums text-muted-foreground/60">{deadline ? formatDeadlineLabel(deadline) : "—"}</div>
                              <div className="text-[9px] text-success/70">Done</div>
                            </button>
                          ) : deadline ? (
                            <button type="button" className="block w-full text-left hover:bg-muted/40 rounded px-1 py-0.5" onClick={() => setEditing({ id: cell.readiness_id, itemName: row.item, siteName: site, siteId: cell.site_id, value: cell })}>
                              <div className="whitespace-nowrap tabular-nums">{formatDeadlineLabel(deadline)}</div>
                              {badge && <div className={`text-[9px] ${badge.tone === "overdue" ? "text-destructive" : badge.tone === "soon" ? "text-warning" : "text-muted-foreground"}`}>{badge.label}</div>}
                            </button>
                          ) : (
                            <button type="button" className="text-[10px] text-primary hover:underline" onClick={() => setEditing({ id: cell.readiness_id, itemName: row.item, siteName: site, siteId: cell.site_id, value: cell })}>
                              Set date
                            </button>
                          )}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}
