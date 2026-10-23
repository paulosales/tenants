import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AmenityReservationCalendar } from '../components/AmenityReservationCalendar';
import type { Amenity } from '@tenants/shared-types';

const mockAmenities: Amenity[] = [
  {
    id: 'amenity-1',
    name: 'Skyline Lounge',
    description: 'Rooftop terrace and party room',
    capacity: 30,
    hourly_rate_cents: 4000,
    min_duration_minutes: 60,
    max_duration_minutes: 180,
    open_time_minutes: 480,
    close_time_minutes: 1320,
    is_active: true,
  },
];

describe('AmenityReservationCalendar', () => {
  it('renders amenity details, capacity and hourly rate', () => {
    const queryClient = new QueryClient();
    const fetchReservations = vi.fn().mockResolvedValue([]);
    const createReservation = vi.fn().mockResolvedValue({});

    render(
      <QueryClientProvider client={queryClient}>
        <AmenityReservationCalendar
          amenities={mockAmenities}
          fetchReservationsFn={fetchReservations}
          createReservationFn={createReservation}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Skyline Lounge')).toBeInTheDocument();
    expect(screen.getAllByText('$40/hr')[0]).toBeInTheDocument();
    expect(screen.getByText(/Cap: 30/i)).toBeInTheDocument();
  });
});
