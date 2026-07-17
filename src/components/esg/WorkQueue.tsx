import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  countdownLabel,
  daysUntil,
  personById,
  recordPlace,
  recordState,
  STATE_META,
  typeByKey,
  type ComplianceRecord,
  type EsgState,
} from "@/lib/esg-data";
import { CriticalBeam, EmptyState, Gloss, StateDot, StatePill, WithheldPill, useEsg } from "./primitives";

type StateFilter = "all" | EsgState;

/**
 * The maintainer's work queue — lands on "what's due", most urgent first.
 * Notifications deep-link here with the relevant row pre-selected.
 */
export function WorkQueue({
  records,
  defaultFilter = "all",
  highlightId,
  compact = false,
}: {
  records: ComplianceRecord[];
  defaultFilter?: StateFilter;
  highlightId?: string;
  compact?: boolean;
}) {
  const { audience, openRecord } = useEsg();
  const [filter, setFilter] = useState<StateFilter>(defaultFilter);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => setFilter(defaultFilter), [defaultFilter]);
  useEffect(() => {
    if (highlightId) highlightRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightId]);

  const visible = useMemo(() => {
    let rs = records.filter((r) => (audience === "external" ? !r.withheldExternal : true));
    if (filter !== "all") rs = rs.filter((r) => recordState(r) === filter);
    return rs.sort((a, b) => {
      const da = a.expiryDate ? daysUntil(a.expiryDate) : 9999;
      const db = b.expiryDate ? daysUntil(b.expiryDate) : 9999;
      return da - db;
    });
  }, [records, filter, audience]);

  const counts = useMemo(() => {
    const scoped = records.filter((r) => (audience === "external" ? !r.withheldExternal : true));
    return {
      all: scoped.length,
      overdue: scoped.filter((r) => recordState(r) === "overdue").length,
      expiring: scoped.filter((r) => recordState(r) === "expiring").length,
      valid: scoped.filter((r) => recordState(r) === "valid").length,
    };
  }, [records, audience]);

  const chips: { key: StateFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "overdue", label: "Overdue" },
    { key: "expiring", label: "Expiring" },
    { key: "valid", label: "Valid" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-5 py-2.5">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            aria-pressed={filter === c.key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              filter === c.key ? "nav-pill-active" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {c.label}
            <span className="num text-[10.5px] opacity-70">{counts[c.key]}</span>
          </button>
        ))}
        <span className="ml-auto hidden text-[10.5px] text-muted-foreground sm:block">
          sorted most-urgent first · capture is always on, reporting is monthly
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nothing due in this scope"
          hint={
            audience === "external" && counts.all === 0
              ? "Items withheld from the external view are not shown. Switch to Internal for the complete record."
              : "No items match this filter — the valid stock is holding."
          }
        />
      ) : (
        <div className={cn("overflow-auto", compact ? "max-h-[380px]" : "max-h-[520px]")}>
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-medium">Item</th>
                <th className="px-3 py-2.5 text-left font-medium">Owner</th>
                <th className="px-3 py-2.5 text-right font-medium">Expiry clock</th>
                <th className="px-3 py-2.5 text-left font-medium">State</th>
                <th className="px-5 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const st = recordState(r);
                const type = typeByKey(r.typeKey);
                const owner = personById(r.ownerId);
                const overdue = st === "overdue";
                const selected = r.id === highlightId;
                return (
                  <tr
                    key={r.id}
                    ref={selected ? highlightRef : undefined}
                    onClick={() => openRecord(r.id)}
                    className={cn(
                      "cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40",
                      selected && "bg-primary/8 ring-1 ring-inset ring-primary/30",
                    )}
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <CriticalBeam active={overdue} size="sm">
                          <StateDot state={st} />
                        </CriticalBeam>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">
                            <Gloss text={type?.label ?? r.typeKey} />
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {recordPlace(r)}
                            {r.withheldExternal && audience === "internal" && (
                              <WithheldPill className="hidden lg:inline-flex" />
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{owner?.name}</div>
                      <div className="text-[11px] text-muted-foreground">{owner?.role}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className="num text-[13px] font-semibold"
                        style={{ color: st === "valid" ? "var(--color-muted-foreground)" : STATE_META[st].color }}
                      >
                        {countdownLabel(r)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatePill state={st} />
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors",
                          overdue
                            ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                            : st === "expiring"
                              ? "border-warning/35 text-warning hover:bg-warning/10"
                              : "border-border/60 text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        {overdue ? "Remediate" : st === "expiring" ? "Renew" : "View"}
                        <ArrowRight className="h-3 w-3" aria-hidden />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
