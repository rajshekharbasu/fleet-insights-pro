import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/layout/AppNav";
import { Button } from "@/components/ui/button";
import { hasApiKey } from "@/lib/api/config";
import { refreshIceberg } from "@/lib/api/data-admin";
import { ApiKeyControl } from "@/components/data-sync/ApiKeyControl";
import { StatusStrip } from "@/components/data-sync/StatusStrip";
import { LocalTablesPanel } from "@/components/data-sync/LocalTablesPanel";
import { RemoteBrowserPanel } from "@/components/data-sync/RemoteBrowserPanel";
import { SyncJobsPanel } from "@/components/data-sync/SyncJobsPanel";
import { canAccessDataSync, getCurrentUser, type AuthUser } from "@/lib/auth";

export const Route = createFileRoute("/data-sync")({
  head: () => ({
    meta: [
      { title: "Data Sync · Voltline" },
      { name: "description", content: "Browse remote catalogs, sync marts and manage the DuckDB warehouse." },
    ],
  }),
  component: DataSyncPage,
});

function DataSyncPage() {
  const qc = useQueryClient();
  const [apiReady, setApiReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => { setApiReady(hasApiKey()); }, []);
  useEffect(() => {
    setUser(getCurrentUser());
    setAuthChecked(true);
  }, []);

  const allowed = canAccessDataSync(user);

  const refresh = useMutation({
    mutationFn: refreshIceberg,
    onSuccess: () => {
      toast.success("Reloaded Glue Iceberg views.");
      qc.invalidateQueries({ queryKey: ["fleet-api"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authChecked && !allowed) {
    return <DataSyncRestricted user={user} />;
  }

  return (
    <PageShell
      eyebrow="Live · Fleet Analytics API"
      title="Data Sync"
      description="Browse the remote Glue catalog, load tables and keep DuckDB marts in sync with your lakehouse."
      meta={
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={!apiReady || refresh.isPending} onClick={() => refresh.mutate()}>
            <RefreshCcw className={`h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`} />
            Refresh views
          </Button>
          <ApiKeyControl onChange={() => setApiReady(hasApiKey())} />
        </div>
      }
    >
      <StatusStrip apiReady={apiReady} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <RemoteBrowserPanel apiReady={apiReady} onSynced={() => { /* handled via query invalidation */ }} />
        <LocalTablesPanel apiReady={apiReady} />
      </div>

      <SyncJobsPanel apiReady={apiReady} />
    </PageShell>
  );
}

function DataSyncRestricted({ user }: { user: AuthUser | null }) {
  return (
    <PageShell bare>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
            <ShieldAlert className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
            Data Sync is restricted
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {user
              ? `Your account (${user.email}) doesn't have access to Data Sync. This area is limited to authorised data administrators.`
              : "You need to sign in with an authorised account to access Data Sync."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2.5">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Back to Trip Efficiency
            </Link>
            {!user && (
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Lock className="h-4 w-4" />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
