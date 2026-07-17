import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  key: T;
  label: React.ReactNode;
  Icon?: LucideIcon;
};

const SIZE = {
  sm: { pad: "p-0.5", seg: "px-2.5 py-1 text-[11.5px]", gap: "gap-1.5", icon: "h-3 w-3", radius: "rounded-md" },
  md: { pad: "p-0.5", seg: "px-3 py-1.5 text-[12px]", gap: "gap-1.5", icon: "h-3.5 w-3.5", radius: "rounded-lg" },
  lg: { pad: "p-1", seg: "px-4 py-2 text-[13px] font-medium", gap: "gap-2", icon: "h-4 w-4", radius: "rounded-lg" },
} as const;

/**
 * Animated segmented control — a single sliding indicator (shared layoutId)
 * glides under the active segment instead of each pill toggling its own bg.
 * Springs stay interruptible, so a fast back-and-forth reverses mid-flight.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
  className,
  emphasis = false,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: keyof typeof SIZE;
  ariaLabel: string;
  className?: string;
  /** Bumps the active indicator to a solid brand fill — for the hero control. */
  emphasis?: boolean;
}) {
  const s = SIZE[size];
  const layoutId = useId();
  const reduce = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center border border-border/60 bg-card/60",
        size === "lg" ? "rounded-xl" : "rounded-lg",
        s.pad,
        className,
      )}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={cn(
              "relative inline-flex items-center justify-center whitespace-nowrap transition-[color,transform] duration-150 ease-out active:scale-[0.96]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              s.seg,
              s.radius,
              active ? (emphasis ? "text-primary-foreground" : "text-foreground") : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className={cn(
                  "absolute inset-0 -z-0",
                  s.radius,
                  emphasis ? "bg-primary shadow-elevated" : "nav-pill-active",
                )}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 520, damping: 40, mass: 0.7 }
                }
              />
            )}
            <span className={cn("relative z-10 inline-flex items-center", s.gap)}>
              {o.Icon && <o.Icon className={s.icon} aria-hidden />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
