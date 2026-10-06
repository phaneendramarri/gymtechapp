/**
 * Transport layer for the GymTech API client.
 *
 * Owns: base URL, CSRF double-submit storage, refresh-token storage, the
 * `request` pipeline (CSRF attach → 403 self-heal → 401 refresh-and-retry →
 * login redirect), and the sliding-window refresh call.
 *
 * Domain methods (members, payments, …) live in `api.ts` as
 * `ApiClient extends ApiClientBase` so `import { api } from '@/lib/api'`
 * keeps working. Nothing here knows about any business resource.
 */

// The Hono API is served from the same origin as the SPA (single Cloudflare
// Worker). The API is now versioned under `/api/v1/`.
// In dev, Vite's proxy or `wrangler dev` handles the routing. Override via
// `VITE_API_BASE_URL` only when explicitly needed.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * The session JWT is in an httpOnly cookie that the browser auto-attaches.
 * The client never reads it (kept out of XSS-reachable storage).
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

let _memoryCsrfToken: string | null = null;

/**
 * Read the `gym_csrf` non-httpOnly cookie value. Used for the
 * double-submit CSRF pattern: the web app reads the cookie and echoes it
 * as the `X-CSRF-Token` header on every non-safe request.
 * Falls back to in-memory / sessionStorage token if cookie is not yet parsed.
 */
export function readCsrfCookie(): string | null {
  if (typeof document !== 'undefined') {
    try {
      const match = document.cookie.match(/(?:^|;\s*)gym_csrf=([^;]+)/);
      if (match) return decodeURIComponent(match[1]);
    } catch {
      // Malformed cookie value — fall through to the in-memory/session copies.
    }
  }
  if (_memoryCsrfToken) return _memoryCsrfToken;
  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('gymtech_csrf_token');
  }
  return null;
}

export function saveCsrfToken(token: string | null): void {
  _memoryCsrfToken = token;
  if (typeof sessionStorage !== 'undefined') {
    if (token) sessionStorage.setItem('gymtech_csrf_token', token);
    else sessionStorage.removeItem('gymtech_csrf_token');
  }
}

/**
 * Token refresh interceptor storage. The refresh token lives in
 * sessionStorage (more isolated than localStorage). On 401 the client
 * attempts a sliding-window refresh, retries once, then redirects to login
 * only if refresh fails.
 */
const REFRESH_TOKEN_KEY = 'gymtech_refresh_token';
// Shared promise dedupes concurrent refresh attempts while one is in-flight
let _refreshPromise: Promise<string | null> | null = null;

export function getStoredRefreshToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredRefreshToken(token: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  if (token) sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  else sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiClientBase {
  protected async fetchCsrfToken(): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/csrf`, {
        method: 'GET',
        credentials: 'include',
      });
      const headerCsrf = res.headers.get('X-CSRF-Token');
      if (headerCsrf) {
        saveCsrfToken(headerCsrf);
        return headerCsrf;
      }
      const data: any = await res.json().catch(() => ({}));
      if (data?.csrfToken) {
        saveCsrfToken(data.csrfToken);
        return data.csrfToken;
      }
      return readCsrfCookie();
    } catch (err) {
      console.warn('[api] CSRF bootstrap failed:', (err as Error)?.message);
      return null;
    }
  }

  protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const method = (options.method || 'GET').toUpperCase();
    if (!SAFE_METHODS.has(method)) {
      let csrf = readCsrfCookie();
      if (!csrf) {
        csrf = await this.fetchCsrfToken();
      }
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }

    // Normalize endpoint so paths like '/api/dashboard', '/dashboard', or '/api/v1/dashboard'
    // resolve cleanly to the target versioned API mount without double prefixes.
    const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const cleanPath = normalized.replace(/^\/api\/v1/, '').replace(/^\/api/, '');
    const targetUrl = `${API_BASE_URL}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;

    const doFetch = () =>
      fetch(targetUrl, {
        ...options,
        headers,
        credentials: 'include',
      });

    let res = await doFetch();

    // Capture CSRF token echoed by server on auth operations
    const responseCsrf = res.headers.get('X-CSRF-Token');
    if (responseCsrf) {
      saveCsrfToken(responseCsrf);
    }

    // Auto-heal CSRF mismatch or missing token and retry once
    if (res.status === 403 && !SAFE_METHODS.has(method)) {
      const errorBody: any = await res.clone().json().catch(() => ({}));
      if (errorBody.code === 'CSRF_MISSING' || errorBody.code === 'CSRF_MISMATCH' || errorBody.error?.includes('CSRF')) {
        const freshCsrf = await this.fetchCsrfToken();
        if (freshCsrf) {
          headers['X-CSRF-Token'] = freshCsrf;
          res = await doFetch();
          const retryCsrf = res.headers.get('X-CSRF-Token');
          if (retryCsrf) saveCsrfToken(retryCsrf);
        }
      }
    }

    // On 401, attempt token refresh then retry original request once
    if (res.status === 401) {
      const refreshToken = getStoredRefreshToken();
      if (refreshToken) {
        // Reuse in-flight refresh if another request triggered it concurrently
        if (!_refreshPromise) {
          _refreshPromise = this.tryRefresh(refreshToken);
        }
        let newToken: string | null = null;
        try {
          newToken = await _refreshPromise;
        } catch {
          newToken = null;
        } finally {
          _refreshPromise = null;
        }
        if (newToken) {
          // Retry once with updated CSRF (cookie may have changed too)
          if (!SAFE_METHODS.has(method)) {
            const csrf = readCsrfCookie();
            if (csrf) headers['X-CSRF-Token'] = csrf;
          }
          res = await doFetch();
        }
      }

      // If still 401 or no refresh token → handle session invalidation
      if (res.status === 401) {
        setStoredRefreshToken(null);

        const isAuthCheck =
          endpoint.includes('/auth/me') ||
          endpoint.includes('/auth/csrf') ||
          endpoint.includes('/auth/refresh') ||
          endpoint.includes('/auth/login') ||
          endpoint.includes('/auth/member-login') ||
          endpoint.includes('/auth/forgot-password') ||
          endpoint.includes('/auth/reset-password') ||
          endpoint.includes('/auth/portal');

        const isPublicPath = typeof window !== 'undefined' && (
          window.location.pathname === '/' ||
          window.location.pathname === '/login' ||
          window.location.pathname.startsWith('/reset-password') ||
          window.location.pathname.startsWith('/about') ||
          window.location.pathname.startsWith('/contact') ||
          window.location.pathname.startsWith('/terms') ||
          window.location.pathname.startsWith('/privacy')
        );

        // Only force window redirect to /login if user was on a protected internal route
        // and their session truly expired. <ProtectedRoute> handles standard navigation guards.
        // Stash the deep link so LoginPage can return there after sign-in.
        if (!isAuthCheck && !isPublicPath && typeof window !== 'undefined') {
          try {
            const returnTo = `${window.location.pathname}${window.location.search}`;
            if (returnTo.startsWith('/') && !returnTo.startsWith('/login')) {
              sessionStorage.setItem('gymtech_return_to', returnTo);
            }
          } catch {
            // Storage unavailable — redirect still works, just without resume.
          }
          window.location.href = '/login';
        }
      }
    }

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      Object.assign(error, data);
      throw error;
    }

    return data as T;
  }

  // Sliding-window refresh — returns new access token or null on failure.
  // Uses the stored refresh token from sessionStorage; on success the new refresh
  // token is saved back to sessionStorage for the next cycle.
  private async tryRefresh(refreshToken: string): Promise<string | null> {
    try {
      const storedCsrf = readCsrfCookie();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (storedCsrf) headers['X-CSRF-Token'] = storedCsrf;

      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data: any = await res.json().catch(() => ({}));
      if (!data.token) return null;
      if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
      const csrf = res.headers.get('X-CSRF-Token');
      if (csrf) saveCsrfToken(csrf);
      return data.token as string;
    } catch (err) {
      console.warn('[api] Token refresh failed:', (err as Error)?.message);
      return null;
    }
  }
}
