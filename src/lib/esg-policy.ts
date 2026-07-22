/**
 * Policy management workflow — UI-only stub (Phase 2).
 *
 * Holds the mutable version/approval state for policies (upload → submit →
 * approve) in React state, plus the pure helpers that read it. Approval is the
 * gate a policy passes before its rollout action enters the ESAP register.
 */
import { useCallback, useMemo, useState } from "react";
import {
  ESG_TODAY,
  POLICIES,
  daysUntil,
  policyById,
  policyEsapAction,
  type EsapAction,
  type EsgState,
  type Policy,
  type PolicyVersion,
} from "./esg-data";

/* ---------------------------------- roles ---------------------------------- */

/**
 * Stubbed role for presenting a permission model — this gates the UI only, it is
 * NOT enforcement. Real authorisation lands with the backend session layer.
 */
export type Role = "viewer" | "maintainer" | "approver";

export const ROLES: { key: Role; label: string; blurb: string }[] = [
  { key: "viewer", label: "Viewer", blurb: "Read-only" },
  { key: "maintainer", label: "Maintainer", blurb: "Upload & submit versions" },
  { key: "approver", label: "Approver", blurb: "Approve or reject submissions" },
];

export const canEditPolicies = (r: Role) => r === "maintainer" || r === "approver";
export const canApprovePolicies = (r: Role) => r === "approver";

/* ------------------------- policy version + step logic --------------------- */

export const POLICY_STEPS = ["Draft", "Submitted", "Approved", "In ESAP register"] as const;

export const latestVersion = (vs: PolicyVersion[]): PolicyVersion | undefined => vs[0];

/** The most recent version that has actually been approved (the live document). */
export function currentApprovedVersion(vs: PolicyVersion[]): string | undefined {
  return vs.find((v) => v.status === "approved")?.version;
}

/** Index into POLICY_STEPS reached by the latest version. Approval admits to the register. */
export function policyStepIndex(vs: PolicyVersion[]): number {
  const s = latestVersion(vs)?.status;
  if (s === "submitted") return 1;
  if (s === "approved") return 3;
  return 0; // draft or rejected sit at the start of the flow
}

export const policyRejected = (vs: PolicyVersion[]): boolean => latestVersion(vs)?.status === "rejected";
export const policyApproved = (vs: PolicyVersion[]): boolean => latestVersion(vs)?.status === "approved";

/** Annual-review state, reusing the compliance state machine's thresholds. */
export function policyReviewState(p: Policy): EsgState {
  const d = daysUntil(p.reviewDue);
  if (d < 0) return "overdue";
  return d <= 60 ? "expiring" : "valid";
}

export function reviewCountdownLabel(p: Policy): string {
  const d = daysUntil(p.reviewDue);
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Review due today";
  return `review in ${d}d`;
}

const todayIso = () => ESG_TODAY.toISOString().slice(0, 10);

function bumpVersion(v: string): string {
  const m = /^v(\d+)\.(\d+)$/.exec(v);
  return m ? `v${m[1]}.${Number(m[2]) + 1}` : `${v}.1`;
}

function draftDoc(p: Policy, version: string): { name: string; size: string } {
  return { name: `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${version}.pdf`, size: "—" };
}

/* ------------------------------ workflow store ----------------------------- */

export interface PolicyWorkflow {
  /** Live versions for a policy (session edits layered over the seed data). */
  policyVersions: (policyId: string) => PolicyVersion[];
  uploadPolicyVersion: (policyId: string) => void;
  submitPolicyVersion: (policyId: string) => void;
  decidePolicyVersion: (policyId: string, decision: "approved" | "rejected", by?: string) => void;
  /** Policy-sourced ESAP actions for every currently-approved policy. */
  policyEsapActions: () => EsapAction[];
}

export function usePolicyWorkflow(): PolicyWorkflow {
  const [overrides, setOverrides] = useState<Record<string, PolicyVersion[]>>({});

  const policyVersions = useCallback(
    (policyId: string) => overrides[policyId] ?? policyById(policyId)?.versions ?? [],
    [overrides],
  );

  const uploadPolicyVersion = useCallback((policyId: string) => {
    setOverrides((o) => {
      const p = policyById(policyId);
      if (!p) return o;
      const vs = o[policyId] ?? p.versions;
      const version = bumpVersion(latestVersion(vs)?.version ?? p.currentVersion);
      const draft: PolicyVersion = {
        version,
        uploadedAt: todayIso(),
        uploadedBy: p.ownerId,
        status: "draft",
        doc: draftDoc(p, version),
      };
      return { ...o, [policyId]: [draft, ...vs] };
    });
  }, []);

  const submitPolicyVersion = useCallback((policyId: string) => {
    setOverrides((o) => {
      const p = policyById(policyId);
      if (!p) return o;
      const vs = (o[policyId] ?? p.versions).slice();
      if (!vs.length) return o;
      vs[0] = { ...vs[0], status: "submitted" };
      return { ...o, [policyId]: vs };
    });
  }, []);

  const decidePolicyVersion = useCallback((policyId: string, decision: "approved" | "rejected", by = "kavita") => {
    setOverrides((o) => {
      const p = policyById(policyId);
      if (!p) return o;
      const vs = (o[policyId] ?? p.versions).slice();
      if (!vs.length) return o;
      vs[0] =
        decision === "approved"
          ? { ...vs[0], status: "approved", approvedBy: by, approvedOn: todayIso() }
          : { ...vs[0], status: "rejected" };
      return { ...o, [policyId]: vs };
    });
  }, []);

  const policyEsapActionsFn = useCallback(
    () =>
      POLICIES.map((p) => policyEsapAction(p, overrides[p.id] ?? p.versions)).filter(
        (a): a is EsapAction => a !== null,
      ),
    [overrides],
  );

  return useMemo(
    () => ({
      policyVersions,
      uploadPolicyVersion,
      submitPolicyVersion,
      decidePolicyVersion,
      policyEsapActions: policyEsapActionsFn,
    }),
    [policyVersions, uploadPolicyVersion, submitPolicyVersion, decidePolicyVersion, policyEsapActionsFn],
  );
}
