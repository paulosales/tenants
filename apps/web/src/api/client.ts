import type {
  Amenity,
  AuthResponse,
  CreateReservationRequest,
  ParkingLayoutResponse,
  ParkingZone,
  Reservation,
  ReservationWithDetails,
  UserSummary,
} from '@tenants/shared-types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    headers.set('x-request-id', `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Automatically sends and receives HttpOnly cookies
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

  // --- Auth Endpoints ---
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
    this.setToken(null);
  }

  async getCurrentUser(): Promise<UserSummary> {
    return this.request<UserSummary>('/auth/me');
  }

  // --- Amenities & Reservations ---
  async getAmenities(): Promise<Amenity[]> {
    return this.request<Amenity[]>('/amenities');
  }

  async getAmenityReservations(amenityId: string, startDate: string, endDate: string): Promise<Reservation[]> {
    const params = new URLSearchParams({
      amenity_id: amenityId,
      start_date: startDate,
      end_date: endDate,
    });
    return this.request<Reservation[]>(`/amenities/availability?${params}`);
  }

  async createReservation(req: CreateReservationRequest): Promise<Reservation> {
    return this.request<Reservation>('/reservations', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async getMyReservations(): Promise<ReservationWithDetails[]> {
    return this.request<ReservationWithDetails[]>('/reservations/my');
  }

  async cancelReservation(id: string): Promise<void> {
    return this.request<void>(`/reservations/${id}/cancel`, { method: 'POST' });
  }

  // --- Parking Endpoints ---
  async getParkingZones(): Promise<ParkingZone[]> {
    return this.request<ParkingZone[]>('/parking/zones');
  }

  async getParkingLayout(zoneId: string): Promise<ParkingLayoutResponse> {
    return this.request<ParkingLayoutResponse>(`/parking/zones/${zoneId}/layout`);
  }

  async reserveSpot(spotId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/parking/reserve', {
      method: 'POST',
      body: JSON.stringify({ spot_id: spotId }),
    });
  }

  async updateSvgLayout(zoneId: string, svgMarkup: string): Promise<{ message: string; svg: string }> {
    return this.request<{ message: string; svg: string }>(`/parking/zones/${zoneId}/svg`, {
      method: 'PUT',
      body: JSON.stringify({ svg_markup: svgMarkup }),
    });
  }

  async upsertSpot(data: any): Promise<any> {
    return this.request('/parking/spots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
