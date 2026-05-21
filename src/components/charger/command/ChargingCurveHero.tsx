import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { CurveOverlaySeries } from "@/lib/charger-explainability";

export function ChargingCurveHero({
  series,
  height = 340,
}: {
  series: CurveOverlaySeries[];
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !series.length) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    const cvStart = series.find((s) => s.current && series.find((x) => x.soc_pct > (s.soc_pct ?? 0) && (x.current ?? 0) < (s.current ?? 999) * 0.95))?.soc_pct ?? 78;

    chart.setOption({
      backgroundColor: "transparent",
      grid: { left: 48, right: 24, top: 36, bottom: 40 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(12,16,28,0.92)",
        borderColor: "rgba(99,102,241,0.35)",
        textStyle: { fontSize: 11 },
        formatter: (params: { seriesName: string; value: number; dataIndex: number }[]) => {
          const idx = params[0]?.dataIndex ?? 0;
          const pt = series[idx];
          if (!pt) return "";
          return [
            `SOC ${pt.soc_pct}%`,
            pt.current != null ? `Power ${pt.current} kW` : "",
            pt.temperature != null ? `Temp ${pt.temperature}°C` : "",
            pt.current_a != null ? `${pt.current_a} A · ${pt.voltage_v} V` : "",
          ]
            .filter(Boolean)
            .join("<br/>");
        },
      },
      legend: {
        top: 4,
        textStyle: { color: "#94a3b8", fontSize: 10 },
        data: ["Current session", "Previous session", "Fleet average"],
      },
      xAxis: {
        type: "category",
        name: "SOC %",
        nameTextStyle: { color: "#64748b", fontSize: 10 },
        data: series.map((s) => s.soc_pct),
        axisLine: { lineStyle: { color: "#334155" } },
        axisLabel: { color: "#94a3b8", fontSize: 9 },
      },
      yAxis: {
        type: "value",
        name: "kW",
        nameTextStyle: { color: "#64748b", fontSize: 10 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#1e293b" } },
        axisLabel: { color: "#94a3b8", fontSize: 9 },
      },
      series: [
        {
          name: "Fleet average",
          type: "line",
          smooth: true,
          symbol: "none",
          lineStyle: { color: "#64748b", width: 1.5, type: "dashed" },
          data: series.map((s) => s.fleet ?? null),
        },
        {
          name: "Previous session",
          type: "line",
          smooth: true,
          symbol: "none",
          lineStyle: { color: "#a78bfa", width: 1.5, opacity: 0.7 },
          data: series.map((s) => s.previous ?? null),
        },
        {
          name: "Current session",
          type: "line",
          smooth: true,
          symbol: "none",
          lineStyle: {
            color: "#38bdf8",
            width: 3,
            shadowColor: "rgba(56,189,248,0.45)",
            shadowBlur: 12,
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(56,189,248,0.25)" },
              { offset: 1, color: "rgba(56,189,248,0.02)" },
            ]),
          },
          data: series.map((s) => s.current ?? null),
          markArea: {
            silent: true,
            itemStyle: { opacity: 0.08 },
            data: [
              [{ xAxis: "0" }, { xAxis: String(Math.min(cvStart, 20)) }],
              [{ xAxis: String(cvStart) }, { xAxis: "92" }],
              [{ xAxis: "92" }, { xAxis: "100" }],
            ],
          },
        },
      ],
    });

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [series]);

  return (
    <div
      ref={ref}
      className="cc-curve-chart w-full rounded-xl"
      style={{ height }}
    />
  );
}
