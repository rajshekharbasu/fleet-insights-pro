import { useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight, CircleDot, FileText, GitBranch, MapPin, Waypoints } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  entityById,
  fmtDate,
  isEsmsSubAvailable,
  LIFECYCLE_BRANCH_STAGES,
  LIFECYCLE_STAGES,
  lifecycleDaysInStage,
  lifecycleIsBottleneck,
  lifecycleStageByKey,
  lifecycleStageCounts,
  PROJECT_LIFECYCLES,
  type LifecycleStage,
  type ProjectLifecycle,
} from "@/lib/esg-data";
import { CriticalBeam, PanelCard, useEsg } from "../primitives";

const KIND_META: Record<LifecycleStage["kind"], { shape: string }> = {
  start: { shape: "rounded-full" },
  end: { shape: "rounded-full" },
  process: { shape: "rounded-xl" },
  decision: { shape: "rounded-xl" },
  document: { shape: "rounded-lg" },
};

/** One flowchart node — shape + label encode type, never colour alone. */
function StageNode({
  stage,
  count,
  activeProject,
  onClick,
}: {
  stage: LifecycleStage;
  count?: number;
  activeProject?: ProjectLifecycle | null;
  onClick?: () => void;
}) {
  const clickable = !!stage.deepLink && isEsmsSubAvailable(stage.deepLink.sub) && !!onClick;
  const isActive = !!activeProject;
  const bottleneck = isActive && lifecycleIsBottleneck(activeProject!);
  const reduce = useReducedMotion();

  const base = (
    <div
      className={cn(
        "relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 border px-3 py-2 text-center transition-colors",
        KIND_META[stage.kind].shape,
        stage.kind === "decision" && "bg-warning/10 border-warning/40",
        stage.kind === "document" && "border-dashed border-border bg-card/60",
        stage.kind === "process" && "bg-primary/8 border-primary/25",
        (stage.kind === "start" || stage.kind === "end") && "border-foreground/25 bg-muted/50 px-5",
        isActive && !bottleneck && "ring-2 ring-primary/70",
        bottleneck && "border-destructive/60 bg-destructive/8",
        clickable && "cursor-pointer hover:-translate-y-0.5 hover:shadow-elevated",
      )}
      title={
        bottleneck
          ? `${activeProject!.project} — stuck ${lifecycleDaysInStage(activeProject!)}d${
              activeProject!.blocked ? `: ${activeProject!.blocked.reason}` : ""
            }`
          : stage.note
      }
    >
      {stage.kind === "document" && <FileText className="h-3 w-3 text-muted-foreground" aria-hidden />}
      <span className="text-[11px] font-semibold leading-tight text-foreground">{stage.label}</span>
      {stage.note && <span className="text-[9.5px] leading-tight text-muted-foreground">{stage.note}</span>}
      {count != null && count > 0 && (
        <span className="num absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {count}
        </span>
      )}
      {bottleneck && (
        <span className="num absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-destructive-foreground">
          {lifecycleDaysInStage(activeProject!)}d stuck
        </span>
      )}
    </div>
  );

  const wrapped = bottleneck ? (
    <CriticalBeam size="sm" active={!reduce}>
      {base}
    </CriticalBeam>
  ) : (
    base
  );

  if (!clickable) return <div className="w-[168px] shrink-0">{wrapped}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-[168px] shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      {wrapped}
    </button>
  );
}

function Arrow({ dir = "down" }: { dir?: "down" | "right" }) {
  const Icon = dir === "down" ? ArrowDown : ArrowRight;
  return (
    <div className={cn("flex shrink-0 items-center justify-center text-muted-foreground/50", dir === "down" ? "h-6 w-full" : "h-full w-6")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </div>
  );
}

function stageProps(
  key: string,
  mode: "all" | string,
  counts: Record<string, number>,
  activeLifecycle: ProjectLifecycle | undefined,
) {
  return {
    count: mode === "all" ? counts[key] : undefined,
    activeProject: mode !== "all" && activeLifecycle?.currentStage === key ? activeLifecycle : null,
  };
}

/** Desktop/tablet flow — faithful to the stakeholder diagram's topology. */
function DesktopFlow({
  mode,
  counts,
  activeLifecycle,
  onOpen,
}: {
  mode: "all" | string;
  counts: Record<string, number>;
  activeLifecycle: ProjectLifecycle | undefined;
  onOpen: (sub: string) => void;
}) {
  const g = lifecycleStageByKey;
  const node = (key: string) => {
    const stage = g(key)!;
    return (
      <StageNode
        stage={stage}
        {...stageProps(key, mode, counts, activeLifecycle)}
        onClick={stage.deepLink ? () => onOpen(stage.deepLink!.sub) : undefined}
      />
    );
  };

  const branchColumn = (keys: string[], label: string) => (
    <div className="flex flex-col items-center gap-0">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      {keys.map((k, i) => (
        <div key={k} className="flex flex-col items-center">
          {node(k)}
          {i < keys.length - 1 && <Arrow />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-w-[760px] space-y-0 p-6">
      <div className="flex flex-col items-center">
        {node("new-opportunity")}
        <Arrow />
        {node("screening")}
        <Arrow />
        {node("screening-doc")}
        <Arrow />
        {node("classification")}
      </div>

      <div className="my-2 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <GitBranch className="h-3 w-3" aria-hidden /> brownfield / greenfield
      </div>
      <div className="flex items-start justify-center gap-10">
        {branchColumn(LIFECYCLE_BRANCH_STAGES.brownfield, "Brownfield")}
        {branchColumn(LIFECYCLE_BRANCH_STAGES.greenfield, "Greenfield / vacant")}
      </div>

      <div className="mt-2 flex flex-col items-center">
        <Arrow />
        {node("monitor-review")}
        <Arrow />
        {node("risk-reduced")}
      </div>

      <div className="mt-1 flex items-start justify-center gap-10">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-destructive">No</span>
          {node("update-action")}
          <span className="max-w-[168px] pt-1 text-center text-[9.5px] leading-tight text-muted-foreground">
            loops back to Monitor &amp; review
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="mb-1 text-[10px] font-semibold text-success">Yes</span>
          {node("maintain-ops")}
          <Arrow />
          {node("ongoing-monitoring")}
          <Arrow />
          {node("closure")}
        </div>
      </div>
    </div>
  );
}

/** Mobile — a linear vertical stepper covering the same stages, in reading order. */
function MobileStepper({
  mode,
  counts,
  activeLifecycle,
  onOpen,
}: {
  mode: "all" | string;
  counts: Record<string, number>;
  activeLifecycle: ProjectLifecycle | undefined;
  onOpen: (sub: string) => void;
}) {
  const order = [
    "new-opportunity",
    "screening",
    "screening-doc",
    "classification",
    ...LIFECYCLE_BRANCH_STAGES.brownfield,
    ...LIFECYCLE_BRANCH_STAGES.greenfield,
    "monitor-review",
    "risk-reduced",
    "update-action",
    "maintain-ops",
    "ongoing-monitoring",
    "closure",
  ];
  return (
    <ol className="space-y-3 p-4">
      {order.map((key) => {
        const stage = lifecycleStageByKey(key)!;
        const { count, activeProject } = stageProps(key, mode, counts, activeLifecycle);
        const bottleneck = activeProject ? lifecycleIsBottleneck(activeProject) : false;
        const clickable = !!stage.deepLink && isEsmsSubAvailable(stage.deepLink.sub);
        return (
          <li key={key}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onOpen(stage.deepLink!.sub)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left",
                stage.kind === "decision" && "border-warning/40 bg-warning/8",
                stage.kind === "document" && "border-dashed border-border bg-card/60",
                stage.kind === "process" && "border-primary/25 bg-primary/8",
                (stage.kind === "start" || stage.kind === "end") && "border-foreground/25 bg-muted/50",
                activeProject && !bottleneck && "ring-2 ring-primary/70",
                bottleneck && "border-destructive/60 bg-destructive/8",
              )}
            >
              <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold">{stage.label}</span>
                {stage.note && <span className="block text-[10.5px] text-muted-foreground">{stage.note}</span>}
                {bottleneck && (
                  <span className="mt-1 block text-[10.5px] font-semibold text-destructive">
                    Stuck {lifecycleDaysInStage(activeProject!)}d
                    {activeProject!.blocked ? ` — ${activeProject!.blocked.reason}` : ""}
                  </span>
                )}
              </span>
              {count != null && count > 0 && (
                <span className="num shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {count}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function LifecyclePanel() {
  const { goto } = useEsg();
  const [mode, setMode] = useState<"all" | string>("all");

  const counts = useMemo(() => lifecycleStageCounts(), []);
  const activeLifecycle = mode !== "all" ? PROJECT_LIFECYCLES.find((p) => p.projectId === mode) : undefined;
  const bottlenecked = PROJECT_LIFECYCLES.filter(lifecycleIsBottleneck);

  const onOpen = (sub: string) => goto("esms", { sub });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Waypoints className="h-4 w-4 text-primary" aria-hidden />
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="h-8 w-[240px] text-[12px]">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[12px]">All projects — pipeline view</SelectItem>
              {PROJECT_LIFECYCLES.map((p) => (
                <SelectItem key={p.projectId} value={p.projectId} className="text-[12px]">
                  {p.project}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-foreground/25 bg-muted/50" /> Start/end
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md border border-primary/25 bg-primary/8" /> Process
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md border border-warning/40 bg-warning/10" /> Decision
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md border border-dashed border-border bg-card" /> Document
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md border border-destructive/60 bg-destructive/8" /> Bottleneck
          </span>
        </div>
      </div>

      {activeLifecycle && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-4 py-2.5 text-[12px]">
          <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="font-medium">{activeLifecycle.project}</span>
          <span className="text-muted-foreground">
            · {entityById(activeLifecycle.entityId)?.short} · in{" "}
            <span className="font-semibold">{lifecycleStageByKey(activeLifecycle.currentStage)?.label}</span> since{" "}
            {fmtDate(activeLifecycle.stageEnteredOn)}
          </span>
          {lifecycleIsBottleneck(activeLifecycle) && (
            <span className="rounded-md bg-destructive/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
              Bottlenecked
            </span>
          )}
        </div>
      )}

      {mode === "all" && bottlenecked.length > 0 && (
        <div className="rounded-xl border border-destructive/35 bg-destructive/6 px-4 py-2.5 text-[12px] font-medium text-destructive">
          {bottlenecked.length} project{bottlenecked.length === 1 ? "" : "s"} stuck beyond the normal window —{" "}
          {bottlenecked.map((p) => p.project).join(", ")}.
        </div>
      )}

      <PanelCard>
        {/* Desktop: horizontal-scroll flowchart. Mobile: vertical stepper. */}
        <div className="hidden overflow-x-auto md:block">
          <DesktopFlow mode={mode} counts={counts} activeLifecycle={activeLifecycle} onOpen={onOpen} />
        </div>
        <div className="md:hidden">
          <MobileStepper mode={mode} counts={counts} activeLifecycle={activeLifecycle} onOpen={onOpen} />
        </div>
      </PanelCard>
    </div>
  );
}
