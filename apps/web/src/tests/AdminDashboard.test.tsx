import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropertiesView } from '../components/PropertiesView';
import { ParkingLayoutEditor } from '../components/ParkingLayoutEditor';
import { api } from '../api/client';
import type { PropertyWithStats, ParkingLayoutWithSpots } from '@tenants/shared-types';

const mockProperties: PropertyWithStats[] = [
  {
    id: 'prop-1',
    name: 'Grandview Heights',
    address_line1: '1200 Grandview Ave',
    city: 'Seattle',
    state_province: 'WA',
    postal_code: '98101',
    unit_count: 10,
    occupied_units_count: 8,
    tenant_count: 8,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockLayout: ParkingLayoutWithSpots = {
  layout: {
    id: 'layout-1',
    property_id: 'prop-1',
    canvas_width: 1200,
    canvas_height: 800,
    grid_size: 20,
    updated_at: new Date().toISOString(),
  },
  spots: [
    {
      id: 'spot-1',
      layout_id: 'layout-1',
      spot_label: 'P-01',
      x: 60,
      y: 60,
      width: 60,
      height: 120,
      rotation: 0,
      spot_type: 'standard',
      is_occupied: false,
      assigned_tenant_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Admin Dashboard Views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PropertiesView with portfolio statistics and properties table', async () => {
    vi.spyOn(api, 'getProperties').mockResolvedValue(mockProperties);

    renderWithQuery(
      <PropertiesView
        onSelectPropertyForUnits={vi.fn()}
        onSelectPropertyForParking={vi.fn()}
      />
    );

    expect(screen.getByText('Properties Management')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Grandview Heights')).toBeInTheDocument();
      expect(screen.getByText('1200 Grandview Ave, Seattle, WA 98101')).toBeInTheDocument();
    });

    // Check stats
    expect(screen.getAllByText('80%')[0]).toBeInTheDocument(); // 8 / 10 = 80% occupancy
  });

  it('renders ParkingLayoutEditor and adds a new spot with grid snap', async () => {
    vi.spyOn(api, 'getAdminParkingLayout').mockResolvedValue(mockLayout);
    vi.spyOn(api, 'getTenants').mockResolvedValue([]);

    renderWithQuery(
      <ParkingLayoutEditor
        properties={mockProperties}
        selectedPropertyId="prop-1"
        onSelectProperty={vi.fn()}
      />
    );

    // Initial spot P-01
    await waitFor(() => {
      expect(screen.getByText('P-01')).toBeInTheDocument();
    });

    // Click "EV" to add an EV spot
    const evButton = screen.getByText('EV');
    fireEvent.click(evButton);

    // New spot should appear and trigger unsaved changes indicator
    await waitFor(() => {
      expect(screen.getByText('EV-01')).toBeInTheDocument();
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });
  });
});
