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

const COMPANY_BY_ID: Record<number, string> = {
  1: "MBMT",
};

export type AttributeRating = "Excellent" | "Good" | "Average" | "Poor" | string;

/** Pillar mark caps from the Attribute Score v2 spec. */
export const ATTRIBUTE_PILLAR_MAX = {
  accidents: 30,
  soc: 20,
  adas: 20,
  attendance: 15,
  mobile: 10,
  alcohol: 5,
} as const;

export interface DriverAttributePillars {
  accidents: number;
  soc: number;
  adas: number;
  attendance: number;
  mobile: number;
  alcohol: number;
  hardBraking: number;
  hardAccel: number;
  seatbelt: number;
}

export interface DriverAttributeScoreRow {
  driver_id: string;
  driver_name: string;
  company_id: number;
  company_name: string;
  year: number;
  month: number;
  workingDays: number;
  attendancePct: number;
  tripsInMonth: number;
  dutiesInMonth: number;
  kmInMonth: number;
  totalKm: number;
  totalSoc: number;
  socPerKm: number;
  routesDriven: number;
  attendanceScore: number;
  accidentCount: number;
  majorAccidentCount: number;
  accidentScore: number;
  hardBrakingScore: number;
  hardBrakingExcessPct: number;
  hardAccelEvents: number;
  hardAccelScore: number;
  seatbeltScore: number;
  adasScore: number;
  mobileEvents: number;
  mobileScore: number;
  socExcessPct: number;
  socScore: number;
  alcoholScore: number;
  totalAttributeScore: number;
  totalAttributeScoreStraight: number;
  dominantWeakness: string | null;
  weaknessCategory: string | null;
  weaknessMarksLost: number;
  weaknessSeverity: number;
  rank: number;
  rating: AttributeRating;
  marksLost: number;
  processedAt: string | null;
  pillars: DriverAttributePillars;
}

/** Entry shape shared with existing Driver Intelligence UI (score → attribute total). */
export type DriverAttributeLeaderboardEntry = DriverScore & {
  attribute: DriverAttributeScoreRow;
};

function mapRatingToBand(rating: string | null, score: number): DriverScore["risk_band"] {
  const r = (rating ?? "").toLowerCase();
  if (r.includes("excellent")) return "Elite";
  if (r.includes("good")) return "Strong";
  if (r.includes("average")) return "Average";
  if (r.includes("poor")) return "At-risk";
  if (score >= 90) return "Elite";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Average";
  if (score >= 45) return "At-risk";
  return "Critical";
}

function mapRow(row: Record<string, unknown>): DriverAttributeScoreRow {
  const companyId = Math.round(num(row.company_id, 1));
  const score = num(row.totalattributescore);
  return {
    driver_id: str(row.driver_id) ?? String(row.driver_id ?? ""),
    driver_name: (str(row.driver_name) ?? "Unknown").replace(/\s+/g, " ").trim(),
    company_id: companyId,
    company_name: COMPANY_BY_ID[companyId] ?? `Company ${companyId}`,
    year: Math.round(num(row.year)),
    month: Math.round(num(row.month)),
    workingDays: num(row.workingdays),
    attendancePct: num(row.attendancepct),
    tripsInMonth: Math.round(num(row.tripsinmonth)),
    dutiesInMonth: Math.round(num(row.dutiesinmonth)),
    kmInMonth: num(row.kminmonth),
    totalKm: num(row.totalkm),
    totalSoc: num(row.totalsoc),
    socPerKm: num(row.soc_per_km),
    routesDriven: Math.round(num(row.routesdriven)),
    attendanceScore: num(row.attendancescore),
    accidentCount: Math.round(num(row.accidentcount)),
    majorAccidentCount: Math.round(num(row.majoraccidentcount)),
    accidentScore: num(row.accidentscore),
    hardBrakingScore: num(row.hardbrakingscore),
    hardBrakingExcessPct: num(row.hardbrakingexcesspct),
    hardAccelEvents: Math.round(num(row.hardaccelevents)),
    hardAccelScore: num(row.hardaccelscore),
    seatbeltScore: num(row.seatbeltscore),
    adasScore: num(row.adasscore),
    mobileEvents: Math.round(num(row.mobileevents)),
    mobileScore: num(row.mobilescore),
    socExcessPct: num(row.socexcesspct),
    socScore: num(row.socscore),
    alcoholScore: num(row.alcoholscore),
    totalAttributeScore: score,
    totalAttributeScoreStraight: num(row.totalattributescore_straight, score),
    dominantWeakness: str(row.dominantweakness),
    weaknessCategory: str(row.weaknesscategory),
    weaknessMarksLost: num(row.weaknessmarkslost),
    weaknessSeverity: num(row.weaknessseverity),
    rank: Math.round(num(row.rank)),
    rating: (str(row.rating) ?? "Average") as AttributeRating,
    marksLost: num(row.markslost),
    processedAt: str(row.processedat),
    pillars: {
      accidents: num(row.accidentscore),
      soc: num(row.socscore),
      adas: num(row.adasscore),
      attendance: num(row.attendancescore),
      mobile: num(row.mobilescore),
      alcohol: num(row.alcoholscore),
      hardBraking: num(row.hardbrakingscore),
      hardAccel: num(row.hardaccelscore),
      seatbelt: num(row.seatbeltscore),
    },
  };
}

function toLeaderboardEntry(a: DriverAttributeScoreRow): DriverAttributeLeaderboardEntry {
  const score = a.totalAttributeScore;
  return {
    driver_id: a.driver_id,
    driver_name: a.driver_name,
    company_name: a.company_name,
    trips_30d: a.tripsInMonth,
    contextual_score: +score.toFixed(1),
    percentile: Math.max(0, Math.min(100, Math.round(100 - a.marksLost))),
    efficiency_kwh_per_km: a.socPerKm,
    efficiency_delta_pct: a.socExcessPct,
    difficulty_exposure: a.routesDriven,
    risk_band: mapRatingToBand(a.rating, score),
    harsh_braking: a.hardBrakingExcessPct,
    harsh_accel: a.hardAccelEvents,
    overspeed: 0,
    distraction: 0,
    drowsiness: 0,
    seatbelt_violation: ATTRIBUTE_PILLAR_MAX.adas / 3 - a.seatbeltScore > 0 ? 1 : 0,
    phone_use: a.mobileEvents,
    score_evolution: Array.from({ length: 12 }, () => score),
    attribute: a,
  };
}

export interface AttributeScoreMonth {
  year: number;
  month: number;
  label: string;
  count: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatAttributeMonth(year: number, month: number): string {
  return `${MONTH_NAMES[Math.max(0, Math.min(11, month - 1))]} ${year}`;
}

/** Lists available score months (newest first). */
export async function fetchDriverAttributeScoreMonths(): Promise<AttributeScoreMonth[]> {
  const sql = `
    SELECT year, month, COUNT(*) AS n
    FROM driver_attribute_score
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `;

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetAttributeScoreMonths($sql: String!) {
        sqlQuery(sql: $sql)
      }`,
      variables: { sql },
    }),
  });

  if (!res.ok) throw new Error(`Failed to fetch attribute score months: ${res.statusText}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "GraphQL query error");

  const rows = parseSqlQueryResult<Record<string, unknown>>(json.data?.sqlQuery);
  return rows.map((r) => {
    const year = Math.round(num(r.year));
    const month = Math.round(num(r.month));
    return {
      year,
      month,
      label: formatAttributeMonth(year, month),
      count: Math.round(num(r.n)),
    };
  });
}

/**
 * Fetches the monthly Driver Attribute Score leaderboard for a calendar month.
 * Ranked by `rank` ascending (1 = best). All returned rows are already eligible
 * (gates applied upstream — unscored drivers are not in the table).
 */
export async function fetchDriverAttributeScores(
  year: number,
  month: number,
  limit = 200,
): Promise<DriverAttributeLeaderboardEntry[]> {
  const sql = `
    SELECT *
    FROM driver_attribute_score
    WHERE year = ${Math.round(year)}
      AND month = ${Math.round(month)}
    ORDER BY rank ASC
    LIMIT ${limit}
  `;

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetDriverAttributeScores($sql: String!) {
        sqlQuery(sql: $sql)
      }`,
      variables: { sql },
    }),
  });

  if (!res.ok) throw new Error(`Failed to fetch driver attribute scores: ${res.statusText}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "GraphQL query error");

  const rows = parseSqlQueryResult<Record<string, unknown>>(json.data?.sqlQuery);
  return rows.map(mapRow).map(toLeaderboardEntry);
}
