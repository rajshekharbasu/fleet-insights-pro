import { useRef, useState } from "react";
import { FlaskConical, History, Plus, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { fmtDate, personById } from "@/lib/esg-data";
import type { GhgParamRow } from "@/lib/esg-masters";
import { A, PanelCard, ProvenanceChip, useEsg } from "./primitives";

const SCOPE_LABEL: Record<1 | 2 | 3, string> = { 1: "Scope 1", 2: "Scope 2", 3: "Scope 3" };

function FactorCell({ row, onCommit }: { row: GhgParamRow; onCommit: (factor: number, source: string, note: string) => void }) {
  const [factor, setFactor] = useState(String(row.factor));
  const [source, setSource] = useState(row.factorSource);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);

  const submit = () => {
    const f = Number(factor);
    if (!Number.isFinite(f) || !note.trim()) return;
    onCommit(f, source.trim() || row.factorSource, note.trim());
    setNote("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="num rounded-md border border-transparent px-1.5 py-0.5 text-right font-semibold transition-colors hover:border-primary/30 hover:bg-primary/6"
          title="Click to edit — a version note is required"
        >
          {row.factor}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Update factor — {row.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Factor (kgCO₂e/{row.unit})</Label>
              <Input inputMode="decimal" value={factor} onChange={(e) => setFactor(e.target.value)} className="h-9 text-[12.5px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Source</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} className="h-9 text-[12.5px]" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Version note <span className="text-destructive">— required</span></Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is this changing? e.g. CEA 2026 baseline update"
              className="h-9 text-[12.5px]"
            />
            <p className="text-[11px] text-muted-foreground">A changed factor is traceable — GHG numbers that silently change are a credibility risk.</p>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={submit} disabled={!note.trim() || !Number.isFinite(Number(factor))} className="text-[12px]">
            Save with note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddParamDialog({ onAdd }: { onAdd: (p: { label: string; scope: 1 | 2 | 3; unit: string; factor: number; factorSource: string; mode: "manual" | "auto" }) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"1" | "2" | "3">("1");
  const [unit, setUnit] = useState("");
  const [factor, setFactor] = useState("");
  const [factorSource, setFactorSource] = useState("");

  const valid = label.trim() && unit.trim() && Number.isFinite(Number(factor)) && factorSource.trim();

  const submit = () => {
    if (!valid) return;
    onAdd({ label: label.trim(), scope: Number(scope) as 1 | 2 | 3, unit: unit.trim(), factor: Number(factor), factorSource: factorSource.trim(), mode: "manual" });
    setLabel("");
    setUnit("");
    setFactor("");
    setFactorSource("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 text-[12px]">
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add parameter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Add GHG parameter</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Biomass fuel" className="h-9 text-[12.5px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                <SelectTrigger className="h-9 text-[12.5px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1" className="text-[12.5px]">Scope 1</SelectItem>
                  <SelectItem value="2" className="text-[12.5px]">Scope 2</SelectItem>
                  <SelectItem value="3" className="text-[12.5px]">Scope 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg" className="h-9 text-[12.5px]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Factor</Label>
              <Input inputMode="decimal" value={factor} onChange={(e) => setFactor(e.target.value)} className="h-9 text-[12.5px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Factor source</Label>
              <Input value={factorSource} onChange={(e) => setFactorSource(e.target.value)} placeholder="DEFRA 2026" className="h-9 text-[12.5px]" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={submit} disabled={!valid} className="text-[12px]">
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportFactorsDialog({ open, onOpenChange, rows, onConfirm }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rows: GhgParamRow[];
  onConfirm: (rows: { id: string; factor: number; factorSource?: string }[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ id: string; label: string; factor: number; matched: boolean }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setParsed(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const parse = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
        if (!json.length) {
          setError("The sheet has no rows.");
          return;
        }
        const out = json
          .map((r) => {
            const id = String(r.id ?? r.paramId ?? "").trim();
            const factor = Number(r.factor ?? r.Factor);
            const match = rows.find((x) => x.id === id);
            return { id, label: match?.label ?? id, factor, matched: !!match && Number.isFinite(factor) };
          })
          .filter((r) => r.id);
        if (!out.length) {
          setError("No recognisable rows. Use `id` and `factor` columns.");
          return;
        }
        setParsed(out);
      } catch {
        setError("Could not read this file — make sure it's a valid .xlsx workbook.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const matched = parsed?.filter((r) => r.matched) ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Import emission factors from Excel</DialogTitle>
        </DialogHeader>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parse(f); }} />
        {!parsed ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
          >
            <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
            <span className="text-[12.5px] font-medium">Drop an .xlsx or click to choose</span>
            <span className="text-[11px] text-muted-foreground">Columns: id, factor, factorSource (optional)</span>
          </button>
        ) : (
          <div className="max-h-[240px] space-y-1.5 overflow-y-auto text-[12px]">
            {parsed.map((r, i) => (
              <div key={i} className={cn("flex items-center justify-between rounded-lg border border-border/50 px-3 py-1.5", !r.matched && "bg-warning/6")}>
                <span>{r.label}</span>
                <span className="num">{Number.isFinite(r.factor) ? r.factor : "—"}</span>
                <span className={r.matched ? "text-success" : "text-warning"}>{r.matched ? "will import" : "unmatched — skipped"}</span>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-[12px] font-medium text-destructive">{error}</p>}
        <DialogFooter>
          {parsed && (
            <Button size="sm" variant="outline" className="text-[12px]" onClick={reset}>
              Choose another file
            </Button>
          )}
          <Button
            size="sm"
            className="text-[12px]"
            disabled={!matched.length}
            onClick={() => {
              onConfirm(matched.map((r) => ({ id: r.id, factor: r.factor })));
              reset();
              onOpenChange(false);
            }}
          >
            Import {matched.length || ""} factors
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** GHG scope & emission-factor master — editable, versioned, importable from Excel. */
export function GhgMastersPanel() {
  const { masters } = useEsg();
  const [importOpen, setImportOpen] = useState(false);
  const rows = masters.ghgParams();

  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <FlaskConical className="h-4 w-4 text-primary" aria-hidden /> <A t="GHG" /> scope &amp; emission factors
          </h3>
          <p className="text-[12px] text-muted-foreground">
            Master data supplied by Diganta, maintained here — every factor change carries a note.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" aria-hidden /> Import Excel
          </Button>
          <AddParamDialog onAdd={(p) => masters.addGhgParam(p)} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-[12.5px]">
          <thead>
            <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="px-5 py-2.5 text-left font-medium">Parameter</th>
              <th className="px-3 py-2.5 text-left font-medium">Scope</th>
              <th className="px-3 py-2.5 text-right font-medium">Factor</th>
              <th className="px-3 py-2.5 text-left font-medium">Source</th>
              <th className="px-3 py-2.5 text-left font-medium">Last updated</th>
              <th className="px-5 py-2.5 text-right font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn("border-b border-border/40 last:border-0", !r.active && "opacity-50")}>
                <td className="px-5 py-2.5 font-medium">
                  {r.label}
                  {r.prov ? (
                    <div className="mt-0.5">
                      <ProvenanceChip prov={r.prov} />
                    </div>
                  ) : (
                    r.note && (
                      <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground">
                        <History className="h-2.5 w-2.5" aria-hidden /> {r.note}
                      </div>
                    )
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{SCOPE_LABEL[r.scope]}</td>
                <td className="px-3 py-2.5 text-right">
                  <FactorCell row={r} onCommit={(factor, source, note) => masters.setGhgFactor(r.id, factor, source, note)} />
                </td>
                <td className="px-3 py-2.5 text-[11.5px] text-muted-foreground">{r.factorSource}</td>
                <td className="px-3 py-2.5 text-[11px] text-muted-foreground">
                  {r.updatedOn ? `${fmtDate(r.updatedOn)}${r.updatedBy ? ` · ${personById(r.updatedBy)?.name ?? r.updatedBy}` : ""}` : "—"}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <Switch checked={r.active} onCheckedChange={(v) => masters.setGhgActive(r.id, v)} aria-label={`${r.label} active`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ImportFactorsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        rows={rows}
        onConfirm={(imported) => {
          masters.importGhgFactors(imported);
          toast.success("Emission factors imported", { description: `${imported.length} factors updated from Excel.` });
        }}
      />
    </PanelCard>
  );
}
