import { useState } from "react";
import { Building2, Settings2 } from "lucide-react";
import { useMisSiteTemplate } from "@/contexts/MisSiteTemplateContext";
import { templatesForSite } from "@/lib/mis/site-templates";
import { OPS } from "@/lib/mis/ops-copy";
import { Button } from "@/components/ui/button";
import { MisTemplateEditorDialog } from "./MisTemplateEditorDialog";

export function MisSiteTemplateBar() {
  const {
    sites,
    templates,
    activeSiteId,
    activeTemplate,
    setActiveSite,
    setActiveTemplateId,
  } = useMisSiteTemplate();
  const [editorOpen, setEditorOpen] = useState(false);

  const siteTemplates = templatesForSite(templates, activeSiteId);

  return (
    <>
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border/50 bg-card/50 p-4">
        <div className="flex items-center gap-2 text-primary">
          <Building2 className="h-5 w-5" />
          <span className="text-[13px] font-semibold">{OPS.step1}</span>
        </div>

        <label className="text-[12px]">
          <span className="mb-1.5 block font-medium">{OPS.yourDepot}</span>
          <select
            value={activeSiteId}
            onChange={(e) => setActiveSite(e.target.value)}
            className="h-11 min-w-[180px] rounded-md border border-border/60 bg-background px-3 text-[14px]"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-[12px]">
          <span className="mb-1.5 block font-medium">{OPS.reportStyle}</span>
          <select
            value={activeTemplate.id}
            onChange={(e) => setActiveTemplateId(e.target.value)}
            className="h-11 min-w-[240px] rounded-md border border-border/60 bg-background px-3 text-[14px]"
          >
            {siteTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.templateName}
              </option>
            ))}
          </select>
        </label>

        <div className="flex-1 min-w-[200px] text-[12px] text-muted-foreground">
          <span className="font-medium text-foreground">Routes in this style:</span>{" "}
          {activeTemplate.routes.length === 0
            ? "All routes (add routes in setup)"
            : activeTemplate.routes.join(", ")}
        </div>

        <Button
          variant="outline"
          size="lg"
          className="h-11 gap-2 text-[13px]"
          onClick={() => setEditorOpen(true)}
        >
          <Settings2 className="h-4 w-4" />
          {OPS.customizeLayout}
        </Button>
      </div>

      <MisTemplateEditorDialog open={editorOpen} onOpenChange={setEditorOpen} />
    </>
  );
}
