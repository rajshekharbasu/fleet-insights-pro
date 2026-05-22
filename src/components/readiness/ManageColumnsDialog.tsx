import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { CustomColumn } from "@/lib/readiness-store";

export function ManageColumnsDialog({
  open, onOpenChange, columns, onAdd, onRemove,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  columns: CustomColumn[];
  onAdd: (label: string, type: CustomColumn["type"]) => void;
  onRemove: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomColumn["type"]>("text");

  const add = () => {
    if (!label.trim()) return;
    onAdd(label.trim(), type);
    setLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Manage columns</DialogTitle>
          <DialogDescription className="text-[12px]">
            Add custom item-level columns (vendor, PO #, RFQ status…). Each column applies to every row.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">New column</Label>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Input
                placeholder="Column name"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                className="flex-1 min-w-[180px]"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CustomColumn["type"])}
                className="h-9 rounded-md border border-input bg-background px-3 text-[13px]"
              >
                <option value="text">Text</option>
                <option value="date">Date</option>
                <option value="number">Number</option>
              </select>
              <Button onClick={add} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>

          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Current custom columns ({columns.length})
            </Label>
            <div className="mt-2 space-y-1.5">
              {columns.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/50 px-3 py-6 text-center text-[12px] text-muted-foreground">
                  No custom columns yet
                </div>
              )}
              {columns.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                  <div>
                    <div className="text-[13px] font-medium">{c.label}</div>
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{c.type}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onRemove(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
