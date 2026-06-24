import { API_BASE_URL, getApiKey } from "./config";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ValidationDetail {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
}

function extractErrorMessage(status: number, body: unknown): string {
  if (status === 401 || status === 403) return "API key missing or invalid. Update it and try again.";
  if (body && typeof body === "object") {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const parts = (detail as ValidationDetail[])
        .map((d) => {
          const where = Array.isArray(d.loc) ? d.loc.filter((x) => x !== "body").join(".") : "";
          return where ? `${where}: ${d.msg ?? "invalid"}` : d.msg ?? "invalid";
        })
        .filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string") return err;
  }
  return `Request failed (${status})`;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const key = getApiKey();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "X-API-Key": key } : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    throw new ApiError(extractErrorMessage(res.status, parsed), res.status);
  }
  return parsed as T;
}

export const apiGet = <T>(path: string) => request<T>(path, { method: "GET" });

export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body == null ? undefined : JSON.stringify(body) });

export const apiDelete = <T>(path: string) => request<T>(path, { method: "DELETE" });

/** POST that returns a Blob (for CSV export). Throws ApiError on failure. */
export async function apiPostBlob(path: string, body: unknown): Promise<Blob> {
  const key = getApiKey();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "X-API-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    throw new ApiError(extractErrorMessage(res.status, parsed), res.status);
  }
  return res.blob();
}
