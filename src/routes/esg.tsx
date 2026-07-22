import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Globe } from "lucide-react";
import { PageShell } from "@/components/layout/AppNav";
import { EsgHeader } from "@/components/esg/EsgHeader";
import { EsmsTab } from "@/components/esg/EsmsTab";
import { MastersTab } from "@/components/esg/MastersTab";
import { OverviewTab } from "@/components/esg/OverviewTab";
import { ProjectsTab } from "@/components/esg/ProjectsTab";
import { RecordDrawer } from "@/components/esg/RecordDrawer";
import { ReportsTab } from "@/components/esg/ReportsTab";
import { VendorsTab } from "@/components/esg/VendorsTab";
import { EsgContext, type Audience, type EsgCtx } from "@/components/esg/primitives";
import { PERIODS, RECORDS, type ScopeSel } from "@/lib/esg-data";
import { usePolicyWorkflow, type Role } from "@/lib/esg-policy";
import { useAuditWorkflow } from "@/lib/esg-audit";
import { useTrainingWorkflow } from "@/lib/esg-training";
import { useMonitoringWorkflow } from "@/lib/esg-monitoring";
import { useMastersWorkflow } from "@/lib/esg-masters";
import { personById } from "@/lib/esg-data";

type EsgSearch = { area?: string; sub?: string; record?: string };

const trainingPersonLabel = (id: string) => {
  const p = personById(id);
  return { name: p?.name ?? id, role: p?.role ?? "" };
};

export const Route = createFileRoute("/esg")({
  validateSearch: (s: Record<string, unknown>): EsgSearch => ({
    area: typeof s.area === "string" ? s.area : undefined,
    sub: typeof s.sub === "string" ? s.sub : undefined,
    record: typeof s.record === "string" ? s.record : undefined,
  }),
  head: () => ({
    meta: [
      { title: "ESG · Voltline" },
      {
        name: "description",
        content: "Compliance command — permits, ESMS, GHG and reports. A pump against expiry, not a shelf for documents.",
      },
    ],
  }),
  component: EsgPage,
});

function EsgPage() {
  const navigate = useNavigate({ from: "/esg" });
  const { area = "overview", sub, record } = Route.useSearch();

  const [scope, setScope] = useState<ScopeSel>({});
  const [period, setPeriod] = useState(PERIODS[0].id);
  const [audience, setAudience] = useState<Audience>("internal");
  const [role, setRole] = useState<Role>("maintainer");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const policy = usePolicyWorkflow();
  const audit = useAuditWorkflow();
  const training = useTrainingWorkflow(trainingPersonLabel);
  const monitoring = useMonitoringWorkflow();
  const masters = useMastersWorkflow();

  const goto = useCallback(
    (nextArea: string, opts?: { record?: string; state?: string; sub?: string }) => {
      void navigate({ search: { area: nextArea, record: opts?.record, sub: opts?.sub } });
      if (opts?.record) setDrawerId(opts.record);
    },
    [navigate],
  );

  const openRecord = useCallback((id: string) => setDrawerId(id), []);

  const ctx = useMemo<EsgCtx>(
    () => ({ scope, setScope, period, setPeriod, audience, setAudience, role, setRole, policy, audit, training, monitoring, masters, openRecord, goto }),
    [scope, period, audience, role, policy, audit, training, monitoring, masters, openRecord, goto],
  );

  // Notification deep-links land with ?record= — open the drawer and highlight the row.
  const activeRecordId = drawerId ?? record ?? null;
  const activeRecord = activeRecordId ? (RECORDS.find((r) => r.id === activeRecordId) ?? null) : null;
  const closeDrawer = () => {
    setDrawerId(null);
    if (record) void navigate({ search: { area, record: undefined, sub: undefined } });
  };

  const external = audience === "external";
  const reduce = useReducedMotion();

  const body = (
    <>
      {area === "overview" && <OverviewTab deepLinkRecordId={record ?? undefined} />}
      {area === "esms" && <EsmsTab initialSub={sub} />}
      {area === "projects" && <ProjectsTab initialSub={sub} />}
      {area === "reports" && <ReportsTab />}
      {area === "vendors" && <VendorsTab />}
      {area === "masters" && <MastersTab />}
    </>
  );

  return (
    <EsgContext.Provider value={ctx}>
      <PageShell
        eyebrow="Environmental · Social · Governance"
        title="ESG"
        titleAccent="Command"
        description="A pump against compliance decay — what's draining, who owns it, and when it must be renewed. Continuous capture; monthly reporting on the 7th."
        meta={
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-[11.5px] font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Live — dashboard reads the record continuously, not on the report cycle
          </div>
        }
      >
        <div className="space-y-5">
          <EsgHeader area={area} />
          {/* Tab switches blur-crossfade; the audience lens fades so the curated
              swap reads as a deliberate mode change, not a reload. */}
          <motion.div
            key={area}
            initial={reduce ? false : { opacity: 0.35, filter: "blur(3px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <motion.div
              key={audience}
              initial={reduce ? false : { opacity: 0, filter: "blur(2px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            >
              {external ? (
                <div className="rounded-2xl border border-dashed border-border/80 p-3 sm:p-4">
                  <div className="mb-3 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" aria-hidden />
                    External view — curated · non-compliance is withheld here but never internally
                  </div>
                  {body}
                </div>
              ) : (
                body
              )}
            </motion.div>
          </motion.div>
        </div>
        {activeRecord && <RecordDrawer record={activeRecord} onClose={closeDrawer} />}
      </PageShell>
    </EsgContext.Provider>
  );
}
