import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/LandingPage";
import { useState } from "react";
import { buildMicrosoftLoginUrl, fetchCurrentUserFromApi, setAuthToken, setCurrentUser } from "@/lib/auth";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · Fleet Insights Pro" },
      { name: "description", content: "Enterprise EV fleet intelligence — battery, operations, charging, maintenance and DMS events in one command center. Sign in with Microsoft." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [bypassPending, setBypassPending] = useState(false);

  const handleMicrosoftLogin = () => {
    window.location.href = buildMicrosoftLoginUrl("/auth/callback");
  };

  const handleDevBypass = async () => {
    setBypassPending(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", "admin");
      formData.append("password", "admin123");

      const { AUTH_API_BASE } = await import("@/lib/auth");

      const res = await fetch(`${AUTH_API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!res.ok) {
        throw new Error("Local backend login failed. Make sure your local backend is running on port 8000 and has been seeded.");
      }

      const data = await res.json();
      const body = data.data || data;
      const token = body.access_token;
      if (!token) throw new Error("No token returned");

      setAuthToken(token);
      const user = await fetchCurrentUserFromApi();
      if (user) {
        setCurrentUser(user);
      }
      void navigate({ to: "/" });
    } catch (err: any) {
      alert(err.message || "Failed to bypass");
    } finally {
      setBypassPending(false);
    }
  };

  return (
    <>
      <LandingPage onSignIn={handleMicrosoftLogin} />
      
      {typeof window !== "undefined" && window.location.hostname === "localhost" && (
        <div style={{ position: "fixed", bottom: "24px", left: "24px", zIndex: 100 }}>
          <button
            onClick={handleDevBypass}
            disabled={bypassPending}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px", 
              padding: "10px 16px", 
              borderRadius: "12px", 
              backgroundColor: "var(--card)", 
              color: "var(--foreground)", 
              border: "1px dashed var(--border)", 
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)", 
              cursor: "pointer", 
              fontSize: "13px", 
              fontWeight: 500,
              transition: "opacity 0.2s ease" 
            }}
          >
            {bypassPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" style={{ color: "#5B8CFF" }} />
            )}
            {bypassPending ? "Logging in..." : "Dev Bypass"}
          </button>
        </div>
      )}
    </>
  );
}
