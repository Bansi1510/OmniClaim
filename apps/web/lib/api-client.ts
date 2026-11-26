export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const TOKEN_STORAGE_KEY = 'omniclaim_access_token';
export const SESSION_STORAGE_KEY = 'omniclaim_auth_session_v2';

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    try {
      const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed?.userId) headers['x-user-id'] = parsed.userId;
        if (parsed?.userEmail) headers['x-user-email'] = parsed.userEmail;
      }
    } catch {
      // ignore
    }
  }

  return headers;
}

export async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...buildAuthHeaders(),
        ...(extraHeaders || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    const text = await res.text();
    let json: any = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json?.message || json?.detail || `HTTP ${res.status}`,
      };
    }

    return { ok: true, status: res.status, data: json as T };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: (err as Error).message || 'Network error',
    };
  }
}
