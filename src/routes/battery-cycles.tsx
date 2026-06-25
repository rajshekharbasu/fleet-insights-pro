import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/AppNav";
import { BatteryCycleIntelligence } from "@/components/battery/BatteryCycleIntelligence";

export const Route = createFileRoute("/battery-cycles")({
  head: () => ({
    meta: [
      { title: "Operational Efficiency · Voltline" },
      {
        name: "description",
        content:
          "HV battery discharge-cycle intelligence — operational efficiency, equivalent full cycles, and per-bus health across the fleet.",
      },
    ],
  }),
  component: BatteryCyclesPage,
});

function BatteryCyclesPage() {
  return (
    <PageShell bare>
      <BatteryCycleIntelligence />
    </PageShell>
  );
}
