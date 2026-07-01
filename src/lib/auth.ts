/**
 * Lightweight client-side auth/session helpers.
 *
 * This is intentionally front-end only (localStorage) so it can be swapped for
 * a real session/JWT layer later without changing call sites. The signed-in
 * identity is persisted under `voltline-user` and read by route guards.
 */

export type AuthProvider = "microsoft" | "password";

export interface AuthUser {
  email: string;
  provider: AuthProvider;
  name?: string;
}

const USER_KEY = "voltline-user";

/**
 * Bearer token storage key. Shared with the SiteOps REST client
 * (`src/lib/readiness/api.ts`) so authenticated calls reuse the same session.
 */
const TOKEN_KEY = "token";

/**
 * SiteOps / Enterprise Architecture (ea-platform) API base. Same backend the
 * rest of the app talks to; ends in `/api/v1`. Microsoft SSO and the `auth/me`
 * identity lookup both live here.
 */
export const AUTH_API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://dev-siteops-platform.transvolt.org/api/v1";

/**
 * Builds the Microsoft (Entra ID) sign-in URL exactly the way the ea-platform
 * backend expects: it kicks off the OAuth flow and, on success, redirects the
 * browser back to `redirectPath` with the tokens in the URL hash fragment
 * (`#access_token=…&refresh_token=…`).
 */
export function buildMicrosoftLoginUrl(redirectPath = "/auth/callback"): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const callbackUrl = `${origin}${redirectPath}`;
  return `${AUTH_API_BASE}/auth/microsoft/login?redirect_uri=${encodeURIComponent(
    callbackUrl,
  )}`;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Resolves the signed-in identity from the backend using the stored bearer
 * token (`GET {AUTH_API_BASE}/auth/me`). The Microsoft callback returns only
 * tokens, so this is how we learn the user's email for the Data Sync allowlist.
 */
export async function fetchCurrentUserFromApi(): Promise<AuthUser | null> {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(`${AUTH_API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    // The backend wraps the payload as `{ data: { ... } }`; tolerate either shape.
    const data = body?.data ?? body ?? {};
    const email: string = (data.email || data.username || "").trim();
    if (!email) return null;
    const name: string | undefined =
      data.full_name || data.name || data.username || undefined;
    return { email, provider: "microsoft", name };
  } catch {
    return null;
  }
}

/**
 * Emails permitted to open the Data Sync page. Edit this list to grant/revoke
 * access. Comparison is case-insensitive.
 */
export const DATA_SYNC_ALLOWLIST: string[] = [
  "jafar.k@transvolt.in",
  "kunal.s@transvolt.in",
  "sumit.k@transvolt.in",
  "saud.s@transvolt.in",

];

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearCurrentUser(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
}

export function canAccessDataSync(user: AuthUser | null): boolean {
  if (!user?.email) return false;
  const email = user.email.trim().toLowerCase();
  return DATA_SYNC_ALLOWLIST.some((allowed) => allowed.toLowerCase() === email);
}
