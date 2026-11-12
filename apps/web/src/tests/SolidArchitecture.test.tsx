import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '../context/ApiContext';
import { createSegregatedGateways, api } from '../api/client';
import type { IApiGateways } from '../api/interfaces';
import { StaffView } from '../components/StaffView';
import { TenantView } from '../components/TenantView';
import { getCalendarEventPresentation } from '../components/tenant/calendarEventStrategies';
import type {
  AmenityCalendarEvent,
  PropertyStaff,
  PropertyWithStats,
  UserSummary,
} from '@tenants/shared-types';

const mockProperty: PropertyWithStats = {
  id: 'prop-solid-1',
  name: 'SOLID Manor',
  address_line1: '100 Principle Way',
  city: 'Seattle',
  state_province: 'WA',
  postal_code: '98101',
  unit_count: 5,
  occupied_units_count: 4,
  tenant_count: 4,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockStaffMember: PropertyStaff = {
  id: 'staff-solid-1',
  property_id: 'prop-solid-1',
  property_name: 'SOLID Manor',
  first_name: 'Barbara',
  last_name: 'Liskov',
  role: 'manager',
  title: 'Principal Operations Director',
  email: 'barbara.liskov@example.com',
  phone: '+1 (555) 010-2000',
  specialization: 'Behavioral Subtyping & Operations',
  shift: 'Day (08:00 - 16:30)',
  status: 'active',
  assigned_calls_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('Frontend SOLID Architecture (ISP + DIP + LSP)', () => {
  it('substitutes segregated gateway implementations via ApiProvider without touching concrete ApiClient', async () => {
    const singletonSpy = vi.spyOn(api, 'getStaff');

    const baseGateways = createSegregatedGateways();
    const fakeGateways: IApiGateways = {
      ...baseGateways,
      staff: {
        getStaff: vi.fn().mockResolvedValue([mockStaffMember]),
        getStaffById: vi.fn().mockResolvedValue(mockStaffMember),
        createStaff: vi.fn(),
        updateStaff: vi.fn(),
        deleteStaff: vi.fn(),
      },
      maintenance: {
        ...baseGateways.maintenance,
        getMaintenanceCalls: vi.fn().mockResolvedValue([]),
      },
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ApiProvider gateways={fakeGateways}>
          <StaffView properties={[mockProperty]} selectedPropertyId="prop-solid-1" />
        </ApiProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Barbara Liskov')).toBeInTheDocument();
      expect(screen.getByText('Principal Operations Director')).toBeInTheDocument();
    });

    expect(fakeGateways.staff.getStaff).toHaveBeenCalledWith('prop-solid-1', 'all');
    expect(fakeGateways.maintenance.getMaintenanceCalls).toHaveBeenCalledWith({
      property_id: 'prop-solid-1',
    });
    expect(singletonSpy).not.toHaveBeenCalled();
  });

  it('injects segregated tenantSessions & amenities gateways into TenantView (DIP) and enforces Open/Closed calendar privacy strategy', async () => {
    const singletonCalendarSpy = vi.spyOn(api, 'getAmenityCalendar');
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sampleOtherEvent: AmenityCalendarEvent = {
      id: 'ev-solid-1',
      amenity_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      start_time: `${tomorrowStr}T15:00:00Z`,
      end_time: `${tomorrowStr}T17:00:00Z`,
      status: 'confirmed',
      is_own: false,
      scheduled_by_name: 'Elena Rostova',
      unit_number: '102',
      attendees_count: 4,
      notes: 'Confidential',
    };

    const tenantView = getCalendarEventPresentation(sampleOtherEvent, false);
    expect(tenantView.isPrivateMasked).toBe(true);
    expect(tenantView.interactive).toBe(false);
    expect(tenantView.title).toBe('Reserved');

    const adminView = getCalendarEventPresentation(sampleOtherEvent, true);
    expect(adminView.isPrivateMasked).toBe(false);
    expect(adminView.interactive).toBe(true);
    expect(adminView.title).toBe('Elena Rostova · Unit 102');

    const baseGateways = createSegregatedGateways();
    const fakeCalendarFn = vi.fn().mockResolvedValue([sampleOtherEvent]);
    const fakeGateways: IApiGateways = {
      ...baseGateways,
      amenities: {
        ...baseGateways.amenities,
        getAmenities: vi.fn().mockResolvedValue([]),
      },
      tenantSessions: {
        ...baseGateways.tenantSessions,
        getTenantAmenitySessions: vi.fn().mockResolvedValue([]),
        getAmenityCalendar: fakeCalendarFn,
      },
      maintenance: {
        ...baseGateways.maintenance,
        getMaintenanceCalls: vi.fn().mockResolvedValue([]),
      },
    };

    const tenantActor: UserSummary = {
      id: 'u-solid-tenant',
      email: 'solid@example.com',
      full_name: 'Solid Resident',
      role: 'tenant',
      tenant_id: 't-solid-1',
      property_id: 'prop-solid-1',
      unit_number: '101',
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ApiProvider gateways={fakeGateways}>
          <TenantView
            properties={[mockProperty]}
            selectedPropertyId="prop-solid-1"
            currentUser={tenantActor}
          />
        </ApiProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(fakeCalendarFn).toHaveBeenCalled();
    });
    expect(singletonCalendarSpy).not.toHaveBeenCalled();
  });
});
