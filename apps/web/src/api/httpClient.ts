export interface IHttpClient {
  setToken(token: string | null): void;
  getToken(): string | null;
  request<T>(endpoint: string, options?: RequestInit): Promise<T>;
}

const DEFAULT_API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

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
    headers.set('Content-Type', 'application/json');
    headers.set('x-request-id', `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

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

