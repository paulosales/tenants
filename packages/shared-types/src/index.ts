export type Role = 'super_admin' | 'property_manager' | 'maintenance_staff' | 'staff' | 'tenant';

export interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone?: string | null;
  unit_number?: string | null;
  property_id?: string | null;
  tenant_id?: string | null;
  staff_id?: string | null;
}

export interface AuthResponse {
  user: UserSummary;
  access_token: string;
  expires_in: number;
}

// ==========================================
// Admin Property Management Types
// ==========================================

export interface Property {
  id: string;
  name: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state_province: string;
  postal_code: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyWithStats extends Property {
  unit_count: number;
  occupied_units_count: number;
  tenant_count: number;
}

export interface CreatePropertyDto {
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state_province: string;
  postal_code: string;
}

export type UpdatePropertyDto = CreatePropertyDto;

export type UnitStatus = 'vacant' | 'occupied' | 'maintenance';

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  status: UnitStatus;
  created_at: string;
  updated_at: string;
}

export interface UnitTenantSummary {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface UnitWithTenant extends Unit {
  tenant_id?: string | null;
  tenant_name?: string | null;
  tenant_email?: string | null;
  tenants?: UnitTenantSummary[];
}

export interface CreateUnitDto {
  unit_number: string;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  status?: UnitStatus;
  tenant_ids?: string[];
}

export interface UpdateUnitDto {
  unit_number: string;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  status: UnitStatus;
  tenant_ids?: string[];
}

export type TenantStatus = 'active' | 'past' | 'applicant';

export interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  assigned_unit_id?: string | null;
  lease_start_date?: string | null;
  lease_end_date?: string | null;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
}

export interface TenantWithUnit extends Tenant {
  unit_number?: string | null;
  property_id?: string | null;
  property_name?: string | null;
}

export interface CreateTenantDto {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  assigned_unit_id?: string | null;
  lease_start_date?: string | null;
  lease_end_date?: string | null;
  status?: TenantStatus;
}

export interface UpdateTenantDto {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  assigned_unit_id?: string | null;
  lease_start_date?: string | null;
  lease_end_date?: string | null;
  status: TenantStatus;
}

export interface AdminAmenity {
  id: string;
  property_id: string;
  name: string;
  description?: string | null;
  capacity: number;
  fee_cents: number;
  deposit_cents: number;
  rules?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAmenityDto {
  name: string;
  description?: string;
  capacity: number;
  fee_cents: number;
  deposit_cents: number;
  rules?: string;
  is_active?: boolean;
}

export interface UpdateAmenityDto {
  name: string;
  description?: string;
  capacity: number;
  fee_cents: number;
  deposit_cents: number;
  rules?: string;
  is_active: boolean;
}

// ==========================================
// Interactive SVG Parking Layout Types
// ==========================================

export type AdminSpotType = 'standard' | 'compact' | 'ev_charging' | 'handicap';

export interface ParkingSpot {
  id: string;
  layout_id: string;
  spot_label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  spot_type: AdminSpotType;
  is_occupied: boolean;
  assigned_tenant_id?: string | null;
  tenant_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParkingLayout {
  id: string;
  property_id: string;
  canvas_width: number;
  canvas_height: number;
  grid_size: number;
  updated_at: string;
}

export interface ParkingLayoutWithSpots {
  layout: ParkingLayout;
  spots: ParkingSpot[];
}

export interface SaveParkingSpotDto {
  id?: string;
  spot_label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  spot_type: AdminSpotType;
  is_occupied: boolean;
  assigned_tenant_id?: string | null;
}

export interface SaveParkingLayoutRequest {
  canvas_width: number;
  canvas_height: number;
  grid_size: number;
  spots: SaveParkingSpotDto[];
}

// Legacy reservation & payment types
export interface Amenity {
  id: string;
  name: string;
  description?: string | null;
  capacity: number;
  hourly_rate_cents: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  open_time_minutes: number;
  close_time_minutes: number;
  is_active: boolean;
}

export type ReservationStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';

export interface Reservation {
  id: string;
  amenity_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  total_price_cents: number;
  status: ReservationStatus;
  notes?: string | null;
  created_at: string;
}

export interface ReservationWithDetails extends Reservation {
  amenity_name: string;
  user_name: string;
  user_email: string;
}

export interface CreateReservationRequest {
  amenity_id: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export type SpotStatus = 'vacant' | 'reserved' | 'occupied' | 'maintenance';
export type SpotType = 'standard' | 'compact' | 'ev_charging' | 'accessible';
export type ShapeType = 'rect' | 'polygon';

export type RectCoordinates = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

export type PolygonCoordinates = {
  points: [number, number][];
};

export type GeometryCoordinates = RectCoordinates | PolygonCoordinates;

export interface ParkingZone {
  id: string;
  name: string;
  floor_level: number;
  svg_viewbox: string;
  svg_raw?: string | null;
}

export interface ParkingSpotNode {
  id: string;
  spot_number: string;
  spot_type: SpotType;
  shape: ShapeType;
  coordinates: GeometryCoordinates;
  status: SpotStatus;
  hourly_rate_cents: number;
  monthly_rate_cents: number;
  assigned_tenant_id?: string | null;
}

export interface ParkingLayoutResponse {
  zone: ParkingZone;
  spots: ParkingSpotNode[];
}

export interface UpsertSpotRequest {
  zone_id: string;
  spot_number: string;
  spot_type: SpotType;
  shape_type: ShapeType;
  coordinates: GeometryCoordinates;
  hourly_rate_cents: number;
  monthly_rate_cents: number;
}

export interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount_cents: number;
}

// ==========================================
// Maintenance Call & Service Request Types
// ==========================================

export type MaintenancePriority = 'routine' | 'urgent' | 'emergency';

export type MaintenanceStatus = 'reported' | 'dispatched' | 'in_progress' | 'resolved' | 'cancelled';

export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'appliances'
  | 'locks_keys'
  | 'pest_control'
  | 'structural'
  | 'general';

export interface MaintenanceCall {
  id: string;
  ticket_number: string;
  tenant_id: string;
  tenant_name?: string;
  property_id: string;
  property_name?: string;
  unit_number: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  title: string;
  description: string;
  permission_to_enter: boolean;
  preferred_time_window: string;
  contact_phone: string;
  status: MaintenanceStatus;
  assigned_staff_id?: string | null;
  assigned_technician?: string | null;
  technician_phone?: string | null;
  scheduled_date?: string | null;
  resolution_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMaintenanceCallDto {
  tenant_id?: string;
  property_id?: string;
  unit_number: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  title: string;
  description: string;
  permission_to_enter: boolean;
  preferred_time_window: string;
  contact_phone: string;
}

// ==========================================
// Amenity Session Scheduling Types
// ==========================================

export type AmenityBookingStatus = 'confirmed' | 'pending' | 'rejected' | 'cancelled' | 'completed';

export interface AmenitySessionBooking {
  id: string;
  amenity_id: string;
  amenity_name: string;
  tenant_id: string;
  tenant_name?: string;
  property_id: string;
  unit_number?: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  attendees_count: number;
  total_fee_cents: number;
  status: AmenityBookingStatus;
  notes?: string;
  created_at: string;
}

export interface CreateAmenitySessionDto {
  amenity_id: string;
  tenant_id?: string;
  property_id?: string;
  unit_number?: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  attendees_count: number;
  notes?: string;
}

// ==========================================
// Property Staff & Workload Management Types
// ==========================================

export type StaffRole = 'manager' | 'maintainer' | 'security' | 'cleaner' | 'other';
export type StaffStatus = 'active' | 'on_leave' | 'inactive';

export interface PropertyStaff {
  id: string;
  property_id: string;
  property_name?: string;
  first_name: string;
  last_name: string;
  role: StaffRole;
  title: string;
  email: string;
  phone: string;
  specialization?: string | null;
  shift: string;
  status: StaffStatus;
  assigned_calls_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateStaffDto {
  property_id: string;
  first_name: string;
  last_name: string;
  role: StaffRole;
  title: string;
  email: string;
  phone: string;
  specialization?: string;
  shift?: string;
  status?: StaffStatus;
}

export interface UpdateStaffDto {
  property_id?: string;
  first_name?: string;
  last_name?: string;
  role?: StaffRole;
  title?: string;
  email?: string;
  phone?: string;
  specialization?: string;
  shift?: string;
  status?: StaffStatus;
}

export interface AssignMaintenanceCallStaffDto {
  staff_id: string;
  scheduled_date?: string;
  resolution_notes?: string;
}

// ==========================================
// Public Property Portal & Tenancy Applications
// ==========================================

export interface PublicUnitSummary {
  id: string;
  unit_number: string;
  floor: number;
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  status: UnitStatus;
}

export interface PublicPropertyListing {
  id: string;
  name: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state_province: string;
  postal_code: string;
  total_units: number;
  available_units: number;
  manager_count: number;
  vacant_units: PublicUnitSummary[];
  amenities: string[];
}

export type TenancyApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export interface TenancyApplication {
  id: string;
  property_id: string;
  property_name?: string | null;
  preferred_unit_id?: string | null;
  preferred_unit_number?: string | null;
  applicant_first_name: string;
  applicant_last_name: string;
  applicant_email: string;
  applicant_phone: string;
  monthly_income_cents: number;
  employment_status: string;
  desired_move_in_date?: string | null;
  occupants_count: number;
  notes?: string | null;
  status: TenancyApplicationStatus;
  reviewed_by_user_id?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTenancyApplicationDto {
  property_id: string;
  preferred_unit_id?: string | null;
  applicant_first_name: string;
  applicant_last_name: string;
  applicant_email: string;
  applicant_phone: string;
  monthly_income_cents: number;
  employment_status: string;
  desired_move_in_date?: string | null;
  occupants_count: number;
  notes?: string;
}

export interface ReviewTenancyApplicationDto {
  status: TenancyApplicationStatus;
  review_notes?: string;
  onboard_as_tenant?: boolean;
}

export interface ReviewAmenitySessionDto {
  status: 'confirmed' | 'rejected';
  notes?: string;
}

export interface AssignParkingSpotDto {
  tenant_id?: string | null;
  is_occupied?: boolean;
}

// ==========================================
// Staff & Property Manager Messaging Types
// ==========================================

export interface StaffMessage {
  id: string;
  property_id: string;
  sender_user_id: string;
  sender_staff_id?: string | null;
  recipient_user_id?: string | null;
  recipient_staff_id?: string | null;
  sender_name: string;
  sender_role: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface CreateStaffMessageDto {
  property_id: string;
  recipient_staff_id?: string | null;
  recipient_user_id?: string | null;
  body: string;
}

// ==========================================
// User & Role Management Types (Super Admin)
// ==========================================

export interface ManagedUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone?: string | null;
  unit_number?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  tenant_id?: string | null;
  staff_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  full_name: string;
  role: Role;
  phone?: string;
  unit_number?: string;
  property_id?: string | null;
  tenant_id?: string | null;
  staff_id?: string | null;
  is_active?: boolean;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  full_name?: string;
  role?: Role;
  phone?: string | null;
  unit_number?: string | null;
  property_id?: string | null;
  tenant_id?: string | null;
  staff_id?: string | null;
  is_active?: boolean;
}

export interface RoleDefinition {
  role: Role;
  label: string;
  description: string;
  permissions: string[];
  user_count: number;
}




