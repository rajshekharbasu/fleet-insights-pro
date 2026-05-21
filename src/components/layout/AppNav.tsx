import { Link, useRouterState } from "@tanstack/react-router";
import { Bolt, Command, Download, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

const NAV = [
  { to: "/", label: "Trip Efficiency" },
  { to: "/routes", label: "Route Intelligence" },
  { to: "/segments", label: "Segment Risk" },
  { to: "/drivers", label: "Driver Intelligence" },
  { to: "/fleet", label: "Fleet Command" },
  { to: "/charging", label: "Charger Command" },
  { to: "/intelligence", label: "Charging Intelligence" },
] as const;

export function AppNav() {
  const { dark, toggle } = useTheme();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  const openCommand = () => window.dispatchEvent(new CustomEvent("voltline:open-command"));

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 glass">
      <div className="mx-auto flex h-[4.25rem] max-w-[1600px] items-center gap-4 px-6">
        <Link to="/" className="group flex shrink-0 items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25 transition-transform group-hover:scale-[1.02]">
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--primary) 80%, transparent), transparent 70%)",
              }}
              aria-hidden
            />
            <Bolt className="relative h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tight">Voltline</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
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
                className={`rounded-lg px-3 py-2 text-[12.5px] font-medium transition-all duration-200 ${
                  active
                    ? "nav-pill-active"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={openCommand}
            className="hidden items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-card/80 hover:text-foreground md:flex"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[200px] truncate">Search routes, drivers…</span>
            <kbd className="ml-1 inline-flex items-center gap-0.5 rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
          <Button
            variant="outline"
            size="sm"
            className="hidden h-9 gap-1.5 rounded-xl border-border/60 bg-card/50 text-[12px] sm:inline-flex"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border/50 px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-0.5">
            {NAV.map((n) => {
              const active = path === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`rounded-lg px-3 py-2.5 text-[13px] font-medium ${
                    active ? "nav-pill-active" : "text-muted-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={openCommand}
              className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] text-muted-foreground"
            >
              <Search className="h-4 w-4" /> Search…
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

export function PageShell({
  eyebrow,
  title,
  titleAccent,
  description,
  meta,
  bare,
  children,
}: {
  eyebrow?: string;
  title?: string;
  titleAccent?: string;
  description?: string;
  meta?: React.ReactNode;
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="noise-bg min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-[0.22]" aria-hidden />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[480px] hero-glow opacity-80" aria-hidden />

      <div className="relative z-[1]">
        <AppNav />
        <main className="mx-auto max-w-[1600px] space-y-8 px-6 py-8">
          {!bare && (
          <section className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              {eyebrow && (
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[11px] font-medium text-primary">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-50" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  {eyebrow}
                </div>
              )}
              <h1 className="mt-4 text-balance text-[30px] font-semibold leading-[1.15] tracking-tight md:text-[36px]">
                {titleAccent ? (
                  <>
                    {title}{" "}
                    <span className="text-gradient-brand">{titleAccent}</span>
                  </>
                ) : (
                  title
                )}
              </h1>
              {description && (
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{description}</p>
              )}
            </div>
            {meta}
          </section>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
