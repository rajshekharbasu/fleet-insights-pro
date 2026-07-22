import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleCheck,
  FileUp,
  Link2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  entityById,
  fmtDate,
  PEOPLE,
  personById,
  RECORDS,
  typeByKey,
  type Audit,
  type AuditFinding,
} from "@/lib/esg-data";
import { FINDING_RESULT_META, type CorrectiveDraft } from "@/lib/esg-audit";
import { A, DocChip, WithheldPill, useEsg } from "../primitives";

const RESULT_ICON = {
  compliant: CircleCheck,
  observation: TriangleAlert,
  nc: ShieldAlert,
} as const;

function FindingResultChip({ result }: { result: AuditFinding["result"] }) {
  const meta = FINDING_RESULT_META[result];
  const Icon = RESULT_ICON[result];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {result === "nc" ? <A t="NC" /> : meta.label}
    </span>
  );
}

/** Create-corrective-action dialog for an NC row → appends into the ESAP register. */
function CorrectiveActionDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (d: CorrectiveDraft) => void;
}) {
  const [action, setAction] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [due, setDue] = useState("");
  const valid = action.trim() && ownerId && due;

  const submit = () => {
    if (!valid) return;
    onCreate({ action: action.trim(), ownerId, due });
    setAction("");
    setOwnerId("");
    setDue("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Create corrective action</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Corrective action</Label>
            <Textarea
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="What will close this non-conformity?"
              className="min-h-[72px] text-[12.5px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Owner</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="h-9 text-[12.5px]">
                  <SelectValue placeholder="Assign owner" />
                </SelectTrigger>
                <SelectContent>
                  {PEOPLE.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-[12.5px]">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Due date</Label>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-9 text-[12.5px]" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={submit} disabled={!valid} className="text-[12px]">
            Add to <A t="ESAP" /> register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Add-finding dialog. NC result forces a remark before the finding can be saved. */
function AddFindingDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (d: {
    clause: string;
    area: string;
    result: AuditFinding["result"];
    severity?: "major" | "minor";
    remarks?: string;
  }) => void;
}) {
  const [clause, setClause] = useState("");
  const [area, setArea] = useState("");
  const [result, setResult] = useState<AuditFinding["result"]>("compliant");
  const [severity, setSeverity] = useState<"major" | "minor">("minor");
  const [remarks, setRemarks] = useState("");

  const ncMissingRemarks = result === "nc" && !remarks.trim();
  const valid = clause.trim() && area.trim() && !ncMissingRemarks;

  const submit = () => {
    if (!valid) return;
    onAdd({
      clause: clause.trim(),
      area: area.trim(),
      result,
      severity: result === "nc" ? severity : undefined,
      remarks: remarks.trim() || undefined,
    });
    setClause("");
    setArea("");
    setResult("compliant");
    setRemarks("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Record a finding</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Clause / criterion</Label>
              <Input
                value={clause}
                onChange={(e) => setClause(e.target.value)}
                placeholder="ISO 14001 §8.1"
                className="h-9 text-[12.5px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Area observed</Label>
              <Input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Wash bay"
                className="h-9 text-[12.5px]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Result</Label>
              <Select value={result} onValueChange={(v) => setResult(v as AuditFinding["result"])}>
                <SelectTrigger className="h-9 text-[12.5px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compliant" className="text-[12.5px]">
                    Compliant
                  </SelectItem>
                  <SelectItem value="observation" className="text-[12.5px]">
                    Observation
                  </SelectItem>
                  <SelectItem value="nc" className="text-[12.5px]">
                    Non-conformity
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {result === "nc" && (
              <div className="space-y-1.5">
                <Label className="text-[12px]">Severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as "major" | "minor")}>
                  <SelectTrigger className="h-9 text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="major" className="text-[12.5px]">
                      Major
                    </SelectItem>
                    <SelectItem value="minor" className="text-[12.5px]">
                      Minor
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">
              Remarks {result === "nc" && <span className="text-destructive">— required for an NC</span>}
            </Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={result === "nc" ? "State the non-conformity and evidence" : "Optional notes"}
              className={cn("min-h-[64px] text-[12.5px]", ncMissingRemarks && "border-destructive/40")}
            />
            {ncMissingRemarks && (
              <p className="text-[11px] font-medium text-destructive">
                A non-conformity cannot be saved without remarks.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={submit} disabled={!valid} className="text-[12px]">
            Save finding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AuditDetail({
  audit,
  onBack,
  onOpenEsap,
}: {
  audit: Audit;
  onBack: () => void;
  onOpenEsap: () => void;
}) {
  const { audit: wf, audience, openRecord } = useEsg();
  const [caFor, setCaFor] = useState<string | null>(null); // findingId awaiting a corrective action
  const [addOpen, setAddOpen] = useState(false);

  const external = audience === "external";
  const isExternal = audit.kind === "external";
  const findings = wf.findingsFor(audit.id);
  const unlinked = wf.unlinkedNcCount(audit.id);
  const linkedRecord = audit.recordId ? RECORDS.find((r) => r.id === audit.recordId) : undefined;

  // External audience curates NCs out; internal shows them, marked withheld.
  const visibleFindings = external ? findings.filter((f) => f.result !== "nc") : findings;
  const withheldCount = external ? findings.filter((f) => f.result === "nc").length : 0;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to {isExternal ? "external" : "internal"} audits
      </button>

      {/* Header card */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {isExternal ? "External" : "Internal"}
              </span>
              {audit.standard && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {audit.standard}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 text-[16px] font-semibold leading-snug tracking-tight">{audit.title}</h3>
            <div className="mt-1 text-[12px] text-muted-foreground">
              {entityById(audit.entityId)?.short}
              {audit.depotId ? ` · ${entityById(audit.entityId)?.depots.find((d) => d.id === audit.depotId)?.name}` : ""}{" "}
              · {audit.auditorName}
              {audit.auditorOrg ? ` (${audit.auditorOrg})` : ""}
            </div>
            <div className="mt-1 text-[11.5px] text-muted-foreground">
              Scheduled {fmtDate(audit.scheduledOn)}
              {audit.conductedOn ? ` · conducted ${fmtDate(audit.conductedOn)}` : ""}
            </div>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold capitalize text-muted-foreground">
            {audit.status}
          </span>
        </div>

        {/* ISO certification cross-link (external audits) */}
        {linkedRecord && (
          <button
            type="button"
            onClick={() => openRecord(linkedRecord.id)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/8 px-2.5 py-1.5 text-[11.5px] font-medium text-primary transition-colors hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Maintains {typeByKey(linkedRecord.typeKey)?.label} <ArrowUpRight className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>

      {/* Unlinked-NC warning — an NC without a corrective action is the unit of risk */}
      {!external && unlinked > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-warning/35 bg-warning/8 px-4 py-2.5 text-[12px] font-medium text-warning">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          {unlinked} non-conformit{unlinked === 1 ? "y has" : "ies have"} no corrective action yet — create one to close
          the loop.
        </div>
      )}

      {/* Findings table */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
          <div>
            <h4 className="text-[14px] font-semibold tracking-tight">Findings</h4>
            <p className="text-[11.5px] text-muted-foreground">
              Compliant observations and non-conformities. NCs require remarks and a corrective action.
            </p>
          </div>
          {!external && (
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Record finding
            </Button>
          )}
        </div>

        {visibleFindings.length === 0 && withheldCount === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">No findings recorded yet.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {visibleFindings.map((f) => {
              const isNc = f.result === "nc";
              return (
                <div
                  key={f.id}
                  className={cn("flex flex-wrap items-start gap-3 px-5 py-3", isNc && "border-l-2 border-l-destructive")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <FindingResultChip result={f.result} />
                      {f.severity && (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {f.severity}
                        </span>
                      )}
                      <span className="text-[12.5px] font-medium">{f.clause}</span>
                      <span className="text-[11px] text-muted-foreground">· {f.area}</span>
                      {isNc && !external && <WithheldPill />}
                    </div>
                    {f.remarks && <div className="mt-1 text-[11.5px] text-muted-foreground">{f.remarks}</div>}
                  </div>
                  {isNc && (
                    <div className="shrink-0">
                      {f.actionId ? (
                        <button
                          type="button"
                          onClick={onOpenEsap}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                          <Link2 className="h-3 w-3" aria-hidden /> Linked action{" "}
                          <ArrowUpRight className="h-3 w-3" aria-hidden />
                        </button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => setCaFor(f.id)}
                        >
                          <Plus className="h-3 w-3" aria-hidden /> Corrective action
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {withheldCount > 0 && (
              <div className="px-5 py-3 text-[11.5px] text-muted-foreground">
                {withheldCount} non-conformit{withheldCount === 1 ? "y" : "ies"} withheld from the external view.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report evidence */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elevated">
        <div className="section-label mb-2">Signed audit report</div>
        {audit.reportDoc ? (
          <DocChip name={audit.reportDoc.name} size={audit.reportDoc.size} />
        ) : (
          <button
            type="button"
            onClick={() => toast("Upload queued", { description: "Signed report upload is a UI stub." })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <FileUp className="h-3.5 w-3.5" aria-hidden /> Upload signed report (stub)
          </button>
        )}
      </div>

      <CorrectiveActionDialog
        open={caFor !== null}
        onOpenChange={(o) => !o && setCaFor(null)}
        onCreate={(d) => {
          if (caFor) {
            wf.createCorrectiveAction(audit.id, caFor)(d);
            toast.success("Corrective action created", {
              description: `Added to the ESAP register, owned by ${personById(d.ownerId)?.name}.`,
            });
          }
        }}
      />
      <AddFindingDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={(d) => {
          wf.addFinding(audit.id, d);
          toast.success("Finding recorded", { description: `${d.clause} — ${FINDING_RESULT_META[d.result].label}.` });
        }}
      />
    </div>
  );
}
