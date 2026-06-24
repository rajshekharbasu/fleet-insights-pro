import { GRAPHQL_API_URL } from "./config";

export interface SegmentCorrelationRow {
  company_id: string;
  braking_distraction: number | null;
  braking_drowsiness: number | null;
  braking_overspeed: number | null;
  distraction_drowsiness: number | null;
  collision_braking: number | null;
  difficulty_dms: number | null;
  difficulty_braking: number | null;
  braking_hard_turn: number | null;
  route_bucket_count: number;
  snapshot_date: string;
  source: string;
  note: string | null;
}

type CorrelationDim =
  | "braking"
  | "distraction"
  | "drowsiness"
  | "overspeed"
  | "collision"
  | "hard_turn"
  | "difficulty"
  | "dms";

const CORRELATION_DIMS: CorrelationDim[] = [
  "braking",
  "distraction",
  "drowsiness",
  "overspeed",
  "collision",
  "hard_turn",
  "difficulty",
  "dms",
];

const CORRELATION_LABELS: Record<CorrelationDim, string> = {
  braking: "Braking",
  distraction: "Distraction",
  drowsiness: "Drowsy",
  overspeed: "Overspeed",
  collision: "Collision",
  hard_turn: "Hard turn",
  difficulty: "Difficulty",
  dms: "DMS",
};

const PAIR_FIELDS: Partial<Record<string, keyof SegmentCorrelationRow>> = {
  "braking:distraction": "braking_distraction",
  "braking:drowsiness": "braking_drowsiness",
  "braking:overspeed": "braking_overspeed",
  "distraction:drowsiness": "distraction_drowsiness",
  "braking:collision": "collision_braking",
  "difficulty:dms": "difficulty_dms",
  "braking:difficulty": "difficulty_braking",
  "braking:hard_turn": "braking_hard_turn",
};

function pairKey(a: CorrelationDim, b: CorrelationDim): string {
  return [a, b].sort().join(":");
}

/**
 * Builds a symmetric correlation matrix from mart_segment_correlation pairwise columns.
 */
export function buildCorrelationMatrix(row: SegmentCorrelationRow): {
  labels: string[];
  matrix: (number | null)[][];
} {
  const labels = CORRELATION_DIMS.map((d) => CORRELATION_LABELS[d]);
  const matrix = CORRELATION_DIMS.map((a, i) =>
    CORRELATION_DIMS.map((b, j) => {
      if (i === j) return 1;
      const field = PAIR_FIELDS[pairKey(a, b)];
      if (!field) return null;
      const val = row[field];
      return typeof val === "number" ? +val.toFixed(2) : null;
    }),
  );
  return { labels, matrix };
}

/**
 * Fetches pre-computed segment risk correlations from mart_segment_correlation.
 */
export async function fetchMartSegmentCorrelation(
  companyId?: string,
): Promise<SegmentCorrelationRow | null> {
  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetMartSegmentCorrelation($companyId: String) {
        martSegmentCorrelation(companyId: $companyId, limit: 1) {
          companyId
          brakingDistraction
          brakingDrowsiness
          brakingOverspeed
          distractionDrowsiness
          collisionBraking
          difficultyDms
          difficultyBraking
          brakingHardTurn
          routeBucketCount
          snapshotDate
          source
          note
        }
      }`,
      variables: { companyId: companyId ?? null },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch segment correlation: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  const items = json.data?.martSegmentCorrelation ?? [];
  if (items.length === 0) return null;

  const item = items[0];
  return {
    company_id: item.companyId,
    braking_distraction: item.brakingDistraction ?? null,
    braking_drowsiness: item.brakingDrowsiness ?? null,
    braking_overspeed: item.brakingOverspeed ?? null,
    distraction_drowsiness: item.distractionDrowsiness ?? null,
    collision_braking: item.collisionBraking ?? null,
    difficulty_dms: item.difficultyDms ?? null,
    difficulty_braking: item.difficultyBraking ?? null,
    braking_hard_turn: item.brakingHardTurn ?? null,
    route_bucket_count: item.routeBucketCount ?? 0,
    snapshot_date: item.snapshotDate,
    source: item.source ?? "",
    note: item.note ?? null,
  };
}
