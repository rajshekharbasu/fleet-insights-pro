import { Calendar as CalendarIcon, Check, ChevronDown, RotateCcw, Search, X } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { FILTER_OPTIONS } from "@/lib/mock-data";
import { DEFAULT_FILTERS, type Filters } from "@/lib/analytics";

interface RouteOption {
  code: string;
  name: string;
}

interface VehicleOption {
  code: string;
  name: string;
}

interface ShowControls {
  date?: boolean;
  company?: boolean;
  driver?: boolean;
  route?: boolean;
  vehicle?: boolean;
  search?: boolean;
}

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  options?: {
    companies: string[];
    drivers: string[];
    routes: RouteOption[];
    vehicles: VehicleOption[];
  };
  /**
   * Which controls to render. Defaults to all. Pages backed by snapshot data
   * (e.g. route/driver leaderboards) pass only the dimensions they support.
   */
  show?: ShowControls;
}

const ALL_SHOWN: Required<ShowControls> = {
  date: true,
  company: true,
  driver: true,
  route: true,
  vehicle: true,
  // Opt-in only so existing callers are unaffected.
  search: false,
};

const PRESETS: { label: string; days: number }[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "180d", days: 180 },
];

function daysBetween(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400_000);
}

function MultiSelect<T extends string>({
  label,
  values,
  options,
  getLabel,
  onToggle,
}: {
  label: string;
  values: T[];
  options: T[];
  getLabel?: (v: T) => string;
  onToggle: (v: T) => void;
}) {
  const display = getLabel ?? ((v: T) => v);
  const hasSelection = values.length > 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-1.5 rounded-xl border-border/60 text-[12px] ${
            hasSelection ? "border-primary/30 bg-primary/8 text-foreground" : "bg-card/50"
          }`}
        >
          <span className={hasSelection ? "text-primary" : "text-muted-foreground"}>{label}</span>
          <span className="font-medium">
            {values.length === 0 ? "All" : `${values.length}`}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto">
        <DropdownMenuLabel className="section-label">{label}</DropdownMenuLabel>
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

export function FilterBar({ filters, onChange, options, show }: Props) {
  const shown = { ...ALL_SHOWN, ...(show ?? {}) };
  const activePreset = useMemo(() => {
    const span = daysBetween(filters.from, filters.to);
    return PRESETS.find((p) => Math.abs(span - p.days) <= 1)?.days;
  }, [filters.from, filters.to]);

  const routeMap = useMemo(() => {
    const map = new Map<string, string>();
    // 1. Local mock routes mapping
    FILTER_OPTIONS.routes.forEach((r) => {
      map.set(r.code, `${r.code} (${r.name})`);
    });
    // 2. Dynamic database routes mapping
    if (options?.routes) {
      options.routes.forEach((r) => {
        map.set(r.code, `${r.code} (${r.name})`);
      });
    }
    return map;
  }, [options?.routes]);

  const vehicleMap = useMemo(() => {
    const map = new Map<string, string>();
    // 1. Local mock vehicles mapping
    FILTER_OPTIONS.vehicles.forEach((v) => {
      const label = v.name && v.name !== v.code ? `${v.name} (${v.code})` : v.code;
      map.set(v.code, label);
    });
    // 2. Dynamic database vehicles mapping
    if (options?.vehicles) {
      options.vehicles.forEach((v) => {
        const label = v.name && v.name !== v.code ? `${v.name} (${v.code})` : v.code;
        map.set(v.code, label);
      });
    }
    return map;
  }, [options?.vehicles]);

  const chips = useMemo(() => {
    const items: { label: string; clear: () => void }[] = [];
    if (shown.company) filters.companies.forEach((v) => items.push({ label: v, clear: () => toggle("companies", v) }));
    if (shown.driver) filters.drivers.forEach((v) => items.push({ label: v, clear: () => toggle("drivers", v) }));
    if (shown.route) filters.routes.forEach((v) => items.push({ label: routeMap.get(v) || v, clear: () => toggle("routes", v) }));
    if (shown.vehicle) filters.vehicles.forEach((v) => items.push({ label: vehicleMap.get(v) || v, clear: () => toggle("vehicles", v) }));
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, routeMap, vehicleMap, shown.company, shown.driver, shown.route, shown.vehicle]);

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
    <div className="rounded-2xl border border-border/50 bg-card/60 p-3.5 shadow-elevated backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        {shown.date && (
          <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card/70 p-1">
            <CalendarIcon className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            {PRESETS.map((p) => {
              const active = activePreset === p.days;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.days)}
                  className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
            <div className="mx-1 h-4 w-px bg-border/60" />
            <span className="px-2 text-[12px] num font-medium text-foreground">
              {filters.from} → {filters.to}
            </span>
          </div>
        )}

        {shown.date && <div className="mx-1 hidden h-6 w-px bg-border/50 md:block" />}

        {shown.search && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filters.search ?? ""}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              placeholder="Search routes…"
              className="h-9 w-48 rounded-xl border border-border/60 bg-card/50 pl-8 pr-7 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, search: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {shown.company && (
          <MultiSelect
            label="Company"
            values={filters.companies}
            options={options?.companies || FILTER_OPTIONS.companies.map((c) => c.name)}
            onToggle={(v) => toggle("companies", v)}
          />
        )}
        {shown.driver && (
          <MultiSelect
            label="Driver"
            values={filters.drivers}
            options={options?.drivers || FILTER_OPTIONS.drivers}
            onToggle={(v) => toggle("drivers", v)}
          />
        )}
        {shown.route && (
          <MultiSelect
            label="Route"
            values={filters.routes}
            options={options?.routes.map((r) => r.code) || FILTER_OPTIONS.routes.map((r) => r.code)}
            getLabel={(code) => routeMap.get(code) || code}
            onToggle={(v) => toggle("routes", v)}
          />
        )}
        {shown.vehicle && (
          <MultiSelect
            label="Vehicle"
            values={filters.vehicles}
            options={options?.vehicles.map((v) => v.code) || FILTER_OPTIONS.vehicles.map((v) => v.code)}
            getLabel={(code) => vehicleMap.get(code) || code}
            onToggle={(v) => toggle("vehicles", v)}
          />
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="h-9 gap-1.5 rounded-xl text-[12px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
          <Check className="h-3 w-3 text-primary" />
          <span className="section-label mr-1">Applied</span>
          {chips.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={c.clear}
              className="group inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2.5 py-0.5 text-[11.5px] text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              {c.label}
              <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
