import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useMisSiteTemplate } from "@/contexts/MisSiteTemplateContext";
import { useMisReport } from "@/contexts/MisReportContext";
import {
  KMS_COLUMN_CATALOG,
  type KmsColumnId,
  type ColumnTemplateConfig,
} from "@/lib/mis/kms-columns";
import { COLUMN_GROUPS, type ColumnGroupKey } from "@/lib/mis/column-groups";
import { GROUP_PLAIN, OPS } from "@/lib/mis/ops-copy";
import { templatesForSite } from "@/lib/mis/site-templates";
import { DEFAULT_SITE_ROUTES } from "@/lib/mis/sites";
import { PIVOT_DIMENSIONS, PIVOT_METRICS } from "@/lib/mis/constants";
import type { PivotConfig } from "@/lib/mis/types";
import { MisKmsReportPreview } from "./MisKmsReportPreview";
import { MisPivotPreview } from "./MisPivotPreview";
import { RouteTagInput } from "./RouteTagInput";

const SIMPLE_PIVOT_METRICS: PivotConfig["metrics"] = [
  "completedTrips",
  "lostTrips",
  "billingKMs",
  "completionPct",
];

export function MisTemplateEditorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const {
    activeSiteId,
    activeTemplate,
    sites,
    templates,
    saveTemplate,
    createTemplate,
    duplicateActiveTemplate,
    deleteTemplate,
  } = useMisSiteTemplate();
  const { scheduleReports, state, filteredRows } = useMisReport();

  const [step, setStep] = useState<1 | 2>(1);
  const [draftName, setDraftName] = useState(activeTemplate.templateName);
  const [draftColumns, setDraftColumns] = useState(activeTemplate.columns);
  const [draftRoutes, setDraftRoutes] = useState<string[]>(activeTemplate.routes);
  const [draftPivot, setDraftPivot] = useState<PivotConfig>(
    activeTemplate.pivotConfig ?? {
      rowDim: "route",
      colDim: "none",
      metrics: SIMPLE_PIVOT_METRICS,
    },
  );

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setDraftName(activeTemplate.templateName);
    setDraftColumns({ ...activeTemplate.columns });
    setDraftRoutes([...activeTemplate.routes]);
    setDraftPivot(
      activeTemplate.pivotConfig ?? {
        rowDim: "route",
        colDim: "none",
        metrics: SIMPLE_PIVOT_METRICS,
      },
    );
  }, [open, activeTemplate]);

  const previewRows = useMemo(() => {
    if (state.loadState === "ready" && scheduleReports.length > 0) {
      return scheduleReports.slice(0, 2);
    }
    return undefined;
  }, [state.loadState, scheduleReports]);

  const siteName = sites.find((s) => s.id === activeSiteId)?.name ?? activeSiteId;
  const siteTemplateCount = templatesForSite(templates, activeSiteId).length;
  const routeSuggestions = DEFAULT_SITE_ROUTES[activeSiteId] ?? [];

  const setColumn = (id: KmsColumnId, patch: Partial<ColumnTemplateConfig>) => {
    const def = KMS_COLUMN_CATALOG.find((c) => c.id === id)!;
    setDraftColumns((prev) => ({
      ...prev,
      [id]: {
        header: prev[id]?.header ?? def.defaultHeader,
        visible: prev[id]?.visible ?? true,
        ...patch,
      },
    }));
  };

  const toggleGroup = (group: ColumnGroupKey, visible: boolean) => {
    KMS_COLUMN_CATALOG.filter((c) => c.group === group && !c.locked).forEach((c) => {
      setColumn(c.id, { visible });
    });
  };

  const handleSave = () => {
    saveTemplate({
      ...activeTemplate,
      templateName: draftName.trim() || activeTemplate.templateName,
      columns: draftColumns,
      routes: draftRoutes,
      pivotConfig: draftPivot,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !max-h-[94vh] !w-[min(98vw,1280px)] !max-w-[1280px] !flex-col !gap-0 overflow-hidden !p-0 sm:!rounded-xl">
        <DialogHeader className="shrink-0 border-b border-border/40 px-6 py-4 text-left">
          <DialogTitle className="text-[18px]">Set up report for {siteName}</DialogTitle>
          <DialogDescription className="text-[13px]">
            Step 1: name and routes. Step 2: columns with a live preview on the right.
          </DialogDescription>
          <div className="mt-3 flex flex-wrap gap-2">
            <StepChip n={1} label="Name & routes" active={step === 1} onClick={() => setStep(1)} />
            <StepChip n={2} label="Columns & preview" active={step === 2} onClick={() => setStep(2)} />
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
          <div className="relative z-10 min-h-0 w-full shrink-0 overflow-y-auto border-b border-border/40 bg-background px-6 py-5 xl:w-[min(100%,440px)] xl:max-w-[45%] xl:border-b-0 xl:border-r">
            {step === 1 && (
              <div className="mx-auto max-w-lg space-y-6">
                <label className="block">
                  <span className="mb-2 block text-[14px] font-semibold">Report name</span>
                  <span className="mb-2 block text-[12px] text-muted-foreground">
                    e.g. “Khapri morning shift” — only your team sees this.
                  </span>
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="h-11 w-full text-[14px]"
                  />
                </label>
                <div>
                  <span className="mb-2 block text-[14px] font-semibold">{OPS.routesForDepot}</span>
                  <RouteTagInput
                    routes={draftRoutes}
                    onChange={setDraftRoutes}
                    suggestions={routeSuggestions}
                  />
                </div>
                <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
                  Press Next to pick columns and see how the report will look.
                </p>
                <Button size="lg" className="h-11 w-full" onClick={() => setStep(2)}>
                  Next: choose columns →
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" className="mb-2" onClick={() => setStep(1)}>
                  ← Back to routes
                </Button>
                <p className="text-[13px] text-muted-foreground">
                  Turn sections on/off and rename column titles. Use words your depot team already knows.
                </p>
                {(Object.keys(COLUMN_GROUPS) as ColumnGroupKey[]).map((group) => {
                  const cols = KMS_COLUMN_CATALOG.filter((c) => c.group === group);
                  const allOn = cols
                    .filter((c) => !c.locked)
                    .every((c) => draftColumns[c.id]?.visible !== false);
                  return (
                    <div key={group} className="rounded-xl border border-border/50 overflow-hidden">
                      <div
                        className={`flex items-center justify-between px-4 py-3 ${COLUMN_GROUPS[group].band}`}
                      >
                        <span className="text-[13px] font-semibold">{GROUP_PLAIN[group]}</span>
                        <label className="flex items-center gap-2 text-[12px] font-normal">
                          <Checkbox checked={allOn} onCheckedChange={(c) => toggleGroup(group, !!c)} />
                          {OPS.showColumn}
                        </label>
                      </div>
                      <div className="divide-y divide-border/30 bg-card/30">
                        {cols.map((col) => {
                          const cfg = draftColumns[col.id];
                          const visible = col.locked ? true : cfg?.visible !== false;
                          if (!visible && col.locked) return null;
                          return (
                            <div
                              key={col.id}
                              className={`grid gap-2 px-4 py-3 sm:grid-cols-[auto_1fr] ${!visible ? "opacity-50" : ""}`}
                            >
                              {!col.locked && (
                                <Checkbox
                                  checked={visible}
                                  onCheckedChange={(c) => setColumn(col.id, { visible: !!c })}
                                  className="mt-2"
                                />
                              )}
                              <div>
                                <span className="text-[11px] text-muted-foreground">{OPS.columnTitle}</span>
                                <Input
                                  value={cfg?.header ?? col.defaultHeader}
                                  onChange={(e) => setColumn(col.id, { header: e.target.value })}
                                  disabled={!visible}
                                  className="mt-1 h-10 text-[13px]"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
                  <div className="text-[14px] font-semibold">{OPS.previewSummary}</div>
                  <label className="block text-[12px]">
                    <span className="mb-1 block text-muted-foreground">{OPS.pivotRows}</span>
                    <select
                      value={draftPivot.rowDim}
                      onChange={(e) =>
                        setDraftPivot((p) => ({
                          ...p,
                          rowDim: e.target.value as PivotConfig["rowDim"],
                        }))
                      }
                      className="h-10 w-full rounded-md border border-border/60 bg-background px-2 text-[13px]"
                    >
                      {PIVOT_DIMENSIONS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="text-[12px] font-medium">{OPS.pivotNumbers}</div>
                  <div className="flex flex-wrap gap-2">
                    {PIVOT_METRICS.filter((m) =>
                      SIMPLE_PIVOT_METRICS.includes(m.id as (typeof SIMPLE_PIVOT_METRICS)[number]),
                    ).map((m) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 rounded-lg border border-border/40 bg-background px-3 py-2 text-[12px]"
                      >
                        <Checkbox checked disabled className="opacity-70" />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {step === 2 && (
            <div className="flex min-h-[280px] min-w-0 flex-1 flex-col overflow-hidden bg-muted/10 xl:min-h-0">
              <Tabs defaultValue="kms" className="flex h-full min-h-0 flex-col px-4 py-4">
                <TabsList className="grid h-10 w-full shrink-0 grid-cols-2">
                  <TabsTrigger value="kms" className="text-[12px]">
                    Daily list preview
                  </TabsTrigger>
                  <TabsTrigger value="pivot" className="text-[12px]">
                    Summary preview
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="kms"
                  className="mt-3 min-h-0 flex-1 overflow-x-auto overflow-y-auto data-[state=inactive]:hidden"
                >
                  <div className="max-w-full">
                    <MisKmsReportPreview
                      siteName={siteName}
                      templateName={draftName}
                      routes={draftRoutes}
                      columns={draftColumns}
                      columnOrder={activeTemplate.columnOrder}
                      rows={previewRows}
                      maxRows={2}
                      defaultExpandFirst
                      showLegend
                      showTripDetail
                      compact
                    />
                  </div>
                </TabsContent>
                <TabsContent
                  value="pivot"
                  className="mt-3 min-h-0 flex-1 overflow-auto data-[state=inactive]:hidden"
                >
                  <MisPivotPreview
                    siteName={siteName}
                    config={draftPivot}
                    useLiveTrips={!!previewRows}
                    liveTrips={previewRows ? filteredRows : undefined}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-border/40 px-6 py-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => createTemplate(activeSiteId, `${siteName} report ${siteTemplateCount + 1}`)}
            >
              New style
            </Button>
            <Button type="button" variant="outline" onClick={() => duplicateActiveTemplate(`${draftName} (copy)`)}>
              Copy style
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={siteTemplateCount <= 1}
              onClick={() => deleteTemplate(activeTemplate.id)}
            >
              Delete
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="lg" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="lg" className="min-w-[140px]" onClick={handleSave}>
              {OPS.saveAndUse}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepChip({
  n,
  label,
  active,
  onClick,
}: {
  n: number;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background/20 text-[11px]">
        {n}
      </span>
      {label}
    </button>
  );
}
