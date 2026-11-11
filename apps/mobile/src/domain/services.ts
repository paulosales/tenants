import type {
  MaintenanceCall,
  MaintenanceStatus,
  StaffMessage,
  UserSummary,
} from '@tenants/shared-types';
import type { MobileSpotStatus } from '../theme/mobileTheme';

export interface MobileParkingSpot {
  id: string;
  num: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status: MobileSpotStatus;
  type: 'EV' | 'STD' | 'ACC';
  hourlyRateLabel: string;
  monthlyRateLabel: string;
}

export interface MobileAmenityOption {
  id: string;
  name: string;
  rate: string;
  cap: number;
}

export interface ResidentDashboardData {
  residentName: string;
  unitLabel: string;
  currentSpot: {
    spotNumber: string;
    level: string;
    bayType: string;
  };
  upcomingReservation: {
    amenityName: string;
    timeLabel: string;
    statusLabel: string;
  };
}

/** Segregated service port for Dashboard screen (ISP + DIP). */
export interface IResidentDashboardService {
  getDashboardSummary(): Promise<ResidentDashboardData>;
}

/** Segregated service port for Garage Parking screen (ISP + DIP). */
export interface IMobileParkingService {
  getGarageSpots(): Promise<MobileParkingSpot[]>;
  reserveSpot(spotNumber: string): Promise<{ spotNumber: string }>;
}

/** Segregated service port for Amenity Booking screen (ISP + DIP). */
export interface IMobileAmenityService {
  getAmenities(): Promise<MobileAmenityOption[]>;
  getAvailableTimeSlots(): Promise<string[]>;
  scheduleAmenitySession(amenityName: string, timeSlot: string): Promise<void>;
}

/** Segregated transport port for Mobile API adapters (DIP). */
export interface IMobileHttpClient {
  setToken(token: string | null): Promise<void>;
  getToken(): Promise<string | null>;
  request<T>(endpoint: string, options?: RequestInit): Promise<T>;
}

/** Segregated service port for Mobile Authentication (ISP + DIP). */
export interface IMobileAuthService {
  login(email: string, password: string): Promise<UserSummary>;
  logout(): Promise<void>;
  restoreSession(): Promise<UserSummary | null>;
}

/** Segregated service port for Maintainer Call Queue & Resolution (ISP + DIP). */
export interface IMobileMaintenanceService {
  getCalls(propertyId?: string): Promise<MaintenanceCall[]>;
  updateCallStatus(
    callId: string,
    status: MaintenanceStatus,
    resolutionNotes?: string
  ): Promise<MaintenanceCall>;
}

/** Segregated service port for Staff <-> Property Manager Messaging (ISP + DIP). */
export interface IMobileMessagingService {
  getMessages(propertyId: string, staffId?: string): Promise<StaffMessage[]>;
  sendMessage(
    propertyId: string,
    body: string,
    recipientStaffId?: string | null
  ): Promise<StaffMessage>;
}

export interface IMobileServices {
  dashboard: IResidentDashboardService;
  parking: IMobileParkingService;
  amenities: IMobileAmenityService;
  auth: IMobileAuthService;
  maintenance: IMobileMaintenanceService;
  messages: IMobileMessagingService;
}

