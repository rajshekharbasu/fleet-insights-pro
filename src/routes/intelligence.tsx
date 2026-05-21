import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/AppNav";
import { IntelligenceCommandCenter } from "@/components/intelligence/IntelligenceCommandCenter";

export const Route = createFileRoute("/intelligence")({
  head: () => ({
    meta: [
      { title: "Charging Intelligence Command Center · Voltline" },
      {
        name: "description",
        content:
          "Explainable EV charger intelligence — operational health, charging curve analytics, energy flow, and predictive ops in a single command center.",
      },
    ],
  }),
  component: IntelligencePage,
});

function IntelligencePage() {
  return (
    <PageShell bare>
      <IntelligenceCommandCenter />
    </PageShell>
  );
}
