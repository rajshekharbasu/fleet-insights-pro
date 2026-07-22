import { useState } from "react";
import { BookOpen, CalendarClock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { entityById, personById, policiesDueForReview, POLICIES, type Policy, type PolicyVersion } from "@/lib/esg-data";
import {
  currentApprovedVersion,
  latestVersion,
  policyReviewState,
  reviewCountdownLabel,
} from "@/lib/esg-policy";
import { EmptyState, PanelCard, StatePill, useEsg } from "../primitives";
import { DocStatusPill } from "./DocStatus";
import { PolicyDrawer } from "./PolicyDrawer";

/** Maps a policy version status onto the document-workflow pill vocabulary. */
const VERSION_TO_DOC_STATUS: Record<string, string> = {
  approved: "approved",
  submitted: "under-review",
  draft: "draft",
  rejected: "draft",
};

export function PoliciesPanel({ onOpenEsap }: { onOpenEsap: () => void }) {
  const { scope, policy: wf } = useEsg();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const policies = POLICIES.filter((p) => !scope.entityId || p.entityId === scope.entityId);
  const dueForReview = policiesDueForReview(scope);
  const selected = selectedId ? POLICIES.find((p) => p.id === selectedId) ?? null : null;

  return (
    <div className="space-y-4">
      {/* Annual review banner */}
      {dueForReview.length > 0 && (
        <PanelCard accent="var(--color-warning)">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warning/14 text-warning">
              <CalendarClock className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">
                {dueForReview.length} {dueForReview.length === 1 ? "policy needs" : "policies need"} annual review
              </div>
              <div className="text-[11.5px] text-muted-foreground">
                {dueForReview
                  .map((p) => `${p.name} (${reviewCountdownLabel(p)})`)
                  .join(" · ")}
              </div>
            </div>
          </div>
        </PanelCard>
      )}

      <PanelCard>
        <div className="border-b border-border/60 px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <BookOpen className="h-4 w-4 text-primary" aria-hidden /> Policies
          </h3>
          <p className="text-[12px] text-muted-foreground">
            Versioned and annually reviewed. Approval gates a policy's entry into the ESAP register — open a row to
            upload, submit, and approve.
          </p>
        </div>
        {policies.length === 0 ? (
          <EmptyState title="No policies in this scope" hint="Corporate policies live under the Corporate (HQ) entity." />
        ) : (
          <div className="divide-y divide-border/40">
            {policies.map((p) => (
              <PolicyRow key={p.id} policy={p} versionsFor={wf.policyVersions} onOpen={() => setSelectedId(p.id)} />
            ))}
          </div>
        )}
      </PanelCard>

      {selected && (
        <PolicyDrawer policy={selected} onClose={() => setSelectedId(null)} onOpenEsap={onOpenEsap} />
      )}
    </div>
  );
}

function PolicyRow({
  policy,
  versionsFor,
  onOpen,
}: {
  policy: Policy;
  versionsFor: (id: string) => PolicyVersion[];
  onOpen: () => void;
}) {
  const versions = versionsFor(policy.id);
  const latest = latestVersion(versions);
  const approved = currentApprovedVersion(versions);
  const reviewState = policyReviewState(policy);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[13px] font-medium">{policy.name}</span>
          <span className="num rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {approved ?? "no approved version"}
          </span>
          {latest && <DocStatusPill status={VERSION_TO_DOC_STATUS[latest.status] ?? "draft"} />}
        </div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
          {entityById(policy.entityId)?.short} · owner {personById(policy.ownerId)?.name}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Annual review</div>
          <div
            className={cn(
              "num text-[12px] font-semibold",
              reviewState === "overdue"
                ? "text-destructive"
                : reviewState === "expiring"
                  ? "text-warning"
                  : "text-muted-foreground",
            )}
          >
            {reviewCountdownLabel(policy)}
          </div>
        </div>
        {reviewState !== "valid" && <StatePill state={reviewState} />}
        <ChevronRight className="h-4 w-4 text-muted-foreground/60" aria-hidden />
      </div>
    </button>
  );
}
