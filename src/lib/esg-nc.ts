/**
 * Non-Compliance (NC) register — Phase 7.
 *
 * Aggregates every non-compliance in the system, regardless of origin, into one
 * normalised list: expired/overdue compliance records, internal + external audit
 * NCs, and monitoring breaches. This is deliberately the single place that reads
 * across all four sources — a consolidated register that disagrees with itself
 * is the exact failure the module exists to prevent.
 */
import {
  daysUntil,
  ESG_TODAY,
  ESAP_ACTIONS,
  entityById,
  fmtDate,
  inScope,
  monitoringParamByKey,
  personById,
  RECORDS,
  recordState,
  typeByKey,
  type EsapAction,
  type ScopeSel,
} from "./esg-data";
import type { AuditWorkflow } from "./esg-audit";
import type { MonitoringWorkflow } from "./esg-monitoring";

export type NcSource = "permit" | "site" | "internal-audit" | "external-audit" | "monitoring";

export const NC_SOURCE_LABEL: Record<NcSource, string> = {
  permit: "Permit",
  site: "Site compliance",
  "internal-audit": "Internal audit",
  "external-audit": "External audit",
  monitoring: "Monitoring",
};

export type NcItem = {
  id: string;
  ref: string;
  source: NcSource;
  title: string;
  entityId: string;
  depotId?: string;
  raisedDate: string; // ISO date
  severity?: "major" | "minor" | "observation";
  ownerId?: string;
  ageDays: number;
  actionStatus: "open" | "in-progress" | "closed" | "none";
  remarks?: string;
  withheldExternal: boolean;
  /** Where "open in context" navigates: a compliance record, or an ESMS sub-tab. */
  backlink: { kind: "record"; recordId: string } | { kind: "esms"; sub: string };
};

const ageOf = (iso: string) => Math.max(0, daysUntil(iso) * -1);

function actionStatusFor(actionId: string | undefined, extraActions: EsapAction[]): NcItem["actionStatus"] {
  if (!actionId) return "none";
  const action = [...ESAP_ACTIONS, ...extraActions].find((a) => a.id === actionId);
  return action?.status ?? "none";
}

/** Builds the consolidated register for the current scope + reporting period. */
export function buildNcRegister(
  sel: ScopeSel,
  period: string,
  audit: AuditWorkflow,
  monitoring: MonitoringWorkflow,
): NcItem[] {
  const items: NcItem[] = [];

  // ---- overdue compliance records (permits + site) ----
  for (const r of RECORDS.filter((r) => inScope(r, sel) && recordState(r) === "overdue")) {
    const type = typeByKey(r.typeKey);
    items.push({
      id: `nc-rec-${r.id}`,
      ref: r.refNo,
      source: type?.category === "permit" ? "permit" : "site",
      title: `${type?.label ?? r.typeKey} — ${r.authority}`,
      entityId: r.entityId,
      depotId: r.depotId,
      raisedDate: r.expiryDate ?? ESG_TODAY.toISOString().slice(0, 10),
      ownerId: r.ownerId,
      ageDays: r.expiryDate ? ageOf(r.expiryDate) : 0,
      actionStatus: r.renewal === "initiated" ? "in-progress" : "open",
      remarks: r.remarks,
      withheldExternal: !!r.withheldExternal,
      backlink: { kind: "record", recordId: r.id },
    });
  }

  // ---- internal + external audit NCs ----
  const auditActions = audit.auditEsapActions();
  for (const kind of ["internal", "external"] as const) {
    for (const a of audit.auditsFor(kind).filter((a) => inScope({ entityId: a.entityId, depotId: a.depotId }, sel))) {
      for (const f of audit.findingsFor(a.id).filter((f) => f.result === "nc")) {
        const linkedAction = [...ESAP_ACTIONS, ...auditActions].find((x) => x.id === f.actionId);
        items.push({
          id: `nc-af-${f.id}`,
          ref: linkedAction?.ncRef ?? `NC-${f.id}`,
          source: kind === "internal" ? "internal-audit" : "external-audit",
          title: `${f.clause} — ${f.area}`,
          entityId: a.entityId,
          depotId: a.depotId,
          raisedDate: a.conductedOn ?? a.scheduledOn,
          severity: f.severity,
          ownerId: linkedAction?.ownerId,
          ageDays: ageOf(a.conductedOn ?? a.scheduledOn),
          actionStatus: actionStatusFor(f.actionId, auditActions),
          remarks: f.remarks,
          // The whole module withholds every NC (any source) from the external
          // audience by default — see AuditDetail's identical rule.
          withheldExternal: true,
          backlink: { kind: "esms", sub: kind === "internal" ? "audit-internal" : "audit-external" },
        });
      }
    }
  }

  // ---- monitoring breaches (current period) ----
  for (const b of monitoring.breachesForPeriod(period).filter((b) => inScope(b, sel))) {
    const param = monitoringParamByKey(b.paramKey);
    items.push({
      id: `nc-mon-${b.entityId}-${b.depotId}-${b.paramKey}-${b.period}`,
      ref: `MON-${b.paramKey.toUpperCase()}-${b.period}`,
      source: "monitoring",
      title: `${param?.label ?? b.paramKey} breach — ${b.value}${param?.unit ?? ""}${param?.limit != null ? ` (limit ${param.limit})` : ""}`,
      entityId: b.entityId,
      depotId: b.depotId,
      raisedDate: `${b.period}-01`,
      severity: param?.limit && b.value > param.limit * 1.5 ? "major" : "minor",
      ageDays: ageOf(`${b.period}-01`),
      actionStatus: "none",
      withheldExternal: true,
      backlink: { kind: "esms", sub: "monitoring" },
    });
  }

  return items;
}

export type AgeBucket = "0-30" | "31-90" | "90+";
export const ageBucket = (days: number): AgeBucket => (days <= 30 ? "0-30" : days <= 90 ? "31-90" : "90+");

/** Oldest open first — age is the risk signal; closed items sink to the bottom. */
export function sortNcRegister(items: NcItem[]): NcItem[] {
  return items.slice().sort((a, b) => {
    const aClosed = a.actionStatus === "closed" ? 1 : 0;
    const bClosed = b.actionStatus === "closed" ? 1 : 0;
    if (aClosed !== bClosed) return aClosed - bClosed;
    return b.ageDays - a.ageDays;
  });
}

export function ncItemPlace(item: NcItem): string {
  const e = entityById(item.entityId);
  if (!e) return item.entityId;
  if (!item.depotId) return e.short;
  const d = e.depots.find((x) => x.id === item.depotId);
  return d ? `${e.short} · ${d.name.replace(" Depot", "")}` : e.short;
}

export function ncItemOwnerName(item: NcItem): string {
  return item.ownerId ? (personById(item.ownerId)?.name ?? item.ownerId) : "—";
}

export function ncRaisedLabel(item: NcItem): string {
  return fmtDate(item.raisedDate);
}
