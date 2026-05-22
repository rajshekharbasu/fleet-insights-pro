/**
 * Executive & ops aggregations — merges sheet seed + readiness-store overrides.
 * All readiness UI should read from here (not raw READINESS_ITEMS + ad-hoc getCell).
 */

import {
  READINESS_ITEMS,
  SITES,
  daysUntil,
  type ReadinessItem,
  type Site,
} from "@/lib/readiness-data";
import type { ConfigShape } from "@/lib/readiness-store";
import { effectiveCells } from "@/lib/readiness-store";

export type SiteTask = {
  itemId: number;
  item: string;
  site: Site;
  team: string;
  owner: string;
  priority: ReadinessItem["priority"];
  deadline: string;
  daysUntil: number;
  overdue: boolean;
};

export type DoneItemRef = { itemId: number; item: string };

export type SiteExecutiveView = {
  site: Site;
  doneCount: number;
  pendingCount: number;
  notApplicableCount: number;
  applicable: number;
  readinessPct: number;
  done: DoneItemRef[];
  pending: SiteTask[];
  overdueCount: number;
  nextDeadline: string | null;
};

export type ExecutiveSummary = {
  fleetReadinessPct: number;
  totalDone: number;
  totalPending: number;
  totalApplicable: number;
  siteCount: number;
  overdueCount: number;
  dueWithin7Days: number;
  worstSite: SiteExecutiveView | null;
};

export type ExecutiveReadinessModel = {
  summary: ExecutiveSummary;
  sites: SiteExecutiveView[];
  allPending: SiteTask[];
};

function effectiveDeadline(
  item: ReadinessItem,
  site: Site,
  cfg: ConfigShape,
): string {
  const cellKey = `${item.id}::${site}`;
  const cell = cfg.cells[cellKey];
  const itemOverride = cfg.itemOverrides[item.id];
  return cell?.deadline ?? itemOverride?.deadline ?? item.deadline;
}

function effectiveOwner(item: ReadinessItem, site: Site, cfg: ConfigShape): string {
  const cellKey = `${item.id}::${site}`;
  const cell = cfg.cells[cellKey];
  const itemOverride = cfg.itemOverrides[item.id];
  return cell?.owner ?? itemOverride?.owner ?? item.owner;
}

export function buildExecutiveModel(cfg: ConfigShape): ExecutiveReadinessModel {
  const cells = effectiveCells(cfg);

  const sites: SiteExecutiveView[] = SITES.map((site) => {
    const pending: SiteTask[] = [];
    const done: DoneItemRef[] = [];
    let notApplicableCount = 0;

    READINESS_ITEMS.forEach((item) => {
      const status = cells[item.id][site];
      if (status === "na") {
        notApplicableCount++;
        return;
      }
      if (status === "yes") {
        done.push({ itemId: item.id, item: item.item });
        return;
      }

      const deadline = effectiveDeadline(item, site, cfg);
      const days = daysUntil(deadline);
      pending.push({
        itemId: item.id,
        item: item.item,
        site,
        team: item.team,
        owner: effectiveOwner(item, site, cfg),
        priority: cfg.itemOverrides[item.id]?.priority ?? item.priority,
        deadline,
        daysUntil: days,
        overdue: days < 0,
      });
    });

    pending.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return a.deadline.localeCompare(b.deadline);
    });

    const applicable = done.length + pending.length;
    return {
      site,
      doneCount: done.length,
      pendingCount: pending.length,
      notApplicableCount,
      applicable,
      readinessPct: applicable ? done.length / applicable : 0,
      done,
      pending,
      overdueCount: pending.filter((p) => p.overdue).length,
      nextDeadline: pending[0]?.deadline ?? null,
    };
  });

  const totalDone = sites.reduce((s, x) => s + x.doneCount, 0);
  const totalPending = sites.reduce((s, x) => s + x.pendingCount, 0);
  const totalApplicable = totalDone + totalPending;
  const allPending = sites.flatMap((s) => s.pending).sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.deadline.localeCompare(b.deadline);
  });

  const summary: ExecutiveSummary = {
    fleetReadinessPct: totalApplicable ? totalDone / totalApplicable : 0,
    totalDone,
    totalPending,
    totalApplicable,
    siteCount: SITES.length,
    overdueCount: allPending.filter((p) => p.overdue).length,
    dueWithin7Days: allPending.filter((p) => !p.overdue && p.daysUntil <= 7).length,
    worstSite: [...sites].sort((a, b) => a.readinessPct - b.readinessPct)[0] ?? null,
  };

  return { summary, sites, allPending };
}

export function formatDeadlineLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function deadlineBadge(days: number): { label: string; tone: "overdue" | "soon" | "ok" } {
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "overdue" };
  if (days === 0) return { label: "Due today", tone: "soon" };
  if (days <= 7) return { label: `${days}d left`, tone: "soon" };
  return { label: `${days}d left`, tone: "ok" };
}
