/**
 * Editable masters — UI-only stub (Phase 9).
 *
 * Session overrides for the compliance-type lead window and the GHG
 * parameter/factor master, so both surface as genuinely editable master data
 * (per the plan) rather than read-only tables. A changed GHG factor always
 * carries a note — GHG numbers that silently change are a credibility risk.
 */
import { useCallback, useMemo, useState } from "react";
import { ESG_TODAY, GHG_PARAMS, TYPE_MASTER, typeByKey, type GhgParam, type Provenance } from "./esg-data";

export type GhgParamRow = GhgParam & {
  active: boolean;
  note?: string;
  updatedBy?: string;
  updatedOn?: string;
  /** Set when the factor's latest value arrived via Excel import — renders a ProvenanceChip. */
  prov?: Provenance;
};

export type GhgParamDraft = Omit<GhgParam, "id"> & { id?: string };

export interface MastersWorkflow {
  leadDaysFor: (typeKey: string) => number;
  setLeadDays: (typeKey: string, days: number) => void;
  ghgParams: () => GhgParamRow[];
  setGhgFactor: (id: string, factor: number, factorSource: string, note: string, by?: string) => void;
  setGhgActive: (id: string, active: boolean) => void;
  addGhgParam: (p: GhgParamDraft, by?: string) => void;
  importGhgFactors: (rows: { id: string; factor: number; factorSource?: string }[], by?: string) => void;
}

const todayIso = () => ESG_TODAY.toISOString().slice(0, 10);

export function useMastersWorkflow(): MastersWorkflow {
  const [leadDaysOverrides, setLeadDaysOverrides] = useState<Record<string, number>>({});
  const [ghgOverrides, setGhgOverrides] = useState<Record<string, Partial<GhgParamRow>>>({});
  const [extraParams, setExtraParams] = useState<GhgParam[]>([]);

  const leadDaysFor = useCallback(
    (typeKey: string) => leadDaysOverrides[typeKey] ?? typeByKey(typeKey)?.leadDays ?? 60,
    [leadDaysOverrides],
  );

  const setLeadDays = useCallback((typeKey: string, days: number) => {
    setLeadDaysOverrides((o) => ({ ...o, [typeKey]: Math.max(0, Math.round(days)) }));
  }, []);

  const ghgParams = useCallback((): GhgParamRow[] => {
    return [...GHG_PARAMS, ...extraParams].map((p) => ({ ...p, active: true, ...ghgOverrides[p.id] }));
  }, [ghgOverrides, extraParams]);

  const setGhgFactor = useCallback(
    (id: string, factor: number, factorSource: string, note: string, by = "diganta") => {
      setGhgOverrides((o) => ({
        ...o,
        // A manual edit supersedes any prior import provenance for this factor.
        [id]: { ...o[id], factor, factorSource, note, updatedBy: by, updatedOn: todayIso(), prov: undefined },
      }));
    },
    [],
  );

  const setGhgActive = useCallback((id: string, active: boolean) => {
    setGhgOverrides((o) => ({ ...o, [id]: { ...o[id], active, updatedOn: todayIso() } }));
  }, []);

  const addGhgParam = useCallback((p: GhgParamDraft, by = "diganta") => {
    const id = p.id ?? `ghg-${p.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    setExtraParams((list) => [...list, { ...p, id }]);
    setGhgOverrides((o) => ({ ...o, [id]: { active: true, updatedBy: by, updatedOn: todayIso(), note: "New parameter" } }));
  }, []);

  const importGhgFactors = useCallback((rows: { id: string; factor: number; factorSource?: string }[], by = "diganta") => {
    const prov: Provenance = { source: "ghg-factors-upload.xlsx", fetchedAt: ESG_TODAY.toISOString() };
    setGhgOverrides((o) => {
      const next = { ...o };
      for (const r of rows) {
        next[r.id] = {
          ...next[r.id],
          factor: r.factor,
          factorSource: r.factorSource ?? next[r.id]?.factorSource,
          note: "Imported from Excel",
          updatedBy: by,
          updatedOn: todayIso(),
          prov,
        };
      }
      return next;
    });
  }, []);

  return useMemo(
    () => ({ leadDaysFor, setLeadDays, ghgParams, setGhgFactor, setGhgActive, addGhgParam, importGhgFactors }),
    [leadDaysFor, setLeadDays, ghgParams, setGhgFactor, setGhgActive, addGhgParam, importGhgFactors],
  );
}

export const TYPE_MASTER_ALL = TYPE_MASTER;
