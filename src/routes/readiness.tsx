import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/AppNav";

export const Route = createFileRoute("/readiness")({
  component: ReadinessLayout,
});

function ReadinessLayout() {
  return (
    <PageShell bare>
      <Outlet />
    </PageShell>
  );
}
