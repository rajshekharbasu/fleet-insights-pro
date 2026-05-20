import { Link } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_ENTER } from "@/lib/chart-motion";
import type { DailyInsight } from "@/lib/daily-insights";
import { ExportTableButton } from "./ExportTableButton";

const SEV_STYLE = {
  critical: "bg-destructive/15 text-destructive ring-destructive/30",
  warning: "bg-warning/15 text-warning ring-warning/30",
  info: "bg-primary/10 text-primary ring-primary/25",
};

export function InsightDetailDrawer({
  insight,
  onClose,
}: {
  insight: DailyInsight | null;
  onClose: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-background/60 backdrop-blur-sm transition-opacity ${
          insight ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-[520px] flex-col border-l border-border/60 bg-card shadow-2xl transition-transform duration-300 ${
          insight ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {insight && (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-border/60 p-5">
              <div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${SEV_STYLE[insight.severity]}`}
                >
                  {insight.severity}
                </span>
                <h2 className="mt-2 text-[17px] font-semibold leading-snug">{insight.title}</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">{insight.summary}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Metric</div>
                  <div className="mt-1 num text-[18px] font-semibold">{insight.metric}</div>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vs baseline</div>
                  <div className="mt-1 num font-semibold">{insight.vsBaseline}</div>
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12px] font-semibold">30-day trend</div>
                <div className="h-44 rounded-xl border border-border/50 bg-muted/10 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={insight.trend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.35} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={36} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        dot={false}
                        {...CHART_ENTER}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[12px]">
                <div className="font-medium text-primary">Recommended action</div>
                <p className="mt-1 text-muted-foreground">{insight.action}</p>
                {insight.deepLink && (
                  <Link
                    to={insight.deepLink.split("#")[0] || insight.deepLink}
                    hash={insight.deepLink.includes("#") ? insight.deepLink.split("#")[1] : undefined}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    Open deep dive <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold">Supporting data</span>
                  <ExportTableButton
                    filename={`voltline-insight-${insight.id}`}
                    columns={insight.evidenceColumns.map((c) => ({
                      key: c.key,
                      header: c.header,
                    }))}
                    rows={insight.evidence as Record<string, unknown>[]}
                  />
                </div>
                <div className="max-h-52 overflow-auto rounded-xl border border-border/50">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border/50 text-left text-[10px] uppercase text-muted-foreground">
                        {insight.evidenceColumns.map((c) => (
                          <th key={c.key} className="px-3 py-2 font-medium">
                            {c.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {insight.evidence.map((row, i) => (
                        <tr key={i} className="border-b border-border/30 last:border-0">
                          {insight.evidenceColumns.map((c) => (
                            <td key={c.key} className="px-3 py-2 num">
                              {row[c.key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
