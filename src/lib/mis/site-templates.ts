import {
  DEFAULT_COLUMN_ORDER,
  KMS_COLUMN_CATALOG,
  type ColumnTemplateConfig,
  type KmsColumnId,
} from "./kms-columns";
import { DEFAULT_SITE_ROUTES, misSiteById, type MisSite } from "./sites";
import type { PivotConfig } from "./types";

export interface SiteMisTemplate {
  id: string;
  siteId: string;
  siteName: string;
  templateName: string;
  columnOrder: KmsColumnId[];
  columns: Partial<Record<KmsColumnId, ColumnTemplateConfig>>;
  routes: string[];
  pivotConfig?: PivotConfig;
  updatedAt: string;
}

const STORAGE_KEY = "voltline.mis.site-templates.v1";

function defaultColumns(): Partial<Record<KmsColumnId, ColumnTemplateConfig>> {
  const out: Partial<Record<KmsColumnId, ColumnTemplateConfig>> = {};
  KMS_COLUMN_CATALOG.forEach((c) => {
    out[c.id] = { header: c.defaultHeader, visible: true };
  });
  return out;
}

export function createDefaultTemplate(site: MisSite, name?: string): SiteMisTemplate {
  return {
    id: crypto.randomUUID(),
    siteId: site.id,
    siteName: site.name,
    templateName: name ?? `${site.name} — Standard KMS`,
    columnOrder: [...DEFAULT_COLUMN_ORDER],
    columns: defaultColumns(),
    routes: [...(DEFAULT_SITE_ROUTES[site.id] ?? [])],
    pivotConfig: {
      rowDim: "route",
      colDim: "none",
      metrics: ["completedTrips", "lostTrips", "billingKMs"],
    },
    updatedAt: new Date().toISOString(),
  };
}

export function loadSiteTemplates(): SiteMisTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SiteMisTemplate[];
  } catch {
    return [];
  }
}

export function saveSiteTemplates(templates: SiteMisTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  window.dispatchEvent(new CustomEvent("voltline:mis-templates-changed"));
}

export function templatesForSite(templates: SiteMisTemplate[], siteId: string): SiteMisTemplate[] {
  return templates.filter((t) => t.siteId === siteId);
}

export function ensureSiteHasTemplate(
  templates: SiteMisTemplate[],
  siteId: string,
): { templates: SiteMisTemplate[]; active: SiteMisTemplate } {
  const site = misSiteById(siteId);
  if (!site) throw new Error(`Unknown site: ${siteId}`);

  const existing = templatesForSite(templates, siteId);
  if (existing.length > 0) {
    return { templates, active: existing[0]! };
  }
  const created = createDefaultTemplate(site);
  const next = [...templates, created];
  saveSiteTemplates(next);
  return { templates: next, active: created };
}

export function duplicateTemplate(template: SiteMisTemplate, newName: string): SiteMisTemplate {
  return {
    ...structuredClone(template),
    id: crypto.randomUUID(),
    templateName: newName,
    updatedAt: new Date().toISOString(),
  };
}
