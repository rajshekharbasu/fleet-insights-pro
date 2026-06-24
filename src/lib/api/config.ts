import { GRAPHQL_BASE_URL } from "../graphql/config";

/** REST base for the Fleet Analytics (DuckDB) API — same host as GraphQL. */
export const API_BASE_URL = GRAPHQL_BASE_URL;

const API_KEY_STORAGE = "voltline-fleet-api-key";

/** Reads the API key: localStorage override first, then build-time env. */
export function getApiKey(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(API_KEY_STORAGE);
    if (stored) return stored;
  }
  return (import.meta.env.VITE_FLEET_API_KEY as string | undefined) ?? "";
}

export function setApiKey(key: string): void {
  if (typeof window === "undefined") return;
  const trimmed = key.trim();
  if (trimmed) window.localStorage.setItem(API_KEY_STORAGE, trimmed);
  else window.localStorage.removeItem(API_KEY_STORAGE);
}

export function clearApiKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(API_KEY_STORAGE);
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}
