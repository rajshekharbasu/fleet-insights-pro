import { OPS } from "@/lib/mis/ops-copy";

export function MisStatusLegend({ compact }: { compact?: boolean }) {
  const items = [
    { color: "bg-emerald-500/20 text-emerald-700 ring-emerald-500/30", label: OPS.tripDone },
    { color: "bg-red-500/15 text-red-700 ring-red-500/30", label: OPS.tripLost },
    { color: "bg-amber-500/15 text-amber-800 ring-amber-500/30", label: OPS.tripShort },
    { color: "bg-blue-500/15 text-blue-700 ring-blue-500/30", label: OPS.tripExtra },
    { color: "bg-primary/15 text-primary ring-primary/30", label: OPS.rowAdjusted },
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "text-[10px]" : "text-[11px]"}`}>
      {items.map((item) => (
        <span
          key={item.label}
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 ring-1 ${item.color}`}
        >
          <span className="h-2 w-2 rounded-full bg-current opacity-80" />
          {item.label}
        </span>
      ))}
    </div>
  );
}
