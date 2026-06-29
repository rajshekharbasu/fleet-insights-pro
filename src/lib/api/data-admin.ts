import { apiDelete, apiGet, apiPost, apiPostBlob } from "./client";

/* ------------------------------- System ------------------------------------ */
export interface HealthResponse {
  status: string;
  db_ok: boolean;
  glue_available: boolean;
}

export interface MemoryStat {
  tag: string;
  memory_usage_bytes: number;
  temporary_storage_bytes: number;
}

export interface StatsResponse {
  db_file_mb: number;
  memory: MemoryStat[];
  iceberg_views: string[];
}

export const getHealth = () => apiGet<HealthResponse>("/health");
export const getStats = () => apiGet<StatsResponse>("/stats");
export const refreshIceberg = () => apiPost<unknown>("/refresh");

/* ------------------------------- Schema ------------------------------------ */
export interface LocalTable {
  table_name: string;
  table_type: string; // "BASE TABLE" | "VIEW"
  column_count: number;
}

export const listTables = () => apiGet<LocalTable[]>("/tables");
export const getSchema = () => apiGet<Record<string, unknown>>("/schema");
export const deleteTable = (tableName: string) =>
  apiDelete<unknown>(`/tables/${encodeURIComponent(tableName)}`);

/* -------------------------------- Query ------------------------------------ */
export interface QueryResult {
  rows: Record<string, unknown>[];
  row_count: number;
  columns: string[];
  elapsed_ms: number;
}

export const runQuery = (sql: string, limit = 10000) =>
  apiPost<QueryResult>("/query", { sql, limit });

export const exportQueryCsv = (sql: string, limit = 100000) =>
  apiPostBlob("/query/export", { sql, limit });

/* --------------------------------- Sync ------------------------------------ */
export const listRemoteDatabases = () => apiGet<string[]>("/remote/databases");

export const listRemoteTables = (database: string) =>
  apiGet<string[]>(`/remote/tables?database=${encodeURIComponent(database)}`);

export interface SyncTableRequest {
  database: string;
  table: string;
  target_table: string;
  physical: boolean;
}

export interface SyncTableResult {
  status?: string;
  database?: string;
  table?: string;
  target_table?: string;
  rows_synced?: number;
  elapsed_ms?: number;
  physical?: boolean;
  [key: string]: unknown;
}

export const syncTable = (body: SyncTableRequest) =>
  apiPost<SyncTableResult>("/sync/table", body);

export interface SyncDatabaseRequest {
  database: string;
  tables?: string[] | null;
}

export interface SyncDatabaseResult {
  job_id?: string;
  status?: string;
  [key: string]: unknown;
}

export const syncDatabase = (body: SyncDatabaseRequest) =>
  apiPost<SyncDatabaseResult>("/sync/database", body);

/* ------------------------------- Sync jobs --------------------------------- */
export type SyncJobStatus = "running" | "success" | "failed" | "pending" | string;

export interface SyncJobTableDetail {
  status: string;
  database: string;
  table: string;
  target_table: string;
  rows_synced: number;
  elapsed_ms: number;
  error?: string | null;
}

export interface SyncJob {
  job_id: string;
  type: "table" | "database" | string;
  status: SyncJobStatus;
  database: string;
  started_at: string;
  finished_at?: string | null;
  elapsed_ms?: number;
  error?: string | null;
  // table jobs
  target?: string;
  rows_synced?: number;
  // database jobs
  tables?: string[];
  total_tables?: number;
  success_count?: number;
  failed_count?: number;
  total_rows_synced?: number;
  details?: SyncJobTableDetail[];
}

export const getSyncJobs = () => apiGet<SyncJob[]>("/sync/jobs");
export const getSyncJob = (jobId: string) =>
  apiGet<SyncJob>(`/sync/jobs/${encodeURIComponent(jobId)}`);
