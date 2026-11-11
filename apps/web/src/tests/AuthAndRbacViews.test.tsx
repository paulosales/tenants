import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '../context/ApiContext';
import { createSegregatedGateways } from '../api/client';
import type { IApiGateways } from '../api/interfaces';
import { AdminAppContent } from '../App';
import { PublicPortalView } from '../components/public/PublicPortalView';
import { LoginPage } from '../components/auth/LoginPage';
import { ApplicationsReviewView } from '../components/ApplicationsReviewView';
import { AmenityApprovalsView } from '../components/AmenityApprovalsView';
import { MaintainerCallsView } from '../components/MaintainerCallsView';
import { StaffMessagesView } from '../components/StaffMessagesView';
import type {
  AmenitySessionBooking,
  MaintenanceCall,
  PropertyWithStats,
  PublicPropertyListing,
  StaffMessage,
  TenancyApplication,
  UserSummary,
} from '@tenants/shared-types';

const mockProp: PropertyWithStats = {
  id: '11111111-2222-3333-4444-555555555551',
  name: 'Grandview Heights Luxury Residences',
  address_line1: '1200 Grandview Avenue',
  city: 'Seattle',
  state_province: 'WA',
  postal_code: '98101',
  unit_count: 4,
  occupied_units_count: 2,
  tenant_count: 2,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockPublicListing: PublicPropertyListing = {
  id: '11111111-2222-3333-4444-555555555551',
  name: 'Grandview Heights Luxury Residences',
  address_line1: '1200 Grandview Avenue',
  city: 'Seattle',
  state_province: 'WA',
  postal_code: '98101',
  total_units: 4,
  available_units: 1,
  manager_count: 1,
  vacant_units: [
    {
      id: '22222222-1111-1111-1111-111111111103',
      unit_number: '201',
      floor: 2,
      bedrooms: 2,
      bathrooms: 2,
      square_feet: 1020,
      status: 'vacant',
    },
  ],
  amenities: ['Skyline Rooftop Lounge'],
};

function makeFakeGateways(overrides: Partial<IApiGateways> = {}): IApiGateways {
  const base = createSegregatedGateways();
  return {
    ...base,
    properties: {
      ...base.properties,
      getProperties: vi.fn().mockResolvedValue([mockProp]),
    },
    tenants: {
      ...base.tenants,
      getTenants: vi.fn().mockResolvedValue([]),
    },
    amenities: {
      ...base.amenities,
      getAmenities: vi.fn().mockResolvedValue([]),
    },
    staff: {
      ...base.staff,
      getStaff: vi.fn().mockResolvedValue([]),
    },
    maintenance: {
      ...base.maintenance,
      getMaintenanceCalls: vi.fn().mockResolvedValue([]),
      updateMaintenanceCallStatus: vi.fn().mockImplementation(async (id, status, notes) => ({
        id,
        ticket_number: 'MNT-2026-0418',
        tenant_id: 't1',
        property_id: mockProp.id,
        unit_number: '101',
        category: 'plumbing',
        priority: 'routine',
        title: 'Drain leak',
        description: 'Sink trap dripping',
        permission_to_enter: true,
        preferred_time_window: 'Morning',
        contact_phone: '555-0192',
        status,
        resolution_notes: notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
    },
    tenantSessions: {
      ...base.tenantSessions,
      getTenantAmenitySessions: vi.fn().mockResolvedValue([]),
      reviewAmenitySession: vi.fn().mockImplementation(async (id, dto) => ({
        id,
        amenity_id: 'a1',
        amenity_name: 'Skyline Rooftop Lounge',
        tenant_id: 't1',
        tenant_name: 'Marcus Vance',
        property_id: mockProp.id,
        unit_number: '101',
        booking_date: '2026-12-01',
        start_time: '2026-12-01T18:00:00Z',
        end_time: '2026-12-01T20:00:00Z',
        attendees_count: 6,
        total_fee_cents: 5000,
        status: dto.status,
        notes: dto.notes,
        created_at: new Date().toISOString(),
      })),
    },
    publicPortal: {
      getPublicProperties: vi.fn().mockResolvedValue([mockPublicListing]),
      getPublicProperty: vi.fn().mockResolvedValue(mockPublicListing),
      submitPublicApplication: vi.fn().mockResolvedValue({
        application: {
          id: 'app-new-1',
          property_id: mockPublicListing.id,
          applicant_first_name: 'Jordan',
          applicant_last_name: 'Taylor',
          applicant_email: 'jordan@example.com',
          applicant_phone: '2065550101',
          monthly_income_cents: 650000,
          employment_status: 'full_time',
          occupants_count: 1,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        managers_notified: 1,
        message: 'Application routed.',
      }),
    },
    applications: {
      getApplications: vi.fn().mockResolvedValue([]),
      reviewApplication: vi.fn(),
    },
    messages: {
      getMessages: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn(),
      markMessageRead: vi.fn(),
    },
    ...overrides,
  };
}

function renderWithProviders(ui: React.ReactElement, gateways: IApiGateways = makeFakeGateways()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ApiProvider gateways={gateways}>{ui}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('Authentication, Public Portal & RBAC Workspace Views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows unauthenticated visitors to view public properties and submit a tenancy application', async () => {
    const gateways = makeFakeGateways();
    const onOpenLogin = vi.fn();

    renderWithProviders(<PublicPortalView onOpenLogin={onOpenLogin} />, gateways);

    await waitFor(() => {
      expect(screen.getByText('Grandview Heights Luxury Residences')).toBeInTheDocument();
      expect(screen.getByText(/1 Matching Suite/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Apply to Be a Tenant'));
    expect(screen.getByText(/Tenancy Application — Grandview Heights Luxury Residences/i)).toBeInTheDocument();

    fireEvent.change(document.getElementById('app-first-name')!, { target: { value: 'Jordan' } });
    fireEvent.change(document.getElementById('app-last-name')!, { target: { value: 'Taylor' } });
    fireEvent.change(document.getElementById('app-email')!, { target: { value: 'jordan@example.com' } });
    fireEvent.change(document.getElementById('app-phone')!, { target: { value: '2065550101' } });
    fireEvent.click(document.getElementById('submit-tenancy-application-btn')!);

    await waitFor(() => {
      expect(gateways.publicPortal.submitPublicApplication).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Routed to 1 property manager/i)).toBeInTheDocument();
    });
  });

  it('renders LoginPage role directory prefill and invokes onLogin cleanly', async () => {
    const onLogin = vi.fn().mockResolvedValue({});
    const onBack = vi.fn();

    renderWithProviders(<LoginPage onLogin={onLogin} onNavigateToPortal={onBack} />);

    fireEvent.click(screen.getByText('Property Manager'));
    expect((document.getElementById('login-email') as HTMLInputElement).value).toBe('manager@property.local');

    fireEvent.change(document.getElementById('login-password')!, { target: { value: 'test-pass-only' } });
    fireEvent.click(document.getElementById('login-submit-btn')!);

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith('manager@property.local', 'test-pass-only');
    });
  });

  it('restricts Tenant role strictly to Tenant View without admin navigation', async () => {
    const tenantUser: UserSummary = {
      id: 'u-tenant-1',
      email: 'tenant@property.local',
      full_name: 'Marcus Vance',
      role: 'tenant',
      unit_number: '101',
      property_id: mockProp.id,
      tenant_id: '33333333-1111-1111-1111-111111111001',
    };

    const gateways = makeFakeGateways();
    renderWithProviders(<AdminAppContent user={tenantUser} onLogout={vi.fn()} />, gateways);

    await waitFor(() => {
      expect(screen.getByText(/ApexLiving Resident Portal/i)).toBeInTheDocument();
      expect(screen.getByText(/Welcome back, Marcus Vance/i)).toBeInTheDocument();
    });

    expect(screen.queryByText('Applications')).not.toBeInTheDocument();
    expect(screen.queryByText('Staff & Team')).not.toBeInTheDocument();
    expect(gateways.tenants.getTenants).not.toHaveBeenCalled();
  });

  it('scopes Building Staff sidebar solely to Staff Messages and allows Maintainer call updates', async () => {
    const staffUser: UserSummary = {
      id: 'u-staff-1',
      email: 'staff@property.local',
      full_name: 'Maria Gonzalez',
      role: 'staff',
      property_id: mockProp.id,
      staff_id: 'staff-maria',
    };

    const gateways = makeFakeGateways();
    renderWithProviders(<AdminAppContent user={staffUser} onLogout={vi.fn()} />, gateways);

    await waitFor(() => {
      expect(screen.getByText('Team & Management Messaging')).toBeInTheDocument();
    });
    expect(screen.queryByText('Applications')).not.toBeInTheDocument();
    expect(screen.queryByText('Maintenance Calls')).not.toBeInTheDocument();
  });

  it('allows Property Manager to review applications, accept amenity bookings, and message staff', async () => {
    const mockApp: TenancyApplication = {
      id: 'app-1',
      property_id: mockProp.id,
      property_name: mockProp.name,
      applicant_first_name: 'Clara',
      applicant_last_name: 'Oswald',
      applicant_email: 'clara@example.com',
      applicant_phone: '2065550188',
      monthly_income_cents: 950000,
      employment_status: 'full_time',
      occupants_count: 2,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockSession: AmenitySessionBooking = {
      id: 'res-pending-1',
      amenity_id: 'am-1',
      amenity_name: 'Skyline Rooftop Lounge',
      tenant_id: 't-1',
      tenant_name: 'Marcus Vance',
      property_id: mockProp.id,
      unit_number: '101',
      booking_date: '2026-12-01',
      start_time: '2026-12-01T18:00:00Z',
      end_time: '2026-12-01T20:00:00Z',
      attendees_count: 8,
      total_fee_cents: 5000,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const mockCall: MaintenanceCall = {
      id: 'call-1',
      ticket_number: 'MNT-2026-0418',
      tenant_id: 't-1',
      property_id: mockProp.id,
      unit_number: '101',
      category: 'plumbing',
      priority: 'routine',
      title: 'Drain leak',
      description: 'Slow sink drain',
      permission_to_enter: true,
      preferred_time_window: 'Morning',
      contact_phone: '555-0192',
      status: 'dispatched',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockMsg: StaffMessage = {
      id: 'msg-1',
      property_id: mockProp.id,
      sender_user_id: 'mgr-1',
      sender_name: 'Sarah Jenkins',
      sender_role: 'property_manager',
      body: 'Please inspect Tower A lobby.',
      is_read: false,
      created_at: new Date().toISOString(),
    };

    const gateways = makeFakeGateways({
      applications: {
        getApplications: vi.fn().mockResolvedValue([mockApp]),
        reviewApplication: vi.fn().mockResolvedValue({ ...mockApp, status: 'approved' }),
      },
      messages: {
        getMessages: vi.fn().mockResolvedValue([mockMsg]),
        sendMessage: vi.fn().mockResolvedValue(mockMsg),
        markMessageRead: vi.fn(),
      },
    });
    gateways.tenantSessions.getTenantAmenitySessions = vi.fn().mockResolvedValue([mockSession]);
    gateways.maintenance.getMaintenanceCalls = vi.fn().mockResolvedValue([mockCall]);

    // 1. Applications review
    renderWithProviders(<ApplicationsReviewView properties={[mockProp]} selectedPropertyId={mockProp.id} />, gateways);
    await waitFor(() => expect(screen.getByText('Clara Oswald')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Approve'));
    fireEvent.click(screen.getByText('Confirm Decision'));
    await waitFor(() =>
      expect(gateways.applications.reviewApplication).toHaveBeenCalledWith('app-1', {
        status: 'approved',
        review_notes: undefined,
        onboard_as_tenant: true,
      })
    );

    // 2. Amenity schedule approval
    renderWithProviders(<AmenityApprovalsView properties={[mockProp]} selectedPropertyId={mockProp.id} />, gateways);
    await waitFor(() => expect(screen.getByText('Accept Schedule')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Accept Schedule'));
    fireEvent.click(screen.getByText('Accept Booking'));
    await waitFor(() =>
      expect(gateways.tenantSessions.reviewAmenitySession).toHaveBeenCalledWith('res-pending-1', {
        status: 'confirmed',
        notes: undefined,
      })
    );

    // 3. Maintainer call solve
    renderWithProviders(<MaintainerCallsView properties={[mockProp]} selectedPropertyId={mockProp.id} />, gateways);
    await waitFor(() => expect(screen.getByText('Drain leak')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Mark Solved'));
    fireEvent.click(screen.getByText('Mark Call Solved'));
    await waitFor(() =>
      expect(gateways.maintenance.updateMaintenanceCallStatus).toHaveBeenCalledWith(
        'call-1',
        'resolved',
        'Resolved by technical maintenance staff'
      )
    );

    // 4. Staff messaging
    renderWithProviders(<StaffMessagesView properties={[mockProp]} selectedPropertyId={mockProp.id} />, gateways);
    await waitFor(() => expect(screen.getByText('Please inspect Tower A lobby.')).toBeInTheDocument());
    fireEvent.change(document.getElementById('staff-message-input')!, {
      target: { value: 'Confirmed, heading up now.' },
    });
    fireEvent.click(document.getElementById('send-staff-message-btn')!);
    await waitFor(() =>
      expect(gateways.messages.sendMessage).toHaveBeenCalledWith({
        property_id: mockProp.id,
        recipient_staff_id: null,
        body: 'Confirmed, heading up now.',
      })
    );
  });
});

