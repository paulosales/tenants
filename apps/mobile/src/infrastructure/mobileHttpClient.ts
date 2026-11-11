import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'apexliving_mobile_access_token';

const globalProcessEnv = (
  globalThis as { process?: { env?: Record<string, string | undefined> } }
)?.process?.env;

const DEFAULT_MOBILE_API_BASE =
  globalProcessEnv?.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export class MobileHttpClient {
  private inMemoryToken: string | null = null;
  private readonly baseUrl: string;

  constructor(baseUrl: string = DEFAULT_MOBILE_API_BASE) {
    this.baseUrl = baseUrl;
  }

  async setToken(token: string | null): Promise<void> {
    this.inMemoryToken = token;
    try {
      if (token) {
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
      } else {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      }
    } catch {
      // Fallback safely to in-memory token on environments without native Keychain/Keystore (e.g. Jest/Web)
    }
  }

  async getToken(): Promise<string | null> {
    if (this.inMemoryToken) {
      return this.inMemoryToken;
    }
    try {
      const stored = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      this.inMemoryToken = stored;
      return stored;
    } catch {
      return null;
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-request-id': `mob-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let detail = `HTTP error ${res.status}`;
      try {
        const body = await res.json();
        detail = body.detail || body.title || detail;
      } catch {
        // Keep generic HTTP error
      }
      throw new Error(detail);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return res.json() as Promise<T>;
  }
}

export const mobileHttpClient = new MobileHttpClient();
