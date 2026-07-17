import { useMemo, useState } from "react";
import { Check, ExternalLink, PackageOpen, ShieldQuestion, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  VENDOR_CATEGORY_META,
  VENDORS,
  fmtDate,
  type Vendor,
  type VendorCategory,
  type VendorDoc,
} from "@/lib/esg-data";
import { A, EmptyState, Gloss, PanelCard, useEsg, useStubLoad, LoadingRows } from "./primitives";

type DocKey = `${string}:${string}`;

const DOC_STATUS_META: Record<VendorDoc["status"], { label: string; cls: string }> = {
  pending: { label: "Not submitted", cls: "bg-muted text-muted-foreground" },
  submitted: { label: "Awaiting verification", cls: "bg-warning/14 text-warning" },
  verified: { label: "Verified", cls: "bg-success/12 text-success" },
  rejected: { label: "Rejected", cls: "bg-destructive/12 text-destructive" },
};

/** Vendor-facing sheet — plain, low-friction, conditionally revealing. */
function VendorFormPreview({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<VendorCategory>("battery-recycler");
  const meta = VENDOR_CATEGORY_META[category];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[520px] gap-0 overflow-hidden rounded-2xl border-border/60 p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-[16px] tracking-tight">Vendor compliance sheet</DialogTitle>
          <DialogDescription className="text-[12px]">
            What the vendor sees — identity and registration always; category-dependent sections appear only when relevant.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-auto px-5 py-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Vendor category</label>
            <Select value={category} onValueChange={(v) => setCategory(v as VendorCategory)}>
              <SelectTrigger className="mt-1.5 h-9 bg-muted/40 text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(VENDOR_CATEGORY_META).map(([k, m]) => (
                  <SelectItem key={k} value={k} className="text-[12.5px]">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="section-label mb-2">Identity & registration — always required</div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {["Legal entity name", "GST number", "PAN", "Registered address"].map((f) => (
                <div key={f}>
                  <label className="text-[11px] font-medium text-muted-foreground">{f}</label>
                  <Input placeholder={f} className="mt-1 h-9 bg-muted/40 text-[12.5px]" aria-label={f} />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
            <div className="section-label mb-2 text-primary">
              Because you are a {meta.label.toLowerCase()} — these sections apply
            </div>
            <div className="space-y-2.5">
              {meta.conditional.map((s) => (
                <div key={s} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5">
                  <span className="text-[12.5px] font-medium">
                    <Gloss text={s} /> compliance document
                  </span>
                  <Button variant="outline" size="sm" className="h-7 rounded-lg text-[11px]">
                    Upload
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Self-attested submissions land in a verification queue — nothing enters the trusted compliance picture until reviewed. Bulk
            document storage may move to a separate <A t="DMS" /> (open scope question); this sheet captures the compliance signal either way.
          </p>
        </div>
        <div className="flex justify-end border-t border-border/60 bg-muted/20 px-5 py-3.5">
          <Button size="sm" className="h-8 rounded-lg text-[12px]" onClick={onClose}>
            Close preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function VendorsTab() {
  const { scope, audience } = useEsg();
  const [overrides, setOverrides] = useState<Record<DocKey, VendorDoc["status"]>>({});
  const [preview, setPreview] = useState(false);
  const loading = useStubLoad(JSON.stringify(scope));

  const decide = (v: Vendor, d: VendorDoc, status: "verified" | "rejected") => {
    setOverrides((m) => ({ ...m, [`${v.id}:${d.name}`]: status }));
    toast[status === "verified" ? "success" : "warning"](status === "verified" ? "Document verified" : "Document rejected", {
      description: `${v.name} — ${d.name}. (UI stub — decision will be logged when connected.)`,
    });
  };

  const vendors = useMemo(
    () =>
      VENDORS.map((v) => ({
        ...v,
        docs: v.docs.map((d) => ({ ...d, status: overrides[`${v.id}:${d.name}`] ?? d.status })),
      })),
    [overrides],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">Vendor & contractor compliance</h3>
          <p className="text-[12px] text-muted-foreground">
            Walled then gated: self-attested submissions stay visually quarantined until someone verifies them.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg border-border/60 text-[12px]" onClick={() => setPreview(true)}>
          <ExternalLink className="h-3.5 w-3.5" /> Preview vendor-facing form
        </Button>
      </div>

      {loading ? (
        <PanelCard>
          <LoadingRows rows={5} />
        </PanelCard>
      ) : vendors.length === 0 ? (
        <PanelCard>
          <EmptyState icon={PackageOpen} title="No vendors onboarded" />
        </PanelCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {vendors.map((v) => {
            const cat = VENDOR_CATEGORY_META[v.category];
            const unverified = v.docs.filter((d) => d.status === "submitted" || d.status === "pending").length;
            return (
              <PanelCard key={v.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold tracking-tight">{v.name}</span>
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {cat.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">Contract to {fmtDate(v.contractEnd)}</div>
                  </div>
                  {unverified > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-warning/50 bg-warning/8 px-2 py-1 text-[10.5px] font-semibold text-warning">
                      <ShieldQuestion className="h-3 w-3" aria-hidden />
                      {unverified} unverified — quarantined
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border/30">
                  {v.docs.map((d) => {
                    const m = DOC_STATUS_META[d.status];
                    const quarantined = d.status === "submitted" || d.status === "pending";
                    return (
                      <div
                        key={d.name}
                        className={cn("flex flex-wrap items-center gap-2.5 px-5 py-2.5", quarantined && "bg-warning/[0.04]")}
                        style={
                          quarantined
                            ? {
                                backgroundImage:
                                  "repeating-linear-gradient(45deg, transparent, transparent 6px, color-mix(in oklab, var(--color-warning) 4%, transparent) 6px, color-mix(in oklab, var(--color-warning) 4%, transparent) 7px)",
                              }
                            : undefined
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-medium">
                            <Gloss text={d.name} />
                          </div>
                          <div className="text-[10.5px] text-muted-foreground">
                            <Gloss text={d.section} />
                            {d.note && <span className="text-destructive"> · {d.note}</span>}
                          </div>
                        </div>
                        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", m.cls)}>
                          {m.label}
                        </span>
                        {d.status === "submitted" && audience === "internal" && (
                          <span className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => decide(v, d, "verified")}
                              className="grid h-7 w-7 place-items-center rounded-lg border border-success/40 text-success transition-colors hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                              aria-label={`Verify ${d.name}`}
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => decide(v, d, "rejected")}
                              className="grid h-7 w-7 place-items-center rounded-lg border border-destructive/40 text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                              aria-label={`Reject ${d.name}`}
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </PanelCard>
            );
          })}
        </div>
      )}

      {preview && <VendorFormPreview onClose={() => setPreview(false)} />}
    </div>
  );
}
