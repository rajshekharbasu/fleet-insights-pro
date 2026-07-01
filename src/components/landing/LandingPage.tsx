/**
 * Landing / Login page — Fleet Insights Pro
 * ------------------------------------------------------------------
 * World-class enterprise landing page with Microsoft (Entra ID) SSO.
 * Showcases the five integrated modules — Battery, Operations, Charger,
 * Maintenance, DMS Events — converging into one analytics core.
 *
 * Visuals use the app's existing design tokens (styles.css). Animation
 * keyframes + stateful helper classes live in `@/styles/landing.css`
 * (import it once — see README).
 *
 * Self-contained: manages its own light/dark via the `.dark` class on
 * <html>, so it works as a standalone route shown before authentication.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

type Props = {
  brandName?: string;
  defaultTheme?: "dark" | "light";
  showTelemetry?: boolean;
  /** Wire this to your MSAL / Entra ID loginRedirect(). */
  onSignIn?: () => void;
};

/* tiny inline-icon helper keeps the diagram pixel-faithful */
function Ic({ d, size = 22 }: { d: string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {d.map((p, i) => (<path key={i} d={p} />))}
    </svg>
  );
}

const NODES = [
  { label: "Battery", color: "var(--chart-4)", left: "50%", top: "13%", delay: ".30s", d: ["M2 7h16M2 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M2 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M22 10v4"] },
  { label: "Operations", color: "var(--primary)", left: "85.19%", top: "38.57%", delay: ".40s", d: ["M3 12h4l3 8 4-16 3 8h4"] },
  { label: "Charger", color: "var(--chart-3)", left: "71.75%", top: "79.93%", delay: ".50s", d: ["M13 2 4 14h7l-1 8 9-12h-7l1-8z"] },
  { label: "DMS Events", color: "var(--chart-5)", left: "28.25%", top: "79.93%", delay: ".60s", d: ["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z", "M12 9.5v3"] },
  { label: "Maintenance", color: "var(--chart-2)", left: "14.81%", top: "38.57%", delay: ".70s", d: ["M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.2-.3-.3-2.2 2.5-2.5z"] },
];

const CONNECTORS = [
  { x2: 50, y2: 13, color: "var(--chart-4)", delay: "0s" },
  { x2: 85.19, y2: 38.57, color: "var(--primary)", delay: ".26s" },
  { x2: 71.75, y2: 79.93, color: "var(--chart-3)", delay: ".52s" },
  { x2: 28.25, y2: 79.93, color: "var(--chart-5)", delay: ".78s" },
  { x2: 14.81, y2: 38.57, color: "var(--chart-2)", delay: "1.04s" },
];

const TELEMETRY = [
  { color: "var(--chart-4)", tag: "MBMT", text: "MH04LQ5737 charge cycle complete" },
  { color: "var(--chart-3)", tag: "Charger", text: "Bay 12 back online · 142 kW" },
  { color: "var(--chart-5)", tag: "DMS", text: "Harsh-braking event flagged" },
  { color: "var(--primary)", tag: "UMT", text: "Route 9 round-trip eff. 90.7%" },
  { color: "var(--chart-2)", tag: "Maint.", text: "WO-2231 closed · pack inspection" },
  { color: "var(--chart-4)", tag: "NTSPL", text: "208 buses healthy · 0 attention" },
  { color: "var(--chart-3)", tag: "Energy", text: "Depot throughput 6,731 kWh" },
  { color: "var(--primary)", tag: "Ops", text: "Fleet refresh synced · 60s" },
];

const MsLogo = () => (
  <svg width="21" height="21" viewBox="0 0 21 21" aria-hidden style={{ flex: "none" }}>
    <rect x="0" y="0" width="9.5" height="9.5" fill="#F25022" />
    <rect x="11.5" y="0" width="9.5" height="9.5" fill="#7FBA00" />
    <rect x="0" y="11.5" width="9.5" height="9.5" fill="#00A4EF" />
    <rect x="11.5" y="11.5" width="9.5" height="9.5" fill="#FFB900" />
  </svg>
);

export function LandingPage({ brandName = "Voltline", defaultTheme = "dark", showTelemetry = true, onSignIn }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(defaultTheme !== "light");
  const [signingIn, setSigningIn] = useState(false);
  const year = new Date().getFullYear();

  // theme → toggle global .dark class
  useEffect(() => {
    const root = document.documentElement;
    const had = root.classList.contains("dark");
    root.classList.toggle("dark", isDark);
    return () => { root.classList.toggle("dark", had); };
  }, [isDark]);

  // scroll-reveal + count-up
  useEffect(() => {
    const scope = rootRef.current;
    if (!scope) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const reveals = Array.from(scope.querySelectorAll<HTMLElement>(".lp-reveal"));
    let io: IntersectionObserver | undefined;
    if (reduce || !("IntersectionObserver" in window)) {
      reveals.forEach((e) => e.classList.add("in"));
    } else {
      io = new IntersectionObserver(
        (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io!.unobserve(en.target); } }),
        { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
      );
      reveals.forEach((e) => io!.observe(e));
    }

    scope.querySelectorAll<HTMLElement>("[data-count]").forEach((node) => {
      const target = parseFloat(node.dataset.count || "0");
      const dec = parseInt(node.dataset.dec || "0", 10);
      const fmt = (v: number) => (dec > 0 ? v.toFixed(dec) : Math.round(v).toLocaleString());
      if (reduce) { node.textContent = fmt(target); return; }
      const dur = 1500, t0 = performance.now();
      const ease = (x: number) => 1 - Math.pow(1 - x, 3);
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        node.textContent = fmt(target * ease(p));
        if (p < 1) requestAnimationFrame(tick);
        else node.textContent = fmt(target);
      };
      requestAnimationFrame(tick);
    });

    return () => io?.disconnect();
  }, []);

  const handleSignIn = () => {
    if (signingIn) return;
    setSigningIn(true);
    onSignIn?.();
    window.setTimeout(() => setSigningIn(false), 2200);
  };
  const msLabel = signingIn ? "Signing you in…" : "Sign in with Microsoft";

  const bolt = ["M13 2 4 14h7l-1 8 9-12h-7l1-8z"];

  const MsButton = ({ big }: { big?: boolean }) => (
    <button
      type="button"
      onClick={handleSignIn}
      className="ms-btn"
      style={{ display: "inline-flex", alignItems: "center", gap: 12, height: 54, padding: big ? "0 28px 0 22px" : "0 26px 0 22px", borderRadius: 13, border: "none", cursor: "pointer", background: "#ffffff", color: "#1b1b1b", font: "inherit", fontSize: 15.5, fontWeight: 600, boxShadow: "0 12px 34px -12px rgba(0,0,0,.45), 0 0 0 1px rgba(0,0,0,.06)" }}
    >
      <MsLogo />
      {signingIn && (<span style={{ display: "inline-flex", height: 18, width: 18, borderRadius: "50%", border: "2.4px solid rgba(0,0,0,.18)", borderTopColor: "#1b1b1b", animation: "lpSpinner .7s linear infinite" }} />)}
      <span>{msLabel}</span>
    </button>
  );

  return (
    <div ref={rootRef} className="lp-root" style={{ position: "relative", minHeight: "100vh", overflowX: "hidden", fontFamily: "var(--font-display)", color: "var(--foreground)", background: "var(--background)" }}>
      {/* ambient bg */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 55% at 50% -8%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 62%), radial-gradient(ellipse 46% 36% at 88% 4%, color-mix(in oklab, var(--chart-2) 12%, transparent), transparent 55%), radial-gradient(ellipse 50% 40% at 8% 100%, color-mix(in oklab, var(--chart-4) 9%, transparent), transparent 60%)" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.5, backgroundImage: "linear-gradient(to right, color-mix(in oklab, var(--border) 38%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 38%, transparent) 1px, transparent 1px)", backgroundSize: "48px 48px", WebkitMaskImage: "radial-gradient(ellipse 92% 72% at 50% 0%, black 12%, transparent 78%)", maskImage: "radial-gradient(ellipse 92% 72% at 50% 0%, black 12%, transparent 78%)", animation: "lpGridDrift 9s linear infinite" }} />

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* NAV */}
        <header style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid color-mix(in oklab, var(--border) 80%, transparent)", background: "color-mix(in oklab, var(--card) 70%, transparent)", backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)" }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", gap: 20, height: 64, padding: "0 26px" }}>
            <a href="#top" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", height: 34, width: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, background: "color-mix(in oklab, var(--primary) 16%, transparent)", color: "var(--primary)", boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--primary) 26%, transparent)" }}>
                <Ic d={bolt} size={17} />
              </div>
              <div style={{ lineHeight: 1.1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>{brandName}</div>
                <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.18em", color: "var(--muted-foreground)" }}>Fleet Insights Pro</div>
              </div>
            </a>
            <nav className="lp-nav-links" style={{ display: "flex", alignItems: "center", gap: 26, marginLeft: 18 }}>
              {["Modules", "Platform", "Security"].map((l) => (
                <a key={l} href={`#${l.toLowerCase()}`} className="lp-navlink" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--muted-foreground)", textDecoration: "none" }}>{l}</a>
              ))}
            </nav>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" onClick={() => setIsDark((v) => !v)} aria-label="Toggle theme" className="lp-iconbtn" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 38, width: 38, borderRadius: 10, border: "1px solid var(--border)", background: "color-mix(in oklab, var(--card) 60%, transparent)", color: "var(--foreground)", cursor: "pointer" }}>
                {isDark
                  ? (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>)
                  : (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>)}
              </button>
              <a href="#signin" className="lp-ghost" style={{ display: "inline-flex", alignItems: "center", height: 38, padding: "0 18px", borderRadius: 10, border: "1px solid var(--border)", background: "color-mix(in oklab, var(--card) 60%, transparent)", color: "var(--foreground)", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>Sign in</a>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section id="top" style={{ maxWidth: 1240, margin: "0 auto", padding: "64px 26px 40px" }}>
          <div className="lp-hero" style={{ display: "grid", gridTemplateColumns: "1.04fr 0.96fr", gap: 48, alignItems: "center" }}>
            <div id="signin">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "7px 14px", borderRadius: 999, border: "1px solid color-mix(in oklab, var(--primary) 30%, var(--border))", background: "color-mix(in oklab, var(--primary) 10%, transparent)", fontSize: 12, fontWeight: 600, color: "var(--primary)", animation: "lpFadeUp .7s cubic-bezier(.2,.7,.2,1) both" }}>
                <span style={{ position: "relative", display: "flex", height: 7, width: 7 }}><span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--success)", animation: "lpBlink 1.6s ease-in-out infinite" }} /></span>
                Enterprise EV fleet intelligence
              </div>
              <h1 style={{ margin: "20px 0 0", fontSize: "clamp(36px,5.2vw,62px)", lineHeight: 1.02, fontWeight: 700, letterSpacing: "-0.03em", animation: "lpFadeUp .7s cubic-bezier(.2,.7,.2,1) both", animationDelay: ".08s" }}>
                Every system in your fleet,{" "}
                <span style={{ background: "linear-gradient(120deg, var(--foreground) 0%, color-mix(in oklab, var(--primary) 78%, var(--foreground)) 55%, var(--primary) 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>speaking as one.</span>
              </h1>
              <p style={{ margin: "22px 0 0", maxWidth: 520, fontSize: 16.5, lineHeight: 1.62, color: "var(--muted-foreground)", animation: "lpFadeUp .7s cubic-bezier(.2,.7,.2,1) both", animationDelay: ".18s" }}>
                Battery, operations, charging, maintenance and driver-safety events — five modules, one integrated command center. Sign in with your organization account to pick up exactly where the fleet left off.
              </p>
              <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 13, animation: "lpFadeUp .7s cubic-bezier(.2,.7,.2,1) both", animationDelay: ".28s" }}>
                <MsButton />
                <a href="#modules" className="lp-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 9, height: 54, padding: "0 22px", borderRadius: 13, border: "1px solid var(--border)", background: "color-mix(in oklab, var(--card) 55%, transparent)", color: "var(--foreground)", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
                  Explore the platform
                  <Ic d={["M5 12h13M13 6l6 6-6 6"]} size={17} />
                </a>
              </div>
              <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--muted-foreground)", animation: "lpFadeUp .7s cubic-bezier(.2,.7,.2,1) both", animationDelay: ".36s" }}>
                <span style={{ color: "var(--success)", display: "inline-flex" }}><Ic d={["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z", "M9 12l2 2 4-4"]} size={14} /></span>
                Secured by Microsoft Entra ID · SSO / SAML · SOC&nbsp;2 Type&nbsp;II
              </div>
              <div style={{ marginTop: 34, display: "flex", gap: 30, flexWrap: "wrap", animation: "lpFadeUp .7s cubic-bezier(.2,.7,.2,1) both", animationDelay: ".46s" }}>
                {[{ c: "5", dec: "0", l: "Integrated modules" }, { c: "314", dec: "0", l: "Buses monitored" }].map((s) => (
                  <div key={s.l}>
                    <div className="num" style={{ fontSize: 26, fontWeight: 600 }} data-count={s.c} data-dec={s.dec}>0</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
                <div style={{ width: 1, background: "var(--border)" }} />
                <div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 600 }}><span data-count="99.9" data-dec="1">0</span>%</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 2 }}>Platform uptime</div>
                </div>
              </div>
            </div>

            {/* integration core */}
            <div className="lp-diagram-wrap" style={{ display: "flex", justifyContent: "center", animation: "lpFadeScale .9s cubic-bezier(.2,.7,.2,1) both", animationDelay: ".2s" }}>
              <div style={{ position: "relative", width: "clamp(300px,42vw,540px)", aspectRatio: "1" }}>
                <div style={{ position: "absolute", top: "50%", left: "50%", width: "62%", height: "62%", transform: "translate(-50%,-50%)", borderRadius: "50%", background: "conic-gradient(from 0deg, transparent, color-mix(in oklab, var(--primary) 42%, transparent), transparent 38%, color-mix(in oklab, var(--chart-2) 30%, transparent), transparent 70%, color-mix(in oklab, var(--chart-4) 26%, transparent), transparent)", filter: "blur(20px)", opacity: 0.55, animation: "lpSpin 16s linear infinite" }} />
                {[0, 1.5, 3].map((dl, i) => (
                  <div key={i} style={{ position: "absolute", top: "50%", left: "50%", width: "30%", height: "30%", borderRadius: "50%", border: `1px solid color-mix(in oklab, var(--primary) ${36 - i * 4}%, transparent)`, transform: "translate(-50%,-50%)", animation: "lpRing 4.4s ease-out infinite", animationDelay: `${dl}s` }} />
                ))}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
                  <g strokeLinecap="round" fill="none">
                    {CONNECTORS.map((c, i) => (
                      <g key={i}>
                        <line x1="50" y1="50" x2={c.x2} y2={c.y2} stroke={`color-mix(in oklab, ${c.color} 22%, transparent)`} strokeWidth="0.6" />
                        <line x1="50" y1="50" x2={c.x2} y2={c.y2} stroke={c.color} strokeWidth="0.7" strokeDasharray="2 6" style={{ animation: "lpFlow 1.3s linear infinite", animationDelay: c.delay }} />
                      </g>
                    ))}
                  </g>
                </svg>
                <div style={{ position: "absolute", top: "50%", left: "50%", width: "27%", aspectRatio: "1", transform: "translate(-50%,-50%)", borderRadius: "50%", background: "color-mix(in oklab, var(--card) 82%, transparent)", backdropFilter: "blur(10px)", border: "1px solid color-mix(in oklab, var(--primary) 45%, var(--border))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", animation: "lpCore 3.6s ease-in-out infinite", zIndex: 3, color: "var(--primary)" }}>
                  <Ic d={bolt} size={26} />
                  <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--primary)", marginTop: 5 }}>Unified</div>
                  <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Core</div>
                </div>
                {NODES.map((n) => (
                  <div key={n.label} className="lp-node" style={{ position: "absolute", left: n.left, top: n.top, transform: "translate(-50%,-50%)", zIndex: 4, ["--nc" as string]: n.color, animation: "lpPop .6s cubic-bezier(.2,.7,.2,1) both", animationDelay: n.delay }}>
                    <div className="lp-node-ic" style={{ position: "relative", display: "flex", height: "clamp(46px,9vw,60px)", width: "clamp(46px,9vw,60px)", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "color-mix(in oklab, var(--card) 86%, transparent)", backdropFilter: "blur(8px)", border: `1px solid color-mix(in oklab, ${n.color} 40%, var(--border))`, color: n.color, boxShadow: `0 8px 22px -12px color-mix(in oklab, ${n.color} 50%, transparent)` }}>
                      <Ic d={n.d} size={22} />
                    </div>
                    <div className="lp-node-label" style={{ position: "absolute", left: "50%", top: "108%", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 11, fontWeight: 600, color: "var(--foreground)", background: "color-mix(in oklab, var(--card) 90%, transparent)", border: "1px solid var(--border)", padding: "3px 9px", borderRadius: 7 }}>{n.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* TELEMETRY */}
        {showTelemetry && (
          <div className="lp-marquee" style={{ position: "relative", borderBlock: "1px solid color-mix(in oklab, var(--border) 75%, transparent)", background: "color-mix(in oklab, var(--card) 45%, transparent)", overflow: "hidden", marginTop: 18, WebkitMaskImage: "linear-gradient(90deg, transparent, black 7%, black 93%, transparent)", maskImage: "linear-gradient(90deg, transparent, black 7%, black 93%, transparent)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 0" }}>
              <div className="lp-marquee-track" style={{ display: "flex", alignItems: "center", gap: 34, flex: "none", paddingLeft: 34 }}>
                {[...TELEMETRY, ...TELEMETRY].map((t, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--muted-foreground)", whiteSpace: "nowrap", flex: "none" }}>
                    <span style={{ height: 7, width: 7, borderRadius: "50%", background: t.color, boxShadow: `0 0 8px ${t.color}`, flex: "none" }} />
                    <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{t.tag}</span>
                    {t.text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODULES */}
        <section id="modules" style={{ maxWidth: 1240, margin: "0 auto", padding: "88px 26px 20px" }}>
          <div className="lp-reveal" style={{ maxWidth: 680 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 12 }}>The integrated suite</div>
            <h2 style={{ fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.1, fontWeight: 700, letterSpacing: "-0.03em" }}>Five modules. One source of truth.</h2>
            <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--muted-foreground)" }}>Each module runs deep on its own domain — and every signal flows into the same analytics core, so a battery anomaly, a missed charge and a driver event all line up on one timeline.</p>
          </div>

          <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
            <ModuleCard accent="var(--chart-4)" to="/battery-cycles" icon={["M2 7h16M2 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M2 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M22 10v4"]} title="Battery Cycles" body="HV discharge cycles, cell-spread health and equivalent full-cycle load across every pack." metric="EFC · health bands" />
            <ModuleCard accent="var(--primary)" delay=".06s" icon={["M3 12h4l3 8 4-16 3 8h4"]} title="Operations" body="Trips, route intelligence and round-trip efficiency — live across every depot and shift." metric="Routes · efficiency" />
            <ModuleCard accent="var(--chart-3)" delay=".12s" icon={["M13 2 4 14h7l-1 8 9-12h-7l1-8z"]} title="Charger Network" body="Depot charging, energy throughput and charger uptime — with anomaly detection built in." metric="Uptime · energy flow" />
            <ModuleCard accent="var(--chart-2)" delay=".06s" icon={["M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.2-.3-.3-2.2 2.5-2.5z"]} title="Maintenance" body="Work orders, part lifecycle and predictive alerts — triggered by signals from every module." metric="Work orders · parts" />
            <ModuleCard accent="var(--chart-5)" delay=".12s" icon={["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z", "M12 8.5v3.5"]} title="DMS Events" body="Driver-monitoring and safety events, streamed in real time and ranked by severity." metric="Live event feed" />

            <div className="lp-reveal" style={{ borderRadius: 18, border: "1px solid color-mix(in oklab, var(--primary) 30%, var(--border))", background: "linear-gradient(150deg, color-mix(in oklab, var(--primary) 13%, var(--card)), color-mix(in oklab, var(--card) 90%, transparent))", padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 14px 36px -22px var(--glow-primary)", transitionDelay: ".18s" }}>
              <div>
                <div style={{ display: "flex", height: 46, width: 46, alignItems: "center", justifyContent: "center", borderRadius: 13, color: "var(--primary)", background: "color-mix(in oklab, var(--primary) 18%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--primary) 34%, transparent)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>
                </div>
                <h3 style={{ fontSize: 17.5, margin: "18px 0 0", fontWeight: 700 }}>Unified Analytics</h3>
                <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--muted-foreground)" }}>One command center over all five modules — cross-signal alerts, executive readiness and MIS reporting.</p>
              </div>
              <div style={{ marginTop: 18, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--primary)" }}>The core they all feed</div>
            </div>
          </div>
        </section>

        {/* PLATFORM */}
        <section id="platform" style={{ maxWidth: 1240, margin: "0 auto", padding: "72px 26px" }}>
          <div className="lp-reveal" style={{ borderRadius: 24, border: "1px solid var(--border)", background: "color-mix(in oklab, var(--card) 80%, transparent)", backdropFilter: "blur(12px)", padding: "clamp(28px,4vw,52px)", position: "relative", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 26px 60px -34px rgba(0,0,0,.4)" }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 60% 90% at 100% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 60%)" }} />
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 30 }}>
              <div style={{ gridColumn: "1/-1", maxWidth: 620 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 12 }}>Integrated by design</div>
                <h2 style={{ fontSize: "clamp(24px,3vw,34px)", lineHeight: 1.12, fontWeight: 700, letterSpacing: "-0.03em" }}>Architecture that turns five data streams into one decision.</h2>
              </div>
              {[
                { c: "var(--primary)", d: ["M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M19 5l-2.5 2.5M7.5 16.5 5 19"], extra: "circle", h: "Shared telemetry bus", p: "Every module writes to one event stream, so signals correlate the moment they arrive." },
                { c: "var(--chart-2)", d: ["M3 7h18M3 12h18M3 17h18"], h: "One timeline", p: "Battery, charge, maintenance and safety events align per bus, per depot, per day." },
                { c: "var(--success)", d: ["M3 3v18h18", "M7 14l4-4 3 3 5-6"], h: "Decisions, not dashboards", p: "Cross-signal alerts surface what needs action — ranked, owned and tracked to closure." },
              ].map((f) => (
                <div key={f.h}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 42, width: 42, borderRadius: 12, color: f.c, background: `color-mix(in oklab, ${f.c} 13%, transparent)` }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{f.d.map((p, i) => (<path key={i} d={p} />))}{f.extra && <circle cx="12" cy="12" r="3.2" />}</svg>
                  </div>
                  <h3 style={{ fontSize: 16, margin: "15px 0 0", fontWeight: 700 }}>{f.h}</h3>
                  <p style={{ margin: "7px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--muted-foreground)" }}>{f.p}</p>
                </div>
              ))}
            </div>
          </div>

          {/* stats band */}
          <div className="lp-reveal" style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 1, background: "var(--border)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
            {[
              { v: <><span data-count="2.4" data-dec="1">0</span>M</>, l: "Telemetry points / day", hi: true },
              { v: <span data-count="3" data-dec="0">0</span>, l: "Active depots · expandable" },
              { v: <span data-count="5" data-dec="0">0</span>, l: "Modules, one login" },
              { v: <><span data-count="60" data-dec="0">0</span>s</>, l: "Fleet-wide refresh cadence" },
            ].map((s, i) => (
              <div key={i} style={{ background: "color-mix(in oklab, var(--card) 90%, transparent)", padding: "26px 24px" }}>
                <div className="num" style={{ fontSize: 32, fontWeight: 600, color: s.hi ? "var(--primary)" : "var(--foreground)" }}>{s.v}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section id="security" style={{ maxWidth: 1240, margin: "0 auto", padding: "30px 26px 96px" }}>
          <div className="lp-reveal" style={{ position: "relative", overflow: "hidden", borderRadius: 26, border: "1px solid color-mix(in oklab, var(--primary) 28%, var(--border))", padding: "clamp(34px,5vw,64px)", textAlign: "center", background: "radial-gradient(ellipse 70% 120% at 50% -20%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%), color-mix(in oklab, var(--card) 86%, transparent)", boxShadow: "0 30px 70px -40px var(--glow-primary)" }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5, backgroundImage: "linear-gradient(to right, color-mix(in oklab, var(--border) 40%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 40%, transparent) 1px, transparent 1px)", backgroundSize: "40px 40px", WebkitMaskImage: "radial-gradient(ellipse 60% 80% at 50% 0%, black, transparent 70%)", maskImage: "radial-gradient(ellipse 60% 80% at 50% 0%, black, transparent 70%)" }} />
            <div style={{ position: "relative" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 13px", borderRadius: 999, border: "1px solid color-mix(in oklab, var(--primary) 30%, var(--border))", background: "color-mix(in oklab, var(--primary) 10%, transparent)", fontSize: 11.5, fontWeight: 600, color: "var(--primary)" }}>
                <Ic d={["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"]} size={13} /> Single sign-on
              </div>
              <h2 style={{ fontSize: "clamp(26px,3.6vw,42px)", lineHeight: 1.08, margin: "18px auto 0", maxWidth: 620, fontWeight: 700, letterSpacing: "-0.03em" }}>Your entire fleet, behind one secure sign-in.</h2>
              <p style={{ margin: "16px auto 0", maxWidth: 500, fontSize: 15.5, lineHeight: 1.6, color: "var(--muted-foreground)" }}>Authenticate with your organization's Microsoft account. No new passwords, no separate logins per module.</p>
              <div style={{ marginTop: 30, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 13 }}>
                <MsButton big />
              </div>
              <div style={{ marginTop: 18, fontSize: 12, color: "var(--muted-foreground)" }}>Microsoft Entra ID · SAML 2.0 · SCIM provisioning · audit logging</div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ borderTop: "1px solid color-mix(in oklab, var(--border) 80%, transparent)", background: "color-mix(in oklab, var(--card) 55%, transparent)" }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", padding: "30px 26px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", height: 28, width: 28, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "color-mix(in oklab, var(--primary) 16%, transparent)", color: "var(--primary)" }}><Ic d={bolt} size={14} /></div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{brandName} <span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>Fleet Insights Pro</span></span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 22, fontSize: 12.5, color: "var(--muted-foreground)" }}>
              {["Modules", "Platform", "Security"].map((l) => (<a key={l} href={`#${l.toLowerCase()}`} className="lp-navlink" style={{ color: "inherit", textDecoration: "none" }}>{l}</a>))}
            </div>
            <div style={{ flexBasis: "100%", fontSize: 11.5, color: "var(--muted-foreground)", borderTop: "1px solid color-mix(in oklab, var(--border) 60%, transparent)", paddingTop: 16 }}>© {year} {brandName} · Transvolt Mobility. Secured by Microsoft Entra ID.</div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ---------- module card ---------- */
function ModuleCard({ accent, icon, title, body, metric, to, delay }: { accent: string; icon: string[]; title: string; body: string; metric: string; to?: string; delay?: string }) {
  const inner = (
    <>
      <div className="lp-card-ic" style={{ display: "flex", height: 46, width: 46, alignItems: "center", justifyContent: "center", borderRadius: 13, color: accent, background: `color-mix(in oklab, ${accent} 15%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 28%, transparent)` }}>
        <Ic d={icon} size={22} />
      </div>
      <h3 style={{ fontSize: 17.5, margin: "18px 0 0", fontWeight: 700 }}>{title}</h3>
      <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.55, color: "var(--muted-foreground)" }}>{body}</p>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid color-mix(in oklab, var(--border) 60%, transparent)" }}>
        <span className="num" style={{ fontSize: 12.5, color: "var(--foreground)", fontWeight: 600 }}>{metric}</span>
        {to ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: accent }}>Open<Ic d={["M5 12h13M13 6l6 6-6 6"]} size={14} /></span>
        ) : (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--muted-foreground)" }}>Integrated</span>
        )}
      </div>
    </>
  );
  const style = { ["--ac" as string]: accent, display: "block", textDecoration: "none", color: "inherit", borderRadius: 18, border: "1px solid var(--border)", background: "color-mix(in oklab, var(--card) 88%, transparent)", padding: 24, boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 14px 36px -22px rgba(0,0,0,.3)", transitionDelay: delay } as React.CSSProperties;
  return to
    ? (<Link to={to} className="lp-card lp-reveal" style={style}>{inner}</Link>)
    : (<div className="lp-card lp-reveal" style={style}>{inner}</div>);
}
