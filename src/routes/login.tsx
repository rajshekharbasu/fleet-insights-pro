import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Lock, Moon, ShieldCheck, Sparkles, Sun, Zap } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { buildMicrosoftLoginUrl } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · Voltline" },
      {
        name: "description",
        content: "Sign in to Voltline — the single sign-in surface for the Transvolt ecosystem.",
      },
    ],
  }),
  component: LoginPage,
});

const VOLT = "#5B8CFF"; // Voltline chrome accent

const ECOSYSTEM = [
  { name: "TIMS", accent: "#F59E0B" },
  { name: "EVopt Charging", accent: "#10B981" },
  { name: "Pulse Analytics", accent: "#8B5CF6" },
  { name: "GridLink", accent: "#0EA5E9" },
];

function LoginPage() {
  const { dark, toggle } = useTheme();

  const [msPending, setMsPending] = useState(false);

  // Kicks off the ea-platform Microsoft (Entra ID) OAuth flow. The backend
  // redirects back to /auth/callback with the tokens in the URL hash; the
  // callback route then resolves the identity and lands the user on Trip
  // Efficiency.
  const handleMicrosoftLogin = () => {
    setMsPending(true);
    window.location.href = buildMicrosoftLoginUrl("/auth/callback");
  };

  return (
    <div className="vl-root relative min-h-screen overflow-hidden text-foreground">
      <StyleInjector />
      <div className="pointer-events-none fixed inset-0 -z-10 vl-backdrop" />

      {/* theme toggle */}
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/70 text-muted-foreground backdrop-blur transition hover:text-foreground"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="mx-auto grid min-h-screen w-full max-w-[1280px] lg:grid-cols-2">
        {/* ---------------- Brand panel ---------------- */}
        <section className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
          <span className="vl-brand-sheen pointer-events-none absolute inset-0 -z-10" />
          <div className="flex flex-col gap-7">
            <TransvoltLogo className="h-8 w-auto self-start" />
            <Wordmark />
          </div>

          <div className="vl-rise max-w-md">
            <p className="vl-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              Enterprise Architecture
            </p>
            <h1 className="vl-head mt-3 text-balance text-[40px] font-semibold leading-[1.08] tracking-tight text-foreground">
              One architecture for{" "}
              <span style={{ color: VOLT }}>every product</span> you run.
            </h1>
            <p className="vl-ui mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Voltline is the control plane for the Transvolt platform — a single layer for
              identity, access governance, and service integration that unifies every
              operational surface into one secure, horizontally scalable enterprise
              architecture.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {ECOSYSTEM.map((p) => (
                <span
                  key={p.name}
                  className="vl-ui inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[12px] font-medium text-foreground/80 backdrop-blur"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: p.accent }} />
                  {p.name}
                </span>
              ))}
            </div>
          </div>

          <div className="vl-ui flex items-center gap-2 text-[12px] text-muted-foreground">
            <ShieldCheck className="h-4 w-4" style={{ color: VOLT }} />
            Enterprise-grade SSO · SOC 2 aligned · encrypted in transit
          </div>
        </section>

        {/* ---------------- Auth panel ---------------- */}
        <section className="flex items-center justify-center px-5 py-12 sm:px-10">
          <div className="vl-rise w-full max-w-[420px]">
            {/* mobile brand lockup */}
            <div className="mb-8 flex flex-col items-center gap-5 lg:hidden">
              <TransvoltLogo className="h-8 w-auto" />
              <Wordmark />
            </div>

            <div className="rounded-3xl border border-border bg-card/80 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
              <div className="mb-6 hidden justify-center lg:flex">
                <TransvoltLogo className="h-7 w-auto" />
              </div>
              <h2 className="vl-head text-2xl font-semibold tracking-tight text-foreground">
                Sign in to Voltline
              </h2>
              <p className="vl-ui mt-1.5 text-sm text-muted-foreground">
                Use your Transvolt organisation account to continue.
              </p>

              {/* Microsoft SSO — the only sign-in method */}
              <button
                onClick={handleMicrosoftLogin}
                disabled={msPending}
                className="vl-ui group mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-background text-[14px] font-medium text-foreground transition hover:bg-muted disabled:opacity-70"
              >
                {msPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MicrosoftLogo className="h-[18px] w-[18px]" />
                )}
                {msPending ? "Redirecting to Microsoft…" : "Continue with Microsoft"}
              </button>

              <p className="vl-ui mt-5 flex items-center justify-center gap-1.5 text-center text-[12px] text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Single sign-on secured by Microsoft Entra ID.
              </p>
            </div>

            <p className="vl-ui mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              By signing in you agree to Voltline&apos;s Terms & Privacy Policy.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

function TransvoltLogo({ className }: { className?: string }) {
  const { dark } = useTheme();
  // SVGs live in /public; white mark for dark canvas, black for light.
  const src = dark
    ? "/Transvolt%20Logo%20-%20White.svg"
    : "/Transvolt_logo_black.svg";
  return <img src={src} alt="Transvolt" className={className} draggable={false} />;
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <span
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border"
        style={{ background: `linear-gradient(160deg, ${VOLT}26, transparent)` }}
      >
        <Zap className="h-5 w-5" style={{ color: VOLT }} fill={VOLT} />
      </span>
      <div className="leading-none">
        <span className="vl-head text-[19px] font-semibold tracking-tight text-foreground">Voltline</span>
        <span className="vl-mono ml-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">OS</span>
      </div>
    </div>
  );
}

function MicrosoftLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} aria-hidden xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Styles (fonts, backdrop, motion) — theme aware
 * ------------------------------------------------------------------ */

function StyleInjector() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');

      .vl-root { background-color: var(--color-background); font-family: 'Inter', system-ui, sans-serif; }
      .vl-head { font-family: 'Space Grotesk', system-ui, sans-serif; }
      .vl-ui { font-family: 'Inter', system-ui, sans-serif; }
      .vl-mono { font-family: 'Space Mono', ui-monospace, monospace; }

      .vl-backdrop {
        background:
          radial-gradient(820px 520px at 8% -10%, color-mix(in oklab, var(--color-primary) 14%, transparent), transparent 60%),
          radial-gradient(720px 520px at 100% 110%, color-mix(in oklab, ${VOLT} 16%, transparent), transparent 55%),
          var(--color-background);
      }

      .vl-brand-sheen {
        background: radial-gradient(600px 600px at 30% 20%, color-mix(in oklab, ${VOLT} 10%, transparent), transparent 60%);
        animation: vlGlow 9s ease-in-out infinite alternate;
      }
      @keyframes vlGlow {
        from { opacity: 0.55; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(8px); }
      }

      .vl-rise { opacity: 0; animation: vlRise 0.55s cubic-bezier(0.22,0.61,0.36,1) forwards; }
      @keyframes vlRise {
        from { opacity: 0; transform: translateY(16px) scale(0.99); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @media (prefers-reduced-motion: reduce) {
        .vl-root *, .vl-root *::before, .vl-root *::after { animation: none !important; transition: none !important; }
        .vl-rise { opacity: 1 !important; transform: none !important; }
      }
    `}</style>
  );
}
