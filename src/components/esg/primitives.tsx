import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CircleCheck,
  Clock,
  EyeOff,
  FileText,
  Flag,
  Inbox,
  Radio,
  TriangleAlert,
} from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { BorderBeam, type BorderBeamSize } from "border-beam";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import {
  GLOSSARY,
  STATE_META,
  type EsgState,
  type Provenance,
  type ScopeSel,
} from "@/lib/esg-data";
import type { PolicyWorkflow, Role } from "@/lib/esg-policy";
import type { AuditWorkflow } from "@/lib/esg-audit";
import type { TrainingWorkflow } from "@/lib/esg-training";
import type { MonitoringWorkflow } from "@/lib/esg-monitoring";
import type { MastersWorkflow } from "@/lib/esg-masters";

/* ------------------------------- ESG context ------------------------------- */

export type Audience = "internal" | "external";

export type EsgCtx = {
  scope: ScopeSel;
  setScope: (s: ScopeSel) => void;
  period: string;
  setPeriod: (p: string) => void;
  audience: Audience;
  setAudience: (a: Audience) => void;
  /** Stubbed role for the permission-model presentation — UI gating, not enforcement. */
  role: Role;
  setRole: (r: Role) => void;
  /** Policy version/approval workflow store (Phase 2). */
  policy: PolicyWorkflow;
  /** Audit workflow store — internal & external (Phases 3 & 4). */
  audit: AuditWorkflow;
  /** Training calendar workflow store (Phase 5). */
  training: TrainingWorkflow;
  /** Site monitoring workflow store (Phase 6). */
  monitoring: MonitoringWorkflow;
  /** Editable masters — lead windows + GHG factors (Phase 9). */
  masters: MastersWorkflow;
  openRecord: (id: string) => void;
  goto: (area: string, opts?: { record?: string; state?: string; sub?: string }) => void;
};

export const EsgContext = createContext<EsgCtx | null>(null);
export const useEsg = () => {
  const ctx = useContext(EsgContext);
  if (!ctx) throw new Error("useEsg outside provider");
  return ctx;
};

/** Simulated fetch delay so loading skeletons are real, not theoretical. */
export function useStubLoad(key: string, ms = 450) {
  const [loading, setLoading] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setLoading(true);
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [key, ms]);
  return loading;
}

/* ----------------------------- acronym glossary ---------------------------- */

/**
 * Inline glossary affordance — no underline. A sustained ~1.2s hover reveals
 * the full form; it then eases away on its own with a soft 500ms fade (or
 * immediately on pointer-leave). Keyboard focus reveals it instantly and holds
 * it. One definition source (GLOSSARY); plain text when the term is unknown.
 */
const A_OPEN_DELAY = 1200;
const A_DWELL = 2200;
const A_FADE_MS = 500;

export function A({ t, className }: { t: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dwellTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reduce = useReducedMotion();
  const entry = GLOSSARY[t];

  useEffect(
    () => () => {
      clearTimeout(openTimer.current);
      clearTimeout(dwellTimer.current);
    },
    [],
  );

  if (!entry) return <span className={className}>{t}</span>;

  const clear = () => {
    clearTimeout(openTimer.current);
    clearTimeout(dwellTimer.current);
  };
  const enter = () => {
    clear();
    openTimer.current = setTimeout(() => {
      setOpen(true);
      // Reveal, then let it drift away on its own after a readable dwell.
      dwellTimer.current = setTimeout(() => setOpen(false), A_DWELL);
    }, A_OPEN_DELAY);
  };
  const leave = () => {
    clear();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => !o && setOpen(false)}>
      <PopoverTrigger asChild>
        {/* span, not button: acronyms legally nest inside buttons/rows */}
        <span
          role="button"
          tabIndex={0}
          onMouseEnter={enter}
          onMouseLeave={leave}
          onFocus={() => {
            clear();
            setOpen(true);
          }}
          onBlur={leave}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }
          }}
          aria-label={`${t}: ${entry.full}`}
          className={cn(
            "cursor-help rounded-sm decoration-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            className,
          )}
        >
          {t}
        </span>
      </PopoverTrigger>
      <AnimatePresence>
        {open && (
          <PopoverPrimitive.Portal forceMount>
            <PopoverPrimitive.Content
              asChild
              forceMount
              side="top"
              align="start"
              sideOffset={6}
              onMouseEnter={enter}
              onMouseLeave={leave}
              className="z-50 origin-(--radix-popover-content-transform-origin)"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  filter: "blur(2px)",
                  transition: { duration: reduce ? 0 : A_FADE_MS / 1000, ease: "easeOut" },
                }}
                transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className="w-auto max-w-[280px] rounded-xl border border-border/60 bg-popover px-3.5 py-2.5 text-popover-foreground shadow-elevated outline-none"
              >
                <div className="text-[12px] font-semibold tracking-tight">{entry.full}</div>
                {entry.note && <div className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{entry.note}</div>}
              </motion.div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        )}
      </AnimatePresence>
    </Popover>
  );
}

/** Auto-mark known acronyms inside a plain string ("Fire NOC" → Fire <A t="NOC"/>). */
export function Gloss({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\b[A-Za-z0-9/&-]+\b)/g);
  return (
    <span className={className}>
      {parts.map((p, i) => (GLOSSARY[p] ? <A key={i} t={p} /> : <span key={i}>{p}</span>))}
    </span>
  );
}

/* -------------------------------- state pill ------------------------------- */

const STATE_ICON: Record<EsgState, typeof CircleCheck> = {
  valid: CircleCheck,
  expiring: Clock,
  overdue: TriangleAlert,
};

/** Label + glyph + tint — state never reads through colour alone. */
export function StatePill({ state, className, size = "sm" }: { state: EsgState; className?: string; size?: "sm" | "md" }) {
  const meta = STATE_META[state];
  const Icon = STATE_ICON[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-semibold uppercase tracking-wider",
        size === "md" ? "px-2 py-1 text-[11px]" : "px-1.5 py-0.5 text-[10px]",
        className,
      )}
      style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }}
    >
      <Icon className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} aria-hidden />
      {meta.label}
    </span>
  );
}

export function StateDot({ state }: { state: EsgState }) {
  const Icon = STATE_ICON[state];
  return (
    <span
      className="grid h-5 w-5 shrink-0 place-items-center rounded-md"
      style={{ background: `color-mix(in oklab, ${STATE_META[state].color} 14%, transparent)`, color: STATE_META[state].color }}
      aria-label={STATE_META[state].label}
    >
      <Icon className="h-3 w-3" aria-hidden />
    </span>
  );
}

/* ------------------------------ provenance chip ---------------------------- */

/**
 * Auto-fetched values carry visible, challengeable provenance.
 * UI-only: the chip is the seam where the real pipeline will plug in.
 */
export function ProvenanceChip({ prov, onFlag }: { prov: Provenance; onFlag?: () => void }) {
  const errored = !!prov.error;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        errored
          ? "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/25"
          : "bg-accent text-accent-foreground ring-1 ring-inset ring-primary/20",
      )}
      title={
        errored
          ? prov.error
          : `Auto-fetched from ${prov.source} · ${new Date(prov.fetchedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
      }
    >
      <Radio className="h-2.5 w-2.5" aria-hidden />
      {errored ? `${prov.source} — unavailable` : `from ${prov.source}`}
      {onFlag && !errored && (
        <button
          type="button"
          onClick={onFlag}
          aria-label="Flag this value as wrong"
          className="ml-0.5 rounded-sm p-0.5 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Flag className="h-2.5 w-2.5" aria-hidden />
        </button>
      )}
    </span>
  );
}

/* ------------------------------- withheld pill ----------------------------- */

/** Internal-only marker: this item is curated out of the external view. */
export function WithheldPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, transparent, transparent 3px, color-mix(in oklab, var(--muted-foreground) 8%, transparent) 3px, color-mix(in oklab, var(--muted-foreground) 8%, transparent) 4px)",
      }}
      title="Visible internally; withheld from the curated external view by default"
    >
      <EyeOff className="h-2.5 w-2.5" aria-hidden />
      Hidden from external view
    </span>
  );
}

/* --------------------------- empty / loading states ------------------------ */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  hint,
  className,
}: {
  icon?: typeof Inbox;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid place-items-center gap-2 px-6 py-12 text-center", className)}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      {hint && <div className="max-w-[360px] text-[12px] leading-relaxed text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5 p-5", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-md" />
          <Skeleton className="h-4 flex-1 rounded-md" style={{ maxWidth: `${88 - i * 9}%` }} />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- doc evidence ------------------------------ */

export function DocChip({ name, size }: { name: string; size?: string }) {
  return (
    <button
      type="button"
      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors hover:border-primary/40 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      title="Evidence document (stub — opens from document store when connected)"
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span className="truncate">{name}</span>
      {size && <span className="shrink-0 text-[10.5px] font-normal text-muted-foreground">{size}</span>}
    </button>
  );
}

/* ------------------------------ section wrapper ---------------------------- */

/* -------------------------------- critical beam ----------------------------- */

/**
 * Breathing red border for items that need eyes now (overdue / errored).
 * Reserved for genuinely critical states — not a general-purpose glow, or it
 * stops meaning anything. border-beam ships four fixed hue palettes and no
 * raw-color prop, so `critical-beam-red` (styles.css) forces every palette's
 * colors down to a single destructive red via a grayscale→sepia→hue-rotate
 * chain — see the comment there for why that's colour-agnostic and reliable.
 */
export function CriticalBeam({
  active = true,
  size = "pulse-inner",
  className,
  children,
}: {
  active?: boolean;
  size?: BorderBeamSize;
  className?: string;
  children: ReactNode;
}) {
  const { dark } = useTheme();
  const reduce = useReducedMotion();
  if (!active) return <>{children}</>;
  return (
    <BorderBeam
      size={size}
      colorVariant="mono"
      staticColors
      theme={dark ? "dark" : "light"}
      strength={0.85}
      active={!reduce}
      className={cn("critical-beam-red", className)}
    >
      {children}
    </BorderBeam>
  );
}

export function PanelCard({
  accent,
  children,
  className,
}: {
  accent?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elevated", className)}
      style={accent ? { borderColor: `color-mix(in oklab, ${accent} 35%, transparent)` } : undefined}
    >
      {children}
    </section>
  );
}
