import { motion } from "framer-motion";

export interface EnergyFlowTotals {
  gridKwh: number;
  chargerKwh: number;
  busKwh: number;
  gapKwh: number;
  efficiencyPct: number;
}

/** Illustrated grid → chargers → buses with animated energy streams */
export function EnergyFlowDiagram({
  totals,
  caption,
}: {
  totals: EnergyFlowTotals;
  caption?: string;
}) {
  const max = Math.max(totals.gridKwh, totals.chargerKwh, totals.busKwh, 1);
  const chPct = (totals.chargerKwh / max) * 100;
  const busPct = (totals.busKwh / max) * 100;
  const gridPct = 100;
  const bottleneck = totals.gapKwh > totals.gridKwh * 0.08;

  return (
    <div className="cc-energy-diagram relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 md:px-8 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(56,189,248,0.12),transparent_60%)]" />

      <svg
        viewBox="0 0 900 320"
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
          <linearGradient id="flowBus" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connection paths */}
        <path
          d="M 200 160 C 320 160, 340 160, 420 160"
          fill="none"
          stroke="url(#flowGrid)"
          strokeWidth="3"
          strokeDasharray="8 6"
          opacity="0.5"
        />
        <path
          d="M 480 160 C 560 160, 580 160, 680 160"
          fill="none"
          stroke="url(#flowCharger)"
          strokeWidth="3"
          strokeDasharray="8 6"
          opacity="0.5"
        />

        {/* Animated energy particles — grid to chargers */}
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
        <g transform="translate(80, 80)">
          <rect x="0" y="40" width="120" height="140" rx="8" fill="#1e293b" stroke="#818cf8" strokeWidth="2" />
          <path d="M60 20 L60 50 M40 35 L80 35 M45 25 L75 25" stroke="#818cf8" strokeWidth="2" fill="none" />
          <rect x="25" y="70" width="70" height="90" rx="4" fill="#0f172a" stroke="#6366f1" strokeWidth="1" opacity="0.8" />
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={32 + col * 22}
                y={78 + row * 18}
                width="14"
                height="10"
                rx="1"
                fill="#818cf8"
                opacity={0.4 + (row + col) * 0.1}
              />
            )),
          )}
          <text x="60" y="200" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="600">
            GRID
          </text>
          <text x="60" y="218" textAnchor="middle" fill="#94a3b8" fontSize="11">
            Intake
          </text>
        </g>

        {/* CHARGERS */}
        <g transform="translate(360, 60)">
          <rect x="0" y="60" width="160" height="160" rx="10" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${20 + i * 48}, 80)`}>
              <rect x="0" y="0" width="36" height="100" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />
              <rect x="8" y="12" width="20" height="28" rx="3" fill="#38bdf8" opacity="0.35" />
              <circle cx="18" cy="55" r="8" fill="#22d3ee" opacity="0.6" />
              <rect x="10" y="70" width="16" height="22" rx="2" fill="#164e63" />
            </g>
          ))}
          <motion.rect
            x="10"
            y="150"
            width={chPct * 1.4}
            height="6"
            rx="3"
            fill="#38bdf8"
            initial={{ width: 0 }}
            animate={{ width: chPct * 1.4 }}
            transition={{ duration: 1 }}
          />
          <text x="80" y="200" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="600">
            CHARGERS
          </text>
          <text x="80" y="218" textAnchor="middle" fill="#94a3b8" fontSize="11">
            Output
          </text>
        </g>

        {/* BUSES */}
        <g transform="translate(620, 90)">
          <rect x="0" y="50" width="180" height="130" rx="10" fill="#1e293b" stroke="#fbbf24" strokeWidth="2" />
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${24 + i * 72}, 70)`}>
              <rect x="0" y="30" width="56" height="36" rx="6" fill="#422006" stroke="#fbbf24" strokeWidth="1.5" />
              <rect x="4" y="8" width="48" height="28" rx="8" fill="#0f172a" stroke="#fbbf24" strokeWidth="1" />
              <circle cx="14" cy="68" r="7" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
              <circle cx="42" cy="68" r="7" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
              <motion.rect
                x="8"
                y="14"
                width={busPct * 0.4}
                height="16"
                rx="3"
                fill="#fbbf24"
                opacity="0.7"
                initial={{ width: 0 }}
                animate={{ width: busPct * 0.4 }}
                transition={{ duration: 1, delay: 0.2 }}
              />
            </g>
          ))}
          <text x="90" y="200" textAnchor="middle" fill="#e2e8f0" fontSize="14" fontWeight="600">
            BUSES
          </text>
          <text x="90" y="218" textAnchor="middle" fill="#94a3b8" fontSize="11">
            Demand
          </text>
        </g>

        {/* Flow labels on paths */}
        <text x="310" y="145" textAnchor="middle" fill="#94a3b8" fontSize="10">
          →
        </text>
        <text x="560" y="145" textAnchor="middle" fill="#94a3b8" fontSize="10">
          →
        </text>

        {bottleneck && (
          <g transform="translate(400, 120)">
            <rect x="-50" y="-12" width="100" height="24" rx="12" fill="rgba(248,113,113,0.2)" stroke="#f87171" strokeWidth="1" />
            <text x="0" y="4" textAnchor="middle" fill="#fca5a5" fontSize="10" fontWeight="500">
              Bottleneck
            </text>
          </g>
        )}
      </svg>

      {caption && (
        <p className="relative mt-3 text-center text-[11px] text-slate-400">{caption}</p>
      )}

      {/* Proportional flow bars under illustration */}
      <div className="relative mt-2 grid grid-cols-3 gap-3 px-2 md:gap-6">
        {[
          { label: "Grid", pct: gridPct, color: "bg-indigo-500", value: totals.gridKwh },
          { label: "Chargers", pct: chPct, color: "bg-cyan-500", value: totals.chargerKwh },
          { label: "Buses", pct: busPct, color: "bg-amber-500", value: totals.busKwh },
        ].map((bar) => (
          <div key={bar.label}>
            <div className="mb-1 flex justify-between text-[10px] text-slate-400">
              <span>{bar.label}</span>
              <span className="num text-slate-300">{bar.pct.toFixed(0)}% rel.</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                className={`h-full rounded-full ${bar.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${bar.pct}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
