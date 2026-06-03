import { useEffect } from "react";
import { useMisSiteTemplate } from "@/contexts/MisSiteTemplateContext";
import { useMisReport } from "@/contexts/MisReportContext";

/** Applies active site template routes + site filter to MIS report context. */
export function MisTemplateSync() {
  const { activeSiteId, activeTemplate } = useMisSiteTemplate();
  const { setFilters } = useMisReport();

  useEffect(() => {
    setFilters({
      siteId: activeSiteId,
      routeFilters: activeTemplate.routes,
    });
  }, [activeSiteId, activeTemplate.id, activeTemplate.routes, setFilters]);

  return null;
}
