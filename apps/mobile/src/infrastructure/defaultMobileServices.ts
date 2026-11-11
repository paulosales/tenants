import type {
  AuthResponse,
  MaintenanceCall,
  MaintenanceStatus,
  StaffMessage,
  UserSummary,
} from '@tenants/shared-types';
import type {
  IMobileAmenityService,
  IMobileAuthService,
  IMobileMaintenanceService,
  IMobileMessagingService,
  IMobileParkingService,
  IMobileServices,
  IResidentDashboardService,
  MobileAmenityOption,
  MobileParkingSpot,
  ResidentDashboardData,
} from '../domain/services';
import { mobileHttpClient, type MobileHttpClient } from './mobileHttpClient';

const DEFAULT_DASHBOARD_SUMMARY: ResidentDashboardData = {
  residentName: 'Marcus Vance',
  unitLabel: 'Unit 101 • Verified Resident',
  currentSpot: {
    spotNumber: 'P-01',
    level: 'Subterranean Level P1',
    bayType: 'EV Fast Charging Bay',
  },
  upcomingReservation: {
    amenityName: 'Skyline Rooftop Lounge',
    timeLabel: 'Pending / Scheduled',
    statusLabel: 'Synced with Property Portal',
  },
};

const DEFAULT_GARAGE_SPOTS: MobileParkingSpot[] = [
  { id: '1', num: 'P1-01', x: 20, y: 30, w: 70, h: 120, status: 'vacant', type: 'EV', hourlyRateLabel: '$5.00 / hour', monthlyRateLabel: '$150.00 / month' },
  { id: '2', num: 'P1-02', x: 105, y: 30, w: 70, h: 120, status: 'vacant', type: 'EV', hourlyRateLabel: '$5.00 / hour', monthlyRateLabel: '$150.00 / month' },
  { id: '3', num: 'P1-03', x: 190, y: 30, w: 70, h: 120, status: 'occupied', type: 'STD', hourlyRateLabel: '$4.00 / hour', monthlyRateLabel: '$120.00 / month' },
  { id: '4', num: 'P1-04', x: 275, y: 30, w: 70, h: 120, status: 'reserved', type: 'STD', hourlyRateLabel: '$4.00 / hour', monthlyRateLabel: '$120.00 / month' },
  { id: '5', num: 'P1-05', x: 20, y: 220, w: 70, h: 120, status: 'vacant', type: 'ACC', hourlyRateLabel: '$3.50 / hour', monthlyRateLabel: '$100.00 / month' },
  { id: '6', num: 'P1-06', x: 105, y: 220, w: 70, h: 120, status: 'vacant', type: 'STD', hourlyRateLabel: '$4.00 / hour', monthlyRateLabel: '$120.00 / month' },
];

const DEFAULT_AMENITIES: MobileAmenityOption[] = [
  { id: '1', name: 'Skyline Rooftop Lounge', rate: '$50/hr', cap: 40 },
  { id: '2', name: 'Championship Tennis Court', rate: '$25/hr', cap: 4 },
  { id: '3', name: 'Poolside BBQ Pavilion', rate: '$35/hr', cap: 25 },
];

const DEFAULT_TIME_SLOTS = ['10:00 - 12:00', '14:00 - 16:00', '16:00 - 18:00', '18:00 - 20:00'];

export class ApiResidentDashboardService implements IResidentDashboardService {
  async getDashboardSummary(): Promise<ResidentDashboardData> {
    return DEFAULT_DASHBOARD_SUMMARY;
  }
}

export class ApiMobileParkingService implements IMobileParkingService {
  async getGarageSpots(): Promise<MobileParkingSpot[]> {
    return DEFAULT_GARAGE_SPOTS;
  }

  async reserveSpot(spotNumber: string): Promise<{ spotNumber: string }> {
    return { spotNumber };
  }
}

export class ApiMobileAmenityService implements IMobileAmenityService {
  async getAmenities(): Promise<MobileAmenityOption[]> {
    return DEFAULT_AMENITIES;
  }

  async getAvailableTimeSlots(): Promise<string[]> {
    return DEFAULT_TIME_SLOTS;
  }

  async scheduleAmenitySession(_amenityName: string, _timeSlot: string): Promise<void> {
    // Dispatched through injected service abstraction
  }
}

export class ApiMobileAuthService implements IMobileAuthService {
  constructor(private readonly http: MobileHttpClient = mobileHttpClient) {}

  async login(email: string, password: string): Promise<UserSummary> {
    const res = await this.http.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await this.http.setToken(res.access_token);
    return res.user;
  }

  async logout(): Promise<void> {
    try {
      await this.http.request('/auth/logout', { method: 'POST' });
    } finally {
      await this.http.setToken(null);
    }
  }

  async restoreSession(): Promise<UserSummary | null> {
    const token = await this.http.getToken();
    if (!token) {
      return null;
    }
    try {
      return await this.http.request<UserSummary>('/auth/me');
    } catch {
      await this.http.setToken(null);
      return null;
    }
  }
}

export class ApiMobileMaintenanceService implements IMobileMaintenanceService {
  constructor(private readonly http: MobileHttpClient = mobileHttpClient) {}

  async getCalls(propertyId?: string): Promise<MaintenanceCall[]> {
    const query = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : '';
    return this.http.request<MaintenanceCall[]>(`/maintenance-calls${query}`);
  }

  async updateCallStatus(
    callId: string,
    status: MaintenanceStatus,
    resolutionNotes?: string
  ): Promise<MaintenanceCall> {
    return this.http.request<MaintenanceCall>(`/maintenance-calls/${callId}/status`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        ...(resolutionNotes !== undefined ? { resolution_notes: resolutionNotes } : {}),
      }),
    });
  }
}

export class ApiMobileMessagingService implements IMobileMessagingService {
  constructor(private readonly http: MobileHttpClient = mobileHttpClient) {}

  async getMessages(propertyId: string, staffId?: string): Promise<StaffMessage[]> {
    const params = new URLSearchParams({ property_id: propertyId });
    if (staffId) params.set('staff_id', staffId);
    return this.http.request<StaffMessage[]>(`/staff-messages?${params.toString()}`);
  }

  async sendMessage(
    propertyId: string,
    body: string,
    recipientStaffId?: string | null
  ): Promise<StaffMessage> {
    return this.http.request<StaffMessage>('/staff-messages', {
      method: 'POST',
      body: JSON.stringify({
        property_id: propertyId,
        recipient_staff_id: recipientStaffId ?? null,
        body,
      }),
    });
  }
}

export const defaultMobileServices: IMobileServices = {
  dashboard: new ApiResidentDashboardService(),
  parking: new ApiMobileParkingService(),
  amenities: new ApiMobileAmenityService(),
  auth: new ApiMobileAuthService(),
  maintenance: new ApiMobileMaintenanceService(),
  messages: new ApiMobileMessagingService(),
};
