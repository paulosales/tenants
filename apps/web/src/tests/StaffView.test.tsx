import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffView } from '../components/StaffView';
import { api } from '../api/client';
import type {
  PropertyWithStats,
  PropertyStaff,
  MaintenanceCall,
} from '@tenants/shared-types';

const mockProperties: PropertyWithStats[] = [
  {
    id: 'prop-1',
    name: 'Grandview Heights Luxury Residences',
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

const mockStaffList: PropertyStaff[] = [
  {
    id: 'staff-1',
    property_id: 'prop-1',
    property_name: 'Grandview Heights Luxury Residences',
    first_name: 'Sarah',
    last_name: 'Jenkins',
    role: 'manager',
    title: 'Senior Property Director',
    email: 's.jenkins@grandview.example.com',
    phone: '+1 (206) 555-0111',
    specialization: 'Portfolio Operations',
    shift: 'Day (08:30 - 17:30)',
    status: 'active',
    assigned_calls_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'staff-2',
    property_id: 'prop-1',
    property_name: 'Grandview Heights Luxury Residences',
    first_name: 'Carlos',
    last_name: 'Mendez',
    role: 'maintainer',
    title: 'Lead Plumber',
    email: 'carlos.m@grandview.example.com',
    phone: '+1 (555) 019-3321',
    specialization: 'Plumbing & Hydraulics',
    shift: 'Morning (07:00 - 15:30)',
    status: 'active',
    assigned_calls_count: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'staff-3',
    property_id: 'prop-1',
    property_name: 'Grandview Heights Luxury Residences',
    first_name: 'Marcus',
    last_name: 'Vance',
    role: 'security',
    title: 'Chief of Security',
    email: 'm.vance@grandview.example.com',
    phone: '+1 (206) 555-0144',
    specialization: 'CCTV & Gate Access',
    shift: 'Night (20:00 - 04:00)',
    status: 'active',
    assigned_calls_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'staff-4',
    property_id: 'prop-1',
    property_name: 'Grandview Heights Luxury Residences',
    first_name: 'Maria',
    last_name: 'Gonzalez',
    role: 'cleaner',
    title: 'Head of Housekeeping',
    email: 'maria.g@grandview.example.com',
    phone: '+1 (206) 555-0177',
    specialization: 'Deep Sanitation',
    shift: 'Morning (06:00 - 14:00)',
    status: 'active',
    assigned_calls_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockMaintenanceCalls: MaintenanceCall[] = [
  {
    id: 'call-101',
    ticket_number: 'MNT-2026-0418',
    tenant_id: 'tenant-1',
    property_id: 'prop-1',
    unit_number: '101',
    category: 'plumbing',
    priority: 'routine',
    title: 'Slow draining bathroom sink',
    description: 'Master bathroom sink drains slowly.',
    permission_to_enter: true,
    preferred_time_window: 'Morning (08:00 - 12:00)',
    contact_phone: '+1 (206) 555-0192',
    status: 'reported',
    assigned_technician: null,
    technician_phone: null,
    scheduled_date: null,
    resolution_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'call-102',
    ticket_number: 'MNT-2026-0502',
    tenant_id: 'tenant-1',
    property_id: 'prop-1',
    unit_number: '102',
    category: 'hvac',
    priority: 'urgent',
    title: 'Low cooling in bedroom',
    description: 'Thermostat unresponsive.',
    permission_to_enter: true,
    preferred_time_window: 'Afternoon (12:00 - 16:00)',
    contact_phone: '+1 (206) 555-0192',
    status: 'dispatched',
    assigned_technician: 'Dave K.',
    technician_phone: '+1 (555) 019-4412',
    scheduled_date: new Date().toISOString(),
    resolution_notes: null,
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

describe('StaffView Component - Properties Staff & Maintainer Assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'getStaff').mockResolvedValue(mockStaffList);
    vi.spyOn(api, 'getMaintenanceCalls').mockResolvedValue(mockMaintenanceCalls);
    vi.spyOn(api, 'createStaff').mockResolvedValue({
      id: 'staff-new',
      property_id: 'prop-1',
      property_name: 'Grandview Heights Luxury Residences',
      first_name: 'Elena',
      last_name: 'Santos',
      role: 'maintainer',
      title: 'HVAC Specialist',
      email: 'elena.s@grandview.example.com',
      phone: '+1 (555) 019-7788',
      specialization: 'Smart Climate & Heat Pumps',
      shift: 'Day (08:00 - 16:30)',
      status: 'active',
      assigned_calls_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.spyOn(api, 'assignMaintenanceCallStaff').mockResolvedValue({
      ...mockMaintenanceCalls[0],
      assigned_staff_id: 'staff-2',
      assigned_technician: 'Carlos Mendez (Lead Plumber)',
      status: 'dispatched',
    });
    vi.spyOn(api, 'deleteStaff').mockResolvedValue(undefined);
  });

  it('renders page header, operations KPI cards, and all staff member categories', async () => {
    renderWithQuery(<StaffView properties={mockProperties} selectedPropertyId="prop-1" />);

    // Header title
    expect(screen.getByText('Properties Staff & Operations Team')).toBeInTheDocument();
    expect(screen.getByText(/Manage property managers, technical maintainers/i)).toBeInTheDocument();

    // Staff names and roles in table
    await waitFor(() => {
      expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
    });

    expect(screen.getByText('Senior Property Director')).toBeInTheDocument();
    expect(screen.getByText('Carlos Mendez')).toBeInTheDocument();
    expect(screen.getByText('Lead Plumber')).toBeInTheDocument();
    expect(screen.getByText('Marcus Vance')).toBeInTheDocument();
    expect(screen.getByText('Chief of Security')).toBeInTheDocument();
    expect(screen.getByText('Maria Gonzalez')).toBeInTheDocument();
    expect(screen.getByText('Head of Housekeeping')).toBeInTheDocument();

    // KPI Cards
    expect(screen.getByText('Total Personnel')).toBeInTheDocument();
    expect(screen.getByText('Property Managers')).toBeInTheDocument();
    expect(screen.getByText('Technical Maintainers')).toBeInTheDocument();
    expect(screen.getByText('Security Personnel')).toBeInTheDocument();
    expect(screen.getByText('Housekeeping & Cleaners')).toBeInTheDocument();
  });

  it('filters staff by role when clicking role filter buttons', async () => {
    renderWithQuery(<StaffView properties={mockProperties} selectedPropertyId="prop-1" />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Mendez')).toBeInTheDocument();
    });

    // Click "Managers" filter
    const managerFilterBtn = screen.getByRole('button', { name: /Managers/i });
    fireEvent.click(managerFilterBtn);

    // Only manager should be visible
    await waitFor(() => {
      expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
    });
    expect(screen.queryByText('Marcus Vance')).not.toBeInTheDocument();
    expect(screen.queryByText('Maria Gonzalez')).not.toBeInTheDocument();

    // Click "All Staff"
    const allFilterBtn = screen.getByRole('button', { name: /All Staff/i });
    fireEvent.click(allFilterBtn);

    await waitFor(() => {
      expect(screen.getByText('Marcus Vance')).toBeInTheDocument();
    });
  });

  it('shows maintainer workload and opens assignment modal to assign a maintenance call', async () => {
    renderWithQuery(<StaffView properties={mockProperties} selectedPropertyId="prop-1" />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Mendez')).toBeInTheDocument();
    });

    // Check maintainer workload badge
    expect(screen.getByText('2 Active Tickets')).toBeInTheDocument();

    // Click "Assign Call" button for maintainer Carlos Mendez
    const assignBtn = screen.getByRole('button', { name: /Assign Call/i });
    fireEvent.click(assignBtn);

    // Modal should open
    expect(screen.getByText('Assign Maintenance Call to Maintainer')).toBeInTheDocument();
    expect(screen.getByText(/Dispatching to:/i)).toBeInTheDocument();
    expect(screen.getAllByText('Carlos Mendez').length).toBeGreaterThanOrEqual(1);

    // Check eligible calls in modal
    await waitFor(() => {
      expect(screen.getByText('MNT-2026-0418 - Unit 101')).toBeInTheDocument();
    });
    expect(screen.getByText('Slow draining bathroom sink')).toBeInTheDocument();

    // Select the call
    const callOption = screen.getByText('MNT-2026-0418 - Unit 101').closest('div');
    fireEvent.click(callOption!);

    // Enter dispatch notes
    const notesInput = screen.getByPlaceholderText(/Bring replacement cartridge/i);
    fireEvent.change(notesInput, { target: { value: 'Inspect master bath trap' } });

    // Click "Confirm & Dispatch Maintainer"
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Dispatch Maintainer/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.assignMaintenanceCallStaff).toHaveBeenCalledWith(
        'call-101',
        expect.objectContaining({
          staff_id: 'staff-2',
          resolution_notes: 'Inspect master bath trap',
        })
      );
    });
  });

  it('opens Add Staff Member modal and submits new staff profile', async () => {
    renderWithQuery(<StaffView properties={mockProperties} selectedPropertyId="prop-1" />);

    // Click "+ Add Staff Member"
    const addBtn = screen.getByRole('button', { name: /Add Staff Member/i });
    fireEvent.click(addBtn);

    expect(screen.getByText('Add New Staff Member')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/Department Role/i), {
      target: { value: 'maintainer' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e.g. Lead Plumber/i), {
      target: { value: 'HVAC Specialist' },
    });
    fireEvent.change(screen.getByLabelText(/First Name/i), {
      target: { value: 'Elena' },
    });
    fireEvent.change(screen.getByLabelText(/Last Name/i), {
      target: { value: 'Santos' },
    });
    fireEvent.change(screen.getByPlaceholderText(/staff@property.example.com/i), {
      target: { value: 'elena.s@grandview.example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/\+1 \(555\) 000-0000/i), {
      target: { value: '+1 (555) 019-7788' },
    });

    // Submit
    const submitBtn = screen.getByRole('button', { name: /Create Staff Member/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createStaff).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Elena',
          last_name: 'Santos',
          role: 'maintainer',
          title: 'HVAC Specialist',
          email: 'elena.s@grandview.example.com',
          phone: '+1 (555) 019-7788',
        })
      );
    });
  });

  it('prompts confirmation modal and deletes a staff member', async () => {
    renderWithQuery(<StaffView properties={mockProperties} selectedPropertyId="prop-1" />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
    });

    const deleteBtn = screen.getAllByTitle('Deactivate / Delete')[0];
    fireEvent.click(deleteBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to remove Sarah Jenkins\?/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Remove Member/i }));

    await waitFor(() => {
      expect(api.deleteStaff).toHaveBeenCalledWith('staff-1');
    });
  });
});
