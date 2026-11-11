import type {
  IMobileAmenityService,
  IMobileParkingService,
  IMobileServices,
  IResidentDashboardService,
  MobileAmenityOption,
  MobileParkingSpot,
  ResidentDashboardData,
} from '../domain/services';

const DEFAULT_DASHBOARD_SUMMARY: ResidentDashboardData = {
  residentName: 'Alex Resident',
  unitLabel: 'Unit PH-402 • Verified Resident',
  currentSpot: {
    spotNumber: 'P1-01',
    level: 'Subterranean Level P1',
    bayType: 'EV Fast Charging Bay',
  },
  upcomingReservation: {
    amenityName: 'Skyline Rooftop Lounge',
    timeLabel: 'Tomorrow • 18:00 - 20:00',
    statusLabel: 'Confirmed & Paid',
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

export const defaultMobileServices: IMobileServices = {
  dashboard: new ApiResidentDashboardService(),
  parking: new ApiMobileParkingService(),
  amenities: new ApiMobileAmenityService(),
};

