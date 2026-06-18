// src/lib/readiness/queries.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

export const readinessKeys = {
  all: ["site-readiness"] as const,
  sites: () => [...readinessKeys.all, "sites"] as const,
  checklists: () => [...readinessKeys.all, "checklists"] as const,
  matrix: (siteId?: string, projectId?: string) => [...readinessKeys.all, "matrix", siteId, projectId] as const,
  pending: (siteId?: string, projectId?: string) => [...readinessKeys.all, "pending", siteId, projectId] as const,
  dashboardStats: (projectId?: string) => [...readinessKeys.all, "dashboardStats", projectId] as const,
  globalStats: () => [...readinessKeys.all, "globalStats"] as const,
  snapshots: () => [...readinessKeys.all, "snapshots"] as const,
};

export function useSites() {
  return useQuery({
    queryKey: readinessKeys.sites(),
    queryFn: () => api.fetchSitesDropdown(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useChecklistItems() {
  return useQuery({
    queryKey: readinessKeys.checklists(),
    queryFn: () => api.fetchChecklistItems(),
  });
}

export function useCreateChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<api.ChecklistItemResponse>) => api.createChecklistItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readinessKeys.checklists() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.matrix() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.pending() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.dashboardStats() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.globalStats() });
    },
  });
}

export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<api.ChecklistItemResponse> }) =>
      api.updateChecklistItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readinessKeys.checklists() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.matrix() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.pending() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.dashboardStats() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.globalStats() });
    },
  });
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteChecklistItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readinessKeys.checklists() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.matrix() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.pending() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.dashboardStats() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.globalStats() });
    },
  });
}

export function useMatrix(siteId?: string, projectId?: string) {
  return useQuery({
    queryKey: readinessKeys.matrix(siteId, projectId),
    queryFn: () => api.fetchMatrix(siteId, projectId),
  });
}

export function usePendingQueue(siteId?: string, projectId?: string) {
  return useQuery({
    queryKey: readinessKeys.pending(siteId, projectId),
    queryFn: () => api.fetchPendingQueue(siteId, projectId),
  });
}

export function useDashboardStats(projectId?: string) {
  return useQuery({
    queryKey: readinessKeys.dashboardStats(projectId),
    queryFn: () => api.fetchDashboardStats(projectId),
  });
}

export function useGlobalStats() {
  return useQuery({
    queryKey: readinessKeys.globalStats(),
    queryFn: () => api.fetchGlobalStats(),
  });
}

export function useSnapshots() {
  return useQuery({
    queryKey: readinessKeys.snapshots(),
    queryFn: () => api.fetchSnapshots(),
  });
}

export function useUpdateSiteReadiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateSiteReadiness(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readinessKeys.matrix() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.pending() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.dashboardStats() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.globalStats() });
    },
  });
}
