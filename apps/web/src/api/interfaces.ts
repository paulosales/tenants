import type {
  AdminAmenity,
  Amenity,
  AmenitySessionBooking,
  AssignMaintenanceCallStaffDto,
  AuthResponse,
  CreateAmenityDto,
  CreateAmenitySessionDto,
  CreateMaintenanceCallDto,
  CreatePropertyDto,
  CreateReservationRequest,
  CreateStaffDto,
  CreateTenantDto,
  CreateUnitDto,
  MaintenanceCall,
  MaintenanceStatus,
  ParkingLayoutResponse,
  ParkingLayoutWithSpots,
  ParkingZone,
  Property,
  PropertyStaff,
  PropertyWithStats,
  Reservation,
  ReservationWithDetails,
  SaveParkingLayoutRequest,
  StaffRole,
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
  updateMaintenanceCallStatus(id: string, status: MaintenanceStatus): Promise<MaintenanceCall>;
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
  bookAmenitySession(dto: CreateAmenitySessionDto): Promise<AmenitySessionBooking>;
  cancelAmenitySession(id: string): Promise<void>;
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
}
