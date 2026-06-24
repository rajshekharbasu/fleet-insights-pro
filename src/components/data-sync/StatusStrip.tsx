import { useQuery } from "@tanstack/react-query";
import { Activity, Database, HardDrive, Layers, Cpu } from "lucide-react";
import { getHealth, getStats } from "@/lib/api/data-admin";
import { formatBytes } from "./shared";

function Pill({ icon, label, value, tone = "default" }: {
  icon: React.ReactNode; label: string; value: string;
  tone?: "default" | "success" | "destructive" | "warning";
}) {
  const toneClass =
    tone === "success" ? "text-success"
      : tone === "destructive" ? "text-destructive"
      : tone === "warning" ? "text-warning"
      : "text-foreground";
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3.5 py-2.5 shadow-elevated">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted/60 text-muted-foreground">{icon}</span>
      <div className="leading-tight">
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
        <div className={`text-[13px] font-semibold ${toneClass}`}>{value}</div>
      </div>
    </div>
  );
}

export function StatusStrip({ apiReady }: { apiReady: boolean }) {
  const health = useQuery({
    queryKey: ["fleet-api", "health"],
    queryFn: getHealth,
    enabled: apiReady,
    refetchInterval: 30_000,
  });
  const stats = useQuery({
    queryKey: ["fleet-api", "stats"],
    queryFn: getStats,
    enabled: apiReady,
    refetchInterval: 30_000,
  });

  const ok = health.data?.status === "ok" && health.data?.db_ok;
  const memUsed = stats.data?.memory?.reduce((s, m) => s + (m.memory_usage_bytes ?? 0), 0) ?? 0;

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <Pill
        icon={<Activity className="h-4 w-4" />}
        label="API status"
        value={!apiReady ? "No key" : health.isLoading ? "…" : ok ? "Healthy" : "Down"}
        tone={!apiReady ? "warning" : ok ? "success" : health.isLoading ? "default" : "destructive"}
      />
      <Pill
        icon={<Database className="h-4 w-4" />}
        label="DuckDB"
        value={health.data?.db_ok ? "Connected" : apiReady ? "—" : "—"}
        tone={health.data?.db_ok ? "success" : "default"}
      />
      <Pill
        icon={<Layers className="h-4 w-4" />}
        label="Glue catalog"
        value={health.data?.glue_available ? "Available" : "—"}
        tone={health.data?.glue_available ? "success" : "default"}
      />
      <Pill
        icon={<HardDrive className="h-4 w-4" />}
        label="DB file size"
        value={stats.data ? `${stats.data.db_file_mb.toFixed(1)} MB` : "—"}
      />
      <Pill
        icon={<Cpu className="h-4 w-4" />}
        label="Memory in use"
        value={stats.data ? formatBytes(memUsed) : "—"}
      />
    </section>
  );
}
