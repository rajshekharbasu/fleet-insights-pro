import { Link, useRouterState } from "@tanstack/react-router";
import { Bolt, Command, Download, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Trip Efficiency" },
  { to: "/routes", label: "Route Intelligence" },
  { to: "/segments", label: "Segment Risk" },
  { to: "/drivers", label: "Driver Intelligence" },
  { to: "/fleet", label: "Fleet Command" },
] as const;

export function AppNav() {
  const [dark, setDark] = useState(true);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20">
            <Bolt className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">Voltline</div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              EV Fleet Intelligence
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => {
            const active = path === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                  active
                    ? "bg-muted/60 text-foreground"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button className="hidden items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-muted/60 md:flex">
            <Search className="h-3.5 w-3.5" />
            <span>Search routes, drivers, segments…</span>
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

export function PageShell({
  eyebrow,
  title,
  description,
  meta,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-[0.18]" aria-hidden />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent 60%)",
        }}
        aria-hidden
      />
      <div className="relative">
        <AppNav />
        <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div>
              {eyebrow && (
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  {eyebrow}
                </div>
              )}
              <h1 className="mt-3 text-balance text-[28px] font-semibold tracking-tight md:text-[32px]">
                {title}
              </h1>
              {description && (
                <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">{description}</p>
              )}
            </div>
            {meta}
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
