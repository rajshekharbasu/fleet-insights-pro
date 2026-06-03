import { REMARK_LABELS } from "@/lib/mis/constants";
import type { MergedTrip, RemarkCode } from "@/lib/mis/types";
import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: MergedTrip["status"] }) {
  const map = {
    completed: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30",
    lost: "bg-red-500/15 text-red-600 ring-red-500/30",
    short: "bg-amber-500/15 text-amber-700 ring-amber-500/30",
    extra: "bg-blue-500/15 text-blue-600 ring-blue-500/30",
  };
  const label = { completed: "Completed", lost: "Lost", short: "Short", extra: "Extra" }[status];
  return (
    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1", map[status])}>
      {label}
    </span>
  );
}

export function RemarkLabel({ code }: { code: RemarkCode }) {
  return <span className="text-[11px]">{REMARK_LABELS[code]}</span>;
}

export { COLUMN_GROUPS, type ColumnGroupKey } from "@/lib/mis/column-groups";

export function MisTableShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-auto rounded-lg border border-border/60", className)}>
      <table className={cn("mis-table w-full border-collapse text-[11.5px]", className?.includes("min-w-0") ? "min-w-0" : "min-w-[1280px]")}>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  band,
  colSpan,
  align,
}: {
  children: React.ReactNode;
  className?: string;
  band?: string;
  colSpan?: number;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      colSpan={colSpan}
      className={cn(
        "sticky top-0 z-10 border-b border-border/50 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide",
        band ?? "bg-muted/90 text-muted-foreground backdrop-blur-sm",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align !== "right" && align !== "center" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border-b border-border/30 px-2 py-1.5",
        align === "right" ? "text-right tabular-nums" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}
