import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/AppNav";
import { SiteReadinessDashboard } from "@/components/readiness/SiteReadinessDashboard";

export const Route = createFileRoute("/readiness")({
  head: () => ({
    meta: [
      { title: "Site Readiness · Voltline" },
      { name: "description", content: "Centralised web view of IT/ITMS site readiness across Transvolt Mobility depots — replaces the master Excel sheet." },
    ],
  }),
  component: ReadinessPage,
});

function ReadinessPage() {
  return (
    <PageShell bare>
      <SiteReadinessDashboard />
    </PageShell>
  );
}
