import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bolt,
  ChevronDown,
  Command,
  Download,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { canAccessDataSync, clearCurrentUser, getCurrentUser, type AuthUser } from "@/lib/auth";

type NavLink = { to: string; label: string };

const NAV_OPERATIONS: NavLink[] = [
  { to: "/", label: "Trip Efficiency" },
  { to: "/routes", label: "Route Intelligence" },
  { to: "/segments", label: "Segment Risk" },
  { to: "/drivers", label: "Driver Intelligence" },
];

const NAV_FLEET: NavLink[] = [{ to: "/fleet", label: "Fleet Command" }];

const NAV_CHARGING: NavLink[] = [
  { to: "/charging", label: "Command Center" },
  { to: "/intelligence", label: "Charging Intelligence" },
];

const NAV_OTHER: NavLink[] = [
  { to: "/launcher", label: "App Launcher" },
  { to: "/mis", label: "Daily reports" },
  { to: "/readiness", label: "Site Readiness" },
  { to: "/data-sync", label: "Data Sync" },
];

function isActive(path: string, to: string) {
  if (to === "/") return path === "/";
  return path === to || path.startsWith(`${to}/`);
}

function isGroupActive(path: string, items: NavLink[]) {
  return items.some((n) => isActive(path, n.to));
}

function NavDropdown({
  label,
  items,
  path,
}: {
  label: string;
  items: NavLink[];
  path: string;
}) {
  const active = isGroupActive(path, items);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors",
            active
              ? "nav-pill-active"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        {items.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to} className="w-full cursor-pointer">
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavGroup({ title, items, path }: { title: string; items: NavLink[]; path: string }) {
  return (
    <div className="pt-2">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {items.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          className={cn(
            "block rounded-lg px-3 py-2.5 text-[13px] font-medium",
            isActive(path, n.to) ? "nav-pill-active" : "text-muted-foreground",
          )}
        >
          {n.label}
        </Link>
      ))}
    </div>
  );
}

export function AppNav() {
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  // Start permissive so SSR and first client render match, then refine on mount.
  const [canDataSync, setCanDataSync] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  useEffect(() => {
    const current = getCurrentUser();
    setUser(current);
    setCanDataSync(canAccessDataSync(current));
  }, [path]);

  const navOther = canDataSync ? NAV_OTHER : NAV_OTHER.filter((n) => n.to !== "/data-sync");

  const handleSignOut = () => {
    clearCurrentUser();
    setUser(null);
    void navigate({ to: "/login" });
  };

  const openCommand = () => window.dispatchEvent(new CustomEvent("voltline:open-command"));

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 glass">
      <div className="mx-auto flex h-[4.25rem] max-w-[1600px] items-center gap-2 px-4 lg:px-6">
        <Link to="/" className="group flex shrink-0 items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25 transition-transform group-hover:scale-[1.02]">
            <Bolt className="relative h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-[14px] font-semibold tracking-tight">Voltline</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              EV Fleet Intelligence
            </div>
          </div>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-[12px] font-medium",
                  isGroupActive(path, NAV_OPERATIONS)
                    ? "nav-pill-active"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                Operations
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
                Trip & route analytics
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {NAV_OPERATIONS.map((n) => (
                <DropdownMenuItem key={n.to} asChild>
                  <Link to={n.to}>{n.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {NAV_FLEET.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-2 text-[12px] font-medium",
                isActive(path, n.to)
                  ? "nav-pill-active"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}

          <NavDropdown label="Charging" items={NAV_CHARGING} path={path} />

          {navOther.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-2 text-[12px] font-medium",
                isActive(path, n.to)
                  ? "nav-pill-active"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={openCommand}
            className="hidden items-center gap-2 rounded-xl border border-border/60 bg-card/50 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-card/80 hover:text-foreground md:flex"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[140px] truncate">Search…</span>
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
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={toggle} aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-9 items-center gap-2 rounded-xl border border-border/60 bg-card/50 pl-1 pr-2 text-[12px] font-medium transition-colors hover:border-primary/30 hover:bg-card/80"
                  aria-label="Account menu"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12 text-[11px] font-semibold uppercase text-primary ring-1 ring-primary/25">
                    {user.email.slice(0, 2)}
                  </span>
                  <span className="hidden max-w-[160px] truncate text-foreground md:inline">{user.email}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                    Signed in as
                  </span>
                  <span className="truncate text-[13px] font-medium">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded-xl border border-border/60 bg-card/50 px-3 text-[12px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-card/80"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border/50 px-4 py-3 lg:hidden">
          <MobileNavGroup title="Operations" items={NAV_OPERATIONS} path={path} />
          <MobileNavGroup title="Fleet" items={NAV_FLEET} path={path} />
          <MobileNavGroup title="Charging" items={NAV_CHARGING} path={path} />
          <MobileNavGroup title="More" items={navOther} path={path} />
          <button
            type="button"
            onClick={openCommand}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] text-muted-foreground"
          >
            <Search className="h-4 w-4" /> Search…
          </button>
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
