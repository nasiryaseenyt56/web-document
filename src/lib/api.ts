// Safe API client with automatic backend URL resolution for Netlify & static hosts

export const CLOUD_RUN_BACKEND = '';

/**
 * Resolve the API base URL based on host environment
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. Check if explicit custom URL saved in localStorage
  const savedUrl = localStorage.getItem('store_api_base_url');
  if (savedUrl) return savedUrl.replace(/\/+$/, '');

  const hostname = window.location.hostname;

  // 2. If running on local development or Cloud Run, use relative path
  if (
    hostname === 'localhost' ||
    hostname.includes('127.0.0.1') ||
    hostname.endsWith('.run.app') ||
    hostname.includes('.run.app')
  ) {
    return '';
  }

  // 3. If running on external host with custom backend configured
  if (CLOUD_RUN_BACKEND) {
    return CLOUD_RUN_BACKEND;
  }

  return '';
}

/**
 * Safe fetch JSON wrapper that NEVER throws "Unexpected token '<', <!DOCTYPE... is not valid JSON"
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = getApiBaseUrl();
  const primaryUrl = baseUrl ? `${baseUrl}${cleanEndpoint}` : cleanEndpoint;

  let res: Response;
  try {
    res = await fetch(primaryUrl, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options?.headers || {}),
      },
    });
  } catch (err: any) {
    // If primary URL failed and baseUrl was set, try relative as fallback
    if (baseUrl) {
      try {
        res = await fetch(cleanEndpoint, {
          ...options,
          headers: {
            Accept: 'application/json',
            ...(options?.headers || {}),
          },
        });
      } catch (subErr: any) {
        return { ok: false, status: 0, error: subErr?.message || 'Network connection failed' };
      }
    } else {
      return { ok: false, status: 0, error: err?.message || 'Network connection failed' };
    }
  }

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  // Detect HTML response (SPA index.html rewrite or 404 page)
  const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE') || contentType.includes('text/html');

  if (isHtml) {
    return {
      ok: false,
      status: res.status,
      error: `Backend endpoint '${cleanEndpoint}' returned HTML instead of JSON (${res.status}). Ensure the server is running.`,
    };
  }

  try {
    const data = JSON.parse(text);
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: !res.ok ? (data?.error || `Request failed with status ${res.status}`) : undefined,
    };
  } catch {
    return {
      ok: false,
      status: res.status,
      error: 'Invalid JSON response from server',
    };
  }
}
