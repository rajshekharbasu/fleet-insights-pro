/**
 * Shared presentational primitives for the Battery Cycle screens.
 * Kept framework-light (hand-rolled SVG) to match the dashboard's
 * token-driven aesthetic and avoid heavy chart deps.
 */
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const fmt = (v: number | null | undefined, dec = 0) =>
  v == null || !Number.isFinite(v) ? "—" : dec === 0 ? Math.round(v).toLocaleString() : v.toFixed(dec);

/** Segmented-control button used across toolbars + filters. */
export function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border-0 px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
        active ? "nav-pill-active text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Card container with section label + optional subtitle / right slot. */
export function Panel({
  title,
  subtitle,
  right,
  className,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-card p-5 shadow-elevated", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="section-label">{title}</div>
          {subtitle && <div className="mt-1 text-[13px] text-muted-foreground">{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ---------- sparkline ---------- */
export function spark(vals: (number | null)[], w: number, h: number) {
  const valid = vals.map((v, i) => ({ v, i })).filter((o) => o.v != null) as { v: number; i: number }[];
  if (!valid.length) return { line: "", area: "" };
  const nums = valid.map((o) => o.v);
  const mn = Math.min(...nums);
  const mx = Math.max(...nums);
  const rng = mx - mn || 1;
  const pad = 2;
  const n = vals.length;
  const pts = valid.map((o) => {
    const x = n === 1 ? w / 2 : (o.i / (n - 1)) * w;
    const y = h - pad - ((o.v - mn) / rng) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const x0 = (valid[0].i / (n - 1)) * w;
  const x1 = (valid[valid.length - 1].i / (n - 1)) * w;
  return { line: pts.join(" "), area: `${x0.toFixed(1)},${h} ${pts.join(" ")} ${x1.toFixed(1)},${h}` };
}

export function Sparkline({ vals, color, w, h, lineOnly }: { vals: (number | null)[]; color: string; w: number; h: number; lineOnly?: boolean }) {
  const s = spark(vals, w, h);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {!lineOnly && s.area && <polyline points={s.area} fill={color} fillOpacity={0.11} stroke="none" />}
      <polyline points={s.line} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- donut ---------- */
export type DonutSeg = { label: string; value: number; color: string };

export function Donut({
  segments,
  size = 150,
  thickness = 20,
  centerTop,
  centerSub,
}: {
  segments: DonutSeg[];
  size?: number;
  thickness?: number;
  centerTop?: string;
  centerSub?: string;
}) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  const activeSeg = hoveredLabel ? segments.find((s) => s.label === hoveredLabel) : null;
  const displayTop = activeSeg ? String(activeSeg.value) : centerTop;
  const displaySub = activeSeg ? `${activeSeg.label} (${Math.round((activeSeg.value / total) * 100)}%)` : centerSub;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in oklab,var(--muted-foreground) 14%,transparent)" strokeWidth={thickness} />
        {segments.map((s) => {
          const len = (s.value / total) * c;
          const isHovered = hoveredLabel === s.label;
          const el = (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={isHovered ? thickness + 4 : thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              className="cursor-pointer transition-all duration-200"
              style={{
                opacity: hoveredLabel === null || isHovered ? 1 : 0.55,
              }}
              onMouseEnter={() => setHoveredLabel(s.label)}
              onMouseLeave={() => setHoveredLabel(null)}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      {(displayTop || displaySub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {displayTop && <span className="num text-[22px] font-semibold leading-none">{displayTop}</span>}
          {displaySub && <span className="mt-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground text-center px-2">{displaySub}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------- horizontal bar row ---------- */
export function HBar({ label, value, max, color, suffix, onClick, active }: {
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const w = Math.max(2, Math.min(100, (value / (max || 1)) * 100));
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group w-full rounded-lg px-1.5 py-1 text-left transition",
        onClick && "hover:bg-muted/50",
        active && "bg-primary/5 ring-1 ring-primary/30",
      )}
    >
      <div className="mb-1 flex items-center justify-between text-[11.5px]">
        <span className="font-medium">{label}</span>
        <span className="num font-semibold">{fmt(value, value < 100 ? 1 : 0)}{suffix}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "color-mix(in oklab,var(--muted-foreground) 16%,transparent)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
      </div>
    </button>
  );
}

/* ---------- grouped vertical bars (one group per category) ---------- */
export function VBars({ groups, max, height = 150 }: {
  groups: { label: string; bars: { value: number; color: string; tip?: string }[] }[];
  max: number;
  height?: number;
}) {
  return (
    <div className="flex items-end gap-3 overflow-x-auto" style={{ height }}>
      {groups.map((g) => (
        <div key={g.label} className="flex h-full min-w-[64px] flex-1 flex-col">
          <div className="flex flex-1 items-end justify-center gap-1.5">
            {g.bars.map((b, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end" title={b.tip}>
                <span className="num mb-1 text-[10.5px] font-semibold">{fmt(b.value, b.value < 100 ? 1 : 0)}</span>
                <div className="w-full max-w-[26px] rounded-t-md" style={{ height: `${Math.max(2, (b.value / (max || 1)) * 100)}%`, background: b.color }} />
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-border/60 pt-2 text-center text-[11.5px] font-semibold">{g.label}</div>
        </div>
      ))}
    </div>
  );
}
