import { useState } from "react";
import { KeyRound, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearApiKey, getApiKey, hasApiKey, setApiKey } from "@/lib/api/config";

export function ApiKeyControl({ onChange }: { onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const present = hasApiKey();

  function openDialog(next: boolean) {
    if (next) setValue(getApiKey());
    setOpen(next);
  }

  function save() {
    setApiKey(value);
    setOpen(false);
    onChange();
    toast.success(value.trim() ? "API key saved." : "API key cleared.");
  }

  function clear() {
    clearApiKey();
    setValue("");
    setOpen(false);
    onChange();
    toast.success("API key cleared.");
  }

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={present
            ? "border-success/40 text-success hover:bg-success/10"
            : "border-warning/40 text-warning hover:bg-warning/10"}
        >
          {present ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {present ? "API key set" : "Set API key"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Fleet Analytics API key
          </DialogTitle>
          <DialogDescription>
            Sent as the <code className="rounded bg-muted px-1 py-0.5 text-[11px]">X-API-Key</code> header on
            every request. Stored locally in this browser only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="api-key">API key</Label>
          <Input
            id="api-key"
            type="password"
            autoComplete="off"
            placeholder="Paste your X-API-Key…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {present && (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={clear}>
              Clear
            </Button>
          )}
          <Button onClick={save}>Save key</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
