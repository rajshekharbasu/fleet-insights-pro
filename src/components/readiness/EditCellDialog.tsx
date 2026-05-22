import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { CellState } from "@/lib/readiness-store";
import type { Site, Cell } from "@/lib/readiness-data";
import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";

export function EditCellDialog({
  open, onOpenChange, itemName, site, value, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itemName: string;
  site: Site;
  value: CellState;
  onSave: (v: CellState) => void;
}) {
  const [draft, setDraft] = useState<CellState>(value);
  useEffect(() => setDraft(value), [value, open]);

  const set = (patch: Partial<CellState>) => setDraft((d) => ({ ...d, ...patch }));
  const completed = draft.status === "yes";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Configure cell</DialogTitle>
          <DialogDescription className="text-[12px]">
            <span className="font-medium text-foreground">{itemName}</span> · site{" "}
            <span className="font-mono">{site}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <StatusBtn icon={CheckCircle2} label="Yes" active={draft.status === "yes"} tone="success" onClick={() => set({ status: "yes" as Cell })} />
              <StatusBtn icon={XCircle} label="No" active={draft.status === "no"} tone="destructive" onClick={() => set({ status: "no" as Cell })} />
              <StatusBtn icon={MinusCircle} label="N/A" active={draft.status === "na"} tone="muted" onClick={() => set({ status: "na" as Cell })} />
            </div>
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Deadline {completed && <span className="ml-1 text-[10px] normal-case tracking-normal">(only for incomplete items)</span>}
            </Label>
            <Input
              type="date"
              value={draft.deadline ?? ""}
              disabled={completed}
              onChange={(e) => set({ deadline: e.target.value || undefined })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Owner override</Label>
            <Input
              placeholder="e.g. A. Mehta"
              value={draft.owner ?? ""}
              onChange={(e) => set({ owner: e.target.value || undefined })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea
              placeholder="Context, blockers, vendor updates…"
              value={draft.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value || undefined })}
              className="mt-1.5 min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onSave(draft); onOpenChange(false); }}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusBtn({
  icon: Icon, label, active, onClick, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; active: boolean; onClick: () => void;
  tone: "success" | "destructive" | "muted";
}) {
  const tones: Record<string, string> = {
    success: active ? "bg-success/15 text-success ring-success/40" : "ring-border/50 hover:bg-success/8 hover:text-success",
    destructive: active ? "bg-destructive/12 text-destructive ring-destructive/40" : "ring-border/50 hover:bg-destructive/8 hover:text-destructive",
    muted: active ? "bg-muted text-foreground ring-border" : "ring-border/50 hover:bg-muted/60",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium ring-1 transition ${tones[tone]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
