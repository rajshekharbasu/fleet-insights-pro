import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import appCss from "../styles.css?url";
import landingCss from "../styles/landing.css?url";
import { ThemeProvider } from "@/hooks/use-theme";
import { CommandPaletteProvider } from "@/components/layout/CommandPalette";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Voltline · EV Fleet Intelligence" },
      { name: "description", content: "Premium analytics for EV fleet trip efficiency, energy, and driver performance." },
      { name: "author", content: "Transvolt" },
      { property: "og:title", content: "Voltline · EV Fleet Intelligence" },
      { property: "og:description", content: "Premium analytics for EV fleet trip efficiency, energy, and driver performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Voltline · EV Fleet Intelligence" },
      { name: "twitter:description", content: "Premium analytics for EV fleet trip efficiency, energy, and driver performance." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7d0c9f8d-5b2f-429a-9249-29c51e2aee18/id-preview-20cdad81--de38856a-288c-4196-b466-925186e0ce3f.lovable.app-1779195329655.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7d0c9f8d-5b2f-429a-9249-29c51e2aee18/id-preview-20cdad81--de38856a-288c-4196-b466-925186e0ce3f.lovable.app-1779195329655.png" },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.png",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: landingCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const themeBootScript = `(function(){try{var t=localStorage.getItem("voltline-theme");if(t==="light")document.documentElement.classList.remove("dark");else document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}})();`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Routes reachable without an authenticated session. Everything else is gated
 * behind <AuthGate /> and redirects to /login.
 */
const PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);

function AuthGateLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Client-side session guard. Auth state lives in localStorage (see lib/auth),
 * which is unavailable during SSR, so protected routes render a loader until the
 * browser confirms a signed-in user. Unauthenticated visitors are sent to
 * /login; public routes always render.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isPublic = PUBLIC_PATHS.has(pathname);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isPublic) {
      setAllowed(true);
      return;
    }
    if (!getCurrentUser()) {
      setAllowed(false);
      void navigate({ to: "/login" });
      return;
    }
    setAllowed(true);
  }, [pathname, isPublic, navigate]);

  if (isPublic) return <>{children}</>;
  if (!allowed) return <AuthGateLoader />;
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CommandPaletteProvider>
          <AuthGate>
            <Outlet />
          </AuthGate>
          <Toaster position="bottom-right" richColors />
        </CommandPaletteProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
