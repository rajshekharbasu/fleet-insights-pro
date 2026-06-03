import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  resolveVisibleColumns,
  type KmsColumnId,
  type ColumnTemplateConfig,
} from "@/lib/mis/kms-columns";
import { MIS_SITES, type MisSite } from "@/lib/mis/sites";
import {
  createDefaultTemplate,
  duplicateTemplate,
  ensureSiteHasTemplate,
  loadSiteTemplates,
  saveSiteTemplates,
  templatesForSite,
  type SiteMisTemplate,
} from "@/lib/mis/site-templates";

type MisSiteTemplateContextValue = {
  sites: MisSite[];
  templates: SiteMisTemplate[];
  activeSiteId: string;
  activeTemplate: SiteMisTemplate;
  visibleColumns: ReturnType<typeof resolveVisibleColumns>;
  setActiveSite: (siteId: string) => void;
  setActiveTemplateId: (templateId: string) => void;
  saveTemplate: (template: SiteMisTemplate) => void;
  createTemplate: (siteId: string, name: string) => SiteMisTemplate;
  duplicateActiveTemplate: (newName: string) => void;
  deleteTemplate: (templateId: string) => void;
  updateActiveTemplateColumns: (
    columns: Partial<Record<KmsColumnId, ColumnTemplateConfig>>,
    columnOrder?: KmsColumnId[],
  ) => void;
  updateActiveTemplateRoutes: (routes: string[]) => void;
};

const MisSiteTemplateContext = createContext<MisSiteTemplateContextValue | null>(null);

export function MisSiteTemplateProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<SiteMisTemplate[]>(() => loadSiteTemplates());
  const [activeSiteId, setActiveSiteId] = useState(MIS_SITES[0]!.id);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setTemplates(loadSiteTemplates());
    window.addEventListener("voltline:mis-templates-changed", sync);
    return () => window.removeEventListener("voltline:mis-templates-changed", sync);
  }, []);

  useEffect(() => {
    if (templates.length > 0) return;
    const { templates: next, active } = ensureSiteHasTemplate([], activeSiteId);
    setTemplates(next);
    setActiveTemplateId(active.id);
  }, [activeSiteId, templates.length]);

  const activeTemplate = useMemo(() => {
    const siteTemplates = templatesForSite(templates, activeSiteId);
    return (
      siteTemplates.find((t) => t.id === activeTemplateId) ??
      siteTemplates[0] ??
      createDefaultTemplate(MIS_SITES[0]!)
    );
  }, [templates, activeSiteId, activeTemplateId]);

  const visibleColumns = useMemo(
    () => resolveVisibleColumns(activeTemplate.columnOrder, activeTemplate.columns),
    [activeTemplate],
  );

  const persist = useCallback((next: SiteMisTemplate[]) => {
    setTemplates(next);
    saveSiteTemplates(next);
  }, []);

  const saveTemplate = useCallback(
    (template: SiteMisTemplate) => {
      const next = templates.map((t) =>
        t.id === template.id ? { ...template, updatedAt: new Date().toISOString() } : t,
      );
      persist(next);
    },
    [templates, persist],
  );

  const setActiveSite = useCallback((siteId: string) => {
    setActiveSiteId(siteId);
    const siteTemplates = templatesForSite(loadSiteTemplates(), siteId);
    if (siteTemplates[0]) setActiveTemplateId(siteTemplates[0].id);
    else {
      const site = MIS_SITES.find((s) => s.id === siteId);
      if (site) {
        const created = createDefaultTemplate(site);
        const next = [...loadSiteTemplates(), created];
        persist(next);
        setActiveTemplateId(created.id);
      }
    }
  }, [persist]);

  const createTemplate = useCallback(
    (siteId: string, name: string) => {
      const site = MIS_SITES.find((s) => s.id === siteId);
      if (!site) throw new Error("Unknown site");
      const created = createDefaultTemplate(site, name);
      const next = [...templates, created];
      persist(next);
      setActiveTemplateId(created.id);
      setActiveSiteId(siteId);
      return created;
    },
    [templates, persist],
  );

  const duplicateActiveTemplate = useCallback(
    (newName: string) => {
      const copy = duplicateTemplate(activeTemplate, newName);
      persist([...templates, copy]);
      setActiveTemplateId(copy.id);
    },
    [activeTemplate, templates, persist],
  );

  const deleteTemplate = useCallback(
    (templateId: string) => {
      const siteTemplates = templatesForSite(templates, activeSiteId);
      if (siteTemplates.length <= 1) return;
      const next = templates.filter((t) => t.id !== templateId);
      persist(next);
      if (activeTemplateId === templateId) {
        setActiveTemplateId(templatesForSite(next, activeSiteId)[0]?.id ?? null);
      }
    },
    [templates, activeSiteId, activeTemplateId, persist],
  );

  const updateActiveTemplateColumns = useCallback(
    (columns: Partial<Record<KmsColumnId, ColumnTemplateConfig>>, columnOrder?: KmsColumnId[]) => {
      saveTemplate({
        ...activeTemplate,
        columns: { ...activeTemplate.columns, ...columns },
        columnOrder: columnOrder ?? activeTemplate.columnOrder,
      });
    },
    [activeTemplate, saveTemplate],
  );

  const updateActiveTemplateRoutes = useCallback(
    (routes: string[]) => {
      saveTemplate({ ...activeTemplate, routes });
    },
    [activeTemplate, saveTemplate],
  );

  const value: MisSiteTemplateContextValue = {
    sites: MIS_SITES,
    templates,
    activeSiteId,
    activeTemplate,
    visibleColumns,
    setActiveSite,
    setActiveTemplateId: setActiveTemplateId,
    saveTemplate,
    createTemplate,
    duplicateActiveTemplate,
    deleteTemplate,
    updateActiveTemplateColumns,
    updateActiveTemplateRoutes,
  };

  return (
    <MisSiteTemplateContext.Provider value={value}>{children}</MisSiteTemplateContext.Provider>
  );
}

export function useMisSiteTemplate() {
  const ctx = useContext(MisSiteTemplateContext);
  if (!ctx) throw new Error("useMisSiteTemplate must be used within MisSiteTemplateProvider");
  return ctx;
}
