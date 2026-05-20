import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/layout/AppNav";
import { ChargerCommandCenter } from "@/components/charger/ChargerCommandCenter";
import { DailyInsightsBrief } from "@/components/insights/DailyInsightsBrief";
import { DEFAULT_CHARGER_FILTERS, type ChargerFilters } from "@/lib/charger-analytics";

export const Route = createFileRoute("/charging")({
  head: () => ({
    meta: [
      { title: "Charger Command Center · Voltline" },
      {
        name: "description",
        content:
          "Premium EV charging intelligence war-room — fleet, charger, depot, and live abnormality command.",
      },
    ],
  }),
  component: ChargerCommandPage,
});

function ChargerCommandPage() {
  const [filters, setFilters] = useState<ChargerFilters>(DEFAULT_CHARGER_FILTERS);

  return (
    <PageShell bare>
      <div className="space-y-8">
        <DailyInsightsBrief chargingOnly />
        <ChargerCommandCenter filters={filters} onFiltersChange={setFilters} />
      </div>
    </PageShell>
  );
}
