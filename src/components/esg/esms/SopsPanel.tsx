import { ClipboardCheck } from "lucide-react";
import { entityById, fmtDate, SOPS } from "@/lib/esg-data";
import { A, EmptyState, PanelCard, useEsg } from "../primitives";
import { DocStatusPill } from "./DocStatus";

/** SOPs — organised by entity, then activity; the shop-floor layer of the ESMS. */
export function SopsPanel() {
  const { scope } = useEsg();
  const sops = SOPS.filter((s) => !scope.entityId || s.entityId === scope.entityId);

  return (
    <PanelCard>
      <div className="border-b border-border/60 px-5 py-3.5">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden /> Standard Operating Procedures
        </h3>
        <p className="text-[12px] text-muted-foreground">
          Organised by entity, then activity — the shop-floor layer of the <A t="ESMS" />.
        </p>
      </div>
      {sops.length === 0 ? (
        <EmptyState title="No SOPs in this scope" />
      ) : (
        <div className="divide-y divide-border/40">
          {Object.entries(
            sops.reduce<Record<string, typeof sops>>((acc, s) => {
              const k = `${entityById(s.entityId)?.short} · ${s.activity}`;
              (acc[k] ||= []).push(s);
              return acc;
            }, {}),
          ).map(([groupLabel, list]) => (
            <div key={groupLabel} className="px-5 py-3.5">
              <div className="section-label mb-2">{groupLabel}</div>
              <div className="space-y-2">
                {list.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-[13px] font-medium">{s.name}</span>
                      <span className="num ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {s.version}
                      </span>
                      <DocStatusPill status={s.status} />
                    </div>
                    <span className="text-[11px] text-muted-foreground">updated {fmtDate(s.updated)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
