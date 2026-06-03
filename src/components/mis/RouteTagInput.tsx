import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OPS } from "@/lib/mis/ops-copy";

export function RouteTagInput({
  routes,
  onChange,
  suggestions = [],
}: {
  routes: string[];
  onChange: (routes: string[]) => void;
  suggestions?: string[];
}) {
  const add = (code: string) => {
    const t = code.trim().toUpperCase();
    if (!t || routes.includes(t)) return;
    onChange([...routes, t]);
  };

  const unusedSuggestions = suggestions.filter((s) => !routes.includes(s));

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">{OPS.routesHint}</p>
      <div className="flex flex-wrap gap-2">
        {routes.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-1 rounded-lg bg-primary/12 px-3 py-1.5 text-[13px] font-medium text-primary ring-1 ring-primary/25"
          >
            {r}
            <button
              type="button"
              className="rounded p-0.5 hover:bg-primary/20"
              onClick={() => onChange(routes.filter((x) => x !== r))}
              aria-label={`Remove ${r}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {routes.length === 0 && (
          <span className="text-[12px] text-muted-foreground">No routes added yet</span>
        )}
      </div>
      {unusedSuggestions.length > 0 && (
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Quick add</div>
          <div className="flex flex-wrap gap-2">
            {unusedSuggestions.map((s) => (
              <Button
                key={s}
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-[12px]"
                onClick={() => add(s)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {s}
              </Button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Type route code e.g. RT-101"
          className="h-10 text-[13px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = "";
            }
          }}
          id="route-add-input"
        />
        <Button
          type="button"
          size="lg"
          className="h-10 shrink-0"
          onClick={() => {
            const el = document.getElementById("route-add-input") as HTMLInputElement | null;
            if (el?.value) {
              add(el.value);
              el.value = "";
            }
          }}
        >
          Add route
        </Button>
      </div>
    </div>
  );
}
