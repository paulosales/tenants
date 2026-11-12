import type {
  AddPropertyFeatureDto,
  AdminAmenity,
  Amenity,
  AmenityCalendarEvent,
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

export interface IAuthGateway {
  login(email: string, password: string): Promise<AuthResponse>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<UserSummary>;
}

export interface IPropertyGateway {
  getProperties(): Promise<PropertyWithStats[]>;
  getProperty(id: string): Promise<Property>;
  createProperty(data: CreatePropertyDto): Promise<Property>;
  updateProperty(id: string, data: UpdatePropertyDto): Promise<Property>;
  deleteProperty(id: string): Promise<void>;
  getPropertyFeatures(propertyId: string): Promise<PropertyFeature[]>;
  addPropertyFeature(propertyId: string, data: AddPropertyFeatureDto): Promise<PropertyFeature>;
  deletePropertyFeature(propertyId: string, featureId: string): Promise<void>;
  getPropertyPhotos(propertyId: string): Promise<PropertyPhoto[]>;
  uploadPropertyPhoto(
    propertyId: string,
    file: File,
    options?: { caption?: string; isCover?: boolean }
  ): Promise<PropertyPhoto>;
  setCoverPropertyPhoto(propertyId: string, photoId: string): Promise<PropertyPhoto>;
  deletePropertyPhoto(propertyId: string, photoId: string): Promise<void>;
}

export interface IUnitGateway {
  getUnits(propertyId: string): Promise<UnitWithTenant[]>;
  createUnit(propertyId: string, data: CreateUnitDto): Promise<Unit>;
  updateUnit(id: string, data: UpdateUnitDto): Promise<Unit>;
  deleteUnit(id: string): Promise<void>;
}

export interface ITenantGateway {
  getTenants(filters?: { property_id?: string; status?: TenantStatus; q?: string }): Promise<TenantWithUnit[]>;
  getTenant(id: string): Promise<TenantWithUnit>;
  createTenant(data: CreateTenantDto): Promise<Tenant>;
  updateTenant(id: string, data: UpdateTenantDto): Promise<Tenant>;
  deleteTenant(id: string): Promise<void>;
}

export interface IAmenityGateway {
  getAmenities(): Promise<Amenity[]>;
  getPropertyAmenities(propertyId: string): Promise<AdminAmenity[]>;
  createPropertyAmenity(propertyId: string, data: CreateAmenityDto): Promise<AdminAmenity>;
  updatePropertyAmenity(id: string, data: UpdateAmenityDto): Promise<AdminAmenity>;
  deletePropertyAmenity(id: string): Promise<void>;
}

export interface IParkingGateway {
  getParkingZones(): Promise<ParkingZone[]>;
  getParkingLayout(zoneId: string): Promise<ParkingLayoutResponse>;
  reserveSpot(spotId: string): Promise<{ message: string }>;
  getAdminParkingLayout(propertyId: string): Promise<ParkingLayoutWithSpots>;
  saveAdminParkingLayout(
    propertyId: string,
    data: SaveParkingLayoutRequest
  ): Promise<{ message: string; data: ParkingLayoutWithSpots }>;
  assignParkingSpot(spotId: string, dto: AssignParkingSpotDto): Promise<ParkingSpot>;
}

export interface IReservationGateway {
  getAmenityReservations(amenityId: string, startDate: string, endDate: string): Promise<Reservation[]>;
  createReservation(data: CreateReservationRequest): Promise<Reservation>;
  getMyReservations(): Promise<ReservationWithDetails[]>;
  cancelReservation(id: string): Promise<void>;
}

export interface IMaintenanceGateway {
  getMaintenanceCalls(filters?: {
    tenant_id?: string;
    property_id?: string;
    status?: string;
  }): Promise<MaintenanceCall[]>;
  getMaintenanceCall(id: string): Promise<MaintenanceCall>;
  createMaintenanceCall(dto: CreateMaintenanceCallDto): Promise<MaintenanceCall>;
  updateMaintenanceCallStatus(
    id: string,
    status: MaintenanceStatus,
    resolutionNotes?: string
  ): Promise<MaintenanceCall>;
  cancelMaintenanceCall(id: string): Promise<void>;
  assignMaintenanceCallStaff(id: string, dto: AssignMaintenanceCallStaffDto): Promise<MaintenanceCall>;
}

export interface IStaffGateway {
  getStaff(propertyId?: string, role?: StaffRole | string): Promise<PropertyStaff[]>;
  getStaffById(id: string): Promise<PropertyStaff>;
  createStaff(dto: CreateStaffDto): Promise<PropertyStaff>;
  updateStaff(id: string, dto: UpdateStaffDto): Promise<PropertyStaff>;
  deleteStaff(id: string): Promise<void>;
}

export interface ITenantSessionGateway {
  getTenantAmenitySessions(tenantId?: string): Promise<AmenitySessionBooking[]>;
  getAmenityCalendar(
    amenityId: string,
    startDate: string,
    endDate: string
  ): Promise<AmenityCalendarEvent[]>;
  bookAmenitySession(dto: CreateAmenitySessionDto): Promise<AmenitySessionBooking>;
  cancelAmenitySession(id: string): Promise<void>;
  reviewAmenitySession(id: string, dto: ReviewAmenitySessionDto): Promise<AmenitySessionBooking>;
}

export interface IPublicPortalGateway {
  getPublicProperties(): Promise<PublicPropertyListing[]>;
  getPublicProperty(id: string): Promise<PublicPropertyListing>;
  submitPublicApplication(dto: CreateTenancyApplicationDto): Promise<{
    application: TenancyApplication;
    managers_notified: number;
    message: string;
  }>;
}

export interface IApplicationGateway {
  getApplications(filters?: { property_id?: string; status?: string }): Promise<TenancyApplication[]>;
  reviewApplication(id: string, dto: ReviewTenancyApplicationDto): Promise<TenancyApplication>;
}

export interface IMessageGateway {
  getMessages(propertyId: string, staffId?: string): Promise<StaffMessage[]>;
  sendMessage(dto: CreateStaffMessageDto): Promise<StaffMessage>;
  markMessageRead(id: string): Promise<StaffMessage>;
}

export interface IUserAdminGateway {
  getUsers(filters?: { role?: Role | string; property_id?: string; q?: string }): Promise<ManagedUser[]>;
  getRoles(): Promise<RoleDefinition[]>;
  createUser(dto: CreateUserDto): Promise<ManagedUser>;
  updateUser(id: string, dto: UpdateUserDto): Promise<ManagedUser>;
  deleteUser(id: string): Promise<void>;
}

export interface IApiGateways {
  auth: IAuthGateway;
  properties: IPropertyGateway;
  units: IUnitGateway;
  tenants: ITenantGateway;
  amenities: IAmenityGateway;
  parking: IParkingGateway;
  reservations: IReservationGateway;
  maintenance: IMaintenanceGateway;
  staff: IStaffGateway;
  tenantSessions: ITenantSessionGateway;
  publicPortal: IPublicPortalGateway;
  applications: IApplicationGateway;
  messages: IMessageGateway;
  users: IUserAdminGateway;
}
