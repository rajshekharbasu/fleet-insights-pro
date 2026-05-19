import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BatteryCharging,
  Bus,
  Gauge,
  PlugZap,
  Zap,
} from "lucide-react";
import type { ExecutiveKpis } from "@/lib/charger-analytics";
import { fmt, MiniSpark } from "./charger-shared";

function KpiTile({
  label,
  value,
  unit,
  delta,
  spark,
  icon: Icon,
  anomaly,
  positiveIsGood = true,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  spark?: { v: number }[];
  icon: React.ComponentType<{ className?: string }>;
  anomaly?: boolean;
  positiveIsGood?: boolean;
}) {
  const good = delta == null ? true : positiveIsGood ? delta >= 0 : delta <= 0;
  return (
    <div className="accent-bar-top group relative min-w-[140px] flex-1 overflow-hidden rounded-2xl border border-border/50 bg-card p-4 shadow-elevated transition-all hover:border-primary/25">
      {anomaly && (
        <span className="absolute right-3 top-3 h-2 w-2 animate-pulse rounded-full bg-destructive shadow-[0_0_8px_var(--color-destructive)]" />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="num truncate text-[22px] font-semibold tracking-tight">{value}</span>
            {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
          </div>
          {delta != null && (
            <div
              className={`mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold num ${
                good ? "text-success" : "text-destructive"
              }`}
            >
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta).toFixed(1)}% DoD
            </div>
          )}
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {spark && spark.length > 0 && (
        <div className="mt-2 flex justify-end opacity-80">
          <MiniSpark data={spark} />
        </div>
      )}
    </div>
  );
}

export function ChargerKpiRibbon({ kpis }: { kpis: ExecutiveKpis }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
      <KpiTile label="Energy delivered" value={fmt(kpis.totalEnergyKwh, 0)} unit="kWh" delta={kpis.energyDeltaPct} spark={kpis.sparkEnergy} icon={Zap} positiveIsGood />
      <KpiTile label="Active chargers" value={String(kpis.activeChargers)} icon={PlugZap} spark={kpis.sparkSessions} />
      <KpiTile label="Charger health" value={fmt(kpis.avgChargerHealth, 0)} unit="/100" icon={BatteryCharging} spark={kpis.sparkHealth} />
      <KpiTile label="Fleet health" value={fmt(kpis.avgFleetHealth, 0)} unit="/100" delta={kpis.healthDeltaPct} icon={Bus} positiveIsGood spark={kpis.sparkHealth} />
      <KpiTile label="Abnormal chargers" value={String(kpis.abnormalChargers)} icon={AlertTriangle} anomaly={kpis.abnormalChargers > 3} positiveIsGood={false} />
      <KpiTile label="Abnormal buses" value={String(kpis.abnormalBuses)} icon={Activity} anomaly={kpis.abnormalBuses > 5} positiveIsGood={false} />
      <KpiTile label="Daily sessions" value={String(kpis.dailySessions)} icon={Gauge} spark={kpis.sparkSessions} />
      <KpiTile label="Disconnect rate" value={fmt(kpis.disconnectRate * 100, 1)} unit="%" icon={AlertTriangle} anomaly={kpis.disconnectRate > 0.1} positiveIsGood={false} />
      <KpiTile label="Avg charge power" value={fmt(kpis.avgChargingPower, 1)} unit="kW" icon={Zap} />
      <KpiTile label="Depot ops score" value={fmt(kpis.depotOperationalScore, 0)} unit="/100" icon={PlugZap} />
    </div>
  );
}
