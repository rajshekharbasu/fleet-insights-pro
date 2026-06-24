import type { ReactNode } from "react";
import type { SyncJobStatus } from "@/lib/api/data-admin";

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function relativeTime(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

const STATUS_STYLE: Record<string, string> = {
  success: "bg-success/12 text-success ring-success/25",
  running: "bg-primary/12 text-primary ring-primary/25",
  pending: "bg-warning/12 text-warning ring-warning/25",
  failed: "bg-destructive/12 text-destructive ring-destructive/25",
};

export function StatusBadge({ status }: { status: SyncJobStatus }) {
  const cls = STATUS_STYLE[status] ?? "bg-muted text-muted-foreground ring-border";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ring-1 ring-inset ${cls}`}>
      {status === "running" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {status}
    </span>
  );
}

export function Panel({
  title, subtitle, icon, actions, children,
}: {
  title: string; subtitle?: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elevated">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
        <div className="flex items-center gap-3">
          {icon && <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</span>}
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
            {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-[12.5px] text-muted-foreground">{message}</div>
  );
}
