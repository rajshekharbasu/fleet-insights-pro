import { useMemo, useRef, useState } from "react";
import { ArrowRight, Download, Eye, FileOutput, Globe, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AMR_FIELDS,
  AMR_VALUES,
  ASSESSMENTS,
  CARBON,
  GHG_PARAMS,
  GHG_QTY,
  PERIODS,
  RECORDS,
  REPORT_DEFS,
  fmtDate,
  inScope,
  personById,
  recordPlace,
  recordState,
  scopeLabel,
  typeByKey,
  type ReportDef,
} from "@/lib/esg-data";
import {
  buildNcRegister,
  NC_SOURCE_LABEL,
  ncItemOwnerName,
  ncItemPlace,
  ncRaisedLabel,
  sortNcRegister,
  type NcItem,
} from "@/lib/esg-nc";
import { exportToXlsx } from "@/lib/export-xlsx";
import { A, DocChip, EmptyState, Gloss, PanelCard, StatePill, WithheldPill, useEsg, useStubLoad, LoadingRows } from "./primitives";

const nf = new Intl.NumberFormat("en-IN");

const KIND_LABEL: Record<ReportDef["kind"], string> = {
  rollup: "Roll-up · no new input",
  "external-format": "External format · configured",
  narrative: "Narrative",
  calculation: "Calculation",
};

function ncExportRows(items: NcItem[]) {
  return items.map((r) => ({
    "NC ref": r.ref,
    Source: NC_SOURCE_LABEL[r.source],
    Finding: r.title,
    Entity: ncItemPlace(r),
    Raised: ncRaisedLabel(r),
    "Age (days)": r.ageDays,
    Severity: r.severity ?? "",
    Owner: ncItemOwnerName(r),
    "Corrective action status": r.actionStatus,
  }));
}

/** Two-step egress: curation review is an unavoidable stage, never a checkbox. */
function ExportFlow({ def, onDone }: { def: ReportDef; onDone: () => void }) {
  const { scope, period, audit, monitoring } = useEsg();
  const [step, setStep] = useState<1 | 2>(1);
  const isNc = def.id === "nc-report";

  const withheld = useMemo(
    () => RECORDS.filter((r) => inScope(r, scope)).filter((r) => r.withheldExternal),
    [scope],
  );
  const ncRegister = useMemo(
    () => (isNc ? buildNcRegister(scope, period, audit, monitoring) : []),
    [isNc, scope, period, audit, monitoring],
  );
  const ncWithheld = useMemo(() => ncRegister.filter((r) => r.withheldExternal), [ncRegister]);
  const ncVisible = useMemo(() => ncRegister.filter((r) => !r.withheldExternal), [ncRegister]);

  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const includedCount = isNc
    ? ncWithheld.filter((r) => included[r.id]).length
    : withheld.filter((r) => included[r.id]).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="max-w-[560px] gap-0 overflow-hidden rounded-2xl border-border/60 p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-[16px] tracking-tight">
            {step === 1 ? "Curation review — before anything leaves" : "External preview"}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {def.name} · {scopeLabel(scope)} · {PERIODS.find((p) => p.id === period)?.label}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <>
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/8 px-3.5 py-2.5 text-[12px] font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                {isNc ? ncWithheld.length : withheld.length} item{(isNc ? ncWithheld.length : withheld.length) === 1 ? "" : "s"} withheld
                from external audiences by default. Including one is a deliberate, logged decision.
              </div>
              <div className="mt-3 max-h-[260px] space-y-2 overflow-auto pr-1">
                {isNc ? (
                  ncWithheld.length === 0 ? (
                    <p className="py-6 text-center text-[12.5px] text-muted-foreground">Nothing is withheld in this scope — the external artifact equals the internal one.</p>
                  ) : (
                    ncWithheld.map((r) => (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 transition-colors hover:border-primary/30"
                      >
                        <Checkbox
                          checked={!!included[r.id]}
                          onCheckedChange={(v) => setIncluded((m) => ({ ...m, [r.id]: v === true }))}
                          className="mt-0.5"
                          aria-label={`Include ${r.title} in external artifact`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[12.5px] font-medium">{r.title}</span>
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {NC_SOURCE_LABEL[r.source]}
                            </span>
                            <WithheldPill />
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                            {ncItemPlace(r)} · raised {ncRaisedLabel(r)} · {r.ageDays}d old
                            {r.remarks ? ` · ${r.remarks.slice(0, 70)}…` : ""}
                          </span>
                        </span>
                      </label>
                    ))
                  )
                ) : withheld.length === 0 ? (
                  <p className="py-6 text-center text-[12.5px] text-muted-foreground">Nothing is withheld in this scope — the external artifact equals the internal one.</p>
                ) : (
                  withheld.map((r) => {
                    const t = typeByKey(r.typeKey);
                    return (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 transition-colors hover:border-primary/30"
                      >
                        <Checkbox
                          checked={!!included[r.id]}
                          onCheckedChange={(v) => setIncluded((m) => ({ ...m, [r.id]: v === true }))}
                          className="mt-0.5"
                          aria-label={`Include ${t?.label} in external artifact`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[12.5px] font-medium">{t?.label}</span>
                            <StatePill state={recordState(r)} />
                            <WithheldPill />
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                            {recordPlace(r)} · expired {fmtDate(r.expiryDate)} · {r.remarks?.slice(0, 80)}…
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-3.5">
              <span className="text-[11.5px] text-muted-foreground">
                {includedCount === 0 ? "All withheld items stay internal" : `${includedCount} withheld item${includedCount === 1 ? "" : "s"} will be disclosed`}
              </span>
              <Button size="sm" className="h-8 gap-1.5 rounded-lg text-[12px]" onClick={() => setStep(2)}>
                Preview external variant <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="px-5 py-4">
              <div className="rounded-xl border border-border/70 border-dashed p-4">
                <div className="mb-3 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <Globe className="h-3 w-3" aria-hidden /> External view — curated · exactly what leaves the building
                </div>
                <div className="text-[15px] font-semibold tracking-tight">{def.name}</div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {scopeLabel(scope)} · {PERIODS.find((p) => p.id === period)?.label}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {(isNc
                    ? [
                        { l: "Disclosed NCs", v: String(ncVisible.length + includedCount) },
                        { l: "Withheld", v: String(ncWithheld.length - includedCount) },
                        { l: "Total in scope", v: String(ncRegister.length) },
                      ]
                    : [
                        { l: "Tracked items", v: String(RECORDS.filter((r) => inScope(r, scope)).length) },
                        {
                          l: "Disclosed lapses",
                          v: String(includedCount),
                        },
                        {
                          l: "Compliance",
                          v: `${Math.round(((RECORDS.filter((r) => inScope(r, scope)).length - RECORDS.filter((r) => inScope(r, scope)).filter((x) => recordState(x) === "overdue").length) / Math.max(1, RECORDS.filter((r) => inScope(r, scope)).length)) * 100)}%`,
                        },
                      ]
                  ).map((s) => (
                    <div key={s.l} className="rounded-lg bg-muted/40 px-3 py-2">
                      <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{s.l}</div>
                      <div className="num mt-0.5 text-[16px] font-semibold">{s.v}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Withheld items are absent here — not hidden rows, a different artifact. The internal record stays complete and remediation-tracked.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-3.5">
              <Button variant="ghost" size="sm" className="h-8 rounded-lg text-[12px]" onClick={() => setStep(1)}>
                Back to curation
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 rounded-lg text-[12px]"
                onClick={() => {
                  if (isNc) {
                    const disclosed = ncWithheld.filter((r) => included[r.id]);
                    const finalRows = [...ncVisible, ...disclosed];
                    exportToXlsx(`nc-report-external-${period}`, [
                      { key: "NC ref", header: "NC ref" },
                      { key: "Source", header: "Source" },
                      { key: "Finding", header: "Finding" },
                      { key: "Entity", header: "Entity" },
                      { key: "Raised", header: "Raised" },
                      { key: "Age (days)", header: "Age (days)" },
                      { key: "Severity", header: "Severity" },
                      { key: "Owner", header: "Owner" },
                      { key: "Corrective action status", header: "Corrective action status" },
                    ], ncExportRows(finalRows), "NC Report");
                    toast.success("External NC report downloaded", {
                      description: `${finalRows.length} rows (${includedCount} disclosed withheld item${includedCount === 1 ? "" : "s"}).`,
                    });
                  } else {
                    toast.success("External artifact prepared", {
                      description: `${def.name} exported with ${includedCount} disclosed lapse${includedCount === 1 ? "" : "s"}. (UI stub — real export lands with the backend.)`,
                    });
                  }
                  onDone();
                }}
              >
                <Download className="h-3.5 w-3.5" /> Export external variant
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InternalPreview({ def }: { def: ReportDef }) {
  const { scope, period, audience, audit, monitoring } = useEsg();
  const records = RECORDS.filter((r) => inScope(r, scope));
  const external = audience === "external";

  if (def.id === "nc-report") {
    const register = sortNcRegister(buildNcRegister(scope, period, audit, monitoring));
    const rows = register.filter((r) => (external ? !r.withheldExternal : true));
    const withheldCount = register.length - rows.length;
    if (rows.length === 0) {
      return <EmptyState title="No non-compliances in this scope" hint={external ? "Withheld items are not shown in the external view." : undefined} />;
    }
    return (
      <div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-medium">Finding</th>
                <th className="px-3 py-2.5 text-left font-medium">Source</th>
                <th className="px-3 py-2.5 text-left font-medium">Entity</th>
                <th className="px-3 py-2.5 text-right font-medium">Age</th>
                <th className="px-3 py-2.5 text-left font-medium">Owner</th>
                <th className="px-5 py-2.5 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 align-top last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium">{r.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {r.ref}
                      {r.withheldExternal && !external && <WithheldPill />}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{NC_SOURCE_LABEL[r.source]}</td>
                  <td className="px-3 py-3">{ncItemPlace(r)}</td>
                  <td className="num px-3 py-3 text-right font-semibold">{r.ageDays}d</td>
                  <td className="px-3 py-3 text-[12px]">{ncItemOwnerName(r)}</td>
                  <td className="max-w-[220px] px-5 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
                    {r.actionStatus === "none" ? "No corrective action" : r.actionStatus}
                    {r.remarks ? ` — ${r.remarks.slice(0, 60)}…` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!external && withheldCount > 0 && (
          <p className="border-t border-border/40 px-5 py-2.5 text-[11.5px] text-muted-foreground">
            {withheldCount} item{withheldCount === 1 ? "" : "s"} withheld from the external view.
          </p>
        )}
      </div>
    );
  }

  if (def.id === "noncompliance") {
    const rows = records
      .filter((r) => recordState(r) !== "valid")
      .filter((r) => (external ? !r.withheldExternal : true))
      .sort((a, b) => (recordState(a) === "overdue" ? -1 : 1) - (recordState(b) === "overdue" ? -1 : 1));
    if (rows.length === 0) return <EmptyState title="Nothing out of validity" hint={external ? "Withheld items are not shown in the external view." : undefined} />;
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12.5px]">
          <thead>
            <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="px-5 py-2.5 text-left font-medium">Item</th>
              <th className="px-3 py-2.5 text-left font-medium">State</th>
              <th className="px-3 py-2.5 text-left font-medium">Owner</th>
              <th className="px-5 py-2.5 text-left font-medium">Root cause / plan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/40 align-top last:border-0">
                <td className="px-5 py-3">
                  <div className="font-medium">
                    <Gloss text={typeByKey(r.typeKey)?.label ?? ""} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {recordPlace(r)} · expires {fmtDate(r.expiryDate)}
                    {r.withheldExternal && !external && <WithheldPill />}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <StatePill state={recordState(r)} />
                </td>
                <td className="px-3 py-3 text-[12px]">{personById(r.ownerId)?.name}</td>
                <td className="max-w-[300px] px-5 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  {r.remarks ?? "Renewal window open; no lapse yet."}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (def.id === "amr") {
    const vals = AMR_VALUES[period] ?? {};
    return (
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {AMR_FIELDS.map((f) => {
          const v = vals[f.id];
          return (
            <div key={f.id} className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3">
              <div className="truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{f.label}</div>
              <div className="num mt-1 text-[17px] font-semibold">
                {v?.value != null ? nf.format(v.value) : <span className="text-muted-foreground">not captured</span>}
                {v?.value != null && <span className="ml-1 text-[10.5px] font-medium text-muted-foreground">{f.unit}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (def.id === "ghg") {
    const total = GHG_PARAMS.reduce((acc, p) => acc + (GHG_QTY[period]?.[p.id] ?? 0) * p.factor, 0);
    return (
      <div className="grid gap-3 p-5 sm:grid-cols-4">
        {([1, 2, 3] as const).map((s) => {
          const t = GHG_PARAMS.filter((p) => p.scope === s).reduce((acc, p) => acc + (GHG_QTY[period]?.[p.id] ?? 0) * p.factor, 0);
          return (
            <div key={s} className="rounded-xl border border-border/50 bg-muted/20 px-3.5 py-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Scope {s}</div>
              <div className="num mt-1 text-[17px] font-semibold">
                {nf.format(Math.round(t / 100) / 10)} <span className="text-[10.5px] font-medium text-muted-foreground">tCO₂e</span>
              </div>
            </div>
          );
        })}
        <div className="rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">Total</div>
          <div className="num mt-1 text-[17px] font-semibold text-primary">
            {nf.format(Math.round(total / 100) / 10)} <span className="text-[10.5px] font-medium">tCO₂e</span>
          </div>
        </div>
      </div>
    );
  }

  if (def.id === "brsr") {
    return (
      <div className="space-y-2 p-5">
        {["Section A — General disclosures", "Section B — Management & process", "Section C — Principle-wise performance"].map((s, i) => (
          <div key={s} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
            <span className="text-[12.5px] font-medium">{s}</span>
            <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", i < 2 ? "bg-success/12 text-success" : "bg-warning/14 text-warning")}>
              {i < 2 ? "Mapped" : "12 fields pending"}
            </span>
          </div>
        ))}
        <p className="pt-1 text-[11.5px] leading-relaxed text-muted-foreground">
          Generated per project, rolled up to group — the roll-up is native to the report, mirroring the dashboard. Disclosure format follows <A t="SEBI" /> <A t="BRSR" /> as configured in Masters.
        </p>
      </div>
    );
  }

  if (def.id === "impact") {
    return (
      <div className="space-y-3 p-5">
        {ASSESSMENTS.filter((a) => a.status === "complete").map((a) => (
          <div key={a.id} className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <A t={a.kind} /> · {fmtDate(a.completedOn!)}
            </div>
            <div className="mt-1 text-[13px] font-medium">{a.project}</div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              {a.params.filter((p) => p.result === "ok").length} of {a.params.length} parameters adequate;{" "}
              {a.params.filter((p) => p.result === "gap").length} gaps feeding the <A t="ESAP" /> register.
            </p>
          </div>
        ))}
      </div>
    );
  }

  // carbon
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 p-5">
      <div>
        <div className="num text-[30px] font-semibold leading-none text-success">{nf.format(CARBON.cumulativeSavedT)}</div>
        <div className="mt-1 text-[11.5px] font-medium text-muted-foreground">cumulative tCO₂e avoided by EV fleet operation</div>
      </div>
      <p className="max-w-[380px] text-[11.5px] leading-relaxed text-muted-foreground">{CARBON.methodology}</p>
    </div>
  );
}

/* ------------------------------- upload zone -------------------------------- */

type UploadedFile = { id: string; name: string; size: string; uploadedAt: string };

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Attach the finished file for a report — internal-only, alongside the always-generated preview above. */
function UploadedReports({
  def,
  files,
  onAdd,
  onRemove,
}: {
  def: ReportDef;
  files: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onRemove: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const added = Array.from(list).map((f) => ({
      id: `${f.name}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: humanSize(f.size),
      uploadedAt: new Date().toISOString(),
    }));
    onAdd(added);
    toast.success(`${added.length} file${added.length === 1 ? "" : "s"} uploaded`, {
      description: `${def.name} — attached to this report. (UI stub — lands in the document store when the backend connects.)`,
    });
  };

  const remove = (id: string, name: string) => {
    onRemove(id);
    toast("File removed", { description: `${name} detached from ${def.name}. (UI stub)` });
  };

  return (
    <PanelCard>
      <div className="border-b border-border/60 px-5 py-3.5">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <UploadCloud className="h-4 w-4 text-primary" aria-hidden /> Uploaded reports
        </h3>
        <p className="text-[12px] text-muted-foreground">
          Attach the finished {def.name} file here — evidence for this export, alongside the internal record above.
        </p>
      </div>
      <div className="p-5">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
            dragOver ? "border-primary/60 bg-primary/8" : "border-border hover:border-primary/40 hover:bg-muted/30",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <UploadCloud className="h-5 w-5 text-muted-foreground" aria-hidden />
          <div className="text-[12.5px] font-medium">
            Drop files here, or <span className="text-primary underline underline-offset-2">browse</span>
          </div>
          <div className="text-[11px] text-muted-foreground">PDF, XLSX, or image — any size (UI stub, not persisted)</div>
        </label>

        {files.length === 0 ? (
          <p className="mt-3 text-[11.5px] text-muted-foreground">No files uploaded yet for this report.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
              >
                <DocChip name={f.name} size={f.size} />
                <span className="text-[10.5px] text-muted-foreground">
                  uploaded {new Date(f.uploadedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  type="button"
                  onClick={() => remove(f.id, f.name)}
                  aria-label={`Remove ${f.name}`}
                  className="ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelCard>
  );
}

export function ReportsTab() {
  const { scope, period, audience, audit, monitoring } = useEsg();
  const [sel, setSel] = useState<string>("noncompliance");
  const [exporting, setExporting] = useState(false);
  const [uploads, setUploads] = useState<Record<string, UploadedFile[]>>({});
  const loading = useStubLoad(sel + period + JSON.stringify(scope));
  const def = REPORT_DEFS.find((d) => d.id === sel)!;

  const downloadCompleteNcReport = () => {
    const register = sortNcRegister(buildNcRegister(scope, period, audit, monitoring));
    exportToXlsx(
      `nc-report-internal-${period}`,
      [
        { key: "NC ref", header: "NC ref" },
        { key: "Source", header: "Source" },
        { key: "Finding", header: "Finding" },
        { key: "Entity", header: "Entity" },
        { key: "Raised", header: "Raised" },
        { key: "Age (days)", header: "Age (days)" },
        { key: "Severity", header: "Severity" },
        { key: "Owner", header: "Owner" },
        { key: "Corrective action status", header: "Corrective action status" },
      ],
      ncExportRows(register),
      "NC Report",
    );
    toast.success("Internal NC report downloaded", { description: `${register.length} rows — nothing withheld internally.` });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_DEFS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSel(d.id)}
            aria-pressed={sel === d.id}
            className={cn(
              "rounded-2xl border bg-card p-4 text-left shadow-elevated transition-all hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              sel === d.id ? "border-primary/50 ring-1 ring-primary/30" : "border-border/60",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13.5px] font-semibold tracking-tight">
                <Gloss text={d.name} />
              </span>
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {KIND_LABEL[d.kind]}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{d.blurb}</p>
          </button>
        ))}
      </div>

      <PanelCard>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <FileOutput className="h-4 w-4 text-primary" aria-hidden />
              {def.name} — {audience === "external" ? "external variant" : "internal variant (complete)"}
            </h3>
            <p className="text-[12px] text-muted-foreground">
              {scopeLabel(scope)} · {PERIODS.find((p) => p.id === period)?.label} · every report has two variants; export is the only egress.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-[11px] font-medium text-muted-foreground md:inline-flex">
              <Eye className="h-3 w-3" aria-hidden /> internal always complete
            </span>
            {def.id === "nc-report" && audience === "internal" && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg text-[12px]" onClick={downloadCompleteNcReport}>
                <Download className="h-3.5 w-3.5" /> Download complete
              </Button>
            )}
            <Button size="sm" className="h-8 gap-1.5 rounded-lg text-[12px]" onClick={() => setExporting(true)}>
              <Globe className="h-3.5 w-3.5" /> Prepare external export
            </Button>
          </div>
        </div>
        {loading ? <LoadingRows rows={4} /> : <InternalPreview def={def} />}
      </PanelCard>

      {audience === "internal" && (
        <UploadedReports
          def={def}
          files={uploads[sel] ?? []}
          onAdd={(added) => setUploads((m) => ({ ...m, [sel]: [...added, ...(m[sel] ?? [])] }))}
          onRemove={(id) => setUploads((m) => ({ ...m, [sel]: (m[sel] ?? []).filter((f) => f.id !== id) }))}
        />
      )}

      {exporting && <ExportFlow def={def} onDone={() => setExporting(false)} />}
    </div>
  );
}
