import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParkingMapViewer } from '../components/ParkingMapViewer';
import type { ParkingLayoutResponse } from '@tenants/shared-types';

const mockLayout: ParkingLayoutResponse = {
  zone: {
    id: 'zone-1',
    name: 'Garage P1',
    floor_level: 1,
    svg_viewbox: '0 0 1000 600',
  },
  spots: [
    {
      id: 'spot-1',
      spot_number: 'P1-01',
      spot_type: 'standard',
      shape: 'rect',
      coordinates: { x: 50, y: 50, width: 80, height: 140 },
      status: 'vacant',
      hourly_rate_cents: 500,
      monthly_rate_cents: 15000,
    },
    {
      id: 'spot-2',
      spot_number: 'P1-02',
      spot_type: 'ev_charging',
      shape: 'rect',
      coordinates: { x: 150, y: 50, width: 80, height: 140 },
      status: 'occupied',
      hourly_rate_cents: 700,
      monthly_rate_cents: 22000,
    },
  ],
};

describe('ParkingMapViewer', () => {
  it('renders zone title and all spot identifiers', () => {
    const onReserve = vi.fn().mockResolvedValue(undefined);
    render(<ParkingMapViewer layout={mockLayout} onReserveSpot={onReserve} />);

    expect(screen.getByText('Garage P1')).toBeInTheDocument();
    expect(screen.getByText('P1-01')).toBeInTheDocument();
    expect(screen.getByText('P1-02')).toBeInTheDocument();
  });

  it('selects a vacant spot on click and opens detail drawer', () => {
    const onReserve = vi.fn().mockResolvedValue(undefined);
    render(<ParkingMapViewer layout={mockLayout} onReserveSpot={onReserve} />);

    const spotText = screen.getByText('P1-01');
    fireEvent.click(spotText);

    expect(screen.getByText('Slot Identifier')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reserve Spot P1-01/i })).toBeInTheDocument();
  });
});
