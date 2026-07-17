import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Building2, CalendarDays, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ESG_GROUP, scopeLabel, type ScopeSel } from "@/lib/esg-data";

export type WheelRow = { id: string; label: string; indent?: boolean };

const ITEM_H = 36;
const VISIBLE = 5;
const WHEEL_H = ITEM_H * VISIBLE;
const PAD = (WHEEL_H - ITEM_H) / 2;

/**
 * The scrollable dial itself — native scroll + CSS scroll-snap carries the
 * momentum and rubber-banding for free (real touch/trackpad physics beat a
 * hand-rolled drag simulation here). A short settle-debounce commits the
 * centred row; scroll position also drives live opacity/scale per row so
 * the stack reads as a physical wheel, not a plain list. Shared by the month
 * and scope selectors — anything backed by a flat, mutually-exclusive list.
 */
function Wheel({
  rows,
  value,
  onChange,
  align = "center",
}: {
  rows: WheelRow[];
  value: string;
  onChange: (id: string) => void;
  align?: "center" | "left";
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduce = useReducedMotion();
  const selectedIndex = Math.max(0, rows.findIndex((o) => o.id === value));

  // Land on the current value the instant the wheel mounts — no animation to watch, just there.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = selectedIndex * ITEM_H;
    setScrollTop(selectedIndex * ITEM_H);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const commit = (top: number, smooth = true) => {
    const idx = Math.min(rows.length - 1, Math.max(0, Math.round(top / ITEM_H)));
    scrollerRef.current?.scrollTo({ top: idx * ITEM_H, behavior: smooth && !reduce ? "smooth" : "auto" });
    const row = rows[idx];
    if (row && row.id !== value) onChange(row.id);
  };

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => commit(el.scrollTop), 120);
  };

  return (
    <div className="relative select-none" style={{ height: WHEEL_H }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-1.5 top-1/2 z-0 -translate-y-1/2 rounded-lg border border-primary/25 bg-primary/8"
        style={{ height: ITEM_H }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-9 bg-gradient-to-b from-popover to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-9 bg-gradient-to-t from-popover to-transparent" />

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        tabIndex={0}
        role="listbox"
        aria-label="Select an option"
        aria-activedescendant={rows[selectedIndex]?.id}
        onKeyDown={(e) => {
          const el = scrollerRef.current;
          if (!el) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            commit(el.scrollTop + ITEM_H);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            commit(el.scrollTop - ITEM_H);
          } else if (e.key === "Enter") {
            e.preventDefault();
            clearTimeout(settleTimer.current);
            commit(el.scrollTop);
          }
        }}
        className="relative h-full overflow-y-auto outline-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div style={{ height: PAD }} aria-hidden />
        {rows.map((row, i) => {
          const distance = Math.abs(scrollTop / ITEM_H - i);
          const opacity = Math.max(0.3, 1 - distance * 0.4);
          const scale = Math.max(0.84, 1 - distance * 0.13);
          return (
            <button
              key={row.id}
              id={row.id}
              type="button"
              role="option"
              aria-selected={row.id === value}
              onClick={() => commit(i * ITEM_H)}
              style={{ height: ITEM_H, scrollSnapAlign: "center", opacity, transform: `scale(${scale})` }}
              className={cn(
                "relative z-[1] flex w-full items-center truncate tracking-tight focus-visible:outline-none",
                align === "center" ? "justify-center text-[14.5px] font-semibold" : "justify-start px-4 text-[13.5px] font-semibold",
                row.indent && "pl-8 text-[12.5px] font-medium",
                row.id === value ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {row.label}
            </button>
          );
        })}
        <div style={{ height: PAD }} aria-hidden />
      </div>
    </div>
  );
}

/**
 * Any flat, mutually-exclusive list as an iOS-style dial: the trigger just
 * shows the current value; clicking it opens a scroll wheel to spin to
 * another one.
 */
function WheelTrigger({
  open,
  triggerClassName,
  icon: Icon,
  label,
  ariaLabel,
  panelLabel,
  panelWidth,
  align,
  children,
}: {
  open: boolean;
  triggerClassName: string;
  icon: typeof CalendarDays;
  label: string;
  ariaLabel: string;
  panelLabel: string;
  panelWidth: number;
  align: "start" | "end";
  children: React.ReactNode;
}) {
  return (
    <>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClassName} aria-label={ariaLabel}>
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="max-w-[190px] truncate">{label}</span>
          <ChevronDown className={cn("h-3 w-3 shrink-0 opacity-60 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} sideOffset={8} style={{ width: panelWidth }} className="rounded-xl border-border/60 p-2 shadow-elevated">
        <div className="mb-1 px-1 text-center text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{panelLabel}</div>
        {children}
      </PopoverContent>
    </>
  );
}

export function MonthWheelPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: WheelRow[];
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value)?.label ?? value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <WheelTrigger
        open={open}
        icon={CalendarDays}
        label={current}
        ariaLabel={`Reporting period: ${current}. Activate to change the month`}
        panelLabel="Reporting period"
        panelWidth={168}
        align="end"
        triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <Wheel rows={options} value={value} onChange={onChange} align="center" />
      </WheelTrigger>
    </Popover>
  );
}

/* ---------------------------------- scope ---------------------------------- */

function scopeRows(): WheelRow[] {
  const rows: WheelRow[] = [{ id: "group", label: ESG_GROUP.name }];
  for (const e of ESG_GROUP.entities) {
    rows.push({ id: `entity:${e.id}`, label: e.name });
    for (const d of e.depots) rows.push({ id: `depot:${e.id}:${d.id}`, label: d.name, indent: true });
  }
  return rows;
}

function scopeRowId(scope: ScopeSel): string {
  if (!scope.entityId) return "group";
  if (!scope.depotId) return `entity:${scope.entityId}`;
  return `depot:${scope.entityId}:${scope.depotId}`;
}

function scopeFromRowId(id: string): ScopeSel {
  if (id.startsWith("depot:")) {
    const [, entityId, depotId] = id.split(":");
    return { entityId, depotId };
  }
  if (id.startsWith("entity:")) return { entityId: id.slice("entity:".length) };
  return {};
}

export function ScopeWheelPicker({ scope, onChange }: { scope: ScopeSel; onChange: (s: ScopeSel) => void }) {
  const [open, setOpen] = useState(false);
  const rows = scopeRows();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <WheelTrigger
        open={open}
        icon={Building2}
        label={scopeLabel(scope)}
        ariaLabel={`Scope: ${scopeLabel(scope)}. Activate to change`}
        panelLabel="Scope"
        panelWidth={260}
        align="start"
        triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/8 px-2.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <Wheel rows={rows} value={scopeRowId(scope)} onChange={(id) => onChange(scopeFromRowId(id))} align="left" />
      </WheelTrigger>
    </Popover>
  );
}
