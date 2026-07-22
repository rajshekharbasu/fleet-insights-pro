import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, Zap } from "lucide-react";
import { getCurrentUser, setCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "Signing in · Voltline" }],
  }),
  component: AuthCallbackPage,
});

const VOLT = "#5B8CFF";

/**
 * Legacy OAuth landing route. Auth is now UI-only (no backend), so this simply
 * ensures a local demo identity exists and forwards into the app — kept only so
 * any stale `/auth/callback` link still resolves cleanly.
 */
function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!getCurrentUser()) {
      setCurrentUser({ email: "esg.demo@transvolt.in", provider: "microsoft", name: "ESG Demo User" });
    }
    void navigate({ to: "/esg" });
  }, [navigate]);

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center text-foreground"
      style={{ background: "var(--color-background)" }}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border"
        style={{ background: `linear-gradient(160deg, ${VOLT}26, transparent)` }}
      >
        <Zap className="h-6 w-6" style={{ color: VOLT }} fill={VOLT} />
      </span>
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: VOLT }} />
        Entering…
      </div>
    </div>
  );
}
