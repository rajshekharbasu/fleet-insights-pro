import { useRef } from "react";
import { ArrowUpRight, Check, CircleCheck, Lock, UploadCloud, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { entityById, fmtDate, personById, type Policy, type PolicyVersion } from "@/lib/esg-data";
import {
  POLICY_STEPS,
  canApprovePolicies,
  canEditPolicies,
  currentApprovedVersion,
  latestVersion,
  policyReviewState,
  policyStepIndex,
  reviewCountdownLabel,
} from "@/lib/esg-policy";
import { A, DocChip, StatePill, useEsg } from "../primitives";

const VERSION_STATUS: Record<PolicyVersion["status"], { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", cls: "bg-warning/14 text-warning" },
  approved: { label: "Approved", cls: "bg-success/12 text-success" },
  rejected: { label: "Rejected", cls: "bg-destructive/12 text-destructive" },
};

function VersionStatusPill({ status }: { status: PolicyVersion["status"] }) {
  const m = VERSION_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}

/** Horizontal 4-step approval stepper: Draft → Submitted → Approved → In ESAP register. */
function ApprovalStepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1">
      {POLICY_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-1">
            <div className="flex min-w-0 flex-col items-center gap-1 text-center">
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold transition-colors",
                  done
                    ? "bg-success text-white"
                    : active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight",
                  done || active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < POLICY_STEPS.length - 1 && (
              <span className={cn("mb-4 h-px flex-1", i < current ? "bg-success" : "bg-border")} aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Policy detail — version history, upload, and the approval workflow that gates a
 * policy's entry into the ESAP register. Approve/Reject are gated on the stubbed
 * role (presentation of a permission model, not enforcement).
 */
export function PolicyDrawer({
  policy,
  onClose,
  onOpenEsap,
}: {
  policy: Policy;
  onClose: () => void;
  onOpenEsap: () => void;
}) {
  const { role, policy: wf } = useEsg();
  const fileRef = useRef<HTMLInputElement>(null);

  const versions = wf.policyVersions(policy.id);
  const latest = latestVersion(versions);
  const step = policyStepIndex(versions);
  const approvedVersion = currentApprovedVersion(versions);
  const reviewState = policyReviewState(policy);
  const owner = personById(policy.ownerId);

  const mayEdit = canEditPolicies(role);
  const mayApprove = canApprovePolicies(role);

  const doUpload = () => {
    wf.uploadPolicyVersion(policy.id);
    if (fileRef.current) fileRef.current.value = ""; // allow re-uploading the same file
    toast.success("New version uploaded", {
      description: `${policy.name} — draft added, pending submission. (UI stub — no file stored.)`,
    });
  };
  const doSubmit = () => {
    wf.submitPolicyVersion(policy.id);
    toast.success("Submitted for approval", { description: `${policy.name} ${latest?.version} → awaiting approver.` });
  };
  const doDecide = (decision: "approved" | "rejected") => {
    wf.decidePolicyVersion(policy.id, decision);
    if (decision === "approved") {
      toast.success("Policy approved", {
        description: `${policy.name} ${latest?.version} approved — now in the ESAP register.`,
      });
    } else {
      toast("Version rejected", { description: `${policy.name} ${latest?.version} sent back for revision.` });
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-border/60 sm:max-w-[540px]">
        <SheetHeader className="space-y-3 pb-0">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <div className="section-label">Policy · {entityById(policy.entityId)?.short}</div>
              <SheetTitle className="mt-1 text-[19px] leading-tight tracking-tight">{policy.name}</SheetTitle>
              <SheetDescription className="mt-0.5 text-[12.5px]">
                Owner {owner?.name} · {approvedVersion ? `current ${approvedVersion}` : "no approved version yet"}
              </SheetDescription>
            </div>
            <StatePill state={reviewState} size="md" />
          </div>

          {/* Annual-review clock */}
          <div
            className="flex items-center justify-between rounded-xl border px-4 py-2.5"
            style={{
              borderColor: `color-mix(in oklab, var(--color-${reviewState === "overdue" ? "destructive" : reviewState === "expiring" ? "warning" : "success"}) 30%, transparent)`,
            }}
          >
            <div className="text-[11px] font-medium text-muted-foreground">
              Annual review due {fmtDate(policy.reviewDue)}
            </div>
            <div
              className={cn(
                "num text-[13px] font-semibold",
                reviewState === "overdue"
                  ? "text-destructive"
                  : reviewState === "expiring"
                    ? "text-warning"
                    : "text-success",
              )}
            >
              {reviewCountdownLabel(policy)}
            </div>
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5 pb-6">
          {/* Approval workflow */}
          <section className="rounded-xl border border-border/60 bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Approval workflow
              </div>
              {latest && <VersionStatusPill status={latest.status} />}
            </div>
            <ApprovalStepper current={step} />

            {/* Gate copy */}
            <div className="mt-4">
              {latest?.status === "approved" ? (
                <button
                  type="button"
                  onClick={onOpenEsap}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-[12px] font-semibold text-success transition-colors hover:bg-success/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <CircleCheck className="h-3.5 w-3.5" aria-hidden /> In the <A t="ESAP" /> register — open it{" "}
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                </button>
              ) : latest?.status === "rejected" ? (
                <p className="text-[12px] font-medium text-destructive">
                  Rejected — upload a revised version to resubmit.
                </p>
              ) : (
                <p className="text-[12px] text-muted-foreground">
                  Not yet in the <A t="ESAP" /> Register — approval pending.
                  {approvedVersion && (
                    <span className="mt-0.5 block text-[11px]">
                      Approved {approvedVersion} remains in force until this version is approved.
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Workflow actions (role-gated) */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {latest?.status === "draft" && (
                <Button
                  size="sm"
                  className="h-8 rounded-lg text-[12px]"
                  onClick={doSubmit}
                  disabled={!mayEdit}
                  title={mayEdit ? undefined : "Requires the Maintainer role (switch in Masters)"}
                >
                  Submit for approval
                </Button>
              )}
              {latest?.status === "submitted" && (
                <>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 rounded-lg text-[12px]"
                    onClick={() => doDecide("approved")}
                    disabled={!mayApprove}
                    title={mayApprove ? undefined : "Requires the Approver role (switch in Masters)"}
                  >
                    {!mayApprove && <Lock className="h-3.5 w-3.5" aria-hidden />}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg text-[12px]"
                    onClick={() => doDecide("rejected")}
                    disabled={!mayApprove}
                    title={mayApprove ? undefined : "Requires the Approver role (switch in Masters)"}
                  >
                    Reject
                  </Button>
                </>
              )}
              {!mayApprove && latest?.status === "submitted" && (
                <span className="text-[11px] text-muted-foreground">
                  Approval is limited to the Approver role — change it in Masters.
                </span>
              )}
            </div>
          </section>

          {/* Upload new version */}
          <section>
            <div className="section-label mb-2">Upload new version</div>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={doUpload} />
            <button
              type="button"
              onClick={() => (mayEdit ? fileRef.current?.click() : undefined)}
              disabled={!mayEdit}
              className={cn(
                "flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                mayEdit ? "hover:border-primary/50 hover:bg-muted/40" : "cursor-not-allowed opacity-60",
              )}
              title={mayEdit ? undefined : "Requires the Maintainer role (switch in Masters)"}
            >
              <UploadCloud className="h-6 w-6 text-muted-foreground" aria-hidden />
              <span className="text-[12.5px] font-medium">
                {mayEdit ? "Drop a file or click to upload" : "Upload requires the Maintainer role"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Adds a new draft version, pending submission (UI stub — no file is stored)
              </span>
            </button>
          </section>

          {/* Version history timeline */}
          <section>
            <div className="section-label mb-2">Version history</div>
            <ol className="space-y-3">
              {versions.map((v, i) => (
                <li key={`${v.version}-${i}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold",
                        v.status === "approved"
                          ? "bg-success/15 text-success"
                          : v.status === "rejected"
                            ? "bg-destructive/12 text-destructive"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i === 0 ? "★" : ""}
                    </span>
                    {i < versions.length - 1 && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="num text-[13px] font-semibold">{v.version}</span>
                      <VersionStatusPill status={v.status} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <User className="h-3 w-3" aria-hidden />
                      {personById(v.uploadedBy)?.name ?? v.uploadedBy} · uploaded {fmtDate(v.uploadedAt)}
                      {v.approvedOn && (
                        <>
                          {" · "}approved {fmtDate(v.approvedOn)}
                          {v.approvedBy ? ` by ${personById(v.approvedBy)?.name ?? v.approvedBy}` : ""}
                        </>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <DocChip name={v.doc.name} size={v.doc.size !== "—" ? v.doc.size : undefined} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
