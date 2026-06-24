import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSyncJobs, type SyncJob } from "@/lib/api/data-admin";
import { EmptyState, Panel, relativeTime, StatusBadge } from "./shared";

export function SyncJobsPanel({ apiReady }: { apiReady: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const jobsQuery = useQuery({
    queryKey: ["fleet-api", "sync-jobs"],
    queryFn: getSyncJobs,
    enabled: apiReady,
    refetchInterval: (q) => {
      const data = q.state.data as SyncJob[] | undefined;
      const running = data?.some((j) => j.status === "running" || j.status === "pending");
      return running ? 3_000 : 20_000;
    },
  });

  const jobs = jobsQuery.data ?? [];

  return (
    <Panel
      title="Sync jobs"
      subtitle="Background and table sync history"
      icon={<History className="h-[18px] w-[18px]" />}
      actions={
        <Button variant="outline" size="sm" disabled={!apiReady || jobsQuery.isFetching}
          onClick={() => jobsQuery.refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 ${jobsQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {!apiReady ? (
        <EmptyState message="Set an API key to view sync jobs." />
      ) : jobsQuery.isLoading ? (
        <EmptyState message="Loading jobs…" />
      ) : jobsQuery.error ? (
        <EmptyState message={(jobsQuery.error as Error).message} />
      ) : jobs.length === 0 ? (
        <EmptyState message="No sync jobs yet." />
      ) : (
        <ul className="max-h-[460px] divide-y divide-border/40 overflow-auto">
          {jobs.map((job) => {
            const isDb = job.type === "database";
            const rows = isDb ? job.total_rows_synced : job.rows_synced;
            const open = expanded === job.job_id;
            return (
              <li key={job.job_id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <StatusBadge status={job.status} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className="font-medium">
                        {isDb ? `${job.database} · ${job.total_tables ?? job.tables?.length ?? 0} tables` : job.target}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {job.type}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      {relativeTime(job.started_at)}
                      {rows != null && ` · ${rows.toLocaleString()} rows`}
                      {job.elapsed_ms != null && ` · ${job.elapsed_ms}ms`}
                      {isDb && job.failed_count != null && job.failed_count > 0 && (
                        <span className="text-destructive"> · {job.failed_count} failed</span>
                      )}
                    </div>
                  </div>
                  {isDb && job.details?.length ? (
                    <Button variant="ghost" size="sm" className="h-7 px-2"
                      onClick={() => setExpanded(open ? null : job.job_id)}>
                      <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    </Button>
                  ) : null}
                </div>

                {job.error && (
                  <div className="mt-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11.5px] text-destructive">
                    {job.error}
                  </div>
                )}

                {isDb && open && job.details && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-border/60">
                    <table className="w-full text-[11.5px]">
                      <thead className="bg-muted/60">
                        <tr className="text-left text-muted-foreground">
                          <th className="px-3 py-1.5 font-medium">Table</th>
                          <th className="px-3 py-1.5 font-medium">Status</th>
                          <th className="px-3 py-1.5 text-right font-medium">Rows</th>
                          <th className="px-3 py-1.5 text-right font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.details.map((d) => (
                          <tr key={d.table} className="border-t border-border/40">
                            <td className="px-3 py-1.5 font-mono">{d.target_table || d.table}</td>
                            <td className="px-3 py-1.5"><StatusBadge status={d.status} /></td>
                            <td className="px-3 py-1.5 text-right num">{d.rows_synced?.toLocaleString() ?? "—"}</td>
                            <td className="px-3 py-1.5 text-right num text-muted-foreground">{d.elapsed_ms}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
