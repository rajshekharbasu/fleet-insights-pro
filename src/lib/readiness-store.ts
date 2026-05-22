// Browser-persisted store for site readiness configuration.
// Keeps the original sheet as defaults and layers user overrides on top.
// Swap localStorage with Lovable Cloud later without changing the UI.

import { useCallback, useEffect, useState } from "react";
import { READINESS_ITEMS, SITES, type Cell, type Site, type ReadinessItem } from "./readiness-data";

const KEY = "voltline.readiness.v1";

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
};

const EMPTY: ConfigShape = { cells: {}, itemOverrides: {}, customColumns: [], customValues: {} };

const cellKey = (itemId: number, site: Site) => `${itemId}::${site}`;
const valKey = (itemId: number, colId: string) => `${itemId}::${colId}`;

function load(): ConfigShape {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ConfigShape>;
    return {
      cells: parsed.cells ?? {},
      itemOverrides: parsed.itemOverrides ?? {},
      customColumns: parsed.customColumns ?? [],
      customValues: parsed.customValues ?? {},
    };
  } catch {
    return EMPTY;
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

  const getCell = useCallback(
    (itemId: number, site: Site): CellState => {
      const item = READINESS_ITEMS.find((i) => i.id === itemId);
      const def: CellState = { status: item?.cells[site] ?? "na" };
      return cfg.cells[cellKey(itemId, site)] ?? def;
    },
    [cfg],
  );

  const setCell = useCallback(
    (itemId: number, site: Site, patch: Partial<CellState>) =>
      update((c) => {
        const k = cellKey(itemId, site);
        const item = READINESS_ITEMS.find((i) => i.id === itemId);
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

  const reset = useCallback(() => update(() => EMPTY), [update]);

  return {
    cfg,
    getCell,
    setCell,
    addColumn,
    removeColumn,
    setCustomValue,
    getCustomValue,
    reset,
  };
}

/** Helper for aggregations that need the effective sheet (defaults + overrides). */
export function effectiveCells(cfg: ConfigShape): Record<number, Record<Site, Cell>> {
  const out: Record<number, Record<Site, Cell>> = {};
  READINESS_ITEMS.forEach((r) => {
    const row = {} as Record<Site, Cell>;
    SITES.forEach((s) => {
      const k = `${r.id}::${s}`;
      row[s] = cfg.cells[k]?.status ?? r.cells[s];
    });
    out[r.id] = row;
  });
  return out;
}
