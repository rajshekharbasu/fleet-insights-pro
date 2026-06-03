import { Fragment, useMemo, useState } from "react";
import { daysUntil } from "@/lib/readiness-data";
import {
  deadlineBadge,
  formatDeadlineLabel,
} from "@/lib/readiness-analytics";
import { useReadinessConfig } from "@/lib/readiness-store";
import type { Site } from "@/lib/readiness-config";
import { EditCellDialog } from "./EditCellDialog";
import { cn } from "@/lib/utils";

/** Strong vertical rule between depot column groups */
const depotStartBorder = "border-l-[4px] border-foreground/55";
const depotGroupBg = (index: number) =>
  index % 2 === 0 ? "bg-muted/12" : "bg-muted/28";

function CellBadge({ v }: { v: "yes" | "no" | "na" }) {
  if (v === "yes")
    return (
      <span className="inline-flex h-5 min-w-[2rem] items-center justify-center rounded bg-success/15 px-1 text-[9px] font-bold text-success">
        Y
      </span>
    );
  if (v === "no")
    return (
      <span className="inline-flex h-5 min-w-[2rem] items-center justify-center rounded bg-destructive/12 px-1 text-[9px] font-bold text-destructive">
        N
      </span>
    );
  return (
    <span className="inline-flex h-5 min-w-[2rem] items-center justify-center rounded bg-muted/50 px-1 text-[9px] text-muted-foreground">
      —
    </span>
  );
}

export function GlobalReadinessMatrix() {
  const { cfg, items, sites, getCell, setCell } = useReadinessConfig();
  const [editing, setEditing] = useState<{
    itemId: number;
    itemName: string;
    site: Site;
  } | null>(null);

  const colPairs = useMemo(
    () =>
      sites.flatMap((site) => [
        { key: `${site}-status`, site, kind: "status" as const },
        { key: `${site}-due`, site, kind: "due" as const },
      ]),
    [sites],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card/40">
      <div className="border-b border-border/40 px-4 py-3">
        <h2 className="text-[15px] font-semibold">Global matrix</h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Checklist items in rows · each depot has <strong>Status</strong> and{" "}
          <strong>Deadline</strong> columns. Click a cell to edit.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30">
              <th
                rowSpan={2}
                className="sticky left-0 z-20 min-w-[220px] border-r border-border/40 bg-muted/95 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider"
              >
                Checklist item
              </th>
              <th
                rowSpan={2}
                className="min-w-[100px] border-r border-border/30 px-2 py-2 text-left text-[10px] font-semibold uppercase"
              >
                Team
              </th>
              <th
                rowSpan={2}
                className="min-w-[72px] border-r border-border/30 px-2 py-2 text-center text-[10px] font-semibold uppercase"
              >
                SLA (days)
              </th>
              {sites.map((site, siteIndex) => (
                <th
                  key={site}
                  colSpan={2}
                  className={cn(
                    depotStartBorder,
                    depotGroupBg(siteIndex),
                    "border-r border-foreground/25 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-primary",
                  )}
                >
                  {site}
                </th>
              ))}
            </tr>
            <tr className="border-b border-border/40 bg-muted/20 text-[9px] uppercase text-muted-foreground">
              {colPairs.map((col, colIndex) => {
                const siteIndex = Math.floor(colIndex / 2);
                return (
                  <th
                    key={col.key}
                    className={cn(
                      col.kind === "status" && depotStartBorder,
                      col.kind === "due" && "border-l border-border/50",
                      col.kind === "due" && siteIndex < sites.length - 1 && "border-r border-foreground/20",
                      depotGroupBg(siteIndex),
                      "px-1 py-1.5 font-medium",
                      col.kind === "status" ? "min-w-[52px]" : "min-w-[88px]",
                    )}
                  >
                    {col.kind === "status" ? "St" : "Due"}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const master = cfg.masterChecklist?.find((m) => m.id === row.id);
              const sla = master?.defaultSlaDays;
              return (
                <tr key={row.id} className="border-b border-border/25 hover:bg-muted/15">
                  <td className="sticky left-0 z-10 border-r border-border/30 bg-card/95 px-3 py-2 backdrop-blur-sm">
                    <div className="font-medium leading-snug">{row.item}</div>
                    <div className="text-[10px] text-muted-foreground">{row.category}</div>
                  </td>
                  <td className="border-r border-border/20 px-2 py-2 text-muted-foreground">
                    {row.team}
                  </td>
                  <td className="border-r border-border/20 px-2 py-2 text-center tabular-nums text-muted-foreground">
                    {sla != null ? sla : "—"}
                  </td>
                  {sites.map((site, siteIndex) => {
                    const cell = getCell(row.id, site);
                    const deadline =
                      cell.deadline ??
                      (cell.status !== "yes" ? row.deadline : undefined);
                    const days = deadline ? daysUntil(deadline) : null;
                    const badge = days != null ? deadlineBadge(days) : null;
                    return (
                      <Fragment key={`${row.id}-${site}`}>
                        <td
                          className={cn(
                            depotStartBorder,
                            depotGroupBg(siteIndex),
                            "px-1 py-1.5 text-center align-middle",
                          )}
                        >
                          <button
                            type="button"
                            className="rounded p-0.5 hover:bg-muted/50"
                            onClick={() =>
                              setEditing({ itemId: row.id, itemName: row.item, site })
                            }
                          >
                            <CellBadge v={cell.status} />
                          </button>
                        </td>
                        <td
                          className={cn(
                            "border-l border-border/50 px-1.5 py-1.5 align-middle",
                            depotGroupBg(siteIndex),
                            siteIndex < sites.length - 1 && "border-r border-foreground/20",
                          )}
                        >
                          {cell.status === "yes" ? (
                            <span className="text-muted-foreground/50">—</span>
                          ) : deadline ? (
                            <button
                              type="button"
                              className="block w-full text-left hover:bg-muted/40 rounded px-1 py-0.5"
                              onClick={() =>
                                setEditing({ itemId: row.id, itemName: row.item, site })
                              }
                            >
                              <div className="whitespace-nowrap tabular-nums">
                                {formatDeadlineLabel(deadline)}
                              </div>
                              {badge && (
                                <div
                                  className={`text-[9px] ${
                                    badge.tone === "overdue"
                                      ? "text-destructive"
                                      : badge.tone === "soon"
                                        ? "text-warning"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {badge.label}
                                </div>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-[10px] text-primary hover:underline"
                              onClick={() =>
                                setEditing({ itemId: row.id, itemName: row.item, site })
                              }
                            >
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
          site={editing.site}
          value={getCell(editing.itemId, editing.site)}
          onSave={(v) => setCell(editing.itemId, editing.site, v)}
        />
      )}
    </div>
  );
}
