/**
 * Site monitoring workflow — UI-only stub (Phase 6).
 *
 * Session state for monitoring readings entered by hand (ESG Champion) or
 * imported from Excel, layered over the MONITORING_READINGS seed. Excel-sourced
 * values carry a Provenance so the UI can stamp them with a ProvenanceChip.
 */
import { useCallback, useMemo, useState } from "react";
import {
  ESG_GROUP,
  ESG_TODAY,
  MONITORING_PARAMS,
  MONITORING_READINGS,
  monitoringParamByKey,
  type Provenance,
} from "./esg-data";

export type ReadingCell = { value: number | null; source: "manual" | "excel"; prov?: Provenance };

const keyOf = (paramKey: string, entityId: string, depotId: string, period: string) =>
  `${paramKey}|${entityId}|${depotId}|${period}`;

export type MonitoringBreach = { paramKey: string; entityId: string; depotId: string; period: string; value: number };

const ALL_DEPOTS = ESG_GROUP.entities.flatMap((e) => e.depots.map((d) => ({ entityId: e.id, depotId: d.id })));

export interface MonitoringWorkflow {
  readingFor: (paramKey: string, entityId: string, depotId: string, period: string) => ReadingCell;
  setReading: (paramKey: string, entityId: string, depotId: string, period: string, value: number | null) => void;
  importReadings: (
    entityId: string,
    depotId: string,
    period: string,
    rows: { paramKey: string; value: number }[],
    sourceName: string,
  ) => void;
  /** Every breach for a period, live (seed + session overrides/imports) — the single source NC reporting reads. */
  breachesForPeriod: (period: string) => MonitoringBreach[];
}

export function useMonitoringWorkflow(): MonitoringWorkflow {
  const [overrides, setOverrides] = useState<Record<string, ReadingCell>>({});

  const readingFor = useCallback(
    (paramKey: string, entityId: string, depotId: string, period: string): ReadingCell => {
      const k = keyOf(paramKey, entityId, depotId, period);
      if (overrides[k]) return overrides[k];
      const seed = MONITORING_READINGS.find(
        (r) => r.paramKey === paramKey && r.entityId === entityId && r.depotId === depotId && r.period === period,
      );
      if (seed) return { value: seed.value, source: seed.source, prov: seed.prov };
      return { value: null, source: "manual" };
    },
    [overrides],
  );

  const setReading = useCallback(
    (paramKey: string, entityId: string, depotId: string, period: string, value: number | null) => {
      setOverrides((o) => ({ ...o, [keyOf(paramKey, entityId, depotId, period)]: { value, source: "manual" } }));
    },
    [],
  );

  const importReadings = useCallback(
    (
      entityId: string,
      depotId: string,
      period: string,
      rows: { paramKey: string; value: number }[],
      sourceName: string,
    ) => {
      const prov: Provenance = { source: sourceName, fetchedAt: ESG_TODAY.toISOString() };
      setOverrides((o) => {
        const next = { ...o };
        for (const row of rows) {
          next[keyOf(row.paramKey, entityId, depotId, period)] = { value: row.value, source: "excel", prov };
        }
        return next;
      });
    },
    [],
  );

  const breachesForPeriod = useCallback(
    (period: string): MonitoringBreach[] => {
      const out: MonitoringBreach[] = [];
      for (const { entityId, depotId } of ALL_DEPOTS) {
        for (const p of MONITORING_PARAMS) {
          const cell = readingFor(p.key, entityId, depotId, period);
          if (cellBreaches(p.key, cell.value)) {
            out.push({ paramKey: p.key, entityId, depotId, period, value: cell.value as number });
          }
        }
      }
      return out;
    },
    [readingFor],
  );

  return useMemo(
    () => ({ readingFor, setReading, importReadings, breachesForPeriod }),
    [readingFor, setReading, importReadings, breachesForPeriod],
  );
}

/** True when a value breaches its parameter's regulatory limit. */
export function cellBreaches(paramKey: string, value: number | null): boolean {
  const p = monitoringParamByKey(paramKey);
  return value != null && p?.limit != null && value > p.limit;
}

export const MONITORING_CATEGORY_LABEL: Record<string, string> = {
  air: "Air",
  water: "Water",
  noise: "Noise",
  waste: "Waste",
};
