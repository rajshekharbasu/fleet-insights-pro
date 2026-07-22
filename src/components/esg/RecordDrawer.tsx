import { useState } from "react";
import { ArrowUpRight, CalendarClock, RefreshCcw, ShieldCheck, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AUDITS,
  countdownLabel,
  daysUntil,
  fmtDate,
  personById,
  recordPlace,
  recordState,
  STATE_META,
  typeByKey,
  type ComplianceRecord,
} from "@/lib/esg-data";
import { A, CriticalBeam, DocChip, Gloss, ProvenanceChip, StatePill, WithheldPill, useEsg } from "./primitives";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[13px] font-medium leading-snug">{children}</div>
    </div>
  );
}

/**
 * The shared record view — same layout whether reached from dashboard,
 * queue, report, or a notification deep-link.
 */
export function RecordDrawer({
  record,
  onClose,
}: {
  record: ComplianceRecord | null;
  onClose: () => void;
}) {
  const { audience, goto } = useEsg();
  const [remarks, setRemarks] = useState<string | null>(null);
  const [renewal, setRenewal] = useState<string | null>(null);

  if (!record) return null;
  // Reverse ISO cross-link: audits that maintain this certificate (external, most recent first).
  const linkedAudits = AUDITS.filter((a) => a.recordId === record.id).sort((a, b) =>
    (b.conductedOn ?? b.scheduledOn).localeCompare(a.conductedOn ?? a.scheduledOn),
  );
  const lastAudit = linkedAudits[0];
  const state = recordState(record);
  const type = typeByKey(record.typeKey);
  const owner = personById(record.ownerId);
  const meta = STATE_META[state];
  const overdue = state === "overdue";
  const renewalState = renewal ?? record.renewal ?? "none";
  const remarksVal = remarks ?? record.remarks ?? "";
  const days = record.expiryDate ? daysUntil(record.expiryDate) : null;

  const act = () => {
    setRenewal("initiated");
    toast.success(overdue ? "Remediation logged" : "Renewal initiated", {
      description: `${type?.label} · ${recordPlace(record)} — assigned to ${owner?.name}. (UI stub — workflow connects later.)`,
    });
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-border/60 sm:max-w-[520px]">
        <SheetHeader className="space-y-3 pb-0">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <div className="section-label">{type?.category === "permit" ? "Permit / Licence" : "Site Compliance"}</div>
              <SheetTitle className="mt-1 text-[19px] leading-tight tracking-tight">
                <Gloss text={type?.label ?? record.typeKey} />
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-[12.5px]">
                {recordPlace(record)} · {record.authority}
              </SheetDescription>
            </div>
            <StatePill state={state} size="md" />
          </div>

          {/* Expiry clock — the unit of risk, always visible */}
          <div
            className="flex items-center justify-between rounded-xl border px-4 py-3"
            style={{
              borderColor: `color-mix(in oklab, ${meta.color} 30%, transparent)`,
              background: `color-mix(in oklab, ${meta.color} 6%, transparent)`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <CalendarClock className="h-4 w-4" style={{ color: meta.color }} aria-hidden />
              <div>
                <div className="text-[11px] font-medium text-muted-foreground">
                  {record.expiryDate ? `Expires ${fmtDate(record.expiryDate)}` : "Perpetual instrument"}
                </div>
                <div className="num text-[17px] font-semibold" style={{ color: meta.color }}>
                  {countdownLabel(record)}
                </div>
              </div>
            </div>
            {days !== null && days >= 0 && type && (
              <div className="text-right text-[10.5px] leading-tight text-muted-foreground">
                Alert window
                <br />
                <span className="num text-[12px] font-semibold text-foreground">{type.leadDays}d</span> before expiry
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-8 gap-1.5 rounded-lg text-[12px]" onClick={act} disabled={renewalState === "initiated" && !overdue}>
              {overdue ? <Wrench className="h-3.5 w-3.5" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              {overdue ? "Log remediation step" : renewalState === "initiated" ? "Renewal initiated" : "Start renewal"}
            </Button>
            {renewalState === "initiated" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <RefreshCcw className="h-2.5 w-2.5" aria-hidden /> Renewal in progress
              </span>
            )}
            {record.withheldExternal && audience === "internal" && <WithheldPill />}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5 pb-4">
          {/* Root cause — visually unavoidable whenever non-compliant */}
          {overdue && (
            <CriticalBeam size="pulse-inner">
              <section className="rounded-xl border border-destructive/35 bg-destructive/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-destructive">
                    Root cause & remediation — required
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">status is never a bare flag</span>
                </div>
                <Textarea
                  value={remarksVal}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Why is this item non-compliant, and what is being done? This field is mandatory while the item is overdue."
                  className="mt-2.5 min-h-[88px] resize-none border-destructive/25 bg-card/70 text-[12.5px] leading-relaxed"
                />
                {!remarksVal.trim() && (
                  <p className="mt-1.5 text-[11px] font-medium text-destructive">
                    Cannot be left blank while the item is overdue.
                  </p>
                )}
              </section>
            </CriticalBeam>
          )}

          <section className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Detail label="Reference no.">{record.refNo}</Detail>
            <Detail label="Issuing authority">{record.authority}</Detail>
            <Detail label="Issue date">{fmtDate(record.issueDate)}</Detail>
            <Detail label="Expiry date">
              <span className={cn(overdue && "text-destructive")}>{fmtDate(record.expiryDate)}</span>
            </Detail>
            <Detail label="Owner">
              <span className="inline-flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/10 text-primary">
                  <User className="h-3 w-3" aria-hidden />
                </span>
                {owner?.name}
              </span>
              <div className="mt-0.5 text-[11px] font-normal text-muted-foreground">{owner?.role}</div>
            </Detail>
            <Detail label="Renewal lead window">
              <span className="num">{type?.leadDays ?? 60} days</span>
              <div className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                configurable per type in <A t="ESG" /> Masters
              </div>
            </Detail>
          </section>

          {record.autoFields && record.autoFields.length > 0 && (
            <section>
              <div className="section-label mb-2">Auto-fetched fields</div>
              <div className="space-y-2">
                {record.autoFields.map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-accent/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-medium">{f.label}</div>
                      <ProvenanceChip
                        prov={f.prov}
                        onFlag={() =>
                          toast("Value flagged for review", {
                            description: `${f.label} — challenge recorded against ${f.prov.source}. (UI stub)`,
                          })
                        }
                      />
                    </div>
                    <div className="num shrink-0 text-[15px] font-semibold">{f.value}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {lastAudit && (
            <section>
              <div className="section-label mb-2">Certification assurance</div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  goto("esms", { sub: lastAudit.kind === "external" ? "audit-external" : "audit-internal" });
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-left transition-colors hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span className="inline-flex items-center gap-2 text-[12px] font-medium text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  Last audited {fmtDate(lastAudit.conductedOn ?? lastAudit.scheduledOn)}
                  {lastAudit.auditorOrg ? ` · ${lastAudit.auditorOrg}` : ""}
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-primary" aria-hidden />
              </button>
            </section>
          )}

          <section>
            <div className="section-label mb-2">Evidence</div>
            <DocChip name={record.doc.name} size={record.doc.size} />
            <p className="mt-1.5 text-[11px] text-muted-foreground">Uploaded {fmtDate(record.doc.uploadedAt)}</p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
