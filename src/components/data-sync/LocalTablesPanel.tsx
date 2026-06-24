import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, RefreshCw, Search, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteTable, listTables, runQuery, type LocalTable } from "@/lib/api/data-admin";
import { EmptyState, Panel } from "./shared";

export function LocalTablesPanel({ apiReady }: { apiReady: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const tablesQuery = useQuery({
    queryKey: ["fleet-api", "tables"],
    queryFn: listTables,
    enabled: apiReady,
  });

  const del = useMutation({
    mutationFn: (name: string) => deleteTable(name),
    onSuccess: (_d, name) => {
      toast.success(`Dropped “${name}”.`);
      qc.invalidateQueries({ queryKey: ["fleet-api", "tables"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingDelete(null),
  });

  const filtered = useMemo(() => {
    const list = tablesQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? list.filter((t) => t.table_name.toLowerCase().includes(q)) : list;
  }, [tablesQuery.data, search]);

  return (
    <Panel
      title="Local catalog"
      subtitle="Tables and views materialised in DuckDB"
      icon={<Table2 className="h-[18px] w-[18px]" />}
      actions={
        <Button variant="outline" size="sm" disabled={!apiReady || tablesQuery.isFetching}
          onClick={() => tablesQuery.refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 ${tablesQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {!apiReady ? (
        <EmptyState message="Set an API key to load tables." />
      ) : tablesQuery.isLoading ? (
        <EmptyState message="Loading tables…" />
      ) : tablesQuery.error ? (
        <EmptyState message={(tablesQuery.error as Error).message} />
      ) : (
        <>
          <div className="border-b border-border/60 px-4 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={`Filter ${tablesQuery.data?.length ?? 0} tables…`} className="h-8 pl-8 text-[13px]" />
            </div>
          </div>
          <div className="max-h-[460px] overflow-auto">
            {filtered.length === 0 ? (
              <EmptyState message="No matching tables." />
            ) : (
              <table className="w-full text-[12.5px]">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Name</th>
                    <th className="px-3 py-2.5 text-left font-medium">Type</th>
                    <th className="px-3 py-2.5 text-right font-medium">Columns</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t: LocalTable) => (
                    <tr key={t.table_name} className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5 font-medium text-foreground">{t.table_name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${
                          t.table_type === "VIEW" ? "bg-chart-2/15 text-chart-2" : "bg-primary/10 text-primary"
                        }`}>
                          {t.table_type === "VIEW" ? "View" : "Table"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right num text-muted-foreground">{t.column_count}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setPreview(t.table_name)}>
                            <Eye className="h-3.5 w-3.5" /> Preview
                          </Button>
                          <Button variant="ghost" size="sm"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => setPendingDelete(t.table_name)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <PreviewSheet table={preview} onClose={() => setPreview(null)} />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop “{pendingDelete}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the table or reference view from DuckDB. You can re-sync it from the remote catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && del.mutate(pendingDelete)}>
              Drop table
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

function PreviewSheet({ table, onClose }: { table: string | null; onClose: () => void }) {
  const preview = useQuery({
    queryKey: ["fleet-api", "preview", table],
    queryFn: () => runQuery(`SELECT * FROM "${table}" LIMIT 50`, 50),
    enabled: !!table,
  });

  return (
    <Sheet open={!!table} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="font-mono text-[14px]">{table}</SheetTitle>
          <SheetDescription>
            {preview.data
              ? `First ${preview.data.rows.length} rows · ${preview.data.columns.length} columns · ${preview.data.elapsed_ms}ms`
              : "Sample of the first 50 rows."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 max-h-[calc(100vh-9rem)] overflow-auto rounded-lg border border-border/60">
          {preview.isLoading ? (
            <EmptyState message="Running query…" />
          ) : preview.error ? (
            <EmptyState message={(preview.error as Error).message} />
          ) : preview.data && preview.data.rows.length > 0 ? (
            <table className="w-full text-[11.5px]">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr>
                  {preview.data.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap border-b border-border/60 px-3 py-2 text-left font-semibold">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/40">
                    {preview.data!.columns.map((c) => (
                      <td key={c} className="max-w-[260px] truncate whitespace-nowrap px-3 py-1.5 font-mono text-[11px]"
                        title={fmtCell(row[c])}>
                        {fmtCell(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No rows." />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function fmtCell(v: unknown): string {
  if (v == null) return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
