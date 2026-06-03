import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MisReportProvider } from "@/contexts/MisReportContext";
import { MisSiteTemplateProvider } from "@/contexts/MisSiteTemplateContext";
import { OPS } from "@/lib/mis/ops-copy";
import { KmsReportTab } from "./KmsReportTab";
import { AdjustmentWorkspaceTab } from "./AdjustmentWorkspaceTab";
import { PivotBuilderTab } from "./PivotBuilderTab";
import { MisSiteTemplateBar } from "./MisSiteTemplateBar";
import { MisTemplateSync } from "./MisTemplateSync";

export function MisReportBuilder() {
  return (
    <MisSiteTemplateProvider>
      <MisReportProvider>
        <div className="mis-report-builder min-w-[1280px] space-y-4">
          <header>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
              Operations
            </p>
            <h1 className="mt-1 text-[24px] font-semibold tracking-tight">{OPS.pageTitle}</h1>
            <p className="mt-1 max-w-2xl text-[14px] text-muted-foreground">{OPS.pageSubtitle}</p>
          </header>

          <MisGuidedSteps />

          <MisSiteTemplateBar />
          <MisTemplateSync />

          <Tabs defaultValue="kms" className="w-full">
            <TabsList className="h-11 w-full justify-start rounded-xl border border-border/50 bg-muted/30 p-1">
              <TabsTrigger value="kms" className="text-[13px] px-4">
                {OPS.tabDaily}
              </TabsTrigger>
              <TabsTrigger value="adjust" className="text-[13px] px-4">
                {OPS.tabFix}
              </TabsTrigger>
              <TabsTrigger value="pivot" className="text-[13px] px-4">
                {OPS.tabSummary}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="kms" className="mt-4">
              <KmsReportTab />
            </TabsContent>
            <TabsContent value="adjust" className="mt-4">
              <AdjustmentWorkspaceTab />
            </TabsContent>
            <TabsContent value="pivot" className="mt-4">
              <PivotBuilderTab />
            </TabsContent>
          </Tabs>
        </div>
      </MisReportProvider>
    </MisSiteTemplateProvider>
  );
}

function MisGuidedSteps() {
  return (
    <ol className="grid gap-2 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:grid-cols-3">
      <li className="flex gap-3 text-[13px]">
        <StepNum n={1} />
        <span>
          <strong className="font-semibold">{OPS.step1}</strong>
          <span className="mt-0.5 block text-muted-foreground">Pick depot and report style below.</span>
        </span>
      </li>
      <li className="flex gap-3 text-[13px]">
        <StepNum n={2} />
        <span>
          <strong className="font-semibold">{OPS.step2}</strong>
          <span className="mt-0.5 block text-muted-foreground">Choose dates, then press Load today&apos;s trips.</span>
        </span>
      </li>
      <li className="flex gap-3 text-[13px]">
        <StepNum n={3} />
        <span>
          <strong className="font-semibold">{OPS.step3}</strong>
          <span className="mt-0.5 block text-muted-foreground">Fix trips if needed, then download Excel or PDF.</span>
        </span>
      </li>
    </ol>
  );
}

function StepNum({ n }: { n: number }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">
      {n}
    </span>
  );
}
