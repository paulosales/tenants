export type Role = 'super_admin' | 'property_manager' | 'maintenance_staff' | 'tenant';

export interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  unit_number?: string | null;
}

export interface AuthResponse {
  user: UserSummary;
  access_token: string;
  expires_in: number;
}

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
  start_time: string; // ISO 8601
  end_time: string;   // ISO 8601
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
