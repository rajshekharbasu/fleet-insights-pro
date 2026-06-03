// Browser-persisted store for site readiness configuration.
// Keeps the original sheet as defaults and layers user overrides on top.
// Swap localStorage with Lovable Cloud later without changing the UI.

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Cell, type ReadinessItem } from "./readiness-data";
import {
  buildEffectiveItems,
  createCellsForNewSite,
  ensureConfigDefaults,
  getEffectiveMasterChecklist,
  getEffectiveSites,
  type MasterChecklistEntry,
  type Site,
} from "./readiness-config";

const KEY = "voltline.readiness.v2";

export type CellState = {
  status: Cell;
  /** ISO date; only meaningful when status !== "yes" */
  deadline?: string;
  owner?: string;
  notes?: string;
};

export type CustomColumn = {
  id: string;
  label: string;
  type: "text" | "date" | "number";
};

export type ItemOverride = {
  priority?: ReadinessItem["priority"];
  owner?: string;
  deadline?: string;
  status?: ReadinessItem["status"];
};

export type ConfigShape = {
  cells: Record<string, CellState>; // key = `${itemId}::${site}`
  itemOverrides: Record<number, ItemOverride>;
  customColumns: CustomColumn[];
  customValues: Record<string, string>; // key = `${itemId}::${colId}`
  /** Full site list (replaces seed when set). */
  sites?: Site[];
  /** Master checklist — applies to all depots. */
  masterChecklist?: MasterChecklistEntry[];
  deletedItemIds?: number[];
  nextItemId?: number;
};

const EMPTY: ConfigShape = {
  cells: {},
  itemOverrides: {},
  customColumns: [],
  customValues: {},
};

const LEGACY_KEY = "voltline.readiness.v1";

const cellKey = (itemId: number, site: Site) => `${itemId}::${site}`;
const valKey = (itemId: number, colId: string) => `${itemId}::${colId}`;

function load(): ConfigShape {
  if (typeof window === "undefined") return ensureConfigDefaults(EMPTY);
  try {
    let raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        raw = legacy;
        window.localStorage.setItem(KEY, legacy);
      }
    }
    if (!raw) return ensureConfigDefaults(EMPTY);
    const parsed = JSON.parse(raw) as Partial<ConfigShape>;
    return ensureConfigDefaults({
      cells: parsed.cells ?? {},
      itemOverrides: parsed.itemOverrides ?? {},
      customColumns: parsed.customColumns ?? [],
      customValues: parsed.customValues ?? {},
      sites: parsed.sites,
      masterChecklist: parsed.masterChecklist,
      deletedItemIds: parsed.deletedItemIds,
      nextItemId: parsed.nextItemId,
    });
  } catch {
    return ensureConfigDefaults(EMPTY);
  }
}

function save(cfg: ConfigShape) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(cfg));
  window.dispatchEvent(new CustomEvent("voltline:readiness-changed"));
}

export function useReadinessConfig() {
  const [cfg, setCfg] = useState<ConfigShape>(EMPTY);

  useEffect(() => {
    setCfg(load());
    const sync = () => setCfg(load());
    window.addEventListener("voltline:readiness-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("voltline:readiness-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((mutator: (c: ConfigShape) => ConfigShape) => {
    setCfg((prev) => {
      const next = mutator(prev);
      save(next);
      return next;
    });
  }, []);

  const items = useMemo(() => buildEffectiveItems(cfg), [cfg]);
  const sites = useMemo(() => getEffectiveSites(cfg), [cfg]);

  const getCell = useCallback(
    (itemId: number, site: Site): CellState => {
      const item = items.find((i) => i.id === itemId);
      const def: CellState = { status: item?.cells[site] ?? "na" };
      return cfg.cells[cellKey(itemId, site)] ?? def;
    },
    [cfg, items],
  );

  const setCell = useCallback(
    (itemId: number, site: Site, patch: Partial<CellState>) =>
      update((c) => {
        const k = cellKey(itemId, site);
        const item = buildEffectiveItems(c).find((i) => i.id === itemId);
        const base: CellState = c.cells[k] ?? { status: item?.cells[site] ?? "na" };
        const merged: CellState = { ...base, ...patch };
        // Clear deadline if status flips to yes
        if (merged.status === "yes") merged.deadline = undefined;
        return { ...c, cells: { ...c.cells, [k]: merged } };
      }),
    [update],
  );

  const addColumn = useCallback(
    (label: string, type: CustomColumn["type"]) =>
      update((c) => ({
        ...c,
        customColumns: [...c.customColumns, { id: crypto.randomUUID().slice(0, 8), label, type }],
      })),
    [update],
  );

  const removeColumn = useCallback(
    (id: string) =>
      update((c) => {
        const customValues = { ...c.customValues };
        Object.keys(customValues).forEach((k) => {
          if (k.endsWith(`::${id}`)) delete customValues[k];
        });
        return {
          ...c,
          customColumns: c.customColumns.filter((col) => col.id !== id),
          customValues,
        };
      }),
    [update],
  );

  const setCustomValue = useCallback(
    (itemId: number, colId: string, value: string) =>
      update((c) => ({
        ...c,
        customValues: { ...c.customValues, [valKey(itemId, colId)]: value },
      })),
    [update],
  );

  const getCustomValue = useCallback(
    (itemId: number, colId: string) => cfg.customValues[valKey(itemId, colId)] ?? "",
    [cfg],
  );

  const reset = useCallback(() => update(() => ensureConfigDefaults(EMPTY)), [update]);

  const addSite = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) return;
      update((c) => {
        const normalized = ensureConfigDefaults(c);
        const list = getEffectiveSites(normalized);
        if (list.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return normalized;
        const sites = [...list, trimmed];
        const cells = createCellsForNewSite({ ...normalized, sites }, trimmed);
        return { ...normalized, sites, cells };
      });
    },
    [update],
  );

  const removeSite = useCallback(
    (site: Site) =>
      update((c) => {
        const normalized = ensureConfigDefaults(c);
        const sites = getEffectiveSites(normalized).filter((s) => s !== site);
        const cells = { ...normalized.cells };
        Object.keys(cells).forEach((k) => {
          if (k.endsWith(`::${site}`)) delete cells[k];
        });
        return { ...normalized, sites, cells };
      }),
    [update],
  );

  const updateMasterItem = useCallback(
    (id: number, patch: Partial<MasterChecklistEntry>) =>
      update((c) => {
        const normalized = ensureConfigDefaults(c);
        const masterChecklist = (normalized.masterChecklist ?? []).map((m) =>
          m.id === id ? { ...m, ...patch } : m,
        );
        return { ...normalized, masterChecklist };
      }),
    [update],
  );

  const addMasterItem = useCallback(
    (entry: Omit<MasterChecklistEntry, "id">) =>
      update((c) => {
        const normalized = ensureConfigDefaults(c);
        const id = normalized.nextItemId ?? 1000;
        const masterChecklist = [...(normalized.masterChecklist ?? []), { ...entry, id }];
        const sites = getEffectiveSites(normalized);
        const cells = { ...normalized.cells };
        sites.forEach((site) => {
          const k = `${id}::${site}`;
          if (!cells[k]) {
            const deadline =
              entry.defaultSlaDays != null && entry.defaultSlaDays >= 0
                ? (() => {
                    const d = new Date();
                    d.setDate(d.getDate() + entry.defaultSlaDays!);
                    return d.toISOString().slice(0, 10);
                  })()
                : undefined;
            cells[k] = { status: "no", ...(deadline ? { deadline } : {}) };
          }
        });
        return {
          ...normalized,
          masterChecklist,
          nextItemId: id + 1,
          cells,
          deletedItemIds: (normalized.deletedItemIds ?? []).filter((x) => x !== id),
        };
      }),
    [update],
  );

  const removeMasterItem = useCallback(
    (id: number) =>
      update((c) => {
        const normalized = ensureConfigDefaults(c);
        const deletedItemIds = [...new Set([...(normalized.deletedItemIds ?? []), id])];
        const cells = { ...normalized.cells };
        Object.keys(cells).forEach((k) => {
          if (k.startsWith(`${id}::`)) delete cells[k];
        });
        return { ...normalized, deletedItemIds, cells };
      }),
    [update],
  );

  const masterChecklist = useMemo(() => getEffectiveMasterChecklist(cfg), [cfg]);

  return {
    cfg,
    items,
    sites,
    masterChecklist,
    getCell,
    setCell,
    addColumn,
    removeColumn,
    setCustomValue,
    getCustomValue,
    reset,
    addSite,
    removeSite,
    updateMasterItem,
    addMasterItem,
    removeMasterItem,
  };
}

/** Helper for aggregations that need the effective sheet (defaults + overrides). */
export function effectiveCells(cfg: ConfigShape): Record<number, Record<Site, Cell>> {
  const out: Record<number, Record<Site, Cell>> = {};
  const sites = getEffectiveSites(cfg);
  buildEffectiveItems(cfg).forEach((r) => {
    const row = {} as Record<Site, Cell>;
    sites.forEach((s) => {
      const k = `${r.id}::${s}`;
      row[s] = cfg.cells[k]?.status ?? r.cells[s];
    });
    out[r.id] = row;
  });
  return out;
}

export type { Site, MasterChecklistEntry };
