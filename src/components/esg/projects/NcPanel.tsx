import { useMemo, useState } from "react";
import { AlertOctagon, ArrowUpRight, Download, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ESG_GROUP, entityById, esapSourceLabel, ESAP_ACTIONS, personById } from "@/lib/esg-data";
import {
  ageBucket,
  buildNcRegister,
  NC_SOURCE_LABEL,
  ncItemOwnerName,
  ncItemPlace,
  ncRaisedLabel,
  sortNcRegister,
  type AgeBucket,
  type NcItem,
  type NcSource,
} from "@/lib/esg-nc";
import { exportToXlsx } from "@/lib/export-xlsx";
import { EmptyState, PanelCard, WithheldPill, useEsg } from "../primitives";
import { Button } from "@/components/ui/button";

const SOURCE_ORDER: NcSource[] = ["permit", "site", "internal-audit", "external-audit", "monitoring"];
const AGE_BUCKETS: AgeBucket[] = ["0-30", "31-90", "90+"];

function ActionStatusPill({ status }: { status: NcItem["actionStatus"] }) {
  const meta =
    status === "closed"
      ? { label: "Closed", cls: "bg-success/12 text-success" }
      : status === "in-progress"
        ? { label: "In progress", cls: "bg-warning/14 text-warning" }
        : status === "open"
          ? { label: "Open", cls: "bg-muted text-muted-foreground" }
          : { label: "No action", cls: "bg-destructive/12 text-destructive" };
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", meta.cls)}>
      {meta.label}
    </span>
  );
}

function SeverityPill({ severity }: { severity?: NcItem["severity"] }) {
  if (!severity) return <span className="text-[11px] text-muted-foreground">—</span>;
  const cls =
    severity === "major"
      ? "bg-destructive/12 text-destructive"
      : severity === "minor"
        ? "bg-warning/14 text-warning"
        : "bg-muted text-muted-foreground";
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", cls)}>{severity}</span>;
}

function NcDetailDialog({ item, onClose, onNavigate }: { item: NcItem | null; onClose: () => void; onNavigate: (item: NcItem) => void }) {
  if (!item) return null;
  const linkedAction = item.backlink.kind === "record" ? undefined : ESAP_ACTIONS.find((a) => a.ncRef === item.ref);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{item.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-[12.5px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {NC_SOURCE_LABEL[item.source]}
            </span>
            <SeverityPill severity={item.severity} />
            <ActionStatusPill status={item.actionStatus} />
            {item.withheldExternal && <WithheldPill />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ref</div>
              <div className="num mt-0.5 font-medium">{item.ref}</div>
            </div>
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Entity</div>
              <div className="mt-0.5 font-medium">{ncItemPlace(item)}</div>
            </div>
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Raised</div>
              <div className="mt-0.5 font-medium">{ncRaisedLabel(item)}</div>
            </div>
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Age</div>
              <div className="num mt-0.5 font-medium">{item.ageDays}d</div>
            </div>
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Owner</div>
              <div className="mt-0.5 font-medium">{ncItemOwnerName(item)}</div>
            </div>
          </div>
          {item.remarks && (
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Finding / root cause
              </div>
              <p className="mt-1 leading-relaxed text-muted-foreground">{item.remarks}</p>
            </div>
          )}
          {linkedAction && (
            <div className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">Linked corrective action</div>
              <div className="mt-0.5 font-medium">{linkedAction.action}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {esapSourceLabel(linkedAction.source).label} · owner {personById(linkedAction.ownerId)?.name}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => onNavigate(item)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden /> Open origin record <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NcPanel() {
  const { scope, period, audience, openRecord, goto, audit, monitoring } = useEsg();
  const [source, setSource] = useState<NcSource | "all">("all");
  const [entityId, setEntityId] = useState<string | "all">("all");
  const [status, setStatus] = useState<"open" | "closed" | "all">("open");
  const [age, setAge] = useState<AgeBucket | "all">("all");
  const [selected, setSelected] = useState<NcItem | null>(null);
  const external = audience === "external";

  const register = useMemo(
    () => buildNcRegister(scope, period, audit, monitoring),
    [scope, period, audit, monitoring],
  );

  const filtered = useMemo(() => {
    let rows = register.filter((r) => (external ? !r.withheldExternal : true));
    if (source !== "all") rows = rows.filter((r) => r.source === source);
    if (entityId !== "all") rows = rows.filter((r) => r.entityId === entityId);
    if (status !== "all") rows = rows.filter((r) => (status === "closed" ? r.actionStatus === "closed" : r.actionStatus !== "closed"));
    if (age !== "all") rows = rows.filter((r) => ageBucket(r.ageDays) === age);
    return sortNcRegister(rows);
  }, [register, external, source, entityId, status, age]);

  const withheldCount = register.length - register.filter((r) => !r.withheldExternal).length;

  const navigate = (item: NcItem) => {
    setSelected(null);
    if (item.backlink.kind === "record") openRecord(item.backlink.recordId);
    else goto("esms", { sub: item.backlink.sub });
  };

  const exportRegister = () => {
    exportToXlsx(
      "nc-register",
      [
        { key: "ref", header: "NC ref" },
        { key: "source", header: "Source", format: (r: NcItem) => NC_SOURCE_LABEL[r.source] },
        { key: "title", header: "Finding" },
        { key: "entity", header: "Entity", format: (r: NcItem) => ncItemPlace(r) },
        { key: "raised", header: "Raised", format: (r: NcItem) => ncRaisedLabel(r) },
        { key: "age", header: "Age (days)", format: (r: NcItem) => r.ageDays },
        { key: "severity", header: "Severity", format: (r: NcItem) => r.severity ?? "" },
        { key: "owner", header: "Owner", format: (r: NcItem) => ncItemOwnerName(r) },
        { key: "action", header: "Corrective action status", format: (r: NcItem) => r.actionStatus },
      ],
      filtered,
      "NC Register",
    );
    toast.success("NC register exported", { description: `${filtered.length} rows written to .xlsx.` });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={source} onValueChange={(v) => setSource(v as NcSource | "all")}>
            <SelectTrigger className="h-8 w-[150px] text-[12px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[12px]">All sources</SelectItem>
              {SOURCE_ORDER.map((s) => (
                <SelectItem key={s} value={s} className="text-[12px]">
                  {NC_SOURCE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityId} onValueChange={setEntityId}>
            <SelectTrigger className="h-8 w-[150px] text-[12px]">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[12px]">All entities</SelectItem>
              {ESG_GROUP.entities.map((e) => (
                <SelectItem key={e.id} value={e.id} className="text-[12px]">
                  {e.short}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-8 w-[120px] text-[12px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open" className="text-[12px]">Open</SelectItem>
              <SelectItem value="closed" className="text-[12px]">Closed</SelectItem>
              <SelectItem value="all" className="text-[12px]">All</SelectItem>
            </SelectContent>
          </Select>
          <Select value={age} onValueChange={(v) => setAge(v as typeof age)}>
            <SelectTrigger className="h-8 w-[110px] text-[12px]">
              <SelectValue placeholder="Age" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[12px]">Any age</SelectItem>
              {AGE_BUCKETS.map((b) => (
                <SelectItem key={b} value={b} className="text-[12px]">
                  {b}d
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" onClick={exportRegister}>
          <Download className="h-3.5 w-3.5" aria-hidden /> Export .xlsx
        </Button>
      </div>

      <PanelCard>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <AlertOctagon className="h-4 w-4 text-destructive" aria-hidden /> Non-Compliance register
            </h3>
            <p className="text-[12px] text-muted-foreground">
              Every lapse across permits, site compliance, internal &amp; external audit, and monitoring — oldest open
              first. Age is the risk signal.
            </p>
          </div>
          {!external && withheldCount > 0 && (
            <span className="text-[11.5px] text-muted-foreground">{withheldCount} withheld from external view</span>
          )}
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No non-compliances match" hint="Widen the scope or filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[12.5px]">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="px-5 py-2.5 text-left font-medium">Finding</th>
                  <th className="px-3 py-2.5 text-left font-medium">Source</th>
                  <th className="px-3 py-2.5 text-left font-medium">Entity</th>
                  <th className="px-3 py-2.5 text-right font-medium">Age</th>
                  <th className="px-3 py-2.5 text-left font-medium">Severity</th>
                  <th className="px-3 py-2.5 text-left font-medium">Owner</th>
                  <th className="px-5 py-2.5 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className="text-left font-medium underline-offset-2 hover:text-primary hover:underline"
                      >
                        {item.title}
                      </button>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="num text-[11px] text-muted-foreground">{item.ref}</span>
                        {item.withheldExternal && !external && <WithheldPill />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{NC_SOURCE_LABEL[item.source]}</td>
                    <td className="px-3 py-2.5">{ncItemPlace(item)}</td>
                    <td
                      className={cn(
                        "num px-3 py-2.5 text-right font-semibold",
                        item.ageDays > 90 ? "text-destructive" : item.ageDays > 30 ? "text-warning" : "text-muted-foreground",
                      )}
                    >
                      {item.ageDays}d
                    </td>
                    <td className="px-3 py-2.5">
                      <SeverityPill severity={item.severity} />
                    </td>
                    <td className="px-3 py-2.5">{ncItemOwnerName(item)}</td>
                    <td className="px-5 py-2.5">
                      <ActionStatusPill status={item.actionStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      <NcDetailDialog item={selected} onClose={() => setSelected(null)} onNavigate={navigate} />
    </div>
  );
}
