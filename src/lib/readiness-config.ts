/**
 * Master config layer — sites & checklist definitions (localStorage via readiness-store).
 * Seed data in readiness-data.ts is the initial template only.
 */

import {
  READINESS_ITEMS,
  SITES as SEED_SITES,
  type Cell,
  type Cost,
  type ItemType,
  type ReadinessItem,
} from "./readiness-data";
import type { ConfigShape } from "./readiness-store";

export type Site = string;

export type MasterChecklistEntry = {
  id: number;
  item: string;
  category: Cost;
  team: string;
  type: ItemType;
  owner: string;
  priority: ReadinessItem["priority"];
  /** Days from site creation date to set first deadline (when status is not yes). */
  defaultSlaDays: number | null;
};

export function addDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function seedMasterChecklist(): MasterChecklistEntry[] {
  return READINESS_ITEMS.map((r, idx) => ({
    id: r.id,
    item: r.item,
    category: r.category,
    team: r.team,
    type: r.type,
    owner: r.owner,
    priority: r.priority,
    defaultSlaDays: 14 + (idx % 5) * 7,
  }));
}

export function ensureConfigDefaults(cfg: ConfigShape): ConfigShape {
  const sites = cfg.sites?.length ? cfg.sites : [...SEED_SITES];
  const masterChecklist = cfg.masterChecklist?.length
    ? cfg.masterChecklist
    : seedMasterChecklist();
  return {
    ...cfg,
    sites,
    masterChecklist,
    deletedItemIds: cfg.deletedItemIds ?? [],
    nextItemId: cfg.nextItemId ?? Math.max(0, ...masterChecklist.map((m) => m.id)) + 1,
  };
}

export function getEffectiveSites(cfg: ConfigShape): Site[] {
  return ensureConfigDefaults(cfg).sites ?? [...SEED_SITES];
}

export function getEffectiveMasterChecklist(cfg: ConfigShape): MasterChecklistEntry[] {
  const base = ensureConfigDefaults(cfg);
  const deleted = new Set(base.deletedItemIds ?? []);
  return (base.masterChecklist ?? []).filter((m) => !deleted.has(m.id));
}

/** Build runtime checklist rows with per-site cells merged from seed + overrides. */
export function buildEffectiveItems(cfg: ConfigShape): ReadinessItem[] {
  const sites = getEffectiveSites(cfg);
  const master = getEffectiveMasterChecklist(cfg);
  const seedById = new Map(READINESS_ITEMS.map((r) => [r.id, r]));

  return master.map((m, idx) => {
    const seed = seedById.get(m.id);
    const cells = {} as Record<Site, Cell>;

    sites.forEach((site) => {
      const k = `${m.id}::${site}`;
      const override = cfg.cells[k]?.status;
      if (override !== undefined) {
        cells[site] = override;
      } else if (seed?.cells[site] !== undefined) {
        cells[site] = seed.cells[site];
      } else {
        cells[site] = "na";
      }
    });

    const yesCount = Object.values(cells).filter((c) => c === "yes").length;
    const applicable = Object.values(cells).filter((c) => c !== "na").length;
    const pct = applicable ? yesCount / applicable : 0;

    let status: ReadinessItem["status"];
    if (pct >= 0.95) status = "Completed";
    else if (pct < 0.45) status = "At Risk";
    else if (pct < 0.75) status = "Delayed";
    else status = "On Track";

    const deadline =
      cfg.itemOverrides[m.id]?.deadline ??
      seed?.deadline ??
      (m.defaultSlaDays != null ? addDaysFromToday(m.defaultSlaDays) : addDaysFromToday(30));

    return {
      id: m.id,
      item: m.item,
      category: m.category,
      team: m.team,
      type: m.type,
      owner: m.owner,
      priority: m.priority,
      deadline,
      status,
      cells,
    };
  });
}

export function defaultDeadlineForNewSite(entry: MasterChecklistEntry): string | undefined {
  if (entry.defaultSlaDays == null || entry.defaultSlaDays < 0) return undefined;
  return addDaysFromToday(entry.defaultSlaDays);
}

export function createCellsForNewSite(
  cfg: ConfigShape,
  siteCode: Site,
): ConfigShape["cells"] {
  const master = getEffectiveMasterChecklist(cfg);
  const next = { ...cfg.cells };
  master.forEach((entry) => {
    const k = `${entry.id}::${siteCode}`;
    if (next[k]) return;
    const deadline = defaultDeadlineForNewSite(entry);
    next[k] = {
      status: "no",
      ...(deadline ? { deadline } : {}),
    };
  });
  return next;
}
