import { cn } from "@/lib/utils";

/**
 * Document-workflow status chip (approved / under-review / draft). Distinct from
 * `StatePill`, which encodes the compliance state machine (valid/expiring/overdue).
 * Label + tint — never colour alone.
 */
export const DOC_STATUS: Record<string, { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "bg-success/12 text-success" },
  "under-review": { label: "Under review", cls: "bg-warning/14 text-warning" },
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
};

export function DocStatusPill({ status }: { status: string }) {
  const m = DOC_STATUS[status] ?? DOC_STATUS.draft;
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
