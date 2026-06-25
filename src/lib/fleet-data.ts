// Deterministic mock for route_context_fact, route_segment_fact,
// driver_trip_behavior_fact, driver_contextual_score_fact.
// Stable interfaces; swap with Redshift gold-layer fetches later.

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r = mulberry32(7);
function g(mean: number, std: number) {
  const u = 1 - r();
  const v = r();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

export interface RouteContext {
  route_id: string;
  route_code: string;
  route_name: string;
  active_trips_30d: number;
  avg_distance_km: number;
  avg_speed_kmh: number;
  altitude_gain_m: number;
  stop_density_per_km: number;
  rough_road_density: number; // 0..1
  congestion_score: number; // 0..100
  difficulty_score: number; // 0..100
  efficiency_kwh_per_km: number;
  peak_efficiency: number;
  offpeak_efficiency: number;
  peak_stop_ratio: number;
  offpeak_stop_ratio: number;
  peak_dms_index: number;
  offpeak_dms_index: number;
  energy_leakage_kwh: number;
  // pseudo-geospatial polyline (normalized 0..1 coords for SVG canvas)
  path: { x: number; y: number }[];
  // Real route geometry from mart_route_geometry (live routes only).
  stops?: RouteStop[];
  stop_count?: number;
}

/** A real stage/stop on a route, with WGS84 coordinates. */
export interface RouteStop {
  stage_id: number;
  lat: number;
  lon: number;
}

const ROUTE_SEEDS = [
  { code: "R-101", name: "Dadar → BKC Loop" },
  { code: "R-204", name: "Western Express Highway" },
  { code: "R-309", name: "Andheri Industrial Belt" },
  { code: "R-417", name: "CSIA Airport Shuttle" },
  { code: "R-522", name: "Eastern Freeway Trunk" },
  { code: "R-630", name: "Bandra–Worli Sea Link" },
  { code: "R-744", name: "Powai Tech Park Circular" },
  { code: "R-812", name: "South Mumbai Connector" },
  { code: "R-905", name: "Thane–Mulund Express" },
  { code: "R-1020", name: "JNPT Port Logistics" },
];

/** Spread routes across Mumbai so polylines don't stack on the overview map. */
const MUMBAI_ROUTE_ANCHORS = [
  { x: 0.14, y: 0.84 }, // South Mumbai
  { x: 0.26, y: 0.7 }, // Dadar
  { x: 0.4, y: 0.55 }, // Worli / Lower Parel
  { x: 0.55, y: 0.4 }, // BKC
  { x: 0.72, y: 0.52 }, // Andheri E
  { x: 0.86, y: 0.68 }, // Goregaon
  { x: 0.74, y: 0.82 }, // Malad
  { x: 0.52, y: 0.88 }, // Santacruz
  { x: 0.32, y: 0.38 }, // Harbour / Wadala
  { x: 0.18, y: 0.52 }, // Mahalaxmi
];

function makePath(seed: number, segCount: number, routeIndex: number) {
  const rr = mulberry32(seed);
  const anchor = MUMBAI_ROUTE_ANCHORS[routeIndex % MUMBAI_ROUTE_ANCHORS.length];
  const pts: { x: number; y: number }[] = [];
  let x = clamp(anchor.x + (rr() - 0.5) * 0.05, 0.06, 0.94);
  let y = clamp(anchor.y + (rr() - 0.5) * 0.05, 0.06, 0.94);
  pts.push({ x, y });
  for (let i = 0; i < segCount; i++) {
    const step = 0.028 + rr() * 0.022;
    const angle = rr() * Math.PI * 2;
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step * 0.75;
    x = clamp(x, 0.06, 0.94);
    y = clamp(y, 0.06, 0.94);
    pts.push({ x, y });
  }
  return pts;
}

export const ROUTES: RouteContext[] = ROUTE_SEEDS.map((s, i) => {
  const segCount = Math.round(8 + r() * 8);
  const congestion = clamp(g(55, 22), 8, 96);
  const rough = clamp(g(0.28, 0.18), 0.02, 0.85);
  const stopDensity = clamp(g(2.3, 1.1), 0.4, 6.2);
  const altitude = clamp(g(180, 140), 10, 720);
  const difficulty = clamp(
    congestion * 0.4 + rough * 100 * 0.3 + stopDensity * 6 + altitude / 30,
    10,
    99,
  );
  const eff = clamp(g(1.18, 0.18) + (difficulty - 50) * 0.004, 0.7, 1.9);
  const peakBoost = 1 + (difficulty / 100) * 0.32 + r() * 0.05;
  return {
    route_id: `rt_${i + 1}`,
    route_code: s.code,
    route_name: s.name,
    active_trips_30d: Math.round(40 + r() * 260),
    avg_distance_km: +clamp(g(28, 14), 8, 78).toFixed(1),
    avg_speed_kmh: +clamp(g(34, 9), 14, 62).toFixed(1),
    altitude_gain_m: Math.round(altitude),
    stop_density_per_km: +stopDensity.toFixed(2),
    rough_road_density: +rough.toFixed(3),
    congestion_score: +congestion.toFixed(1),
    difficulty_score: +difficulty.toFixed(1),
    efficiency_kwh_per_km: +eff.toFixed(3),
    peak_efficiency: +(eff * peakBoost).toFixed(3),
    offpeak_efficiency: +(eff / (1 + (peakBoost - 1) * 0.4)).toFixed(3),
    peak_stop_ratio: +clamp(0.18 + difficulty * 0.004 + r() * 0.05, 0.05, 0.55).toFixed(3),
    offpeak_stop_ratio: +clamp(0.08 + difficulty * 0.002, 0.03, 0.4).toFixed(3),
    peak_dms_index: +clamp(g(58, 18) + difficulty * 0.3, 10, 98).toFixed(1),
    offpeak_dms_index: +clamp(g(30, 12) + difficulty * 0.15, 5, 80).toFixed(1),
    energy_leakage_kwh: +clamp(g(140, 80) + difficulty * 2.4, 10, 980).toFixed(1),
    path: makePath(100 + i * 17, segCount, i),
  };
});

export interface SegmentRisk {
  segment_id: string;
  route_id: string;
  route_code: string;
  seq: number;
  x: number;
  y: number;
  length_km: number;
  harsh_braking: number;
  overspeed: number;
  distraction: number;
  drowsiness: number;
  rough_road: number;
  energy_leakage_kwh: number;
  risk_score: number; // 0..100
  trend_30d: number; // -50..+50 % delta
}

export const SEGMENTS: SegmentRisk[] = (() => {
  const out: SegmentRisk[] = [];
  for (const route of ROUTES) {
    for (let i = 0; i < route.path.length - 1; i++) {
      const a = route.path[i];
      const b = route.path[i + 1];
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      const len = +clamp(g(2.4, 1.1), 0.4, 6.5).toFixed(2);
      const harsh = Math.round(clamp(g(8, 6) + route.congestion_score / 10, 0, 60));
      const over = Math.round(clamp(g(4, 4) + route.difficulty_score / 18, 0, 38));
      const dist = Math.round(clamp(g(3, 3) + route.peak_dms_index / 22, 0, 42));
      const drow = Math.round(clamp(g(2, 2) + (route.avg_distance_km > 30 ? 4 : 0), 0, 30));
      const rough = Math.round(clamp(g(6, 5) + route.rough_road_density * 30, 0, 55));
      const leak = +clamp(g(14, 10) + harsh * 0.8 + rough * 0.7, 1, 180).toFixed(1);
      const risk = clamp(harsh * 1.4 + over * 1.6 + dist * 1.2 + drow * 1.8 + rough * 0.9, 4, 99);
      out.push({
        segment_id: `${route.route_code}-S${i + 1}`,
        route_id: route.route_id,
        route_code: route.route_code,
        seq: i + 1,
        x,
        y,
        length_km: len,
        harsh_braking: harsh,
        overspeed: over,
        distraction: dist,
        drowsiness: drow,
        rough_road: rough,
        energy_leakage_kwh: leak,
        risk_score: +risk.toFixed(1),
        trend_30d: +clamp(g(0, 14), -42, 48).toFixed(1),
      });
    }
  }
  return out;
})();

export interface DriverScore {
  driver_id: string;
  driver_name: string;
  company_name: string;
  trips_30d: number;
  contextual_score: number; // 0..100, route-normalized
  percentile: number; // 0..100
  efficiency_kwh_per_km: number;
  efficiency_delta_pct: number;
  difficulty_exposure: number; // mean route difficulty
  risk_band: "Elite" | "Strong" | "Average" | "At-risk" | "Critical";
  // behavior fingerprint (per 100 trips, normalized)
  harsh_braking: number;
  harsh_accel: number;
  overspeed: number;
  distraction: number;
  drowsiness: number;
  seatbelt_violation: number;
  phone_use: number;
  // trend
  score_evolution: number[]; // last 12 weeks
}

const DRIVER_NAMES = [
  "Anaya Sharma", "Marco Bellini", "Lin Wei", "Sofia Becker", "Ravi Patel",
  "Jonas Müller", "Aiko Tanaka", "Diego Alvarez", "Priya Iyer", "Lukas Novak",
  "Elena Rossi", "Hiro Sato", "Noor Khan", "Mateo Silva", "Kenji Yamada",
  "Aisha Karim", "Tomás Reyes", "Yara Haddad", "Omar Faruk", "Ines Costa",
  "Pavel Sokolov", "Mei Zhang", "Idris Bello", "Hannah Cohen",
];
const COMPANIES = ["Apex Logistics", "Northwind Transit", "Helix Mobility", "Vector Freight"];

function bandFromScore(s: number): DriverScore["risk_band"] {
  if (s >= 88) return "Elite";
  if (s >= 75) return "Strong";
  if (s >= 60) return "Average";
  if (s >= 45) return "At-risk";
  return "Critical";
}

export const DRIVERS: DriverScore[] = DRIVER_NAMES.map((name, i) => {
  const score = clamp(g(70, 14), 28, 98);
  const eff = clamp(g(1.16, 0.18), 0.8, 1.85);
  const exp = clamp(g(55, 18), 18, 95);
  const evo: number[] = [];
  let cur = score - g(0, 8);
  for (let k = 0; k < 12; k++) {
    cur += g(0, 2.4);
    evo.push(+clamp(cur, 20, 100).toFixed(1));
  }
  evo[11] = +score.toFixed(1);
  return {
    driver_id: `drv_${i + 1}`,
    driver_name: name,
    company_name: COMPANIES[i % COMPANIES.length],
    trips_30d: Math.round(20 + r() * 90),
    contextual_score: +score.toFixed(1),
    percentile: 0, // filled below
    efficiency_kwh_per_km: +eff.toFixed(3),
    efficiency_delta_pct: +g(0, 6).toFixed(1),
    difficulty_exposure: +exp.toFixed(1),
    risk_band: bandFromScore(score),
    harsh_braking: +clamp(g(14, 8) - (score - 70) * 0.2, 0, 60).toFixed(1),
    harsh_accel: +clamp(g(10, 6) - (score - 70) * 0.15, 0, 55).toFixed(1),
    overspeed: +clamp(g(6, 5) - (score - 70) * 0.1, 0, 40).toFixed(1),
    distraction: +clamp(g(8, 6) - (score - 70) * 0.18, 0, 45).toFixed(1),
    drowsiness: +clamp(g(3, 3), 0, 30).toFixed(1),
    seatbelt_violation: +clamp(g(2, 3), 0, 25).toFixed(1),
    phone_use: +clamp(g(5, 4) - (score - 70) * 0.1, 0, 35).toFixed(1),
    score_evolution: evo,
  };
});
// percentile fill
{
  const sorted = [...DRIVERS].sort((a, b) => a.contextual_score - b.contextual_score);
  sorted.forEach((d, idx) => {
    d.percentile = Math.round(((idx + 0.5) / sorted.length) * 100);
  });
}

export const FLEET_KPIS = {
  fleet_efficiency_kwh_per_km: +(
    DRIVERS.reduce((s, d) => s + d.efficiency_kwh_per_km, 0) / DRIVERS.length
  ).toFixed(3),
  operational_risk_index: +(
    DRIVERS.reduce((s, d) => s + (100 - d.contextual_score), 0) / DRIVERS.length
  ).toFixed(1),
  total_energy_leakage_kwh: +ROUTES.reduce((s, r) => s + r.energy_leakage_kwh, 0).toFixed(0),
  total_dms_events: SEGMENTS.reduce(
    (s, x) => s + x.distraction + x.drowsiness + x.harsh_braking + x.overspeed,
    0,
  ),
  high_risk_routes: ROUTES.filter((r) => r.difficulty_score > 70).length,
  high_risk_drivers: DRIVERS.filter((d) => d.contextual_score < 60).length,
  active_routes: ROUTES.length,
  active_drivers: DRIVERS.length,
};
