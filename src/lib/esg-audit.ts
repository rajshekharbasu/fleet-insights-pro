/**
 * Audit workflow — UI-only stub (Phases 3 & 4).
 *
 * Holds session state for internal AND external audits (scheduling, findings,
 * and the corrective actions that flow from NCs into the ESAP register), layered
 * over the seed data in esg-data. Internal and external audits are the same shape
 * separated by `kind` — the register is deliberately kept unified while the two
 * lists are shown separately, per the requirement.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  AUDIT_FINDINGS,
  AUDITS,
  ESG_TODAY,
  type Audit,
  type AuditFinding,
  type AuditKind,
  type EsapAction,
} from "./esg-data";

export interface AuditDraft {
  kind: AuditKind;
  title: string;
  entityId: string;
  depotId?: string;
  standard?: string;
  auditorName: string;
  auditorOrg?: string;
  scheduledOn: string;
}

export interface FindingDraft {
  clause: string;
  area: string;
  result: AuditFinding["result"];
  severity?: "major" | "minor";
  remarks?: string;
}

export interface CorrectiveDraft {
  action: string;
  ownerId: string;
  due: string;
}

export interface AuditWorkflow {
  auditsFor: (kind: AuditKind) => Audit[];
  auditById: (id: string) => Audit | undefined;
  findingsFor: (auditId: string) => AuditFinding[];
  scheduleAudit: (d: AuditDraft) => string;
  addFinding: (auditId: string, d: FindingDraft) => void;
  createCorrectiveAction: (auditId: string, findingId: string) => CorrectiveActionAppender;
  auditEsapActions: () => EsapAction[];
  unlinkedNcCount: (auditId: string) => number;
}

/** Curried so the panel can validate the draft before committing the append. */
type CorrectiveActionAppender = (d: CorrectiveDraft) => void;

const todayIso = () => ESG_TODAY.toISOString().slice(0, 10);

export function useAuditWorkflow(): AuditWorkflow {
  const [sessionAudits, setSessionAudits] = useState<Audit[]>([]);
  const [sessionFindings, setSessionFindings] = useState<AuditFinding[]>([]);
  const [findingActionIds, setFindingActionIds] = useState<Record<string, string>>({});
  const [sessionActions, setSessionActions] = useState<EsapAction[]>([]);
  const counter = useRef(0);
  const ncSeq = useRef(20); // NC-2026-020 onward for session-raised NCs

  const auditsFor = useCallback(
    (kind: AuditKind) => [...AUDITS, ...sessionAudits].filter((a) => a.kind === kind),
    [sessionAudits],
  );

  const auditById = useCallback(
    (id: string) => [...AUDITS, ...sessionAudits].find((a) => a.id === id),
    [sessionAudits],
  );

  const findingsFor = useCallback(
    (auditId: string) =>
      [...AUDIT_FINDINGS, ...sessionFindings]
        .filter((f) => f.auditId === auditId)
        .map((f) => ({ ...f, actionId: findingActionIds[f.id] ?? f.actionId })),
    [sessionFindings, findingActionIds],
  );

  const scheduleAudit = useCallback((d: AuditDraft) => {
    const id = `aud-s-${++counter.current}`;
    setSessionAudits((a) => [...a, { id, status: "planned", ...d }]);
    return id;
  }, []);

  const addFinding = useCallback((auditId: string, d: FindingDraft) => {
    const id = `af-s-${++counter.current}`;
    setSessionFindings((f) => [...f, { id, auditId, ...d }]);
  }, []);

  const createCorrectiveAction = useCallback(
    (auditId: string, findingId: string): CorrectiveActionAppender =>
      (d: CorrectiveDraft) => {
        const finding = [...AUDIT_FINDINGS, ...sessionFindings].find((f) => f.id === findingId);
        const kind = ([...AUDITS, ...sessionAudits].find((a) => a.id === auditId)?.kind ?? "internal") as AuditKind;
        const actionId = `ca-${findingId}`;
        const ncRef = `NC-${ESG_TODAY.getFullYear()}-${String(++ncSeq.current).padStart(3, "0")}`;
        const action: EsapAction = {
          id: actionId,
          source: { kind: kind === "internal" ? "internal-audit" : "external-audit", id: findingId },
          finding: finding ? `${finding.clause} — ${finding.area}` : "Audit non-conformity",
          action: d.action,
          ownerId: d.ownerId,
          due: d.due,
          status: "open",
          ncRef,
          severity: finding?.severity ?? "minor",
        };
        setSessionActions((s) => [...s, action]);
        setFindingActionIds((m) => ({ ...m, [findingId]: actionId }));
      },
    [sessionAudits, sessionFindings],
  );

  const auditEsapActions = useCallback(() => sessionActions, [sessionActions]);

  const unlinkedNcCount = useCallback(
    (auditId: string) =>
      [...AUDIT_FINDINGS, ...sessionFindings]
        .filter((f) => f.auditId === auditId && f.result === "nc")
        .filter((f) => !(findingActionIds[f.id] ?? f.actionId)).length,
    [sessionFindings, findingActionIds],
  );

  return useMemo(
    () => ({
      auditsFor,
      auditById,
      findingsFor,
      scheduleAudit,
      addFinding,
      createCorrectiveAction,
      auditEsapActions,
      unlinkedNcCount,
    }),
    [
      auditsFor,
      auditById,
      findingsFor,
      scheduleAudit,
      addFinding,
      createCorrectiveAction,
      auditEsapActions,
      unlinkedNcCount,
    ],
  );
}

/** Human label + tint for a finding result (label + glyph handled at call site). */
export const FINDING_RESULT_META: Record<
  AuditFinding["result"],
  { label: string; color: string }
> = {
  compliant: { label: "Compliant", color: "var(--color-success)" },
  observation: { label: "Observation", color: "var(--color-warning)" },
  nc: { label: "NC", color: "var(--color-destructive)" },
};

export { todayIso as auditTodayIso };
