import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar';
import { ParkingMapViewer } from './components/ParkingMapViewer';
import { ParkingMapEditor } from './components/ParkingMapEditor';
import { AmenityReservationCalendar } from './components/AmenityReservationCalendar';
import { api } from './api/client';
import type { Amenity, CreateReservationRequest, ParkingLayoutResponse, ParkingSpotNode, Reservation, UserSummary } from '@tenants/shared-types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
});

// Default Mock Data for development demo preview
const defaultLayout: ParkingLayoutResponse = {
  zone: {
    id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    name: 'Subterranean Level P1 (North Garage)',
    floor_level: -1,
    svg_viewbox: '0 0 1000 600',
    svg_raw: null,
  },
  spots: [
    {
      id: '10000000-0000-0000-0000-000000000001',
      spot_number: 'P1-01',
      spot_type: 'ev_charging',
      shape: 'rect',
      coordinates: { x: 60, y: 80, width: 80, height: 140 },
      hourly_rate_cents: 700,
      monthly_rate_cents: 22000,
      status: 'vacant',
      assigned_tenant_id: null,
    },
    {
      id: '10000000-0000-0000-0000-000000000002',
      spot_number: 'P1-02',
      spot_type: 'ev_charging',
      shape: 'rect',
      coordinates: { x: 160, y: 80, width: 80, height: 140 },
      hourly_rate_cents: 700,
      monthly_rate_cents: 22000,
      status: 'vacant',
      assigned_tenant_id: null,
    },
    {
      id: '10000000-0000-0000-0000-000000000003',
      spot_number: 'P1-03',
      spot_type: 'accessible',
      shape: 'rect',
      coordinates: { x: 260, y: 80, width: 90, height: 140 },
      hourly_rate_cents: 500,
      monthly_rate_cents: 15000,
      status: 'vacant',
      assigned_tenant_id: null,
    },
    {
      id: '10000000-0000-0000-0000-000000000004',
      spot_number: 'P1-04',
      spot_type: 'standard',
      shape: 'rect',
      coordinates: { x: 370, y: 80, width: 80, height: 140 },
      hourly_rate_cents: 500,
      monthly_rate_cents: 15000,
      status: 'occupied',
      assigned_tenant_id: null,
    },
    {
      id: '10000000-0000-0000-0000-000000000005',
      spot_number: 'P1-05',
      spot_type: 'standard',
      shape: 'rect',
      coordinates: { x: 470, y: 80, width: 80, height: 140 },
      hourly_rate_cents: 500,
      monthly_rate_cents: 15000,
      status: 'reserved',
      assigned_tenant_id: null,
    },
    {
      id: '10000000-0000-0000-0000-000000000006',
      spot_number: 'P1-06',
      spot_type: 'compact',
      shape: 'rect',
      coordinates: { x: 570, y: 80, width: 70, height: 140 },
      hourly_rate_cents: 400,
      monthly_rate_cents: 13000,
      status: 'vacant',
      assigned_tenant_id: null,
    },
  ],
};

const defaultAmenities: Amenity[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Skyline Rooftop Lounge',
    description: 'Panoramic downtown views, bar area, high-fidelity sound system, and lounge seating.',
    capacity: 40,
    hourly_rate_cents: 5000,
    min_duration_minutes: 60,
    max_duration_minutes: 240,
    open_time_minutes: 600,
    close_time_minutes: 1380,
    is_active: true,
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'Tennis & Pickleball Court',
    description: 'Regulation floodlit synthetic court with automated ball server and equipment caddy.',
    capacity: 4,
    hourly_rate_cents: 2500,
    min_duration_minutes: 60,
    max_duration_minutes: 120,
    open_time_minutes: 420,
    close_time_minutes: 1260,
    is_active: true,
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    name: 'Executive Co-Working Conference Room',
    description: '4K Zoom Rooms display, ergonomic Herman Miller seating, and dedicated gigabit fiber.',
    capacity: 14,
    hourly_rate_cents: 3000,
    min_duration_minutes: 30,
    max_duration_minutes: 240,
    open_time_minutes: 480,
    close_time_minutes: 1200,
    is_active: true,
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    name: 'Poolside BBQ Pavilion',
    description: 'Dual built-in infrared gas grills, outdoor refrigeration, and covered dining tables.',
    capacity: 25,
    hourly_rate_cents: 3500,
    min_duration_minutes: 60,
    max_duration_minutes: 180,
    open_time_minutes: 660,
    close_time_minutes: 1320,
    is_active: true,
  },
];

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'parking' | 'calendar' | 'my-bookings'>('parking');
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [layout, setLayout] = useState<ParkingLayoutResponse>(defaultLayout);
  const [currentUser, setCurrentUser] = useState<UserSummary | null>({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@property.local',
    full_name: 'Chief Operations Admin',
    role: 'super_admin',
    unit_number: 'PH-1',
  });

  const handleReserveSpot = async (spotId: string) => {
    try {
      await api.reserveSpot(spotId);
    } catch {
      // In dev sandbox when server isn't running yet, update local state
      setLayout((prev) => ({
        ...prev,
        spots: prev.spots.map((s) => (s.id === spotId ? { ...s, status: 'reserved' } : s)),
      }));
    }
  };

  const handleSaveSpot = async (spot: Partial<ParkingSpotNode>) => {
    try {
      await api.upsertSpot(spot);
    } catch {
      // mock save
    }
  };

  const handleExportSvg = async (svgMarkup: string) => {
    try {
      await api.updateSvgLayout(layout.zone.id, svgMarkup);
    } catch {
      // mock export
    }
  };

  const handleFetchReservations = async (
    amenityId: string,
    start: string,
    end: string
  ): Promise<Reservation[]> => {
    try {
      return await api.getAmenityReservations(amenityId, start, end);
    } catch {
      // Mock existing booking in dev
      return [
        {
          id: 'mock-res-1',
          amenity_id: amenityId,
          user_id: 'user-2',
          start_time: `${start.split('T')[0]}T10:00:00Z`,
          end_time: `${start.split('T')[0]}T12:00:00Z`,
          total_price_cents: 5000,
          status: 'confirmed',
          notes: 'Executive Board Meeting',
          created_at: new Date().toISOString(),
        },
      ];
    }
  };

  const handleCreateReservation = async (req: CreateReservationRequest): Promise<Reservation> => {
    try {
      return await api.createReservation(req);
    } catch {
      // Return newly created mock reservation
      return {
        id: `mock-${Date.now()}`,
        amenity_id: req.amenity_id,
        user_id: currentUser?.id || 'anon',
        start_time: req.start_time,
        end_time: req.end_time,
        total_price_cents: 5000,
        status: 'confirmed',
        notes: req.notes,
        created_at: new Date().toISOString(),
      };
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdminMode={isAdminMode}
        setIsAdminMode={setIsAdminMode}
        currentUser={currentUser}
        onLogout={() => setCurrentUser(null)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'parking' && (
          <div>
            {isAdminMode ? (
              <ParkingMapEditor
                layout={layout}
                onSaveSpot={handleSaveSpot}
                onExportSvg={handleExportSvg}
              />
            ) : (
              <ParkingMapViewer
                layout={layout}
                onReserveSpot={handleReserveSpot}
              />
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <AmenityReservationCalendar
            amenities={defaultAmenities}
            fetchReservationsFn={handleFetchReservations}
            createReservationFn={handleCreateReservation}
          />
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
