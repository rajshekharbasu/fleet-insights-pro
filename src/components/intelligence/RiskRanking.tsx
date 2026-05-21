import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Panel, PanelHeader, fmt } from "@/components/charger/charger-shared";
import { busLeaderboard, chargerLeaderboard, type BusLeaderboardRow, type ChargerLeaderboardRow } from "@/lib/charger-analytics";
import type { BusOperationalHealthDaily, ChargerHealthDaily, DepotEnergyDaily } from "@/lib/charger-data";

type Tab = "buses" | "chargers" | "depots";

export function RiskRanking({
  buses,
  chargers,
  depots,
}: {
  buses: BusOperationalHealthDaily[];
  chargers: ChargerHealthDaily[];
  depots: DepotEnergyDaily[];
}) {
  const [tab, setTab] = useState<Tab>("buses");
  const busLb = useMemo(() => busLeaderboard(buses).slice(0, 8), [buses]);
  const chgLb = useMemo(() => chargerLeaderboard(chargers).slice(0, 8), [chargers]);
  const depotAgg = useMemo(() => {
    const map = new Map<string, { name: string; energy: number; stress: number; abn: number; n: number }>();
    depots.forEach((d) => {
      const e = map.get(d.depot_id) ?? { name: d.depot_name, energy: 0, stress: 0, abn: 0, n: 0 };
      e.energy += d.total_energy_kwh;
      e.stress += d.disconnect_rate * 100;
      e.abn += d.abnormality_count;
      e.n += 1;
      map.set(d.depot_id, e);
    });
    return [...map.values()]
      .map((d) => ({ name: d.name, energy: d.energy, stress: d.stress / d.n, abn: d.abn }))
      .sort((a, b) => b.stress - a.stress);
  }, [depots]);

  return (
    <Panel>
      <PanelHeader
        title="Operational risk ranking"
        description="Buses · chargers · depots ranked by composite operational stress"
        action={
          <div className="flex rounded-lg border border-border/60 p-0.5">
            {(["buses", "chargers", "depots"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize ${
                  tab === t ? "bg-muted text-foreground" : "text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />
      <div className="divide-y divide-border/40">
        {tab === "buses" && busLb.map((r, i) => <BusRow key={r.vehicle_number} r={r} i={i} />)}
        {tab === "chargers" && chgLb.map((r, i) => <ChargerRow key={r.charger_id} r={r} i={i} />)}
        {tab === "depots" &&
          depotAgg.map((d, i) => (
            <motion.div
              key={d.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="num w-6 text-right text-[11px] text-muted-foreground">{i + 1}</span>
                <span className="text-[13px] font-medium">{d.name}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="text-muted-foreground">Energy <span className="num font-semibold text-foreground">{fmt(d.energy, 0)} kWh</span></span>
                <span className="text-muted-foreground">Abnormal <span className="num font-semibold text-foreground">{d.abn}</span></span>
                <span className="num font-semibold" style={{ color: d.stress > 6 ? "var(--color-destructive)" : "var(--color-warning)" }}>
                  {fmt(d.stress, 1)}% disc
                </span>
              </div>
            </motion.div>
          ))}
      </div>
    </Panel>
  );
}

function BusRow({ r, i }: { r: BusLeaderboardRow; i: number }) {
  const stress = r.abnormality_score;
  const color = stress > 70 ? "var(--color-destructive)" : stress > 50 ? "var(--color-warning)" : "var(--color-success)";
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.04 }}
      className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-4 py-2.5"
    >
      <span className="num text-right text-[11px] text-muted-foreground">{i + 1}</span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium">Bus {r.vehicle_number} <span className="text-muted-foreground">· {r.depot_name}</span></div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted/40">
          <div className="h-full rounded-full" style={{ width: `${stress}%`, background: color }} />
        </div>
      </div>
      <div className="text-right">
        <div className="num text-[14px] font-semibold" style={{ color }}>{fmt(stress, 0)}</div>
        <div className="text-[9.5px] text-muted-foreground">stress</div>
      </div>
    </motion.div>
  );
}

function ChargerRow({ r, i }: { r: ChargerLeaderboardRow; i: number }) {
  const stress = r.abnormality_score;
  const color = stress > 70 ? "var(--color-destructive)" : stress > 50 ? "var(--color-warning)" : "var(--color-success)";
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.04 }}
      className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-4 py-2.5"
    >
      <span className="num text-right text-[11px] text-muted-foreground">{i + 1}</span>
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium">{r.charger_id} <span className="text-muted-foreground">· {r.depot_name}</span></div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted/40">
          <div className="h-full rounded-full" style={{ width: `${stress}%`, background: color }} />
        </div>
      </div>
      <div className="text-right">
        <div className="num text-[14px] font-semibold" style={{ color }}>{fmt(stress, 0)}</div>
        <div className="text-[9.5px] text-muted-foreground">stress</div>
      </div>
    </motion.div>
  );
}
