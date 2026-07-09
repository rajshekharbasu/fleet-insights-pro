import { GRAPHQL_API_URL } from "./config";
import type { DriverScore } from "../fleet-data";

function parseSqlQueryResult<T>(result: T[] | { error?: string } | null | undefined): T[] {
  if (!result) return [];
  if (!Array.isArray(result)) {
    throw new Error(result.error || "GraphQL sqlQuery error");
  }
  return result;
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const str = (v: unknown): string | null => (v == null || v === "" ? null : String(v));

const bool = (v: unknown): boolean =>
  v === true || v === 1 || /^(1|y|yes|true|t)$/i.test(String(v ?? ""));

/** Extra mart_driver_leaderboard signals not present on the mock DriverScore shape. */
export interface DriverLeaderboardExtras {
  rank: number | null;
  snapshotDate: string | null;
  windowStartDate: string | null;
  windowEndDate: string | null;
  tripsScored: number | null;
  tripsPeerScored: number | null;
  peerScoreCoveragePct: number | null;
  scoreTrend: string | null;
  starsPerTripWeighted: number | null;
  highRiskRatio: number | null;
  fatigueDensity: number | null;
  dominantRisk: string | null;
  coachingModule: string | null;
  coachingTrigger: string | null;
  incentiveEligible: boolean;
  reviewRequired: boolean;
  /** Raw letter grade from mart_driver_leaderboard.score_band (e.g. A–D). */
  rawScoreBand: string | null;
}

export type DriverLeaderboardEntry = DriverScore & { extras: DriverLeaderboardExtras };

function mapBand(band: string | null, score: number): DriverScore["risk_band"] {
  const b = (band ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (/^a\+?$/.test(b)) return "Elite";
  if (/^b\+?$/.test(b)) return "Strong";
  if (/^c\+?$/.test(b)) return "Average";
  if (/^d\+?$/.test(b)) return "At-risk";
  if (b.includes("elite") || b.includes("excellent") || b.includes("top")) return "Elite";
  if (b.includes("strong") || b.includes("good")) return "Strong";
  if (b.includes("average") || b.includes("fair") || b.includes("medium") || b.includes("moderate")) return "Average";
  if (b.includes("critical") || b.includes("severe")) return "Critical";
  if (b.includes("risk") || b.includes("watch") || b.includes("poor")) return "At-risk";
  if (score >= 88) return "Elite";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Average";
  if (score >= 45) return "At-risk";
  return "Critical";
}

function trendDirection(trend: string | null): number {
  if (!trend) return 0;
  if (/down|declin|worse|drop|fall|neg/i.test(trend)) return -1;
  if (/up|improv|better|rise|gain|pos/i.test(trend)) return 1;
  const n = Number(trend);
  return Number.isFinite(n) ? Math.sign(n) : 0;
}

function synthEvolution(score: number, trend: string | null): number[] {
  const dir = trendDirection(trend);
  const start = Math.max(20, Math.min(100, score - dir * 6));
  return Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    return +(start + (score - start) * t).toFixed(1);
  });
}

function mapRowToEntry(row: Record<string, unknown>, index: number): DriverLeaderboardEntry {
  const scoreTrend = str(row.score_trend);
  const driverId = str(row.driver_id) ?? `mart-driver-${index}`;
  const driverName = str(row.driver_name) ?? `Driver ${index + 1}`;
  const peerPercentile = num(row.peer_percentile);
  const driverScore = row.score == null ? null : num(row.score);
  const drivingScore = Math.round(peerPercentile * 100);
  const contextualScore = driverScore ?? drivingScore;

  return {
    driver_id: driverId,
    driver_name: driverName,
    company_name: str(row.company_name) ?? "—",
    trips_30d: num(row.trips_driven),
    contextual_score: +contextualScore.toFixed(1),
    percentile: drivingScore,
    efficiency_kwh_per_km: num(row.efficiency),
    efficiency_delta_pct: +(trendDirection(scoreTrend) * Math.abs(num(row.score_trend, 0))).toFixed(1),
    difficulty_exposure: num(row.exposure),
    risk_band: mapBand(str(row.score_band), contextualScore),
    harsh_braking: num(row.braking_density),
    harsh_accel: 0,
    overspeed: num(row.overspeed_density),
    distraction: num(row.distraction_density),
    drowsiness: num(row.fatigue_density),
    seatbelt_violation: 0,
    phone_use: 0,
    score_evolution: synthEvolution(contextualScore, scoreTrend),
    extras: {
      rank: row.rank == null ? null : Math.round(num(row.rank)),
      snapshotDate: str(row.snapshot_date),
      windowStartDate: str(row.window_start_date),
      windowEndDate: str(row.window_end_date),
      tripsScored: row.trips_scored == null ? null : num(row.trips_scored),
      tripsPeerScored: row.trips_peer_scored == null ? null : num(row.trips_peer_scored),
      peerScoreCoveragePct: row.peer_score_coverage_pct == null ? null : num(row.peer_score_coverage_pct),
      scoreTrend,
      starsPerTripWeighted: row.stars_per_trip_weighted == null ? null : num(row.stars_per_trip_weighted),
      highRiskRatio: row.high_risk_ratio == null ? null : num(row.high_risk_ratio),
      fatigueDensity: row.fatigue_density == null ? null : num(row.fatigue_density),
      dominantRisk: str(row.dominant_risk),
      coachingModule: str(row.coaching_module),
      coachingTrigger: str(row.coaching_trigger),
      incentiveEligible: bool(row.incentive_eligible),
      reviewRequired: bool(row.review_required),
      rawScoreBand: str(row.score_band),
    },
  };
}

/**
 * Fetches the driver leaderboard from mart_driver_leaderboard and maps it to the
 * DriverScore shape used by the Driver Intelligence UI, carrying mart-only extras.
 */
export async function fetchDriverLeaderboard(limit = 50): Promise<DriverLeaderboardEntry[]> {
  const sql = `
    SELECT *
    FROM mart_driver_leaderboard
    ORDER BY rank ASC
    LIMIT ${limit}
  `;

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetDriverLeaderboard($sql: String!) {
        sqlQuery(sql: $sql)
      }`,
      variables: { sql },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch driver leaderboard: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  const rows = parseSqlQueryResult<Record<string, unknown>>(json.data?.sqlQuery);
  return rows.map(mapRowToEntry);
}
