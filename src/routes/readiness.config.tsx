import { createFileRoute } from "@tanstack/react-router";
import { ReadinessConfigPanel } from "@/components/readiness/ReadinessConfigPanel";

export const Route = createFileRoute("/readiness/config")({
  head: () => ({
    meta: [
      { title: "Site Readiness · Configuration · Voltline" },
      {
        name: "description",
        content: "Configure depots and master readiness checklist with default SLA.",
      },
    ],
  }),
  component: ReadinessConfigPanel,
});
