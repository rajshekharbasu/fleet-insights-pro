// Pseudo-geospatial map. No external map dependency.
// Renders SVG with stylized landmass, water gradients, and route polylines
// + hotspot pulses. Coordinates are normalized [0..1] in route paths.

import { useMemo } from "react";
import type { RouteContext, SegmentRisk } from "@/lib/fleet-data";

export type HotspotKind =
  | "harsh_braking"
  | "overspeed"
  | "distraction"
  | "drowsiness"
  | "rough_road"
  | "risk";

interface Props {
  routes: RouteContext[];
  segments?: SegmentRisk[];
  highlightRouteIds?: string[];
  activeKinds?: HotspotKind[];
  onSegmentHover?: (s: SegmentRisk | null) => void;
  onSegmentClick?: (s: SegmentRisk) => void;
  height?: number;
  showLegend?: boolean;
}

const KIND_COLOR: Record<HotspotKind, string> = {
  harsh_braking: "var(--color-destructive)",
  overspeed: "var(--color-warning)",
  distraction: "var(--color-chart-4)",
  drowsiness: "var(--color-chart-2)",
  rough_road: "var(--color-chart-3)",
  risk: "var(--color-primary)",
};

function intensityFor(s: SegmentRisk, kinds: HotspotKind[]) {
  if (kinds.includes("risk") || kinds.length === 0) return s.risk_score / 100;
  let sum = 0;
  let n = 0;
  for (const k of kinds) {
    if (k === "risk") continue;
    sum += Math.min(60, (s as any)[k] as number);
    n += 60;
  }
  return n ? sum / n : 0;
}

export function GeoCanvas({
  routes,
  segments = [],
  highlightRouteIds,
  activeKinds = ["risk"],
  onSegmentHover,
  onSegmentClick,
  height = 480,
  showLegend = true,
}: Props) {
  const W = 1600;
  const H = 900;

  const pathDs = useMemo(
    () =>
      routes.map((r) => {
        const d = r.path
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * W} ${p.y * H}`)
          .join(" ");
        return { id: r.route_id, code: r.route_code, d, difficulty: r.difficulty_score };
      }),
    [routes],
  );

  const hotspots = useMemo(
    () =>
      segments
        .map((s) => ({ s, intensity: intensityFor(s, activeKinds) }))
        .filter((x) => x.intensity > 0.1)
        .sort((a, b) => b.intensity - a.intensity),
    [segments, activeKinds],
  );

  const primaryKind = activeKinds[0] ?? "risk";
  const dotColor = KIND_COLOR[primaryKind];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elevated"
      style={{ height }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="map-bg" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="color-mix(in oklab, var(--color-primary) 8%, var(--color-card))" />
            <stop offset="60%" stopColor="var(--color-card)" />
            <stop offset="100%" stopColor="color-mix(in oklab, black 14%, var(--color-card))" />
          </radialGradient>
          <pattern id="map-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="color-mix(in oklab, var(--color-border) 60%, transparent)"
              strokeWidth="0.6"
            />
          </pattern>
          <linearGradient id="route-stroke" x1="0" x2="1">
            <stop offset="0%" stopColor="color-mix(in oklab, var(--color-primary) 70%, transparent)" />
            <stop offset="100%" stopColor="color-mix(in oklab, var(--color-chart-2) 70%, transparent)" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={W} height={H} fill="url(#map-bg)" />
        <rect width={W} height={H} fill="url(#map-grid)" opacity="0.35" />

        {/* faux coastline shapes */}
        <path
          d={`M 0 ${H * 0.78} Q ${W * 0.2} ${H * 0.72} ${W * 0.4} ${H * 0.82} T ${W} ${H * 0.86} L ${W} ${H} L 0 ${H} Z`}
          fill="color-mix(in oklab, var(--color-chart-2) 12%, transparent)"
        />
        <path
          d={`M 0 ${H * 0.18} Q ${W * 0.25} ${H * 0.1} ${W * 0.5} ${H * 0.16} T ${W} ${H * 0.12} L ${W} 0 L 0 0 Z`}
          fill="color-mix(in oklab, var(--color-primary) 6%, transparent)"
        />

        {/* routes */}
        {pathDs.map((p) => {
          const active = !highlightRouteIds || highlightRouteIds.includes(p.id);
          const stroke = active ? "url(#route-stroke)" : "color-mix(in oklab, var(--color-border) 80%, transparent)";
          return (
            <g key={p.id} opacity={active ? 1 : 0.35}>
              <path d={p.d} fill="none" stroke={stroke} strokeWidth={active ? 9 : 4} strokeLinecap="round" strokeOpacity={0.18} filter="url(#glow)" />
              <path d={p.d} fill="none" stroke={stroke} strokeWidth={active ? 2.6 : 1.4} strokeLinecap="round" />
            </g>
          );
        })}

        {/* hotspots */}
        {hotspots.map(({ s, intensity }) => {
          const cx = s.x * W;
          const cy = s.y * H;
          const r = 6 + intensity * 26;
          return (
            <g
              key={s.segment_id}
              onMouseEnter={() => onSegmentHover?.(s)}
              onMouseLeave={() => onSegmentHover?.(null)}
              onClick={() => onSegmentClick?.(s)}
              style={{ cursor: onSegmentClick ? "pointer" : "default" }}
            >
              <circle cx={cx} cy={cy} r={r} fill={dotColor} opacity={0.12} filter="url(#glow)" />
              <circle cx={cx} cy={cy} r={r * 0.55} fill={dotColor} opacity={0.28} />
              <circle cx={cx} cy={cy} r={Math.max(2.4, intensity * 5.5)} fill={dotColor}>
                <animate attributeName="r" values={`${Math.max(2, intensity * 4)};${intensity * 7};${Math.max(2, intensity * 4)}`} dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.55;1" dur="2.4s" repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {/* route labels */}
        {pathDs.map((p) => {
          const start = routes.find((r) => r.route_id === p.id)!.path[0];
          return (
            <g key={`lbl-${p.id}`}>
              <rect
                x={start.x * W + 10}
                y={start.y * H - 18}
                rx={4}
                ry={4}
                width={56}
                height={16}
                fill="color-mix(in oklab, var(--color-card) 85%, transparent)"
                stroke="color-mix(in oklab, var(--color-border) 70%, transparent)"
              />
              <text
                x={start.x * W + 38}
                y={start.y * H - 6}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-mono)"
                fill="var(--color-muted-foreground)"
              >
                {p.code}
              </text>
            </g>
          );
        })}
      </svg>

      {showLegend && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-card/80 px-2.5 py-1.5 text-[10.5px] backdrop-blur-md">
          {activeKinds.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 px-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
              <span className="capitalize text-muted-foreground">{k.replace("_", " ")}</span>
            </span>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute right-3 top-3 rounded-lg border border-border/60 bg-card/80 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur-md">
        Geo · pseudo-tiles
      </div>
    </div>
  );
}
