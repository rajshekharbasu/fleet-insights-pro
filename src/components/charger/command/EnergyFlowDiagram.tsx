import { motion } from "framer-motion";
import type { FlowStage, FlowTrendPoint } from "./energy-flow-sync";
import { pointEfficiency, stageGlow } from "./energy-flow-sync";
import { fmt } from "./primitives";

export interface EnergyFlowTotals {
  gridKwh: number;
  chargerKwh: number;
  busKwh: number;
  gapKwh: number;
  efficiencyPct: number;
}

/** Illustrated grid → chargers → buses with synchronized hover targets */
export function EnergyFlowDiagram({
  snapshot,
  activeStage,
  activeIndex,
  trendLabels,
  onStageHover,
  caption,
}: {
  snapshot: FlowTrendPoint;
  activeStage: FlowStage | null;
  activeIndex: number | null;
  trendLabels?: string[];
  onStageHover: (stage: FlowStage | null) => void;
  caption?: string;
}) {
  const max = Math.max(snapshot.grid, snapshot.output, snapshot.demand, 1);
  const chPct = (snapshot.output / max) * 100;
  const busPct = (snapshot.demand / max) * 100;
  const gridPct = 100;
  const bottleneck = snapshot.gap > snapshot.grid * 0.08 || snapshot.demand > snapshot.output * 1.1;
  const eff = pointEfficiency(snapshot);

  const glow = (stage: FlowStage) =>
    stageGlow(activeStage, stage) ? "drop-shadow-[0_0_12px_rgba(56,189,248,0.85)]" : "";

  return (
    <div className="cc-energy-diagram relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 md:px-8 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(56,189,248,0.12),transparent_60%)]" />

      {activeIndex != null && (
        <div className="absolute left-4 top-3 z-10 rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-1 text-[10px] font-medium text-primary">
          Synced · {snapshot.label}
        </div>
      )}

      <svg
        viewBox="0 0 900 340"
        className="relative mx-auto h-auto w-full max-w-4xl"
        aria-label="Energy flow from grid through chargers to buses"
      >
        <defs>
          <linearGradient id="flowGrid" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="flowCharger" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Hover zones — links */}
        <rect
          x="180"
          y="120"
          width="260"
          height="80"
          fill="transparent"
          className="cursor-pointer"
          onMouseEnter={() => onStageHover("grid_charger")}
          onMouseLeave={() => onStageHover(null)}
        />
        <rect
          x="440"
          y="120"
          width="260"
          height="80"
          fill="transparent"
          className="cursor-pointer"
          onMouseEnter={() => onStageHover("charger_bus")}
          onMouseLeave={() => onStageHover(null)}
        />

        <path
          d="M 200 160 C 320 160, 340 160, 420 160"
          fill="none"
          stroke="url(#flowGrid)"
          strokeWidth={stageGlow(activeStage, "grid_charger") ? 5 : 3}
          strokeDasharray="8 6"
          opacity={stageGlow(activeStage, "grid_charger") ? 1 : 0.5}
        />
        <path
          d="M 480 160 C 560 160, 580 160, 680 160"
          fill="none"
          stroke="url(#flowCharger)"
          strokeWidth={stageGlow(activeStage, "charger_bus") ? 5 : 3}
          strokeDasharray="8 6"
          opacity={stageGlow(activeStage, "charger_bus") ? 1 : 0.5}
        />

        {[0, 1, 2].map((i) => (
          <motion.circle
            key={`g-${i}`}
            r="5"
            fill="#818cf8"
            filter="url(#glow)"
            initial={{ cx: 200, cy: 160, opacity: 0.3 }}
            animate={{ cx: [200, 420], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.7, ease: "linear" }}
          />
        ))}
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={`c-${i}`}
            r="5"
            fill="#2dd4bf"
            filter="url(#glow)"
            initial={{ cx: 480, cy: 160, opacity: 0.3 }}
            animate={{ cx: [480, 680], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: 0.4 + i * 0.7, ease: "linear" }}
          />
        ))}

        {/* GRID */}
        <g
          transform="translate(80, 80)"
          className={`cursor-pointer transition-opacity ${glow("grid")}`}
          onMouseEnter={() => onStageHover("grid")}
          onMouseLeave={() => onStageHover(null)}
        >
          <rect
            x="0"
            y="40"
            width="120"
            height="140"
            rx="8"
            fill="#1e293b"
            stroke={stageGlow(activeStage, "grid") ? "#a5b4fc" : "#818cf8"}
            strokeWidth={stageGlow(activeStage, "grid") ? 3 : 2}
          />
          <path d="M60 20 L60 50 M40 35 L80 35 M45 25 L75 25" stroke="#818cf8" strokeWidth="2" fill="none" />
          <rect x="25" y="70" width="70" height="90" rx="4" fill="#0f172a" stroke="#6366f1" strokeWidth="1" opacity="0.8" />
          <text x="60" y="200" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="600">
            GRID
          </text>
          <text x="60" y="218" textAnchor="middle" fill="#94a3b8" fontSize="11">
            Intake
          </text>
          <text x="60" y="236" textAnchor="middle" fill="#c7d2fe" fontSize="12" fontWeight="600">
            {fmt(snapshot.grid, 0)} kWh
          </text>
        </g>

        {/* CHARGERS */}
        <g
          transform="translate(360, 60)"
          className={`cursor-pointer transition-opacity ${glow("charger")}`}
          onMouseEnter={() => onStageHover("charger")}
          onMouseLeave={() => onStageHover(null)}
        >
          <rect
            x="0"
            y="60"
            width="160"
            height="160"
            rx="10"
            fill="#1e293b"
            stroke={stageGlow(activeStage, "charger") ? "#67e8f9" : "#38bdf8"}
            strokeWidth={stageGlow(activeStage, "charger") ? 3 : 2}
          />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${20 + i * 48}, 80)`}>
              <rect x="0" y="0" width="36" height="100" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
              <rect x="8" y="12" width="20" height="28" rx="3" fill="#38bdf8" opacity={stageGlow(activeStage, "charger") ? 0.6 : 0.35} />
              <circle cx="18" cy="55" r="8" fill="#22d3ee" opacity="0.6" />
            </g>
          ))}
          <rect x="10" y="150" width={Math.max(chPct * 1.4, 4)} height="6" rx="3" fill="#38bdf8" />
          <text x="80" y="200" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="600">
            CHARGERS
          </text>
          <text x="80" y="218" textAnchor="middle" fill="#94a3b8" fontSize="11">
            Output
          </text>
          <text x="80" y="236" textAnchor="middle" fill="#67e8f9" fontSize="12" fontWeight="600">
            {fmt(snapshot.output, 0)} kWh
          </text>
        </g>

        {/* BUSES */}
        <g
          transform="translate(620, 90)"
          className={`cursor-pointer transition-opacity ${glow("bus")}`}
          onMouseEnter={() => onStageHover("bus")}
          onMouseLeave={() => onStageHover(null)}
        >
          <rect
            x="0"
            y="50"
            width="180"
            height="130"
            rx="10"
            fill="#1e293b"
            stroke={stageGlow(activeStage, "bus") ? "#fcd34d" : "#fbbf24"}
            strokeWidth={stageGlow(activeStage, "bus") ? 3 : 2}
          />
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${24 + i * 72}, 70)`}>
              <rect x="0" y="30" width="56" height="36" rx="6" fill="#422006" stroke="#fbbf24" strokeWidth="1.5" />
              <rect x="4" y="8" width="48" height="28" rx="8" fill="#0f172a" stroke="#fbbf24" strokeWidth="1" />
              <rect x="8" y="14" width={Math.max(busPct * 0.4, 4)} height="16" rx="3" fill="#fbbf24" opacity="0.7" />
            </g>
          ))}
          <text x="90" y="200" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="600">
            BUSES
          </text>
          <text x="90" y="218" textAnchor="middle" fill="#94a3b8" fontSize="11">
            Demand
          </text>
          <text x="90" y="236" textAnchor="middle" fill="#fcd34d" fontSize="12" fontWeight="600">
            {fmt(snapshot.demand, 0)} kWh
          </text>
        </g>

        {bottleneck && (
          <g
            transform="translate(400, 118)"
            className="cursor-pointer"
            onMouseEnter={() => onStageHover("charger_bus")}
            onMouseLeave={() => onStageHover(null)}
          >
            <rect
              x="-58"
              y="-14"
              width="116"
              height="28"
              rx="14"
              fill={stageGlow(activeStage, "charger_bus") ? "rgba(248,113,113,0.45)" : "rgba(248,113,113,0.2)"}
              stroke="#f87171"
              strokeWidth={stageGlow(activeStage, "charger_bus") ? 2 : 1}
            />
            <text x="0" y="4" textAnchor="middle" fill="#fca5a5" fontSize="10" fontWeight="600">
              Gap {fmt(snapshot.gap, 0)} kWh
            </text>
          </g>
        )}
      </svg>

      {caption && (
        <p className="relative mt-2 text-center text-[11px] text-slate-400">{caption}</p>
      )}

      {/* Timeline sync strip */}
      {trendLabels && trendLabels.length > 0 && (
        <div className="relative mt-3 flex justify-center gap-1.5 px-2">
          {trendLabels.map((label, i) => (
            <div
              key={label}
              className={`num min-w-[36px] rounded-md border px-1 py-1 text-center text-[9px] transition-all ${
                activeIndex === i
                  ? "border-primary bg-primary/20 font-semibold text-primary"
                  : "border-slate-700/80 text-slate-500"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      )}

      <div className="relative mt-3 grid grid-cols-3 gap-3 px-2 md:gap-6">
        {[
          { label: "Grid", pct: gridPct, color: "bg-indigo-500", on: stageGlow(activeStage, "grid") },
          { label: "Chargers", pct: chPct, color: "bg-cyan-500", on: stageGlow(activeStage, "charger") },
          { label: "Buses", pct: busPct, color: "bg-amber-500", on: stageGlow(activeStage, "bus") },
        ].map((bar) => (
          <div
            key={bar.label}
            className={`rounded-lg p-1 transition-all ${bar.on ? "ring-2 ring-primary/50 ring-offset-1 ring-offset-slate-900" : ""}`}
          >
            <div className="mb-1 flex justify-between text-[10px] text-slate-400">
              <span>{bar.label}</span>
              <span className="num text-slate-300">{bar.pct.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                className={`h-full rounded-full ${bar.color}`}
                animate={{ width: `${bar.pct}%` }}
                transition={{ duration: 0.35 }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="relative mt-2 text-center text-[10px] text-slate-500">
        Hover diagram nodes or trend chart · {eff.toFixed(0)}% delivery efficiency
        {activeStage ? ` · phase: ${activeStage.replace("_", " → ")}` : ""}
      </p>
    </div>
  );
}
