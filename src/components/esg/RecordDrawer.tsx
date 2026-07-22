import { useRef, useState } from "react";
import { ArrowUpRight, CalendarClock, History, RefreshCcw, ShieldCheck, UploadCloud, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AUDITS,
  countdownLabel,
  daysUntil,
  ESG_TODAY,
  fmtDate,
  personById,
  recordPlace,
  recordState,
  STATE_META,
  typeByKey,
  type ComplianceRecord,
} from "@/lib/esg-data";
import { A, CriticalBeam, DocChip, Gloss, ProvenanceChip, StatePill, WithheldPill, useEsg } from "./primitives";

type DocVersion = { name: string; size: string; uploadedAt: string };

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[13px] font-medium leading-snug">{children}</div>
    </div>
  );
}

const todayIso = () => ESG_TODAY.toISOString().slice(0, 10);

/** Update flow: new expiry + new document, preserving history. Session-local, like the drawer's other actions. */
function UpdateLicenceDialog({
  open,
  onOpenChange,
  currentExpiry,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentExpiry?: string;
  onUpdate: (newExpiry: string, doc: DocVersion) => void;
}) {
  const [expiry, setExpiry] = useState(currentExpiry ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!expiry) return;
    onUpdate(expiry, {
      name: fileName ?? `renewed-licence-${expiry}.pdf`,
      size: "—",
      uploadedAt: todayIso(),
    });
    setFileName(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Update licence</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[12px]">New expiry date</Label>
            <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-9 text-[12.5px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px]">Renewed document</Label>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <UploadCloud className="h-3.5 w-3.5" aria-hidden />
              {fileName ?? "Attach the renewed licence (UI stub — not stored)"}
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={submit} disabled={!expiry} className="text-[12px]">
            Save — preserves history
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [docs, setDocs] = useState<DocVersion[] | null>(null);
  const [expiryOverride, setExpiryOverride] = useState<string | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!record) return null;
  // Reverse ISO cross-link: audits that maintain this certificate (external, most recent first).
  const linkedAudits = AUDITS.filter((a) => a.recordId === record.id).sort((a, b) =>
    (b.conductedOn ?? b.scheduledOn).localeCompare(a.conductedOn ?? a.scheduledOn),
  );
  const lastAudit = linkedAudits[0];
  // Session-local edits (this drawer instance only) layer over the record without mutating it elsewhere.
  const effectiveRecord: ComplianceRecord = expiryOverride ? { ...record, expiryDate: expiryOverride } : record;
  const docVersions = docs ?? [record.doc];
  const state = recordState(effectiveRecord);
  const type = typeByKey(record.typeKey);
  const owner = personById(record.ownerId);
  const meta = STATE_META[state];
  const overdue = state === "overdue";
  const renewalState = renewal ?? record.renewal ?? "none";
  const remarksVal = remarks ?? record.remarks ?? "";
  const days = effectiveRecord.expiryDate ? daysUntil(effectiveRecord.expiryDate) : null;

  const addVersion = (doc: DocVersion) => setDocs((d) => [doc, ...(d ?? [record.doc])]);

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
                  {effectiveRecord.expiryDate ? `Expires ${fmtDate(effectiveRecord.expiryDate)}` : "Perpetual instrument"}
                </div>
                <div className="num text-[17px] font-semibold" style={{ color: meta.color }}>
                  {countdownLabel(effectiveRecord)}
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
              <span className={cn(overdue && "text-destructive")}>{fmtDate(effectiveRecord.expiryDate)}</span>
              {expiryOverride && <span className="ml-1.5 text-[10px] font-normal text-primary">(updated)</span>}
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
            <div className="flex items-center justify-between gap-2">
              <div className="section-label mb-2">Evidence &amp; version history</div>
              <div className="mb-2 flex items-center gap-1.5">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      addVersion({ name: f.name, size: "—", uploadedAt: todayIso() });
                      toast.success("New version uploaded", { description: `${f.name} — added to this licence's history. (UI stub)` });
                    }
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <UploadCloud className="h-3 w-3" aria-hidden /> Upload
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <RefreshCcw className="h-3 w-3" aria-hidden /> Update licence
                </button>
              </div>
            </div>
            <ol className="space-y-2.5">
              {docVersions.map((d, i) => (
                <li key={`${d.name}-${i}`} className="flex items-start gap-2.5">
                  {i === 0 ? (
                    <DocChip name={d.name} size={d.size !== "—" ? d.size : undefined} />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[11.5px] text-muted-foreground">
                      <History className="h-3 w-3" aria-hidden /> {d.name}
                    </span>
                  )}
                  <span className="mt-1.5 shrink-0 text-[10.5px] text-muted-foreground">
                    {i === 0 ? "current · " : "superseded · "}
                    {fmtDate(d.uploadedAt)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </SheetContent>

      <UpdateLicenceDialog
        open={updateOpen}
        onOpenChange={setUpdateOpen}
        currentExpiry={effectiveRecord.expiryDate}
        onUpdate={(newExpiry, doc) => {
          setExpiryOverride(newExpiry);
          addVersion(doc);
          toast.success("Licence updated", {
            description: `New expiry ${fmtDate(newExpiry)} — previous document preserved in history.`,
          });
        }}
      />
    </Sheet>
  );
}
