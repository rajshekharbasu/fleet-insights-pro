// src/lib/readiness/api.ts
const API_BASE = import.meta.env.VITE_API_URL || "https://dev-siteops-platform.transvolt.org/api/v1";

async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  let token = localStorage.getItem("token");
  if (token) return token;

  try {
    const formData = new URLSearchParams();
    formData.append("username", "admin");
    formData.append("password", "admin123");

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });
    if (res.ok) {
      const json = await res.json();
      const token = json.data?.access_token || json.access_token;
      if (token) {
        localStorage.setItem("token", token);
        return token;
      }
    }
  } catch (e) {
    console.error("Auto-login failed", e);
  }
  return null;
}

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("token");
    }
    let errorMsg = `API Error: ${response.statusText}`;
    try {
      const data = await response.json();
      if (data.detail) errorMsg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch (e) {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

// --- Interfaces ---

export interface ChecklistItemResponse {
  id: string;
  name: string;
  team: string;
  default_owner: string;
  priority: string;
  spend_type: string;
  category: string;
  default_sla_days: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SiteReadinessMatrixItem {
  readiness_id: string;
  site_id: string;
  site_name: string;
  checklist_item_id: string;
  checklist_name: string;
  team: string;
  owner: string | null;
  deadline: string | null;
  priority: string;
  spend_type: string;
  category: string;
  status: string;
  classification: string;
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface DashboardStatsResponse {
  items_in_scope: number;
  applicable_cells: number;
  cells_ready: number;
  overall_readiness_pct: number;
  workstream_classification: {
    completed: number;
    on_track: number;
    at_risk: number;
    delayed: number;
  };
  readiness_by_type: ChartDataPoint[];
  spend_mix: ChartDataPoint[];
  status_mix: ChartDataPoint[];
  readiness_across_sites: ChartDataPoint[];
}

export interface ReadinessSnapshotResponse {
  id: string;
  snapshot_date: string;
  site_id: string | null;
  total_items: number;
  done_items: number;
  readiness_pct: number;
  created_at: string;
}

export interface SiteDropdownItem {
  id: string;
  name: string;
  code: string;
  location?: string;
  is_active?: boolean;
  site_type?: string;
  project_id?: string;
  project_name?: string;
}

// --- API Functions ---

export async function fetchSitesDropdown(): Promise<SiteDropdownItem[]> {
  const [listRes, dropRes] = await Promise.all([
    fetchApi("/onboarding/sites?pagination=false&page_size=100"),
    fetchApi("/onboarding/sites/dropdown")
  ]);
  
  const dropdownSites = dropRes.data || [];
  
  return (listRes.data || []).map((site: any) => {
    const dropItem = dropdownSites.find((d: any) => d.id === site.id);
    return {
      id: site.id,
      name: site.name,
      code: site.code,
      location: site.location,
      is_active: site.is_active,
      site_type: dropItem?.site_type || site.site_type || "—",
      project_id: site.project_id,
      project_name: site.project_name
    };
  });
}

export async function fetchChecklistItems(): Promise<{ items: ChecklistItemResponse[], total: number }> {
  return fetchApi("/site-readiness/checklist-items?page=1&page_size=100&is_active=true").then(res => {
    const items = [...res.data].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return {
      items,
      total: res.pagination?.total_items || res.data.length
    };
  });
}

export async function createChecklistItem(data: Partial<ChecklistItemResponse>): Promise<ChecklistItemResponse> {
  return fetchApi("/site-readiness/checklist-items", {
    method: "POST",
    body: JSON.stringify(data),
  }).then(res => res.data); // Assuming ok(data) returns { data: ... }
}

export async function updateChecklistItem(id: string, data: Partial<ChecklistItemResponse>): Promise<ChecklistItemResponse> {
  return fetchApi(`/site-readiness/checklist-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }).then(res => res.data);
}

export async function deleteChecklistItem(id: string): Promise<void> {
  await fetchApi(`/site-readiness/checklist-items/${id}`, {
    method: "DELETE",
  });
}

export async function fetchMatrix(siteId?: string, projectId?: string): Promise<SiteReadinessMatrixItem[]> {
  const params = new URLSearchParams();
  if (siteId) params.append("site_id", siteId);
  if (projectId) params.append("project_id", projectId);
  const url = `/site-readiness/readiness/matrix${params.toString() ? '?' + params.toString() : ''}`;
  return fetchApi(url).then(res => res.data);
}

export async function fetchPendingQueue(siteId?: string, projectId?: string): Promise<SiteReadinessMatrixItem[]> {
  const params = new URLSearchParams();
  if (siteId) params.append("site_id", siteId);
  if (projectId) params.append("project_id", projectId);
  const url = `/site-readiness/readiness/pending${params.toString() ? '?' + params.toString() : ''}`;
  return fetchApi(url).then(res => res.data);
}

export async function fetchDashboardStats(projectId?: string): Promise<DashboardStatsResponse> {
  const url = projectId ? `/site-readiness/readiness/stats/dashboard?project_id=${projectId}` : "/site-readiness/readiness/stats/dashboard";
  return fetchApi(url).then(res => res.data);
}

export async function fetchGlobalStats(): Promise<any> {
  return fetchApi("/site-readiness/readiness/stats/global").then(res => res.data);
}

export async function fetchSnapshots(): Promise<ReadinessSnapshotResponse[]> {
  return fetchApi("/site-readiness/snapshots").then(res => res.data);
}

export async function updateSiteReadiness(id: string, data: any): Promise<any> {
  return fetchApi(`/site-readiness/readiness/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }).then(res => res.data);
}
