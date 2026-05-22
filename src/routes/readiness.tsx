import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/AppNav";
import { CeoReadinessDashboard } from "@/components/readiness/CeoReadinessDashboard";

export const Route = createFileRoute("/readiness")({
  head: () => ({
    meta: [
      { title: "Site Readiness · Executive · Voltline" },
      {
        name: "description",
        content:
          "Executive global view of site readiness — all locations, done vs pending, with deadlines.",
      },
    ],
  }),
  component: ReadinessPage,
});

function ReadinessPage() {
  return (
    <PageShell bare>
      <CeoReadinessDashboard />
    </PageShell>
  );
}
