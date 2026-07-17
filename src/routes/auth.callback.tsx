import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Zap } from "lucide-react";
import {
  fetchCurrentUserFromApi,
  setAuthToken,
  setCurrentUser,
} from "@/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "Signing in · Voltline" }],
  }),
  component: AuthCallbackPage,
});

const VOLT = "#5B8CFF";

/**
 * Microsoft SSO landing page.
 *
 * The ea-platform backend completes the OAuth handshake and redirects here with
 * the tokens in the URL hash fragment (`#access_token=…&refresh_token=…`). We
 * persist the token, resolve the signed-in identity via `auth/me`, then land the
 * user on Trip Efficiency (`/`). Any failure routes back to /login.
 */
function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");

      if (!accessToken) {
        if (!cancelled) setError("Microsoft sign-in didn't return a session. Please try again.");
        return;
      }

      setAuthToken(accessToken);

      // Resolve the user's email/name so route guards (e.g. Data Sync) work.
      const user = await fetchCurrentUserFromApi();
      if (cancelled) return;

      if (user) {
        setCurrentUser(user);
      }

      // Clear the tokens out of the URL before landing the user.
      window.history.replaceState(null, "", window.location.pathname);
      void navigate({ to: "/" });
    }

    void finish();
    return () => {
      cancelled = true;
    };
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

      {error ? (
        <>
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {error}
          </div>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition active:scale-[0.99]"
            style={{ background: `linear-gradient(180deg, ${VOLT}, #3f6fe0)` }}
          >
            Back to sign in
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: VOLT }} />
          Completing Microsoft sign-in…
        </div>
      )}
    </div>
  );
}
