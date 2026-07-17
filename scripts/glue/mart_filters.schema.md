# `mart_filters` — Fleet Insights filter dimension mart

Long/narrow lookup table that centralizes every dropdown / filter value used across Fleet Insights Pro. Replaces ad-hoc `SELECT DISTINCT …` queries against `trip_efficiency_fact` and per-page mart queries.

## Table

| Column | Type | Description |
|--------|------|-------------|
| `filter_type` | `STRING` | Dimension name (see below) |
| `filter_key` | `STRING` | Value used in API / SQL `WHERE` clauses |
| `filter_label` | `STRING` | Primary UI label |
| `filter_value_secondary` | `STRING` | Subtitle (e.g. route name when key is `route_code`) |
| `parent_type` | `STRING` | Optional parent dimension (`company`, `depot`, …) |
| `parent_key` | `STRING` | Parent scope id/name |
| `sort_order` | `INT` | Display order within `filter_type` |
| `record_count` | `BIGINT` | Popularity / volume hint from source |
| `source_table` | `STRING` | Provenance table |
| `updated_at` | `TIMESTAMP` | ETL run timestamp (UTC) |

**Primary key (logical):** `(filter_type, filter_key, parent_type, parent_key)`

## Filter types

| `filter_type` | Used by | Source table(s) |
|---------------|---------|-----------------|
| `company` | FilterBar, routes, drivers, segments | `trip_efficiency_fact`, `mart_route_leaderboard`, `mart_driver_leaderboard`, `driver_trip_behavior_fact` |
| `driver` | FilterBar, drivers | `trip_efficiency_fact`, `mart_driver_leaderboard` |
| `route` | FilterBar, routes, segments | `trip_efficiency_fact`, `mart_route_leaderboard`, `mart_segment_risk_map` |
| `vehicle` | FilterBar, pivot | `trip_efficiency_fact` |
| `vehicle_size` | Route compare, trip drill-down | `mart_route_leaderboard`, `driver_trip_behavior_fact` |
| `depot` | Battery cycles (company scope) | `cycle` |
| `spv` | Battery cycles | `cycle` |
| `vehicle_type` | Battery fleet mix | `cycle` |
| `health_band` | Battery health view | `cycle` |
| `risk_level` | Segment risk map | `mart_segment_risk_map` + static seed |
| `route_context` | Segment difficulty filter | `mart_segment_risk_map` + static seed |
| `score_band` | Driver leaderboard | `mart_driver_leaderboard` |
| `coaching_module` | Driver coaching queue | `mart_driver_leaderboard` |
| `time_bucket` | Route / trip behavior | `mart_route_leaderboard`, `driver_trip_behavior_fact` |
| `behavior_risk_flag` | Trip-level risk | `driver_trip_behavior_fact` |

## Example queries

```sql
-- Shared FilterBar options (matches fetchFilterOptions intent)
SELECT filter_key, filter_label, filter_value_secondary
FROM mart_filters
WHERE filter_type = 'company'
ORDER BY record_count DESC, filter_label;

-- Routes for one company
SELECT filter_key AS route_id, filter_label, filter_value_secondary AS route_code
FROM mart_filters
WHERE filter_type = 'route' AND parent_key = 'MBMT';

-- Segment risk dropdowns
SELECT * FROM mart_filters WHERE filter_type IN ('risk_level', 'route_context')
ORDER BY sort_order;
```

## Glue job

- **Script:** `scripts/glue/mart_filters.py`
- **Target:** `glue_catalog.gold_db.mart_filters`
- **Schedule:** daily after gold fact/mart jobs (or on-demand before API sync)

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `GOLD_DATABASE` | `gold_db` | Glue database |
| `GOLD_CATALOG` | `glue_catalog` | Catalog name |
| `OUTPUT_PATH` | `s3://…/gold/gold_db/mart_filters/` | Parquet location |
| `WRITE_MODE` | `overwrite` | Full refresh |

### Post-deploy sync (Fleet Analytics API)

```json
{
  "database": "gold_db",
  "table": "mart_filters",
  "target_table": "mart_filters",
  "physical": true
}
```
