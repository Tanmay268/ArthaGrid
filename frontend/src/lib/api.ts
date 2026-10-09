import { useAuthStore } from '@/store/authStore';
import type { ApiEnvelope, AuthResponseData } from '@/types/api';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// A silent refresh trades the httpOnly cookie for a new access token — no
// body token needed, since the browser attaches the cookie automatically.
// The custom header is required by the backend's CSRF guard for
// cookie-sourced refreshes (see extractRefreshToken.js in the main repo).
async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-ArthaGrid-Client': 'web',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) return null;

    const json = (await res.json()) as ApiEnvelope<AuthResponseData>;
    const token = json.data.accessToken;
    useAuthStore.getState().setAccessToken(token);
    return token;
  } catch {
    return null;
  }
}

// Multiple requests failing at once (e.g. a whole dashboard's worth of
// queries) should trigger exactly one refresh, not one per request.
let inFlightRefresh: Promise<string | null> | null = null;

async function refreshOnce(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = refreshAccessToken().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function request<T>(path: string, init: RequestInit = {}, allowRetry = true): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      // Required by the backend's CSRF guard whenever the refresh cookie is the
      // token source (logout, as well as refresh).
      'X-ArthaGrid-Client': 'web',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && allowRetry) {
    const newToken = await refreshOnce();
    if (newToken) return request<T>(path, init, false);
    useAuthStore.getState().clearSession();
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // No body (e.g. a 204 or a network-level failure) — fall through to the status check below.
  }

  if (!res.ok) {
    const envelope = json as { error?: { message?: string; details?: unknown } } | null;
    throw new ApiError(res.status, envelope?.error?.message ?? 'Something went wrong', envelope?.error?.details);
  }

  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { refreshAccessToken };
