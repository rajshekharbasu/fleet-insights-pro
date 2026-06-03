import { useEffect, useMemo, useState } from "react";
import { useMisReport } from "@/contexts/MisReportContext";
import { useMisSiteTemplate } from "@/contexts/MisSiteTemplateContext";
import { buildPivot } from "@/lib/mis/pivot";
import { PIVOT_DIMENSIONS, PIVOT_METRICS } from "@/lib/mis/constants";
import type { PivotConfig, PivotMetric, PivotTemplate } from "@/lib/mis/types";
import { exportToXlsx } from "@/lib/export-xlsx";
import { fmtKm, fmtPct } from "@/lib/mis/analytics";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { OPS } from "@/lib/mis/ops-copy";
import { Th, Td, MisTableShell } from "./mis-shared";

const TEMPLATE_KEY = "voltline.mis.pivot.templates";

function loadTemplates(): PivotTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATE_KEY) ?? "[]") as PivotTemplate[];
  } catch {
    return [];
  }
}

function saveTemplates(templates: PivotTemplate[]) {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
}

function formatMetric(m: PivotMetric, v: number): string {
  if (m === "completionPct" || m === "lossPct") return fmtPct(v);
  if (m.includes("KMs") || m === "billingKMs") return fmtKm(v);
  return String(Math.round(v * 10) / 10);
}

export function PivotBuilderTab() {
  const { filteredRows, state, getOverlay } = useMisReport();
  const { activeTemplate } = useMisSiteTemplate();
  const [applyAdjustments, setApplyAdjustments] = useState(true);
  const [config, setConfig] = useState<PivotConfig>(
    activeTemplate.pivotConfig ?? {
      rowDim: "route",
      colDim: "none",
      metrics: ["completedTrips", "lostTrips", "billingKMs"],
    },
  );
  useEffect(() => {
    if (activeTemplate.pivotConfig) setConfig(activeTemplate.pivotConfig);
  }, [activeTemplate.id, activeTemplate.pivotConfig]);

  const [built, setBuilt] = useState(false);
  const [templates, setTemplates] = useState<PivotTemplate[]>(() => loadTemplates());
  const [templateName, setTemplateName] = useState("");

  const overlay = applyAdjustments ? getOverlay() : new Map();
  const pivot = useMemo(() => {
    if (!built || state.loadState !== "ready") return null;
    return buildPivot(filteredRows, overlay, config);
  }, [built, filteredRows, overlay, config, state.loadState]);

  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const t: PivotTemplate = {
      id: crypto.randomUUID(),
      name: templateName.trim(),
      config: { ...config },
    };
    const next = [...templates, t];
    setTemplates(next);
    saveTemplates(next);
    setTemplateName("");
  };

  const exportExcel = () => {
    if (!pivot) return;
    const rows = pivot.rowLabels.map((row) => {
      const out: Record<string, string | number> = { row };
      config.metrics.forEach((m) => {
        const val = pivot.rowTotals[row]?.[m] ?? 0;
        out[m] = formatMetric(m, val);
      });
      return out;
    });
    exportToXlsx(
      "mis-pivot",
      [{ key: "row", header: "Row" }, ...config.metrics.map((m) => ({ key: m, header: m }))],
      rows,
      "Pivot",
    );
  };

  return (
    <div className="space-y-4">
      {state.loadState !== "ready" && (
        <p className="rounded-lg border border-dashed border-border/60 px-4 py-3 text-[13px] text-muted-foreground">
          {OPS.loadFirst}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Switch
            id="adj"
            checked={applyAdjustments}
            onCheckedChange={setApplyAdjustments}
          />
          <Label htmlFor="adj" className="text-[13px]">
            Include trip fixes you made
          </Label>
        </div>
      </div>

      {templates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setConfig(t.config);
                setBuilt(true);
              }}
              className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary"
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 rounded-xl border border-border/50 bg-card/30 p-4 md:grid-cols-3">
        <label className="text-[12px]">
          <span className="mb-1 block font-medium">{OPS.pivotRows}</span>
          <select
            value={config.rowDim}
            onChange={(e) =>
              setConfig((c) => ({ ...c, rowDim: e.target.value as PivotConfig["rowDim"] }))
            }
            className="h-9 w-full rounded-md border border-border/60 bg-background px-2"
          >
            {PIVOT_DIMENSIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px]">
          <span className="mb-1 block text-muted-foreground">Columns</span>
          <select
            value={config.colDim}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                colDim: e.target.value as PivotConfig["colDim"],
              }))
            }
            className="h-9 w-full rounded-md border border-border/60 bg-background px-2"
          >
            <option value="none">None</option>
            {PIVOT_DIMENSIONS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button size="lg" className="h-10" onClick={() => setBuilt(true)}>
            {OPS.buildSummary}
          </Button>
          <Button variant="outline" className="h-10" disabled={!pivot} onClick={exportExcel}>
            {OPS.downloadExcel}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border/40 p-3">
        <div className="mb-2 text-[13px] font-medium">{OPS.pivotNumbers}</div>
        <div className="flex flex-wrap gap-3">
          {PIVOT_METRICS.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-[12px]">
              <Checkbox
                checked={config.metrics.includes(m.id)}
                onCheckedChange={(checked) => {
                  setConfig((c) => ({
                    ...c,
                    metrics: checked
                      ? [...c.metrics, m.id]
                      : c.metrics.filter((x) => x !== m.id),
                  }));
                }}
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          placeholder="Template name"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="h-9 flex-1 max-w-xs rounded-md border border-border/60 bg-background px-2 text-[12px]"
        />
        <Button variant="secondary" size="sm" onClick={saveTemplate}>
          Save as Template
        </Button>
      </div>

      {built && !pivot && (
        <p className="text-[13px] text-muted-foreground">Load report data from KMS tab first.</p>
      )}

      {pivot && config.metrics.length > 0 && (
        <MisTableShell>
          <thead>
            <tr>
              <Th>{config.rowDim}</Th>
              {pivot.colLabels.map((col) => (
                <Th key={col} colSpan={config.metrics.length} className="text-center">
                  {col}
                </Th>
              ))}
              <Th colSpan={config.metrics.length}>Row total</Th>
            </tr>
            {pivot.colLabels.length > 0 && (
              <tr>
                <Th />
                {pivot.colLabels.flatMap((col) =>
                  config.metrics.map((m) => (
                    <Th key={`${col}-${m}`} className="text-[9px]">
                      {m}
                    </Th>
                  )),
                )}
                {config.metrics.map((m) => (
                  <Th key={`tot-${m}`} className="text-[9px]">
                    {m}
                  </Th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {pivot.rowLabels.map((row) => (
              <tr key={row}>
                <Td className="font-medium">{row}</Td>
                {pivot.colLabels.length === 0
                  ? config.metrics.map((m) => (
                      <Td key={m} align="right">
                        {formatMetric(m, pivot.cells[row]?.["_"]?.[m] ?? 0)}
                      </Td>
                    ))
                  : pivot.colLabels.flatMap((col) =>
                      config.metrics.map((m) => (
                        <Td key={`${col}-${m}`} align="right">
                          {formatMetric(m, pivot.cells[row]?.[col]?.[m] ?? 0)}
                        </Td>
                      )),
                    )}
                {config.metrics.map((m) => (
                  <Td key={`rt-${m}`} align="right" className="font-semibold bg-muted/20">
                    {formatMetric(m, pivot.rowTotals[row]?.[m] ?? 0)}
                  </Td>
                ))}
              </tr>
            ))}
            <tr className="bg-muted/40 font-semibold">
              <Td>Grand total</Td>
              {pivot.colLabels.flatMap((col) =>
                config.metrics.map((m) => (
                  <Td key={`gt-${col}-${m}`} align="right">
                    {formatMetric(m, pivot.colTotals[col]?.[m] ?? 0)}
                  </Td>
                )),
              )}
              {config.metrics.map((m) => (
                <Td key={`gg-${m}`} align="right">
                  {formatMetric(m, pivot.grandTotal[m] ?? 0)}
                </Td>
              ))}
            </tr>
          </tbody>
        </MisTableShell>
      )}
    </div>
  );
}
