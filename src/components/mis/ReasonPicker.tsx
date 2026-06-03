import { useState } from "react";
import { REASON_OPTIONS } from "@/lib/mis/constants";
import type { RemarkCode } from "@/lib/mis/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReasonPicker({
  onConfirm,
  onCancel,
  initialRemark = 1,
  initialNotes = "",
}: {
  onConfirm: (remark: RemarkCode, notes: string) => void;
  onCancel: () => void;
  initialRemark?: RemarkCode;
  initialNotes?: string;
}) {
  const [remark, setRemark] = useState<RemarkCode>(initialRemark);
  const [notes, setNotes] = useState(initialNotes);

  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
      <select
        value={remark}
        onChange={(e) => setRemark(Number(e.target.value) as RemarkCode)}
        className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-[12px]"
      >
        {REASON_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Input
        placeholder="Additional notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="h-8 text-[12px]"
      />
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-[11px]" onClick={() => onConfirm(remark, notes)}>
          Confirm
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
