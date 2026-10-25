import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UnitsView } from '../components/UnitsView';
import { api } from '../api/client';
import type { PropertyWithStats, UnitWithTenant, TenantWithUnit } from '@tenants/shared-types';

const mockProperties: PropertyWithStats[] = [
  {
    id: 'prop-1',
    name: 'Sunset Towers',
    address_line1: '100 Sunset Blvd',
    city: 'Los Angeles',
    state_province: 'CA',
    postal_code: '90028',
    unit_count: 5,
    occupied_units_count: 3,
    tenant_count: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockUnits: UnitWithTenant[] = [
  {
    id: 'unit-1',
    property_id: 'prop-1',
    unit_number: '101',
    floor: 1,
    bedrooms: 2,
    bathrooms: 2,
    square_feet: 850,
    status: 'occupied',
    tenant_id: 'tenant-1',
    tenant_name: 'Alice Smith, Bob Jones',
    tenant_email: 'alice@example.com',
    tenants: [
      { id: 'tenant-1', name: 'Alice Smith', email: 'alice@example.com' },
      { id: 'tenant-2', name: 'Bob Jones', email: 'bob@example.com' },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'unit-2',
    property_id: 'prop-1',
    unit_number: '102',
    floor: 1,
    bedrooms: 1,
    bathrooms: 1,
    square_feet: 600,
    status: 'vacant',
    tenants: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockTenants: TenantWithUnit[] = [
  {
    id: 'tenant-1',
    first_name: 'Alice',
    last_name: 'Smith',
    email: 'alice@example.com',
    phone: '+1 555-0101',
    assigned_unit_id: 'unit-1',
    unit_number: '101',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tenant-2',
    first_name: 'Bob',
    last_name: 'Jones',
    email: 'bob@example.com',
    phone: '+1 555-0102',
    assigned_unit_id: 'unit-1',
    unit_number: '101',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tenant-3',
    first_name: 'Charlie',
    last_name: 'Brown',
    email: 'charlie@example.com',
    phone: '+1 555-0103',
    assigned_unit_id: null,
    unit_number: null,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('UnitsView Component - Multi-Tenant Assignment', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getUnits').mockResolvedValue(mockUnits);
    vi.spyOn(api, 'getTenants').mockResolvedValue(mockTenants);
  });

  it('renders units list and displays multiple tenants badge and names', async () => {
    renderWithQuery(
      <UnitsView
        properties={mockProperties}
        selectedPropertyId="prop-1"
        onSelectProperty={vi.fn()}
      />
    );

    // Verify unit 101 and 102 are rendered
    await waitFor(() => {
      expect(screen.getByText('101')).toBeInTheDocument();
      expect(screen.getByText('102')).toBeInTheDocument();
    });

    // Check multiple tenants badge and names
    expect(screen.getByText('2 Tenants')).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();

    // Check vacant unit shows Unassigned
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('opens Add Unit modal and provides multi-tenant selector', async () => {
    renderWithQuery(
      <UnitsView
        properties={mockProperties}
        selectedPropertyId="prop-1"
        onSelectProperty={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Add Unit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Add Unit'));

    // Modal should be open
    expect(screen.getByText('Assigned Tenants (Multiple)')).toBeInTheDocument();
    expect(screen.getByText('Select one or multiple tenants...')).toBeInTheDocument();
  });

  it('opens Edit Unit modal with previously assigned tenants pre-selected', async () => {
    renderWithQuery(
      <UnitsView
        properties={mockProperties}
        selectedPropertyId="prop-1"
        onSelectProperty={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('101')).toBeInTheDocument();
    });

    // Click edit unit button for 101
    const editButtons = screen.getAllByTitle('Edit Unit');
    fireEvent.click(editButtons[0]);

    // Modal title
    expect(screen.getByText('Edit Unit 101')).toBeInTheDocument();

    // Assigned tenants chips should be rendered in the modal
    await waitFor(() => {
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });
  });
});
