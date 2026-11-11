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

export interface IMobileServices {
  dashboard: IResidentDashboardService;
  parking: IMobileParkingService;
  amenities: IMobileAmenityService;
}

