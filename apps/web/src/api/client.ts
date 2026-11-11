import type {
  AddPropertyFeatureDto,
  AdminAmenity,
  Amenity,
  AmenitySessionBooking,
  AssignMaintenanceCallStaffDto,
  AssignParkingSpotDto,
  AuthResponse,
  CreateAmenityDto,
  CreateAmenitySessionDto,
  CreateMaintenanceCallDto,
  CreatePropertyDto,
  CreateReservationRequest,
  CreateStaffDto,
  CreateStaffMessageDto,
  CreateTenancyApplicationDto,
  CreateTenantDto,
  CreateUnitDto,
  CreateUserDto,
  MaintenanceCall,
  MaintenanceStatus,
  ManagedUser,
  ParkingLayoutResponse,
  ParkingLayoutWithSpots,
  ParkingSpot,
  ParkingZone,
  Property,
  PropertyFeature,
  PropertyPhoto,
  PropertyStaff,
  PropertyWithStats,
  PublicPropertyListing,
  Reservation,
  ReservationWithDetails,
  ReviewAmenitySessionDto,
  ReviewTenancyApplicationDto,
  Role,
  RoleDefinition,
  SaveParkingLayoutRequest,
  StaffMessage,
  StaffRole,
  TenancyApplication,
  Tenant,
  TenantStatus,
  TenantWithUnit,
  Unit,
  UnitWithTenant,
  UpdateAmenityDto,
  UpdatePropertyDto,
  UpdateStaffDto,
  UpdateTenantDto,
  UpdateUnitDto,
  UpdateUserDto,
  UserSummary,
} from '@tenants/shared-types';
import { FetchHttpClient, type IHttpClient } from './httpClient';
import type {
  IAmenityGateway,
  IApiGateways,
  IApplicationGateway,
  IAuthGateway,
  IMaintenanceGateway,
  IMessageGateway,
  IParkingGateway,
  IPropertyGateway,
  IPublicPortalGateway,
  IReservationGateway,
  IStaffGateway,
  ITenantGateway,
  ITenantSessionGateway,
  IUnitGateway,
  IUserAdminGateway,
} from './interfaces';

export class ApiClient
  implements
    IAuthGateway,
    IPropertyGateway,
    IUnitGateway,
    ITenantGateway,
    IAmenityGateway,
    IParkingGateway,
    IReservationGateway,
    IMaintenanceGateway,
    IStaffGateway,
    ITenantSessionGateway,
    IPublicPortalGateway,
    IApplicationGateway,
    IMessageGateway,
    IUserAdminGateway
{
  constructor(private readonly http: IHttpClient = new FetchHttpClient()) {}

  setToken(token: string | null) {
    this.http.setToken(token);
  }

  getToken(): string | null {
    return this.http.getToken();
  }

  private request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.http.request<T>(endpoint, options);
  }

  // --- Auth Endpoints (HttpOnly cookie session; no localStorage token storage) ---
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    // Web uses HttpOnly SameSite=Strict cookies + X-CSRF-Token automatically
    this.setToken(null);
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

  async getPropertyFeatures(propertyId: string): Promise<PropertyFeature[]> {
    return this.request<PropertyFeature[]>(`/properties/${propertyId}/features`);
  }

  async addPropertyFeature(
    propertyId: string,
    data: AddPropertyFeatureDto
  ): Promise<PropertyFeature> {
    return this.request<PropertyFeature>(`/properties/${propertyId}/features`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deletePropertyFeature(propertyId: string, featureId: string): Promise<void> {
    return this.request<void>(`/properties/${propertyId}/features/${featureId}`, {
      method: 'DELETE',
    });
  }

  async getPropertyPhotos(propertyId: string): Promise<PropertyPhoto[]> {
    return this.request<PropertyPhoto[]>(`/properties/${propertyId}/photos`);
  }

  async uploadPropertyPhoto(
    propertyId: string,
    file: File,
    options?: { caption?: string; isCover?: boolean }
  ): Promise<PropertyPhoto> {
    const params = new URLSearchParams();
    if (options?.caption?.trim()) params.set('caption', options.caption.trim());
    if (options?.isCover) params.set('is_cover', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<PropertyPhoto>(`/properties/${propertyId}/photos${query}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'image/png',
      },
      body: file,
    });
  }

  async setCoverPropertyPhoto(propertyId: string, photoId: string): Promise<PropertyPhoto> {
    return this.request<PropertyPhoto>(`/properties/${propertyId}/photos/${photoId}/cover`, {
      method: 'PATCH',
    });
  }

  async deletePropertyPhoto(propertyId: string, photoId: string): Promise<void> {
    return this.request<void>(`/properties/${propertyId}/photos/${photoId}`, {
      method: 'DELETE',
    });
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

  async assignParkingSpot(spotId: string, dto: AssignParkingSpotDto): Promise<ParkingSpot> {
    return this.request<ParkingSpot>(`/parking-spots/${spotId}/assign`, {
      method: 'POST',
      body: JSON.stringify(dto),
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

  async upsertSpot(data: unknown): Promise<unknown> {
    return this.request('/parking/spots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==========================================
  // Tenant Portal: Maintenance Calls Endpoints
  // ==========================================
  async getMaintenanceCalls(filters?: {
    tenant_id?: string;
    property_id?: string;
    status?: string;
  }): Promise<MaintenanceCall[]> {
    const params = new URLSearchParams();
    if (filters?.tenant_id) params.set('tenant_id', filters.tenant_id);
    if (filters?.property_id) params.set('property_id', filters.property_id);
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<MaintenanceCall[]>(`/maintenance-calls${query}`);
  }

  async getMaintenanceCall(id: string): Promise<MaintenanceCall> {
    return this.request<MaintenanceCall>(`/maintenance-calls/${id}`);
  }

  async createMaintenanceCall(dto: CreateMaintenanceCallDto): Promise<MaintenanceCall> {
    return this.request<MaintenanceCall>('/maintenance-calls', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  async updateMaintenanceCallStatus(
    id: string,
    status: MaintenanceStatus,
    resolutionNotes?: string
  ): Promise<MaintenanceCall> {
    return this.request<MaintenanceCall>(`/maintenance-calls/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        ...(resolutionNotes !== undefined ? { resolution_notes: resolutionNotes } : {}),
      }),
    });
  }

  async cancelMaintenanceCall(id: string): Promise<void> {
    return this.request<void>(`/maintenance-calls/${id}/cancel`, { method: 'POST' });
  }

  async assignMaintenanceCallStaff(
    id: string,
    dto: AssignMaintenanceCallStaffDto
  ): Promise<MaintenanceCall> {
    return this.request<MaintenanceCall>(`/maintenance-calls/${id}/assign-staff`, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  // ==========================================
  // Property Staff Endpoints
  // ==========================================
  async getStaff(propertyId?: string, role?: StaffRole | string): Promise<PropertyStaff[]> {
    const params = new URLSearchParams();
    if (propertyId) params.set('property_id', propertyId);
    if (role && role !== 'all') params.set('role', role);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<PropertyStaff[]>(`/staff${query}`);
  }

  async getStaffById(id: string): Promise<PropertyStaff> {
    return this.request<PropertyStaff>(`/staff/${id}`);
  }

  async createStaff(dto: CreateStaffDto): Promise<PropertyStaff> {
    return this.request<PropertyStaff>('/staff', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  async updateStaff(id: string, dto: UpdateStaffDto): Promise<PropertyStaff> {
    return this.request<PropertyStaff>(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
  }

  async deleteStaff(id: string): Promise<void> {
    return this.request<void>(`/staff/${id}`, { method: 'DELETE' });
  }

  // ==========================================
  // Tenant Portal: Amenity Sessions Endpoints
  // ==========================================
  async getTenantAmenitySessions(tenantId?: string): Promise<AmenitySessionBooking[]> {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenant_id', tenantId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<AmenitySessionBooking[]>(`/amenity-sessions${query}`);
  }

  async bookAmenitySession(dto: CreateAmenitySessionDto): Promise<AmenitySessionBooking> {
    return this.request<AmenitySessionBooking>('/amenity-sessions', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  async cancelAmenitySession(id: string): Promise<void> {
    return this.request<void>(`/amenity-sessions/${id}/cancel`, { method: 'POST' });
  }

  async reviewAmenitySession(
    id: string,
    dto: ReviewAmenitySessionDto
  ): Promise<AmenitySessionBooking> {
    return this.request<AmenitySessionBooking>(`/amenity-sessions/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  }

  // ==========================================
  // Public Property Portal & Tenancy Applications
  // ==========================================
  async getPublicProperties(): Promise<PublicPropertyListing[]> {
    return this.request<PublicPropertyListing[]>('/public/properties');
  }

  async getPublicProperty(id: string): Promise<PublicPropertyListing> {
    return this.request<PublicPropertyListing>(`/public/properties/${id}`);
  }

  async submitPublicApplication(dto: CreateTenancyApplicationDto): Promise<{
    application: TenancyApplication;
    managers_notified: number;
    message: string;
  }> {
    return this.request('/public/applications', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  async getApplications(filters?: {
    property_id?: string;
    status?: string;
  }): Promise<TenancyApplication[]> {
    const params = new URLSearchParams();
    if (filters?.property_id) params.set('property_id', filters.property_id);
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<TenancyApplication[]>(`/tenancy-applications${query}`);
  }

  async reviewApplication(
    id: string,
    dto: ReviewTenancyApplicationDto
  ): Promise<TenancyApplication> {
    return this.request<TenancyApplication>(`/tenancy-applications/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  }

  // ==========================================
  // Manager <-> Staff Messaging Endpoints
  // ==========================================
  async getMessages(propertyId: string, staffId?: string): Promise<StaffMessage[]> {
    const params = new URLSearchParams({ property_id: propertyId });
    if (staffId) params.set('staff_id', staffId);
    return this.request<StaffMessage[]>(`/staff-messages?${params.toString()}`);
  }

  async sendMessage(dto: CreateStaffMessageDto): Promise<StaffMessage> {
    return this.request<StaffMessage>('/staff-messages', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  async markMessageRead(id: string): Promise<StaffMessage> {
    return this.request<StaffMessage>(`/staff-messages/${id}/read`, { method: 'PATCH' });
  }

  // ==========================================
  // Super Admin: Users & Roles Endpoints
  // ==========================================
  async getUsers(filters?: {
    role?: Role | string;
    property_id?: string;
    q?: string;
  }): Promise<ManagedUser[]> {
    const params = new URLSearchParams();
    if (filters?.role && filters.role !== 'all') params.set('role', filters.role);
    if (filters?.property_id) params.set('property_id', filters.property_id);
    if (filters?.q?.trim()) params.set('q', filters.q.trim());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<ManagedUser[]>(`/users${query}`);
  }

  async getRoles(): Promise<RoleDefinition[]> {
    return this.request<RoleDefinition[]>('/users/roles');
  }

  async createUser(dto: CreateUserDto): Promise<ManagedUser> {
    return this.request<ManagedUser>('/users', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<ManagedUser> {
    return this.request<ManagedUser>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    });
  }

  async deleteUser(id: string): Promise<void> {
    return this.request<void>(`/users/${id}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

/**
 * Builds segregated gateway facades delegating to the supplied ApiClient instance,
 * preserving Vitest `vi.spyOn(api, ...)` call interception while enforcing ISP + DIP.
 */
export function createSegregatedGateways(client: ApiClient = api): IApiGateways {
  return {
    auth: {
      login: (email, password) => client.login(email, password),
      logout: () => client.logout(),
      getCurrentUser: () => client.getCurrentUser(),
    },
    properties: {
      getProperties: () => client.getProperties(),
      getProperty: (id) => client.getProperty(id),
      createProperty: (data) => client.createProperty(data),
      updateProperty: (id, data) => client.updateProperty(id, data),
      deleteProperty: (id) => client.deleteProperty(id),
      getPropertyFeatures: (propertyId) => client.getPropertyFeatures(propertyId),
      addPropertyFeature: (propertyId, data) => client.addPropertyFeature(propertyId, data),
      deletePropertyFeature: (propertyId, featureId) =>
        client.deletePropertyFeature(propertyId, featureId),
      getPropertyPhotos: (propertyId) => client.getPropertyPhotos(propertyId),
      uploadPropertyPhoto: (propertyId, file, opts) =>
        client.uploadPropertyPhoto(propertyId, file, opts),
      setCoverPropertyPhoto: (propertyId, photoId) =>
        client.setCoverPropertyPhoto(propertyId, photoId),
      deletePropertyPhoto: (propertyId, photoId) =>
        client.deletePropertyPhoto(propertyId, photoId),
    },
    units: {
      getUnits: (propertyId) => client.getUnits(propertyId),
      createUnit: (propertyId, data) => client.createUnit(propertyId, data),
      updateUnit: (id, data) => client.updateUnit(id, data),
      deleteUnit: (id) => client.deleteUnit(id),
    },
    tenants: {
      getTenants: (filters) => client.getTenants(filters),
      getTenant: (id) => client.getTenant(id),
      createTenant: (data) => client.createTenant(data),
      updateTenant: (id, data) => client.updateTenant(id, data),
      deleteTenant: (id) => client.deleteTenant(id),
    },
    amenities: {
      getAmenities: () => client.getAmenities(),
      getPropertyAmenities: (propertyId) => client.getPropertyAmenities(propertyId),
      createPropertyAmenity: (propertyId, data) => client.createPropertyAmenity(propertyId, data),
      updatePropertyAmenity: (id, data) => client.updatePropertyAmenity(id, data),
      deletePropertyAmenity: (id) => client.deletePropertyAmenity(id),
    },
    parking: {
      getParkingZones: () => client.getParkingZones(),
      getParkingLayout: (zoneId) => client.getParkingLayout(zoneId),
      reserveSpot: (spotId) => client.reserveSpot(spotId),
      getAdminParkingLayout: (propertyId) => client.getAdminParkingLayout(propertyId),
      saveAdminParkingLayout: (propertyId, data) => client.saveAdminParkingLayout(propertyId, data),
      assignParkingSpot: (spotId, dto) => client.assignParkingSpot(spotId, dto),
    },
    reservations: {
      getAmenityReservations: (amenityId, startDate, endDate) =>
        client.getAmenityReservations(amenityId, startDate, endDate),
      createReservation: (data) => client.createReservation(data),
      getMyReservations: () => client.getMyReservations(),
      cancelReservation: (id) => client.cancelReservation(id),
    },
    maintenance: {
      getMaintenanceCalls: (filters) => client.getMaintenanceCalls(filters),
      getMaintenanceCall: (id) => client.getMaintenanceCall(id),
      createMaintenanceCall: (dto) => client.createMaintenanceCall(dto),
      updateMaintenanceCallStatus: (id, status, notes) =>
        client.updateMaintenanceCallStatus(id, status, notes),
      cancelMaintenanceCall: (id) => client.cancelMaintenanceCall(id),
      assignMaintenanceCallStaff: (id, dto) => client.assignMaintenanceCallStaff(id, dto),
    },
    staff: {
      getStaff: (propertyId, role) => client.getStaff(propertyId, role),
      getStaffById: (id) => client.getStaffById(id),
      createStaff: (dto) => client.createStaff(dto),
      updateStaff: (id, dto) => client.updateStaff(id, dto),
      deleteStaff: (id) => client.deleteStaff(id),
    },
    tenantSessions: {
      getTenantAmenitySessions: (tenantId) => client.getTenantAmenitySessions(tenantId),
      bookAmenitySession: (dto) => client.bookAmenitySession(dto),
      cancelAmenitySession: (id) => client.cancelAmenitySession(id),
      reviewAmenitySession: (id, dto) => client.reviewAmenitySession(id, dto),
    },
    publicPortal: {
      getPublicProperties: () => client.getPublicProperties(),
      getPublicProperty: (id) => client.getPublicProperty(id),
      submitPublicApplication: (dto) => client.submitPublicApplication(dto),
    },
    applications: {
      getApplications: (filters) => client.getApplications(filters),
      reviewApplication: (id, dto) => client.reviewApplication(id, dto),
    },
    messages: {
      getMessages: (propertyId, staffId) => client.getMessages(propertyId, staffId),
      sendMessage: (dto) => client.sendMessage(dto),
      markMessageRead: (id) => client.markMessageRead(id),
    },
    users: {
      getUsers: (filters) => client.getUsers(filters),
      getRoles: () => client.getRoles(),
      createUser: (dto) => client.createUser(dto),
      updateUser: (id, dto) => client.updateUser(id, dto),
      deleteUser: (id) => client.deleteUser(id),
    },
  };
}
