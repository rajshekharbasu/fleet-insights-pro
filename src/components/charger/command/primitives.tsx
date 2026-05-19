import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import type { RiskLevel } from "@/lib/charger-data";

export const fmt = (n: number, d = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

export function LivePulse() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
    </span>
  );
}

export function SeverityDot({ level }: { level: RiskLevel | "neutral" }) {
  const c =
    level === "critical"
      ? "bg-destructive shadow-[0_0_10px_var(--color-destructive)]"
      : level === "warning"
        ? "bg-warning shadow-[0_0_8px_var(--color-warning)]"
        : level === "healthy"
          ? "bg-success"
          : "bg-muted-foreground";
  return <span className={`inline-block h-2 w-2 rounded-full ${c}`} />;
}

export function RiskPill({ level }: { level: RiskLevel }) {
  const cls =
    level === "critical"
      ? "bg-destructive/15 text-destructive ring-destructive/35"
      : level === "warning"
        ? "bg-warning/15 text-warning ring-warning/35"
        : "bg-success/15 text-success ring-success/35";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${cls}`}>
      {level}
    </span>
  );
}

export function GlassPanel({
  children,
  className = "",
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: "critical" | "warning" | "primary";
}) {
  const glowStyle =
    glow === "critical"
      ? { boxShadow: "0 0 40px -12px color-mix(in oklab, var(--color-destructive) 55%, transparent)" }
      : glow === "warning"
        ? { boxShadow: "0 0 36px -12px color-mix(in oklab, var(--color-warning) 45%, transparent)" }
        : glow === "primary"
          ? { boxShadow: "0 0 36px -12px color-mix(in oklab, var(--color-primary) 35%, transparent)" }
          : undefined;
  return (
    <div
      className={`cc-glass overflow-hidden rounded-2xl border border-border/40 ${className}`}
      style={glowStyle}
    >
      {children}
    </div>
  );
}

export function SectionShell({
  id,
  label,
  title,
  description,
  children,
  action,
}: {
  id: string;
  label: string;
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section id={id} className="cc-section scroll-mt-28 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/30 pb-4">
        <div>
          <div className="cc-section-label">{label}</div>
          <h2 className="mt-1 text-[22px] font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PanelHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="border-b border-border/30 px-5 py-4">
      <h3 className="text-[14px] font-semibold">{title}</h3>
      {sub && <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function InsightTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex cursor-help">
      <Info className="h-3.5 w-3.5 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
      <span className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden w-56 rounded-lg border border-border/60 bg-popover/95 p-2.5 text-[11px] leading-relaxed text-muted-foreground shadow-xl group-hover:block">
        {text}
      </span>
    </span>
  );
}

export function DeltaBadge({
  delta,
  positiveIsGood,
}: {
  delta: number;
  positiveIsGood: boolean;
}) {
  const good = positiveIsGood ? delta >= 0 : delta <= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold num ${
        good ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"
      }`}
    >
      {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

export function MiniSparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((v - min) / (max - min)) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-20" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        points={pts}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
