import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Thermometer, Zap } from "lucide-react";
import { CHART_ENTER } from "@/lib/chart-motion";
import {
  chargerOperationalStory,
  chargingCurveOverlaysForCharger,
  compatibilityInsights,
  curveExplainability,
  thermalCurveData,
} from "@/lib/charger-explainability";
import type { ChargerBusCompatibility, ChargerHealthDaily } from "@/lib/charger-data";
import { ChargingCurveHero } from "./ChargingCurveHero";
import { fmt, GlassPanel, PanelHead, RiskPill } from "./primitives";

export function ExplainableChargerIntelligence({
  chargers,
  selectedChargerId,
  compatibility,
  highlightDrill,
}: {
  chargers: ChargerHealthDaily[];
  selectedChargerId: string | null;
  compatibility: ChargerBusCompatibility[];
  highlightDrill?: boolean;
}) {
  const story = useMemo(
    () => (selectedChargerId ? chargerOperationalStory(chargers, selectedChargerId) : null),
    [chargers, selectedChargerId],
  );
  const curve = useMemo(
    () => (selectedChargerId ? chargingCurveOverlaysForCharger(selectedChargerId) : null),
    [selectedChargerId],
  );
  const explain = useMemo(
    () => (curve?.metrics ? curveExplainability(curve.metrics) : []),
    [curve],
  );
  const thermal = useMemo(() => thermalCurveData(curve?.metrics ?? null), [curve]);
  const compat = useMemo(
    () =>
      compatibilityInsights(compatibility).filter(
        (c) => c.charger_id === selectedChargerId || c.is_anomaly,
      ),
    [compatibility, selectedChargerId],
  );

  if (!selectedChargerId || !story) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        id="charger-intel-drill"
        key={selectedChargerId}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={`scroll-mt-28 space-y-4 ${highlightDrill ? "rounded-2xl ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""}`}
      >
        {highlightDrill && (
          <p className="text-[11px] font-medium text-primary">Opened from risk ranking · investigate charger</p>
        )}

        <GlassPanel className="overflow-hidden border-primary/25">
          <PanelHead
            title={`${story.chargerId} — operational story`}
            sub={`${story.depotName} · ${story.transformerId}${story.representativeBus ? ` · sample bus ${story.representativeBus}` : ""}`}
          />
          <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="num text-[32px] font-semibold">{fmt(story.currentHealth, 0)}</span>
                <span className="text-[12px] text-muted-foreground">/100 health</span>
                <span
                  className={`num text-[13px] font-medium ${story.healthDelta < 0 ? "text-destructive" : "text-primary"}`}
                >
                  {story.healthDelta >= 0 ? "+" : ""}
                  {fmt(story.healthDelta, 1)} vs prior day
                </span>
                <RiskPill level={story.severity} />
              </div>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-primary">
                Why health changed
              </p>
              <ul className="mt-2 space-y-2">
                {story.whyChanged.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-[12.5px]">
                    <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              {story.diagnostics.map((d) => (
                <div
                  key={d.label}
                  className="rounded-lg border border-border/40 bg-muted/15 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium">{d.label}</span>
                    <RiskPill level={d.severity} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{d.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <GlassPanel className="cc-curve-panel overflow-hidden p-4">
            <PanelHead
              title="Charging curve intelligence"
              sub="Representative bus session on this charger · SOC vs power"
            />
            {curve && curve.series.length > 0 ? (
              <ChargingCurveHero series={curve.series} />
            ) : null}
          </GlassPanel>

          <GlassPanel className="max-h-[420px] overflow-auto p-4">
            <PanelHead title="Root cause intelligence" sub="How curve metrics impact charger health" />
            <div className="space-y-2">
              {explain.map((m) => (
                <div
                  key={m.key}
                  className={`rounded-lg border px-3 py-2.5 ${
                    m.impact.includes("earlier") ||
                    m.impact.includes("Elevated") ||
                    m.impact.includes("Abnormal") ||
                    m.impact.includes("saturation")
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border/40 bg-muted/10"
                  }`}
                >
                  <div className="flex justify-between text-[11px]">
                    <span className="font-medium">{m.label}</span>
                    <span className="num">
                      {fmt(m.value, m.unit === "%" ? 0 : 1)} {m.unit}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">{m.impact}</p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        <GlassPanel className="p-4">
          <PanelHead title="Thermal on representative session" sub="Power vs temperature across SOC" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={thermal}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="soc" tick={{ fontSize: 9 }} />
                <YAxis yAxisId="t" tick={{ fontSize: 9 }} width={28} />
                <YAxis yAxisId="p" orientation="right" tick={{ fontSize: 9 }} width={32} />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                <Area
                  yAxisId="t"
                  type="monotone"
                  dataKey="temp"
                  fill="#f87171"
                  fillOpacity={0.35}
                  stroke="#f87171"
                  {...CHART_ENTER}
                />
                <Line yAxisId="p" type="monotone" dataKey="power" stroke="#38bdf8" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Thermometer className="h-3.5 w-3.5 text-destructive" />
            Thermal rise during CV correlates with disconnect and power cap behavior on this charger.
          </p>
        </GlassPanel>

        {compat.length > 0 && (
          <GlassPanel className="p-4">
            <PanelHead title="Bus pairings on this charger" sub="Compatibility stress" />
            <div className="space-y-2">
              {compat.slice(0, 5).map((c) => (
                <div
                  key={`${c.charger_id}-${c.vehicle_number}`}
                  className={`rounded-lg border px-3 py-2 ${c.is_anomaly ? "border-warning/40 bg-warning/5" : "border-border/40"}`}
                >
                  <div className="flex justify-between text-[11px]">
                    <span className="num">Bus {c.vehicle_number}</span>
                    <span className="num text-destructive">{fmt(c.performance_delta_pct, 0)}%</span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">{c.headline}</p>
                </div>
              ))}
            </div>
          </GlassPanel>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
