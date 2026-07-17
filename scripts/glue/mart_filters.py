"""
AWS Glue job: build gold_db.mart_filters

Canonical dimension / filter lookup table for Fleet Insights Pro.
One row per (filter_type, filter_key) with optional parent scope and labels.

Job parameters (Glue advanced properties or --key value):
  --JOB_NAME            Glue job name (required by Glue)
  --GOLD_DATABASE       Glue catalog database, default: gold_db
  --GOLD_CATALOG        Iceberg/Glue catalog name, default: glue_catalog
  --OUTPUT_PATH         S3 prefix for parquet, e.g. s3://datalake/gold/mart_filters/
  --WRITE_MODE          overwrite | append  (default: overwrite)

Deploy: attach this script to a Glue 4.0 / Spark 3.3 PySpark job with
        `--additional-python-modules` only if you add extra deps (none required).
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone

from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.sql import DataFrame, SparkSession, Window, functions as F
from pyspark.sql.types import IntegerType, LongType, StringType, TimestampType

# ---------------------------------------------------------------------------
# Glue bootstrap
# ---------------------------------------------------------------------------

def _opt_arg(name: str, default: str) -> str:
    flag = f"--{name}"
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


required = ["JOB_NAME"]
args = getResolvedOptions(sys.argv, required)

GOLD_DATABASE = _opt_arg("GOLD_DATABASE", "gold_db")
GOLD_CATALOG = _opt_arg("GOLD_CATALOG", "glue_catalog")
OUTPUT_PATH = _opt_arg("OUTPUT_PATH", f"s3://REPLACE_ME/gold/{GOLD_DATABASE}/mart_filters/")
WRITE_MODE = _opt_arg("WRITE_MODE", "overwrite")

spark: SparkSession = (
    SparkSession.builder.config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")
    .getOrCreate()
)
glue_context = GlueContext(spark.sparkContext)
job = Job(glue_context)
job.init(args["JOB_NAME"], args)

FULL_DB = f"{GOLD_CATALOG}.{GOLD_DATABASE}"
NOW = datetime.now(timezone.utc)

FILTER_SCHEMA = (
    "filter_type STRING, "
    "filter_key STRING, "
    "filter_label STRING, "
    "filter_value_secondary STRING, "
    "parent_type STRING, "
    "parent_key STRING, "
    "sort_order INT, "
    "record_count BIGINT, "
    "source_table STRING, "
    "updated_at TIMESTAMP"
)


def table_exists(qualified: str) -> bool:
    try:
        spark.table(qualified).limit(1).collect()
        return True
    except Exception:
        return False


def safe_sql(name: str) -> str | None:
    qualified = f"{FULL_DB}.{name}"
    return qualified if table_exists(qualified) else None


def stamp(df: DataFrame, source_table: str) -> DataFrame:
    return (
        df.withColumn("source_table", F.lit(source_table))
        .withColumn("updated_at", F.lit(NOW).cast(TimestampType()))
    )


def union_all(dfs: list[DataFrame]) -> DataFrame:
    out = dfs[0]
    for d in dfs[1:]:
        out = out.unionByName(d, allowMissingColumns=True)
    return out


# ---------------------------------------------------------------------------
# Extract helpers — each returns rows in the mart_filters shape
# ---------------------------------------------------------------------------

def extract_companies() -> list[DataFrame]:
    dfs: list[DataFrame] = []

    tef = safe_sql("trip_efficiency_fact")
    if tef:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'company' AS filter_type,
                      CAST(companyname AS STRING) AS filter_key,
                      CAST(companyname AS STRING) AS filter_label,
                      CAST(NULL AS STRING) AS filter_value_secondary,
                      CAST(NULL AS STRING) AS parent_type,
                      CAST(NULL AS STRING) AS parent_key,
                      CAST(0 AS INT) AS sort_order,
                      COUNT(*) AS record_count
                    FROM {tef}
                    WHERE companyname IS NOT NULL AND TRIM(companyname) <> ''
                    GROUP BY companyname
                    """
                ),
                "trip_efficiency_fact",
            )
        )

    mrl = safe_sql("mart_route_leaderboard")
    if mrl:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'company' AS filter_type,
                      CAST(company_id AS STRING) AS filter_key,
                      CAST(company_name AS STRING) AS filter_label,
                      CAST(company_name AS STRING) AS filter_value_secondary,
                      CAST(NULL AS STRING) AS parent_type,
                      CAST(NULL AS STRING) AS parent_key,
                      CAST(0 AS INT) AS sort_order,
                      COUNT(*) AS record_count
                    FROM {mrl}
                    WHERE company_id IS NOT NULL AND TRIM(CAST(company_id AS STRING)) <> ''
                    GROUP BY company_id, company_name
                    """
                ),
                "mart_route_leaderboard",
            )
        )

    mdl = safe_sql("mart_driver_leaderboard")
    if mdl:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'company' AS filter_type,
                      CAST(company_name AS STRING) AS filter_key,
                      CAST(company_name AS STRING) AS filter_label,
                      CAST(NULL AS STRING) AS filter_value_secondary,
                      CAST(NULL AS STRING) AS parent_type,
                      CAST(NULL AS STRING) AS parent_key,
                      CAST(0 AS INT) AS sort_order,
                      COUNT(*) AS record_count
                    FROM {mdl}
                    WHERE company_name IS NOT NULL AND TRIM(company_name) <> ''
                    GROUP BY company_name
                    """
                ),
                "mart_driver_leaderboard",
            )
        )

    dtbf = safe_sql("driver_trip_behavior_fact")
    if dtbf:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'company' AS filter_type,
                      CAST(company_id AS STRING) AS filter_key,
                      COALESCE(CAST(company_name AS STRING), CAST(company_id AS STRING)) AS filter_label,
                      CAST(company_name AS STRING) AS filter_value_secondary,
                      CAST(NULL AS STRING) AS parent_type,
                      CAST(NULL AS STRING) AS parent_key,
                      CAST(0 AS INT) AS sort_order,
                      COUNT(*) AS record_count
                    FROM {dtbf}
                    WHERE company_id IS NOT NULL AND TRIM(CAST(company_id AS STRING)) <> ''
                    GROUP BY company_id, company_name
                    """
                ),
                "driver_trip_behavior_fact",
            )
        )

    return dfs


def extract_drivers() -> list[DataFrame]:
    dfs: list[DataFrame] = []

    tef = safe_sql("trip_efficiency_fact")
    if tef:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'driver' AS filter_type,
                      CAST(driver_name AS STRING) AS filter_key,
                      CAST(driver_name AS STRING) AS filter_label,
                      CAST(NULL AS STRING) AS filter_value_secondary,
                      CAST(NULL AS STRING) AS parent_type,
                      CAST(NULL AS STRING) AS parent_key,
                      CAST(0 AS INT) AS sort_order,
                      COUNT(*) AS record_count
                    FROM {tef}
                    WHERE driver_name IS NOT NULL AND TRIM(driver_name) <> ''
                    GROUP BY driver_name
                    """
                ),
                "trip_efficiency_fact",
            )
        )

    mdl = safe_sql("mart_driver_leaderboard")
    if mdl:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'driver' AS filter_type,
                      CAST(driver_id AS STRING) AS filter_key,
                      CAST(driver_name AS STRING) AS filter_label,
                      CAST(company_name AS STRING) AS filter_value_secondary,
                      'company' AS parent_type,
                      CAST(company_name AS STRING) AS parent_key,
                      CAST(COALESCE(rank, 9999) AS INT) AS sort_order,
                      CAST(trips_driven AS BIGINT) AS record_count
                    FROM {mdl}
                    WHERE driver_id IS NOT NULL AND TRIM(CAST(driver_id AS STRING)) <> ''
                    """
                ),
                "mart_driver_leaderboard",
            )
        )

    return dfs


def extract_routes() -> list[DataFrame]:
    dfs: list[DataFrame] = []

    tef = safe_sql("trip_efficiency_fact")
    if tef:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'route' AS filter_type,
                      CAST(route_code AS STRING) AS filter_key,
                      COALESCE(CAST(route_name AS STRING), CAST(route_code AS STRING)) AS filter_label,
                      CAST(route_name AS STRING) AS filter_value_secondary,
                      CAST(companyname AS STRING) AS parent_type,
                      CAST(companyname AS STRING) AS parent_key,
                      CAST(0 AS INT) AS sort_order,
                      COUNT(*) AS record_count
                    FROM {tef}
                    WHERE route_code IS NOT NULL AND TRIM(CAST(route_code AS STRING)) <> ''
                    GROUP BY route_code, route_name, companyname
                    """
                ),
                "trip_efficiency_fact",
            )
        )

    mrl = safe_sql("mart_route_leaderboard")
    if mrl:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'route' AS filter_type,
                      CAST(route_id AS STRING) AS filter_key,
                      COALESCE(CAST(route_name AS STRING), CAST(route_code AS STRING)) AS filter_label,
                      CAST(route_code AS STRING) AS filter_value_secondary,
                      'company' AS parent_type,
                      CAST(company_id AS STRING) AS parent_key,
                      CAST(COALESCE(difficulty_rank, 9999) AS INT) AS sort_order,
                      CAST(trip_count AS BIGINT) AS record_count
                    FROM {mrl}
                    WHERE route_id IS NOT NULL
                    """
                ),
                "mart_route_leaderboard",
            )
        )

    msrm = safe_sql("mart_segment_risk_map")
    if msrm:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'route' AS filter_type,
                      CAST(route_id AS STRING) AS filter_key,
                      COALESCE(CAST(route_name AS STRING), CAST(route_code AS STRING), CONCAT('Route ', route_id)) AS filter_label,
                      CAST(route_code AS STRING) AS filter_value_secondary,
                      'company' AS parent_type,
                      CAST(company_id AS STRING) AS parent_key,
                      CAST(0 AS INT) AS sort_order,
                      COUNT(*) AS record_count
                    FROM {msrm}
                    WHERE route_id IS NOT NULL
                    GROUP BY route_id, route_code, route_name, company_id
                    """
                ),
                "mart_segment_risk_map",
            )
        )

    return dfs


def extract_vehicles() -> list[DataFrame]:
    dfs: list[DataFrame] = []
    tef = safe_sql("trip_efficiency_fact")
    if not tef:
        return dfs

    dfs.append(
        stamp(
            spark.sql(
                f"""
                SELECT
                  'vehicle' AS filter_type,
                  CAST(vehiclenumber AS STRING) AS filter_key,
                  COALESCE(CAST(bus_code AS STRING), CAST(vehiclenumber AS STRING)) AS filter_label,
                  CAST(bus_code AS STRING) AS filter_value_secondary,
                  CAST(companyname AS STRING) AS parent_type,
                  CAST(companyname AS STRING) AS parent_key,
                  CAST(0 AS INT) AS sort_order,
                  COUNT(*) AS record_count
                FROM {tef}
                WHERE vehiclenumber IS NOT NULL AND TRIM(CAST(vehiclenumber AS STRING)) <> ''
                GROUP BY vehiclenumber, bus_code, companyname
                """
            ),
            "trip_efficiency_fact",
        )
    )
    return dfs


def extract_vehicle_sizes() -> list[DataFrame]:
    dfs: list[DataFrame] = []

    mrl = safe_sql("mart_route_leaderboard")
    if mrl:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'vehicle_size' AS filter_type,
                      CAST(dominant_vehicle_size AS STRING) AS filter_key,
                      CAST(dominant_vehicle_size AS STRING) AS filter_label,
                      CAST(NULL AS STRING) AS filter_value_secondary,
                      CAST(NULL AS STRING) AS parent_type,
                      CAST(NULL AS STRING) AS parent_key,
                      CAST(0 AS INT) AS sort_order,
                      COUNT(*) AS record_count
                    FROM {mrl}
                    WHERE dominant_vehicle_size IS NOT NULL AND TRIM(CAST(dominant_vehicle_size AS STRING)) <> ''
                    GROUP BY dominant_vehicle_size
                    """
                ),
                "mart_route_leaderboard",
            )
        )

    dtbf = safe_sql("driver_trip_behavior_fact")
    if dtbf:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'vehicle_size' AS filter_type,
                      CAST(vehicle_size AS STRING) AS filter_key,
                      CAST(vehicle_size AS STRING) AS filter_label,
                      CAST(NULL AS STRING) AS filter_value_secondary,
                      'company' AS parent_type,
                      CAST(company_id AS STRING) AS parent_key,
                      CAST(0 AS INT) AS sort_order,
                      COUNT(*) AS record_count
                    FROM {dtbf}
                    WHERE vehicle_size IS NOT NULL AND TRIM(CAST(vehicle_size AS STRING)) <> ''
                    GROUP BY vehicle_size, company_id
                    """
                ),
                "driver_trip_behavior_fact",
            )
        )

    return dfs


def extract_depots_and_battery() -> list[DataFrame]:
    dfs: list[DataFrame] = []
    cyc = safe_sql("cycle")
    if not cyc:
        return dfs

    dfs.append(
        stamp(
            spark.sql(
                f"""
                SELECT
                  'depot' AS filter_type,
                  CAST(depot AS STRING) AS filter_key,
                  CAST(depot AS STRING) AS filter_label,
                  CAST(spv AS STRING) AS filter_value_secondary,
                  CAST(NULL AS STRING) AS parent_type,
                  CAST(NULL AS STRING) AS parent_key,
                  CAST(0 AS INT) AS sort_order,
                  COUNT(*) AS record_count
                FROM {cyc}
                WHERE depot IS NOT NULL AND TRIM(CAST(depot AS STRING)) <> ''
                GROUP BY depot, spv
                """
            ),
            "cycle",
        )
    )

    dfs.append(
        stamp(
            spark.sql(
                f"""
                SELECT
                  'spv' AS filter_type,
                  CAST(spv AS STRING) AS filter_key,
                  CAST(spv AS STRING) AS filter_label,
                  CAST(depot AS STRING) AS filter_value_secondary,
                  CAST(NULL AS STRING) AS parent_type,
                  CAST(NULL AS STRING) AS parent_key,
                  CAST(0 AS INT) AS sort_order,
                  COUNT(*) AS record_count
                FROM {cyc}
                WHERE spv IS NOT NULL AND TRIM(CAST(spv AS STRING)) <> ''
                GROUP BY spv, depot
                """
            ),
            "cycle",
        )
    )

    dfs.append(
        stamp(
            spark.sql(
                f"""
                SELECT
                  'vehicle_type' AS filter_type,
                  CAST(vehicle_type AS STRING) AS filter_key,
                  CAST(vehicle_type AS STRING) AS filter_label,
                  CAST(depot AS STRING) AS filter_value_secondary,
                  'depot' AS parent_type,
                  CAST(depot AS STRING) AS parent_key,
                  CAST(0 AS INT) AS sort_order,
                  COUNT(*) AS record_count
                FROM {cyc}
                WHERE vehicle_type IS NOT NULL AND TRIM(CAST(vehicle_type AS STRING)) <> ''
                GROUP BY vehicle_type, depot
                """
            ),
            "cycle",
        )
    )

    dfs.append(
        stamp(
            spark.sql(
                f"""
                SELECT
                  'health_band' AS filter_type,
                  CAST(health_band AS STRING) AS filter_key,
                  CAST(health_band AS STRING) AS filter_label,
                  CAST(depot AS STRING) AS filter_value_secondary,
                  'depot' AS parent_type,
                  CAST(depot AS STRING) AS parent_key,
                  CAST(0 AS INT) AS sort_order,
                  COUNT(*) AS record_count
                FROM {cyc}
                WHERE health_band IS NOT NULL AND TRIM(CAST(health_band AS STRING)) <> ''
                GROUP BY health_band, depot
                """
            ),
            "cycle",
        )
    )

    return dfs


def extract_segment_risk_dims() -> list[DataFrame]:
    dfs: list[DataFrame] = []
    msrm = safe_sql("mart_segment_risk_map")
    if not msrm:
        return dfs

    dfs.append(
        stamp(
            spark.sql(
                f"""
                SELECT
                  'risk_level' AS filter_type,
                  LOWER(CAST(risk_level AS STRING)) AS filter_key,
                  INITCAP(LOWER(CAST(risk_level AS STRING))) AS filter_label,
                  CAST(NULL AS STRING) AS filter_value_secondary,
                  CAST(NULL AS STRING) AS parent_type,
                  CAST(NULL AS STRING) AS parent_key,
                  CASE LOWER(CAST(risk_level AS STRING))
                    WHEN 'low' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'high' THEN 3
                    WHEN 'critical' THEN 4
                    ELSE 9
                  END AS sort_order,
                  COUNT(*) AS record_count
                FROM {msrm}
                WHERE risk_level IS NOT NULL AND TRIM(CAST(risk_level AS STRING)) <> ''
                GROUP BY risk_level
                """
            ),
            "mart_segment_risk_map",
        )
    )

    dfs.append(
        stamp(
            spark.sql(
                f"""
                SELECT
                  'route_context' AS filter_type,
                  LOWER(CAST(route_context_label AS STRING)) AS filter_key,
                  INITCAP(LOWER(CAST(route_context_label AS STRING))) AS filter_label,
                  CAST(NULL AS STRING) AS filter_value_secondary,
                  CAST(NULL AS STRING) AS parent_type,
                  CAST(NULL AS STRING) AS parent_key,
                  CASE LOWER(CAST(route_context_label AS STRING))
                    WHEN 'easy' THEN 1
                    WHEN 'medium' THEN 2
                    WHEN 'hard' THEN 3
                    ELSE 9
                  END AS sort_order,
                  COUNT(*) AS record_count
                FROM {msrm}
                WHERE route_context_label IS NOT NULL AND TRIM(CAST(route_context_label AS STRING)) <> ''
                GROUP BY route_context_label
                """
            ),
            "mart_segment_risk_map",
        )
    )

    return dfs


def extract_driver_leaderboard_dims() -> list[DataFrame]:
    dfs: list[DataFrame] = []
    mdl = safe_sql("mart_driver_leaderboard")
    if not mdl:
        return dfs

    dfs.append(
        stamp(
            spark.sql(
                f"""
                SELECT
                  'score_band' AS filter_type,
                  CAST(score_band AS STRING) AS filter_key,
                  CAST(score_band AS STRING) AS filter_label,
                  CAST(NULL AS STRING) AS filter_value_secondary,
                  CAST(NULL AS STRING) AS parent_type,
                  CAST(NULL AS STRING) AS parent_key,
                  CAST(0 AS INT) AS sort_order,
                  COUNT(*) AS record_count
                FROM {mdl}
                WHERE score_band IS NOT NULL AND TRIM(CAST(score_band AS STRING)) <> ''
                GROUP BY score_band
                """
            ),
            "mart_driver_leaderboard",
        )
    )

    dfs.append(
        stamp(
            spark.sql(
                f"""
                SELECT
                  'coaching_module' AS filter_type,
                  CAST(coaching_module AS STRING) AS filter_key,
                  CAST(coaching_module AS STRING) AS filter_label,
                  CAST(coaching_trigger AS STRING) AS filter_value_secondary,
                  CAST(NULL AS STRING) AS parent_type,
                  CAST(NULL AS STRING) AS parent_key,
                  CAST(0 AS INT) AS sort_order,
                  COUNT(*) AS record_count
                FROM {mdl}
                WHERE coaching_module IS NOT NULL AND TRIM(CAST(coaching_module AS STRING)) <> ''
                GROUP BY coaching_module, coaching_trigger
                """
            ),
            "mart_driver_leaderboard",
        )
    )

    return dfs


def extract_time_and_behavior() -> list[DataFrame]:
    dfs: list[DataFrame] = []

    mrl = safe_sql("mart_route_leaderboard")
    if mrl:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'time_bucket' AS filter_type,
                      CAST(peak_time_bucket AS STRING) AS filter_key,
                      CAST(peak_time_bucket AS STRING) AS filter_label,
                      CAST(NULL AS STRING) AS filter_value_secondary,
                      CAST(NULL AS STRING) AS parent_type,
                      CAST(NULL AS STRING) AS parent_key,
                      CAST(0 AS INT) AS sort_order,
                      COUNT(*) AS record_count
                    FROM {mrl}
                    WHERE peak_time_bucket IS NOT NULL AND TRIM(CAST(peak_time_bucket AS STRING)) <> ''
                    GROUP BY peak_time_bucket
                    """
                ),
                "mart_route_leaderboard",
            )
        )

    dtbf = safe_sql("driver_trip_behavior_fact")
    if dtbf:
        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'time_bucket' AS filter_type,
                      CAST(time_bucket AS STRING) AS filter_key,
                      CAST(time_bucket AS STRING) AS filter_label,
                      CAST(NULL AS STRING) AS filter_value_secondary,
                      'company' AS parent_type,
                      CAST(company_id AS STRING) AS parent_key,
                      CAST(0 AS INT) AS sort_order,
                      COUNT(*) AS record_count
                    FROM {dtbf}
                    WHERE time_bucket IS NOT NULL AND TRIM(CAST(time_bucket AS STRING)) <> ''
                    GROUP BY time_bucket, company_id
                    """
                ),
                "driver_trip_behavior_fact",
            )
        )

        dfs.append(
            stamp(
                spark.sql(
                    f"""
                    SELECT
                      'behavior_risk_flag' AS filter_type,
                      UPPER(CAST(behavior_risk_flag AS STRING)) AS filter_key,
                      UPPER(CAST(behavior_risk_flag AS STRING)) AS filter_label,
                      CAST(NULL AS STRING) AS filter_value_secondary,
                      CAST(NULL AS STRING) AS parent_type,
                      CAST(NULL AS STRING) AS parent_key,
                      CASE UPPER(CAST(behavior_risk_flag AS STRING))
                        WHEN 'LOW' THEN 1
                        WHEN 'MEDIUM' THEN 2
                        WHEN 'HIGH' THEN 3
                        ELSE 9
                      END AS sort_order,
                      COUNT(*) AS record_count
                    FROM {dtbf}
                    WHERE behavior_risk_flag IS NOT NULL AND TRIM(CAST(behavior_risk_flag AS STRING)) <> ''
                    GROUP BY behavior_risk_flag
                    """
                ),
                "driver_trip_behavior_fact",
            )
        )

    return dfs


def seed_static_enums() -> DataFrame:
    """UI enums that may not always appear in fact data."""
    rows = [
        ("risk_level", "low", "Low", None, None, None, 1, 0, "static"),
        ("risk_level", "medium", "Medium", None, None, None, 2, 0, "static"),
        ("risk_level", "high", "High", None, None, None, 3, 0, "static"),
        ("risk_level", "critical", "Critical", None, None, None, 4, 0, "static"),
        ("route_context", "easy", "Easy", None, None, None, 1, 0, "static"),
        ("route_context", "medium", "Medium", None, None, None, 2, 0, "static"),
        ("route_context", "hard", "Hard", None, None, None, 3, 0, "static"),
    ]
    cols = [
        "filter_type",
        "filter_key",
        "filter_label",
        "filter_value_secondary",
        "parent_type",
        "parent_key",
        "sort_order",
        "record_count",
        "source_table",
    ]
    return spark.createDataFrame(rows, cols).withColumn("updated_at", F.lit(NOW).cast(TimestampType()))


# ---------------------------------------------------------------------------
# Build + dedupe
# ---------------------------------------------------------------------------

all_parts: list[DataFrame] = []
for builder in (
    extract_companies,
    extract_drivers,
    extract_routes,
    extract_vehicles,
    extract_vehicle_sizes,
    extract_depots_and_battery,
    extract_segment_risk_dims,
    extract_driver_leaderboard_dims,
    extract_time_and_behavior,
):
    parts = builder()
    all_parts.extend(parts)

if not all_parts:
    raise RuntimeError(
        f"No source tables found under {FULL_DB}. "
        "Ensure trip_efficiency_fact or mart_* tables are registered in the Glue catalog."
    )

raw = union_all(all_parts + [seed_static_enums()])

# Prefer rows with higher record_count; break ties by label richness.
deduped = (
    raw.withColumn(
        "label_score",
        F.length(F.coalesce(F.col("filter_label"), F.lit("")))
        + F.length(F.coalesce(F.col("filter_value_secondary"), F.lit(""))),
    )
    .withColumn(
        "rn",
        F.row_number().over(
            Window.partitionBy("filter_type", "filter_key", "parent_type", "parent_key").orderBy(
                F.col("record_count").desc(),
                F.col("label_score").desc(),
                F.col("source_table"),
            )
        ),
    )
    .filter(F.col("rn") == 1)
    .drop("rn", "label_score")
    .select(
        "filter_type",
        "filter_key",
        "filter_label",
        "filter_value_secondary",
        "parent_type",
        "parent_key",
        "sort_order",
        "record_count",
        "source_table",
        "updated_at",
    )
    .orderBy("filter_type", "sort_order", "filter_label")
)

# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

(
    deduped.write.format("parquet")
    .mode(WRITE_MODE)
    .option("path", OUTPUT_PATH)
    .saveAsTable(f"{FULL_DB}.mart_filters")
)

# Refresh local DuckDB / analytics API sync target (optional manual step):
# POST /sync/table  { "database": "gold_db", "table": "mart_filters", "target_table": "mart_filters", "physical": true }

row_count = deduped.count()
print(f"mart_filters written: {row_count} rows -> {FULL_DB}.mart_filters @ {OUTPUT_PATH}")

job.commit()
