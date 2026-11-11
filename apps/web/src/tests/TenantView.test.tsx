import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  TenantView,
  formatLocalSessionDate,
  formatLocalSessionTimeWindow,
  formatUtcTimeWindow,
} from '../components/TenantView';
import { api } from '../api/client';
import type { PropertyWithStats, AmenitySessionBooking, MaintenanceCall } from '@tenants/shared-types';

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

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('TenantView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'getTenants').mockResolvedValue([]);
    vi.spyOn(api, 'getAmenities').mockResolvedValue([]);
    vi.spyOn(api, 'getTenantAmenitySessions').mockResolvedValue([]);
    vi.spyOn(api, 'getMaintenanceCalls').mockResolvedValue([]);
  });

  it('renders resident welcome banner, emergency hotline button, and both primary feature tabs', async () => {
    renderWithQuery(<TenantView properties={mockProperties} selectedPropertyId="prop-1" />);

    // Check resident welcome banner
    expect(screen.getByText(/Welcome back,/i)).toBeInTheDocument();
    expect(screen.getByText('Verified Resident')).toBeInTheDocument();

    // Check emergency hotline call button
    const emergencyBtn = screen.getByText('24/7 Emergency Call');
    expect(emergencyBtn).toBeInTheDocument();
    expect(emergencyBtn.closest('a')).toHaveAttribute('href', 'tel:+18005552739');

    // Check feature navigation tabs
    expect(screen.getByText('Amenities Session Scheduling')).toBeInTheDocument();
    expect(screen.getByText('Maintenance Call & Dispatch')).toBeInTheDocument();
  });

  describe('Feature 1: Amenities Session Scheduling', () => {
    it('displays community amenities list and allows selecting an amenity to schedule a session', async () => {
      renderWithQuery(<TenantView properties={mockProperties} selectedPropertyId="prop-1" />);

      // Verify default amenities are visible
      expect(screen.getAllByText('Skyline Rooftop Lounge').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Tennis & Pickleball Court').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Heated Swimming Pool & Cabana').length).toBeGreaterThanOrEqual(1);

      // Click on Tennis & Pickleball Court card by id
      const tennisCard = document.getElementById('amenity-card-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
      expect(tennisCard).toBeInTheDocument();
      fireEvent.click(tennisCard!);

      // Verify scheduling wizard reflects selected amenity
      expect(screen.getByText(/Configuring reservation for/i)).toBeInTheDocument();
    });

    it('submits an amenity session booking and displays it in My Booked Sessions', async () => {
      const mockSession: AmenitySessionBooking = {
        id: 'sess-test-123',
        amenity_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        amenity_name: 'Skyline Rooftop Lounge',
        tenant_id: 'tenant-demo-marcus',
        tenant_name: 'Marcus Vance',
        property_id: 'prop-1',
        unit_number: '101',
        booking_date: '2026-11-20',
        start_time: '14:00',
        end_time: '16:00',
        attendees_count: 4,
        total_fee_cents: 10000,
        status: 'confirmed',
        notes: 'Team celebration gathering',
        created_at: new Date().toISOString(),
      };

      const bookSpy = vi.spyOn(api, 'bookAmenitySession').mockResolvedValue(mockSession);
      vi.spyOn(api, 'getTenantAmenitySessions').mockResolvedValue([mockSession]);

      renderWithQuery(<TenantView properties={mockProperties} selectedPropertyId="prop-1" />);

      // Fill in booking date
      const dateInput = document.getElementById('amenity-booking-date') as HTMLInputElement;
      expect(dateInput).toBeInTheDocument();
      fireEvent.change(dateInput, { target: { value: '2026-11-20' } });

      // Fill in attendees
      const attendeesInput = document.getElementById('amenity-attendees-count') as HTMLInputElement;
      fireEvent.change(attendeesInput, { target: { value: '4' } });

      // Fill notes
      const notesInput = document.getElementById('amenity-notes') as HTMLTextAreaElement;
      fireEvent.change(notesInput, { target: { value: 'Team celebration gathering' } });

      // Submit booking form
      const submitBtn = screen.getByText('Confirm & Schedule Amenity Session');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(bookSpy).toHaveBeenCalled();
      });

      // Verify success message appears
      await waitFor(() => {
        expect(screen.getByText(/Session successfully scheduled/i)).toBeInTheDocument();
      });
    });

    it('allows toggling to My Booked Sessions tab and displays scheduled sessions', async () => {
      const mockSession: AmenitySessionBooking = {
        id: 'sess-existing-1',
        amenity_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        amenity_name: 'Tennis & Pickleball Court',
        tenant_id: 'tenant-demo-marcus',
        tenant_name: 'Marcus Vance',
        property_id: 'prop-1',
        unit_number: '101',
        booking_date: '2026-11-15',
        start_time: '10:00',
        end_time: '12:00',
        attendees_count: 2,
        total_fee_cents: 5000,
        status: 'confirmed',
        created_at: new Date().toISOString(),
      };

      vi.spyOn(api, 'getTenantAmenitySessions').mockResolvedValue([mockSession]);

      renderWithQuery(<TenantView properties={mockProperties} selectedPropertyId="prop-1" />);

      // Click on My Booked Sessions sub-tab
      const mySessionsBtn = screen.getByText(/My Booked Sessions/i);
      fireEvent.click(mySessionsBtn);

      await waitFor(() => {
        expect(screen.getByText('Tennis & Pickleball Court')).toBeInTheDocument();
        expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
        expect(screen.getByText('2026-11-15')).toBeInTheDocument();
      });
    });

    it('renders UTC backend timestamps in local time with Local badge and UTC reference', async () => {
      const utcStart = '2026-11-12T18:00:00Z';
      const utcEnd = '2026-11-12T20:00:00Z';
      const expectedLocalWindow = formatLocalSessionTimeWindow(utcStart, utcEnd);
      const expectedLocalDate = formatLocalSessionDate(utcStart);
      const expectedUtcSub = formatUtcTimeWindow(utcStart, utcEnd);

      const mockSession: AmenitySessionBooking = {
        id: 'sess-utc-1',
        amenity_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        amenity_name: 'Skyline Rooftop Lounge',
        tenant_id: 'tenant-demo-marcus',
        tenant_name: 'Marcus Vance',
        property_id: 'prop-1',
        unit_number: '101',
        booking_date: '2026-11-12',
        start_time: utcStart,
        end_time: utcEnd,
        attendees_count: 4,
        total_fee_cents: 10000,
        status: 'confirmed',
        created_at: new Date().toISOString(),
      };

      vi.spyOn(api, 'getTenantAmenitySessions').mockResolvedValue([mockSession]);

      renderWithQuery(<TenantView properties={mockProperties} selectedPropertyId="prop-1" />);

      const mySessionsBtn = screen.getByText(/My Booked Sessions/i);
      fireEvent.click(mySessionsBtn);

      await waitFor(() => {
        expect(screen.getByText('Skyline Rooftop Lounge')).toBeInTheDocument();
        expect(screen.getByText('Local')).toBeInTheDocument();
        expect(screen.getByText(expectedLocalDate)).toBeInTheDocument();
        expect(screen.getByText(expectedLocalWindow)).toBeInTheDocument();
        expect(screen.getByText(expectedUtcSub)).toBeInTheDocument();
      });
    });

    it('converts user selected local date and time to UTC ISO strings on submission', async () => {
      const bookSpy = vi.spyOn(api, 'bookAmenitySession').mockResolvedValue({
        id: 'sess-new-utc',
        amenity_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        amenity_name: 'Skyline Rooftop Lounge',
        tenant_id: '33333333-1111-1111-1111-111111111001',
        property_id: 'prop-1',
        unit_number: '101',
        booking_date: '2026-11-25',
        start_time: '2026-11-25T14:00:00Z',
        end_time: '2026-11-25T16:00:00Z',
        attendees_count: 2,
        total_fee_cents: 10000,
        status: 'confirmed',
        created_at: new Date().toISOString(),
      });
      vi.spyOn(api, 'getTenantAmenitySessions').mockResolvedValue([]);

      renderWithQuery(<TenantView properties={mockProperties} selectedPropertyId="prop-1" />);

      const dateInput = document.getElementById('amenity-booking-date') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: '2026-11-25' } });

      const startSelect = document.getElementById('amenity-start-time') as HTMLSelectElement;
      fireEvent.change(startSelect, { target: { value: '14:00' } });

      const endSelect = document.getElementById('amenity-end-time') as HTMLSelectElement;
      fireEvent.change(endSelect, { target: { value: '16:00' } });

      const submitBtn = screen.getByText('Confirm & Schedule Amenity Session');
      fireEvent.click(submitBtn);

      const expectedStartUtc = new Date('2026-11-25T14:00:00').toISOString();
      const expectedEndUtc = new Date('2026-11-25T16:00:00').toISOString();

      await waitFor(() => {
        expect(bookSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            booking_date: '2026-11-25',
            start_time: expectedStartUtc,
            end_time: expectedEndUtc,
          })
        );
      });
    });
  });

  describe('Feature 2: Maintenance Call', () => {
    it('switches to Maintenance Call tab and displays 24/7 hotline and ticket tracker', async () => {
      renderWithQuery(<TenantView properties={mockProperties} selectedPropertyId="prop-1" />);

      // Switch to Maintenance Call tab
      const maintenanceTab = screen.getByText('Maintenance Call & Dispatch');
      fireEvent.click(maintenanceTab);

      // Verify emergency banner and hotline dialer
      expect(screen.getByText('Need Immediate Emergency Assistance?')).toBeInTheDocument();
      expect(screen.getByText(/Call Hotline: \+1 \(800\) 555-APEX/i)).toBeInTheDocument();

      // Verify default tracker or open call button
      expect(screen.getByText('Maintenance Calls & Service Tracker')).toBeInTheDocument();
      expect(screen.getByText('+ Place New Call')).toBeInTheDocument();
    });

    it('submits a new maintenance call and logs the ticket successfully', async () => {
      const mockNewCall: MaintenanceCall = {
        id: 'mnt-new-1',
        ticket_number: 'MNT-2026-9999',
        tenant_id: 'tenant-demo-marcus',
        tenant_name: 'Marcus Vance',
        property_id: 'prop-1',
        property_name: 'Grandview Heights',
        unit_number: '101',
        category: 'plumbing',
        priority: 'urgent',
        title: 'Kitchen faucet handle broken',
        description: 'The hot water handle snapped off and water is steadily dripping into the basin.',
        permission_to_enter: true,
        preferred_time_window: 'Morning (08:00 - 12:00)',
        contact_phone: '+1 (555) 019-2831',
        status: 'reported',
        assigned_technician: null,
        technician_phone: null,
        scheduled_date: null,
        resolution_notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const createCallSpy = vi.spyOn(api, 'createMaintenanceCall').mockResolvedValue(mockNewCall);
      vi.spyOn(api, 'getMaintenanceCalls').mockResolvedValue([mockNewCall]);

      renderWithQuery(<TenantView properties={mockProperties} selectedPropertyId="prop-1" />);

      // Switch to Maintenance feature
      fireEvent.click(screen.getByText('Maintenance Call & Dispatch'));

      // Click + Place New Call
      fireEvent.click(screen.getByText('+ Place New Call'));

      expect(screen.getByRole('heading', { name: 'Place Maintenance Call' })).toBeInTheDocument();

      // Select Plumbing category (already selected by default, or click it)
      const plumbingBtn = screen.getByText('Plumbing');
      fireEvent.click(plumbingBtn);

      // Select Urgent priority
      const urgentBtn = screen.getByText('Urgent');
      fireEvent.click(urgentBtn);

      // Fill in title
      const titleInput = document.getElementById('maintenance-title') as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: 'Kitchen faucet handle broken' } });

      // Fill in description
      const descInput = document.getElementById('maintenance-description') as HTMLTextAreaElement;
      fireEvent.change(descInput, {
        target: { value: 'The hot water handle snapped off and water is steadily dripping into the basin.' },
      });

      // Submit form
      const submitBtn = document.getElementById('submit-maintenance-call-btn');
      expect(submitBtn).toBeInTheDocument();
      fireEvent.click(submitBtn!);

      await waitFor(() => {
        expect(createCallSpy).toHaveBeenCalled();
      });

      // Verify success notification
      await waitFor(() => {
        expect(screen.getByText(/Maintenance Call placed successfully!/i)).toBeInTheDocument();
      });
    });

    it('displays active maintenance calls with status pipeline, assigned technician and telephone link', async () => {
      const mockCall: MaintenanceCall = {
        id: 'mnt-tracked-1',
        ticket_number: 'MNT-2026-4401',
        tenant_id: 'tenant-demo-marcus',
        tenant_name: 'Marcus Vance',
        property_id: 'prop-1',
        property_name: 'Grandview Heights',
        unit_number: '101',
        category: 'hvac',
        priority: 'emergency',
        title: 'Heater blowing cold air during freezing weather',
        description: 'Main furnace fan blowing cold ambient air without igniting heat cycle.',
        permission_to_enter: true,
        preferred_time_window: 'Anytime (Earliest available)',
        contact_phone: '+1 (555) 019-2831',
        status: 'in_progress',
        assigned_technician: 'Dave K. (Climate Specialist)',
        technician_phone: '+1 (555) 019-4412',
        scheduled_date: '2026-11-09T10:00:00Z',
        resolution_notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(api, 'getMaintenanceCalls').mockResolvedValue([mockCall]);

      renderWithQuery(<TenantView properties={mockProperties} selectedPropertyId="prop-1" />);

      // Switch to Maintenance feature
      fireEvent.click(screen.getByText('Maintenance Call & Dispatch'));

      await waitFor(() => {
        expect(screen.getByText('#MNT-2026-4401')).toBeInTheDocument();
        expect(screen.getByText('Heater blowing cold air during freezing weather')).toBeInTheDocument();
        expect(screen.getByText('EMERGENCY')).toBeInTheDocument();
        expect(screen.getByText('Dave K. (Climate Specialist)')).toBeInTheDocument();
      });

      // Check technician telephone link
      const callTechLink = screen.getByText('Call Tech').closest('a');
      expect(callTechLink).toHaveAttribute('href', 'tel:+1 (555) 019-4412');
    });
  });
});
