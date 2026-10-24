import type {
  AdminAmenity,
  Amenity,
  AuthResponse,
  CreateAmenityDto,
  CreatePropertyDto,
  CreateReservationRequest,
  CreateTenantDto,
  CreateUnitDto,
  ParkingLayoutResponse,
  ParkingLayoutWithSpots,
  ParkingZone,
  Property,
  PropertyWithStats,
  Reservation,
  ReservationWithDetails,
  SaveParkingLayoutRequest,
  Tenant,
  TenantStatus,
  TenantWithUnit,
  Unit,
  UnitWithTenant,
  UpdateAmenityDto,
  UpdatePropertyDto,
  UpdateTenantDto,
  UpdateUnitDto,
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

  // ==========================================
  // Admin: Properties Endpoints
  // ==========================================
  async getProperties(): Promise<PropertyWithStats[]> {
    return this.request<PropertyWithStats[]>('/properties');
  }

  async getProperty(id: string): Promise<Property> {
    return this.request<Property>(`/properties/${id}`);
  }

  async createProperty(data: CreatePropertyDto): Promise<Property> {
    return this.request<Property>('/properties', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProperty(id: string, data: UpdatePropertyDto): Promise<Property> {
    return this.request<Property>(`/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProperty(id: string): Promise<void> {
    return this.request<void>(`/properties/${id}`, { method: 'DELETE' });
  }

  // ==========================================
  // Admin: Units Endpoints
  // ==========================================
  async getUnits(propertyId: string): Promise<UnitWithTenant[]> {
    return this.request<UnitWithTenant[]>(`/properties/${propertyId}/units`);
  }

  async createUnit(propertyId: string, data: CreateUnitDto): Promise<Unit> {
    return this.request<Unit>(`/properties/${propertyId}/units`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUnit(id: string, data: UpdateUnitDto): Promise<Unit> {
    return this.request<Unit>(`/units/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUnit(id: string): Promise<void> {
    return this.request<void>(`/units/${id}`, { method: 'DELETE' });
  }

  // ==========================================
  // Admin: Tenants Endpoints
  // ==========================================
  async getTenants(filters?: { property_id?: string; status?: TenantStatus; q?: string }): Promise<TenantWithUnit[]> {
    const params = new URLSearchParams();
    if (filters?.property_id) params.set('property_id', filters.property_id);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.q) params.set('q', filters.q);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<TenantWithUnit[]>(`/tenants${queryString}`);
  }

  async getTenant(id: string): Promise<TenantWithUnit> {
    return this.request<TenantWithUnit>(`/tenants/${id}`);
  }

  async createTenant(data: CreateTenantDto): Promise<Tenant> {
    return this.request<Tenant>('/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTenant(id: string, data: UpdateTenantDto): Promise<Tenant> {
    return this.request<Tenant>(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTenant(id: string): Promise<void> {
    return this.request<void>(`/tenants/${id}`, { method: 'DELETE' });
  }

  // ==========================================
  // Admin: Amenities Endpoints
  // ==========================================
  async getPropertyAmenities(propertyId: string): Promise<AdminAmenity[]> {
    return this.request<AdminAmenity[]>(`/properties/${propertyId}/amenities`);
  }

  async createPropertyAmenity(propertyId: string, data: CreateAmenityDto): Promise<AdminAmenity> {
    return this.request<AdminAmenity>(`/properties/${propertyId}/amenities`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePropertyAmenity(id: string, data: UpdateAmenityDto): Promise<AdminAmenity> {
    return this.request<AdminAmenity>(`/amenities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePropertyAmenity(id: string): Promise<void> {
    return this.request<void>(`/amenities/${id}`, { method: 'DELETE' });
  }

  // ==========================================
  // Admin: Parking Layout Visual Builder Endpoints
  // ==========================================
  async getAdminParkingLayout(propertyId: string): Promise<ParkingLayoutWithSpots> {
    return this.request<ParkingLayoutWithSpots>(`/properties/${propertyId}/parking-layout`);
  }

  async saveAdminParkingLayout(
    propertyId: string,
    data: SaveParkingLayoutRequest
  ): Promise<{ message: string; data: ParkingLayoutWithSpots }> {
    return this.request<{ message: string; data: ParkingLayoutWithSpots }>(`/properties/${propertyId}/parking-layout`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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

  // --- Legacy Parking Endpoints ---
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
