import { useMemo, useState } from "react";
import { CalendarPlus, ChevronRight, ClipboardCheck } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  ESG_GROUP,
  entityById,
  fmtDate,
  inScope,
  type Audit,
  type AuditKind,
  type FindingResult,
} from "@/lib/esg-data";
import { FINDING_RESULT_META, type AuditDraft } from "@/lib/esg-audit";
import { A, EmptyState, PanelCard, useEsg } from "../primitives";
import { AuditDetail } from "./AuditDetail";

/** Stacked summary of compliant / observation / NC counts — numeric, never colour-only. */
function FindingsSummaryBar({ counts }: { counts: Record<FindingResult, number> }) {
  const total = counts.compliant + counts.observation + counts.nc;
  const order: FindingResult[] = ["compliant", "observation", "nc"];
  if (total === 0) return <span className="text-[11px] text-muted-foreground">No findings yet</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-4 w-28 overflow-hidden rounded-md bg-muted/40" aria-hidden>
        {order.map((k) =>
          counts[k] > 0 ? (
            <span key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: FINDING_RESULT_META[k].color }} />
          ) : null,
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] font-medium">
        {order.map((k) => (
          <span key={k} className="inline-flex items-center gap-1" style={{ color: FINDING_RESULT_META[k].color }}>
            {counts[k]} {k === "nc" ? "NC" : k === "observation" ? "Obs" : "OK"}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScheduleAuditDialog({ kind, onSchedule }: { kind: AuditKind; onSchedule: (d: AuditDraft) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [entityId, setEntityId] = useState("");
  const [depotId, setDepotId] = useState<string>("");
  const [standard, setStandard] = useState("");
  const [auditorName, setAuditorName] = useState("");
  const [auditorOrg, setAuditorOrg] = useState("");
  const [scheduledOn, setScheduledOn] = useState("");

  const depots = entityId ? entityById(entityId)?.depots ?? [] : [];
  const valid = title.trim() && entityId && auditorName.trim() && scheduledOn && (kind === "internal" || auditorOrg.trim());

  const reset = () => {
    setTitle("");
    setEntityId("");
    setDepotId("");
    setStandard("");
    setAuditorName("");
    setAuditorOrg("");
    setScheduledOn("");
  };

  const submit = () => {
    if (!valid) return;
    onSchedule({
      kind,
      title: title.trim(),
      entityId,
      depotId: depotId || undefined,
      standard: standard.trim() || undefined,
      auditorName: auditorName.trim(),
      auditorOrg: kind === "external" ? auditorOrg.trim() : undefined,
      scheduledOn,
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 text-[12px]">
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden /> Schedule audit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Schedule {kind} audit</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "external" ? "ISO 45001 surveillance audit" : "Depot internal EHS audit — Q3"}
              className="h-9 text-[12.5px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Entity</Label>
              <Select
                value={entityId}
                onValueChange={(v) => {
                  setEntityId(v);
                  setDepotId("");
                }}
              >
                <SelectTrigger className="h-9 text-[12.5px]">
                  <SelectValue placeholder="Select entity" />
                </SelectTrigger>
                <SelectContent>
                  {ESG_GROUP.entities.map((e) => (
                    <SelectItem key={e.id} value={e.id} className="text-[12.5px]">
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Depot (optional)</Label>
              <Select value={depotId} onValueChange={setDepotId} disabled={!depots.length}>
                <SelectTrigger className="h-9 text-[12.5px]">
                  <SelectValue placeholder={depots.length ? "Select depot" : "—"} />
                </SelectTrigger>
                <SelectContent>
                  {depots.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-[12.5px]">
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Standard / programme</Label>
              <Input
                value={standard}
                onChange={(e) => setStandard(e.target.value)}
                placeholder={kind === "external" ? "ISO 14001" : "Internal programme"}
                className="h-9 text-[12.5px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Date</Label>
              <Input
                type="date"
                value={scheduledOn}
                onChange={(e) => setScheduledOn(e.target.value)}
                className="h-9 text-[12.5px]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Auditor</Label>
              <Input
                value={auditorName}
                onChange={(e) => setAuditorName(e.target.value)}
                placeholder="Auditor name"
                className="h-9 text-[12.5px]"
              />
            </div>
            {kind === "external" && (
              <div className="space-y-1.5">
                <Label className="text-[12px]">Auditor organisation</Label>
                <Input
                  value={auditorOrg}
                  onChange={(e) => setAuditorOrg(e.target.value)}
                  placeholder="TÜV SÜD"
                  className="h-9 text-[12.5px]"
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={submit} disabled={!valid} className="text-[12px]">
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Shared audit shell, parameterised by `kind`. Internal and external audits use
 * the same components but separate lists and datasets — the separation is the
 * requirement, so they are never merged into one toggled list.
 */
export function AuditsPanel({ kind, onOpenEsap }: { kind: AuditKind; onOpenEsap: () => void }) {
  const { scope, audit: wf } = useEsg();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const audits = useMemo(
    () => wf.auditsFor(kind).filter((a) => inScope({ entityId: a.entityId, depotId: a.depotId }, scope)),
    [wf, kind, scope],
  );

  const selected = selectedId ? wf.auditById(selectedId) : undefined;
  if (selected) {
    return <AuditDetail audit={selected} onBack={() => setSelectedId(null)} onOpenEsap={onOpenEsap} />;
  }

  const isExternal = kind === "external";

  return (
    <PanelCard>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden />
            {isExternal ? "External audits" : "Internal audits"}
          </h3>
          <p className="text-[12px] text-muted-foreground">
            {isExternal ? (
              <>
                Third-party assessments (e.g. <A t="ISO" /> auditors). Findings and <A t="NC" />s are kept separate from
                internal audits.
              </>
            ) : (
              <>
                Conducted by the internal audit team. Findings flag compliant observations and <A t="NC" />s that flow
                into the <A t="ESAP" /> register.
              </>
            )}
          </p>
        </div>
        <ScheduleAuditDialog
          kind={kind}
          onSchedule={(d) => {
            wf.scheduleAudit(d);
            toast.success("Audit scheduled", { description: `${d.title} — ${fmtDate(d.scheduledOn)}.` });
          }}
        />
      </div>

      {audits.length === 0 ? (
        <EmptyState
          title={`No ${kind} audits in this scope`}
          hint="Schedule one, or widen the scope selector above."
        />
      ) : (
        <div className="divide-y divide-border/40">
          {audits.map((a) => (
            <AuditRow key={a.id} audit={a} onOpen={() => setSelectedId(a.id)} />
          ))}
        </div>
      )}
    </PanelCard>
  );
}

function AuditRow({ audit, onOpen }: { audit: Audit; onOpen: () => void }) {
  const { audit: wf } = useEsg();
  const findings = wf.findingsFor(audit.id);
  const counts: Record<FindingResult, number> = {
    compliant: findings.filter((f) => f.result === "compliant").length,
    observation: findings.filter((f) => f.result === "observation").length,
    nc: findings.filter((f) => f.result === "nc").length,
  };

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-wrap items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[13px] font-medium">{audit.title}</span>
          {audit.standard && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {audit.standard}
            </span>
          )}
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
            {audit.status}
          </span>
        </div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
          {entityById(audit.entityId)?.short} · {audit.auditorName}
          {audit.auditorOrg ? ` (${audit.auditorOrg})` : ""} ·{" "}
          {audit.conductedOn ? `conducted ${fmtDate(audit.conductedOn)}` : `scheduled ${fmtDate(audit.scheduledOn)}`}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <FindingsSummaryBar counts={counts} />
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground/60")} aria-hidden />
      </div>
    </button>
  );
}
