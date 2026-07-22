import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/LandingPage";
import { setCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · Fleet Insights Pro" },
      { name: "description", content: "Enterprise EV fleet intelligence — battery, operations, charging, maintenance and DMS events in one command center. Sign in with Microsoft." },
    ],
  }),
  component: LoginPage,
});

/**
 * UI-only sign-in. There is no real authentication here — the ESG module (the
 * focus of this build) runs entirely on stub data, so "Sign in with Microsoft"
 * just sets a local demo identity and enters the app. No backend / OAuth call.
 */
function LoginPage() {
  const navigate = useNavigate();

  const handleSignIn = () => {
    setCurrentUser({ email: "esg.demo@transvolt.in", provider: "microsoft", name: "ESG Demo User" });
    // Small delay so the button's "Signing you in…" state reads as a real sign-in.
    window.setTimeout(() => void navigate({ to: "/esg" }), 700);
  };

  return <LandingPage onSignIn={handleSignIn} />;
}
