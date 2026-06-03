import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/AppNav";
import { MisReportBuilder } from "@/components/mis/MisReportBuilder";

export const Route = createFileRoute("/mis")({
  head: () => ({
    meta: [
      { title: "MIS Report Builder · Voltline" },
      {
        name: "description",
        content: "KMS reports, trip adjustments, and pivot analytics for EV bus fleet operations.",
      },
    ],
  }),
  component: MisPage,
});

function MisPage() {
  return (
    <PageShell bare>
      <MisReportBuilder />
    </PageShell>
  );
}
