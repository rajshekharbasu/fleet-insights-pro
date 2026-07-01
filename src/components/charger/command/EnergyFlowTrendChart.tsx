import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_ENTER } from "@/lib/chart-motion";
import type { FlowTrendPoint } from "./energy-flow-sync";
import { fmt } from "./primitives";

type ChartMouseState = {
  activeTooltipIndex?: number;
  isTooltipActive?: boolean;
};

export function EnergyFlowTrendChart({
  data,
  entityMode,
  activeIndex,
  onHoverIndex,
}: {
  data: FlowTrendPoint[];
  entityMode: boolean;
  activeIndex: number | null;
  onHoverIndex: (index: number | null) => void;
}) {
  const active = activeIndex != null ? data[activeIndex] : null;
  const activeLabel = active?.label;

  const handleMove = (state: ChartMouseState | null) => {
    if (state?.isTooltipActive && typeof state.activeTooltipIndex === "number") {
      onHoverIndex(state.activeTooltipIndex);
    }
  };

  const shared = (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.4} />
      <XAxis
        dataKey="label"
        interval="preserveStartEnd"
        tick={(props) => {
          const { x, y, payload } = props;
          const i = data.findIndex((d) => d.label === payload.value);
          const on = i === activeIndex;
          return (
            <text
              x={x}
              y={y + 12}
              textAnchor="middle"
              fill={on ? "var(--color-primary)" : "var(--color-muted-foreground)"}
              fontSize={10}
              fontWeight={on ? 600 : 400}
            >
              {payload.value}
            </text>
          );
        }}
      />
      <YAxis tick={{ fontSize: 10 }} width={48} />
      {activeLabel != null && (
        <ReferenceArea
          x1={activeLabel}
          x2={activeLabel}
          strokeOpacity={0}
          fill="var(--color-primary)"
          fillOpacity={0.08}
        />
      )}
      {activeLabel != null && (
        <ReferenceLine x={activeLabel} stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="4 3" />
      )}
      <Tooltip
        cursor={{ stroke: "var(--color-primary)", strokeWidth: 1, strokeDasharray: "4 4" }}
        contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid var(--color-border)" }}
        labelFormatter={(label) => `Period · ${label}`}
        formatter={(v: number, name: string) => [`${fmt(v, 0)} kWh`, name]}
      />
      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
    </>
  );

  return (
    <div
      className="h-full w-full"
      onMouseLeave={() => onHoverIndex(null)}
    >
      <ResponsiveContainer width="100%" height="100%">
        {entityMode ? (
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            onMouseMove={handleMove}
            onMouseLeave={() => onHoverIndex(null)}
          >
            {shared}
            <Line
              type="monotone"
              dataKey="grid"
              name="Grid intake"
              stroke="#818cf8"
              strokeWidth={activeIndex != null ? 2 : 2.5}
              dot={(props) => {
                const { cx, cy, index } = props;
                if (cx == null || cy == null) return <g />;
                const on = index === activeIndex;
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={on ? 5 : 0}
                    fill="#818cf8"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              {...CHART_ENTER}
            />
            <Line
              type="monotone"
              dataKey="output"
              name="Charger output"
              stroke="#22d3ee"
              strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, index } = props;
                if (cx == null || cy == null) return <g />;
                const on = index === activeIndex;
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={on ? 5 : 0}
                    fill="#22d3ee"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6 }}
              {...CHART_ENTER}
            />
            <Line
              type="monotone"
              dataKey="demand"
              name="Bus demand"
              stroke="#fbbf24"
              strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, index } = props;
                if (cx == null || cy == null) return <g />;
                const on = index === activeIndex;
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={on ? 5 : 0}
                    fill="#fbbf24"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6 }}
              {...CHART_ENTER}
            />
            <Bar dataKey="lossCharger" name="Charger loss" stackId="loss" fill="#22d3ee" fillOpacity={activeIndex != null ? 0.5 : 0.35} />
            <Bar dataKey="lossBus" name="Bus loss" stackId="loss" fill="#fbbf24" fillOpacity={activeIndex != null ? 0.55 : 0.45} />
          </ComposedChart>
        ) : (
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            onMouseMove={handleMove}
            onMouseLeave={() => onHoverIndex(null)}
          >
            {shared}
            <Line
              type="monotone"
              dataKey="grid"
              name="Grid intake"
              stroke="#818cf8"
              strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, index } = props;
                if (cx == null || cy == null) return <g />;
                const on = index === activeIndex;
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={on ? 5 : 0}
                    fill="#818cf8"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6 }}
              {...CHART_ENTER}
            />
            <Line
              type="monotone"
              dataKey="output"
              name="Charger output"
              stroke="#22d3ee"
              strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, index } = props;
                if (cx == null || cy == null) return <g />;
                const on = index === activeIndex;
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={on ? 5 : 0}
                    fill="#22d3ee"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6 }}
              {...CHART_ENTER}
            />
            <Line
              type="monotone"
              dataKey="demand"
              name="Bus demand"
              stroke="#fbbf24"
              strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, index } = props;
                if (cx == null || cy == null) return <g />;
                const on = index === activeIndex;
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={on ? 5 : 0}
                    fill="#fbbf24"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 6 }}
              {...CHART_ENTER}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
