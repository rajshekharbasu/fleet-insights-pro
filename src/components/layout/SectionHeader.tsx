import type { LucideIcon } from "lucide-react";

export function SectionHeader({
  id,
  label,
  title,
  description,
  icon: Icon,
  action,
}: {
  id?: string;
  label?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <header id={id} className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div>
          {label && <div className="section-label">{label}</div>}
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {action}
    </header>
  );
}
