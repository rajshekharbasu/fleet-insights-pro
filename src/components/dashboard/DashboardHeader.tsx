import { Bolt, Command, Download, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function DashboardHeader() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20">
            <Bolt className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">Voltline</div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">EV Fleet Intelligence</div>
          </div>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {["Overview", "Trends", "Explore", "Rankings", "Anomalies"].map((label, i) => (
            <a
              key={label}
              href={`#${label.toLowerCase()}`}
              className={`rounded-md px-3 py-1.5 text-[13px] transition-colors hover:bg-muted/60 ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-muted/60 md:flex">
            <Search className="h-3.5 w-3.5" />
            <span>Search drivers, vehicles, routes…</span>
            <kbd className="ml-3 inline-flex items-center gap-1 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 border-border/70 text-[12.5px]">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDark((v) => !v)}
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
