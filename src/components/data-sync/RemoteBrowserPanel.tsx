import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudDownload, Database, Layers, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listRemoteDatabases, listRemoteTables, syncDatabase, syncTable,
} from "@/lib/api/data-admin";
import { EmptyState, Panel } from "./shared";

const PREFERRED_DB = "gold_db";

export function RemoteBrowserPanel({ apiReady, onSynced }: { apiReady: boolean; onSynced: () => void }) {
  const qc = useQueryClient();
  const [database, setDatabase] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogTable, setDialogTable] = useState<string | null>(null);

  const dbQuery = useQuery({
    queryKey: ["fleet-api", "remote-databases"],
    queryFn: listRemoteDatabases,
    enabled: apiReady,
  });

  useEffect(() => {
    if (!database && dbQuery.data?.length) {
      setDatabase(dbQuery.data.includes(PREFERRED_DB) ? PREFERRED_DB : dbQuery.data[0]);
    }
  }, [dbQuery.data, database]);

  const tablesQuery = useQuery({
    queryKey: ["fleet-api", "remote-tables", database],
    queryFn: () => listRemoteTables(database),
    enabled: apiReady && !!database,
  });

  useEffect(() => { setSelected(new Set()); }, [database]);

  const filtered = useMemo(() => {
    const list = tablesQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? list.filter((t) => t.toLowerCase().includes(q)) : list;
  }, [tablesQuery.data, search]);

  function afterSync() {
    qc.invalidateQueries({ queryKey: ["fleet-api", "tables"] });
    qc.invalidateQueries({ queryKey: ["fleet-api", "sync-jobs"] });
    onSynced();
  }

  const dbSync = useMutation({
    mutationFn: (tables?: string[]) => syncDatabase({ database, tables: tables ?? null }),
    onSuccess: (res, tables) => {
      const n = tables?.length ? `${tables.length} tables` : "all tables";
      toast.success(`Started background sync of ${n} from ${database}.${res.job_id ? ` Job ${res.job_id.slice(0, 8)}…` : ""}`);
      setSelected(new Set());
      afterSync();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(table: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table); else next.add(table);
      return next;
    });
  }

  return (
    <Panel
      title="Remote catalog"
      subtitle="Browse the Glue catalog and sync marts into DuckDB"
      icon={<Layers className="h-[18px] w-[18px]" />}
      actions={
        <Button variant="outline" size="sm" disabled={!apiReady || tablesQuery.isFetching}
          onClick={() => tablesQuery.refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 ${tablesQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {!apiReady ? (
        <EmptyState message="Set an API key to browse remote databases." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <Select value={database} onValueChange={setDatabase}>
                <SelectTrigger className="h-8 w-[200px] text-[13px]">
                  <SelectValue placeholder={dbQuery.isLoading ? "Loading…" : "Select database"} />
                </SelectTrigger>
                <SelectContent>
                  {(dbQuery.data ?? []).map((db) => (
                    <SelectItem key={db} value={db}>{db}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter tables…" className="h-8 pl-8 text-[13px]" />
            </div>
            <Button size="sm" variant="secondary" disabled={selected.size === 0 || dbSync.isPending}
              onClick={() => dbSync.mutate(Array.from(selected))}>
              <CloudDownload className="h-3.5 w-3.5" />
              Sync selected ({selected.size})
            </Button>
            <Button size="sm" disabled={!database || dbSync.isPending}
              onClick={() => dbSync.mutate(undefined)}>
              <CloudDownload className="h-3.5 w-3.5" />
              Sync entire DB
            </Button>
          </div>

          <div className="max-h-[420px] overflow-auto">
            {tablesQuery.isLoading ? (
              <EmptyState message="Loading remote tables…" />
            ) : tablesQuery.error ? (
              <EmptyState message={(tablesQuery.error as Error).message} />
            ) : filtered.length === 0 ? (
              <EmptyState message="No tables found." />
            ) : (
              <ul className="divide-y divide-border/40">
                {filtered.map((t) => (
                  <li key={t} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                    <Checkbox checked={selected.has(t)} onCheckedChange={() => toggle(t)} />
                    <span className="flex-1 font-mono text-[12.5px]">{t}</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-primary hover:text-primary"
                      onClick={() => setDialogTable(t)}>
                      <CloudDownload className="h-3.5 w-3.5" /> Sync
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <SyncTableDialog
        database={database}
        table={dialogTable}
        onClose={() => setDialogTable(null)}
        onDone={afterSync}
      />
    </Panel>
  );
}

function SyncTableDialog({
  database, table, onClose, onDone,
}: {
  database: string; table: string | null; onClose: () => void; onDone: () => void;
}) {
  const [physical, setPhysical] = useState(true);
  const [targetName, setTargetName] = useState("");

  useEffect(() => {
    if (table) { setPhysical(true); setTargetName(""); }
  }, [table]);

  const mut = useMutation({
    mutationFn: () => syncTable({
      database,
      table: table!,
      target_table: targetName.trim() || table!,
      physical,
    }),
    onSuccess: (res) => {
      const rows = res.rows_synced != null ? ` · ${res.rows_synced} rows` : "";
      toast.success(`Synced “${res.target_table ?? table}”${physical ? "" : " (reference)"}${rows}.`);
      onClose();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!table} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudDownload className="h-4 w-4" /> Sync table
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono">{database}.{table}</span> → DuckDB
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
            <div>
              <div className="text-[13px] font-medium">Physical load — materialize data locally</div>
              <p className="text-[12px] text-muted-foreground">
                {physical
                  ? "Loads a full physical copy of the data locally for fast queries."
                  : "Reference only — creates a live view, no data copied, always reads remote."}
              </p>
            </div>
            <Switch checked={physical} onCheckedChange={setPhysical} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target">Local table name (optional)</Label>
            <Input id="target" value={targetName} onChange={(e) => setTargetName(e.target.value)}
              placeholder={table ?? "target_table"} className="font-mono text-[13px]" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Syncing…" : physical ? "Load table" : "Create reference"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
