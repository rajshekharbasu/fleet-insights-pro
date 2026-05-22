import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/AppNav";
import { SiteReadinessDashboard } from "@/components/readiness/SiteReadinessDashboard";

export const Route = createFileRoute("/readiness/ops")({
  head: () => ({
    meta: [
      { title: "Site Readiness · Operations · Voltline" },
      {
        name: "description",
        content: "IT/ITMS site readiness matrix — edit cells, deadlines, and custom columns.",
      },
    ],
  }),
  component: ReadinessOpsPage,
});

function ReadinessOpsPage() {
  return (
    <PageShell bare>
      <div className="mb-4">
        <Link
          to="/readiness"
          className="text-[12px] font-medium text-primary hover:underline"
        >
          ← Back to executive view
        </Link>
      </div>
      <SiteReadinessDashboard />
    </PageShell>
  );
}
