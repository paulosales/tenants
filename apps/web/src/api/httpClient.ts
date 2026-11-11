export interface IHttpClient {
  setToken(token: string | null): void;
  getToken(): string | null;
  request<T>(endpoint: string, options?: RequestInit): Promise<T>;
}

function resolveDefaultApiBase(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location?.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8080/api/v1';
  }
  return 'http://localhost:8080/api/v1';
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined' || !document.cookie) {
    return null;
  }
  for (const part of document.cookie.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === 'csrf_token' && rest.length > 0) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

const DEFAULT_API_BASE = resolveDefaultApiBase();

export class FetchHttpClient implements IHttpClient {
  private token: string | null = null;
  private readonly baseUrl: string;

  constructor(baseUrl: string = DEFAULT_API_BASE) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    if (!(options.body instanceof Blob) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('x-request-id', `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = readCsrfCookie();
      if (csrf) {
        headers.set('x-csrf-token', csrf);
      }
    }

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { title: 'Network or server error', status: response.status };
      }
      throw new Error(errorData.detail || errorData.title || `HTTP error ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }
}

