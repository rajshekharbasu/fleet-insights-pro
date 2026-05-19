import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { COMMAND_INDEX, type CommandItem as Item } from "@/lib/command-index";

const GROUP_ORDER = ["Pages", "Routes", "Drivers", "Segments"] as const;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  const run = useCallback(
    (item: Item) => {
      onOpenChange(false);
      navigate({ to: item.href });
    },
    [navigate, onOpenChange],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, routes, drivers, segments…" />
      <CommandList className="max-h-[min(420px,50vh)]">
        <CommandEmpty>No results found.</CommandEmpty>
        {GROUP_ORDER.map((group, gi) => {
          const items = COMMAND_INDEX.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              {gi > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.label} ${item.keywords}`}
                      onSelect={() => run(item)}
                      className="cursor-pointer rounded-lg"
                    >
                      <Icon className="text-muted-foreground" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.meta && (
                        <span className="max-w-[140px] truncate text-xs text-muted-foreground">
                          {item.meta}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}

/** Global ⌘K / Ctrl+K listener — mount once inside ThemeProvider. */
export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("voltline:open-command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("voltline:open-command", onOpen);
    };
  }, []);

  return (
    <>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
