import { Sparkles, type LucideIcon } from "lucide-react";

export interface InsightCardProps {
  icon?: LucideIcon;
  tone?: "primary" | "warning" | "destructive" | "success";
  title: string;
  body: string;
  tag?: string;
}

export function InsightCard({ icon: Icon = Sparkles, tone = "primary", title, body, tag }: InsightCardProps) {
  const ring =
    tone === "destructive"
      ? "ring-destructive/25 bg-destructive/10 text-destructive"
      : tone === "warning"
      ? "ring-warning/25 bg-warning/10 text-warning"
      : tone === "success"
      ? "ring-success/25 bg-success/10 text-success"
      : "ring-primary/25 bg-primary/10 text-primary";
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-elevated transition-colors hover:border-border">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-2xl"
        style={{
          background:
            tone === "destructive"
              ? "color-mix(in oklab, var(--color-destructive) 50%, transparent)"
              : tone === "warning"
              ? "color-mix(in oklab, var(--color-warning) 50%, transparent)"
              : tone === "success"
              ? "color-mix(in oklab, var(--color-success) 50%, transparent)"
              : "color-mix(in oklab, var(--color-primary) 50%, transparent)",
        }}
        aria-hidden
      />
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${ring}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {tag && (
              <span className="rounded-full border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {tag}
              </span>
            )}
            <span className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">AI insight</span>
          </div>
          <h4 className="mt-1.5 text-[13.5px] font-semibold tracking-tight">{title}</h4>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}
