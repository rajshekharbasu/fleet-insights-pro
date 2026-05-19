import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { RiskLevel } from "@/lib/charger-data";

export const fmt = (n: number, d = 1) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

export function RiskBadge({ level }: { level: RiskLevel }) {
  const styles =
    level === "critical"
      ? "bg-destructive/15 text-destructive ring-destructive/30"
      : level === "warning"
        ? "bg-warning/15 text-warning ring-warning/30"
        : "bg-success/15 text-success ring-success/30";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${styles}`}>
      {level}
    </span>
  );
}

export function MiniSpark({ data, color = "var(--color-primary)" }: { data: { v: number }[]; color?: string }) {
  if (!data.length) return null;
  return (
    <div className="h-8 w-[4.5rem]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={color} fillOpacity={0.15} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendSpark({ values }: { values: number[] }) {
  const data = values.map((v) => ({ v }));
  const last = values[values.length - 1] ?? 0;
  const first = values[0] ?? last;
  const up = last >= first;
  return (
    <div className="flex items-center gap-1">
      <svg width="56" height="20" className="opacity-90">
        <polyline
          fill="none"
          stroke={up ? "var(--color-success)" : "var(--color-destructive)"}
          strokeWidth="1.5"
          points={values
            .map((v, i) => {
              const x = (i / Math.max(values.length - 1, 1)) * 52 + 2;
              const min = Math.min(...values);
              const max = Math.max(...values, min + 1);
              const y = 18 - ((v - min) / (max - min)) * 14;
              return `${x},${y}`;
            })
            .join(" ")}
        />
      </svg>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-interactive overflow-hidden rounded-2xl border border-border/50 bg-card shadow-elevated ${className}`}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 px-5 py-4">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {description && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
