import { Calendar as CalendarIcon, Check, ChevronDown, RotateCcw, X } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { FILTER_OPTIONS } from "@/lib/mock-data";
import { DEFAULT_FILTERS, type Filters } from "@/lib/analytics";

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
}

const PRESETS: { label: string; days: number }[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "180d", days: 180 },
];

function MultiSelect<T extends string>({
  label, values, options, getLabel, onToggle,
}: {
  label: string;
  values: T[];
  options: T[];
  getLabel?: (v: T) => string;
  onToggle: (v: T) => void;
}) {
  const display = getLabel ?? ((v: T) => v);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 border-border/70 bg-card/60 text-[12.5px]">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">
            {values.length === 0 ? "All" : `${values.length} selected`}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={values.includes(opt)}
            onCheckedChange={() => onToggle(opt)}
            onSelect={(e) => e.preventDefault()}
            className="text-[13px]"
          >
            {display(opt)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FilterBar({ filters, onChange }: Props) {
  const chips = useMemo(() => {
    const items: { label: string; clear: () => void }[] = [];
    filters.companies.forEach((v) => items.push({ label: v, clear: () => toggle("companies", v) }));
    filters.drivers.forEach((v) => items.push({ label: v, clear: () => toggle("drivers", v) }));
    filters.routes.forEach((v) => items.push({ label: v, clear: () => toggle("routes", v) }));
    filters.vehicles.forEach((v) => items.push({ label: v, clear: () => toggle("vehicles", v) }));
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function toggle<K extends "companies" | "drivers" | "routes" | "vehicles">(key: K, v: string) {
    const cur = filters[key];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange({ ...filters, [key]: next });
  }

  function applyPreset(days: number) {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    onChange({ ...filters, from, to });
  }

  const reset = () => onChange(DEFAULT_FILTERS);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-3 shadow-elevated backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/70 p-0.5">
          <CalendarIcon className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              className="rounded-md px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {p.label}
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-border/70" />
          <span className="px-2 text-[12px] num text-foreground">
            {filters.from} → {filters.to}
          </span>
        </div>

        <div className="mx-1 hidden h-6 w-px bg-border/60 md:block" />

        <MultiSelect
          label="Company"
          values={filters.companies}
          options={FILTER_OPTIONS.companies.map((c) => c.name)}
          onToggle={(v) => toggle("companies", v)}
        />
        <MultiSelect
          label="Driver"
          values={filters.drivers}
          options={FILTER_OPTIONS.drivers}
          onToggle={(v) => toggle("drivers", v)}
        />
        <MultiSelect
          label="Route"
          values={filters.routes}
          options={FILTER_OPTIONS.routes.map((r) => r.code)}
          onToggle={(v) => toggle("routes", v)}
        />
        <MultiSelect
          label="Vehicle"
          values={filters.vehicles}
          options={FILTER_OPTIONS.vehicles}
          onToggle={(v) => toggle("vehicles", v)}
        />

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={reset} className="h-8 gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2.5">
          <Check className="h-3 w-3 text-primary" />
          <span className="mr-1 text-[11px] uppercase tracking-wider text-muted-foreground">Applied</span>
          {chips.map((c, i) => (
            <button
              key={i}
              onClick={c.clear}
              className="group inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11.5px] text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              {c.label}
              <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
