import { createFileRoute, Link } from "@tanstack/react-router";
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
    <>
      <div className="mb-4 flex flex-wrap gap-4">
        <Link
          to="/readiness"
          className="text-[12px] font-medium text-primary hover:underline"
        >
          ← Back to executive view
        </Link>
        <Link
          to="/readiness/config"
          className="text-[12px] font-medium text-primary hover:underline"
        >
          Configuration (depots &amp; master checklist)
        </Link>
      </div>
      <SiteReadinessDashboard />
    </>
  );
}
