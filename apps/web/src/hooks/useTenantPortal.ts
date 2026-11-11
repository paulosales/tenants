import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useAmenitiesGateway,
  useMaintenanceGateway,
  useTenantSessionsGateway,
  useTenantsGateway,
} from '../context/ApiContext';
import {
  DEFAULT_AMENITIES,
  type AmenityBookingFormData,
  type MaintenanceCallFormData,
} from '../components/tenant/tenantPortalConstants';
import {
  formatLocalSessionDate,
  formatLocalSessionTimeWindow,
  getTodayLocalStr,
  getTomorrowLocalStr,
} from '../utils/dateTime';
import type {
  CreateAmenitySessionDto,
  CreateMaintenanceCallDto,
  MaintenanceStatus,
  PropertyWithStats,
  TenantWithUnit,
} from '@tenants/shared-types';

interface UseTenantPortalOptions {
  properties: PropertyWithStats[];
  selectedPropertyId?: string | null;
  initialTenantId?: string | null;
}

export function useTenantPortal({
  properties,
  selectedPropertyId,
  initialTenantId,
}: UseTenantPortalOptions) {
  const queryClient = useQueryClient();
  const tenantsGateway = useTenantsGateway();
  const amenitiesGateway = useAmenitiesGateway();
  const sessionsGateway = useTenantSessionsGateway();
  const maintenanceGateway = useMaintenanceGateway();

  const [activeFeature, setActiveFeature] = useState<'amenities' | 'maintenance'>('amenities');
  const [amenitySubTab, setAmenitySubTab] = useState<'schedule' | 'my-sessions'>('schedule');
  const [maintenanceSubTab, setMaintenanceSubTab] = useState<'tracker' | 'new-call'>('tracker');
  const [selectedAmenityId, setSelectedAmenityId] = useState<string>(DEFAULT_AMENITIES[0].id);

  const [sessionSuccessMsg, setSessionSuccessMsg] = useState<string | null>(null);
  const [maintenanceSuccessMsg, setMaintenanceSuccessMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [activeTenantId, setActiveTenantId] = useState<string>(
    initialTenantId || '33333333-1111-1111-1111-111111111001'
  );

  const todayLocalStr = useMemo(() => getTodayLocalStr(), []);
  const tomorrowStr = useMemo(() => getTomorrowLocalStr(), []);

  const { data: tenantsList = [] } = useQuery({
    queryKey: ['tenants-for-resident-view', selectedPropertyId],
    queryFn: () => tenantsGateway.getTenants({ property_id: selectedPropertyId || undefined }),
  });

  const activeTenant: TenantWithUnit = useMemo(() => {
    const found = tenantsList.find((t) => t.id === activeTenantId);
    if (found) return found;
    if (tenantsList.length > 0) return tenantsList[0];
    return {
      id: '33333333-1111-1111-1111-111111111001',
      first_name: 'Marcus',
      last_name: 'Vance',
      email: 'marcus.vance@example.com',
      phone: '+1 (206) 555-0192',
      unit_number: '101',
      property_id: properties[0]?.id || '11111111-2222-3333-4444-555555555551',
      property_name: properties[0]?.name || 'Grandview Heights Luxury Residences',
      assigned_unit_id: '22222222-1111-1111-1111-111111111101',
      lease_start_date: '2026-01-01',
      lease_end_date: '2027-01-01',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, [tenantsList, activeTenantId, properties]);

  const { data: backendAmenities = [] } = useQuery({
    queryKey: ['amenities-tenant-view'],
    queryFn: () => amenitiesGateway.getAmenities(),
  });

  const amenities = backendAmenities.length > 0 ? backendAmenities : DEFAULT_AMENITIES;
  const currentAmenity = amenities.find((a) => a.id === selectedAmenityId) || amenities[0];

  const { data: amenitySessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ['tenant-amenity-sessions', activeTenant.id],
    queryFn: () => sessionsGateway.getTenantAmenitySessions(activeTenant.id),
  });

  const { data: maintenanceCalls = [], refetch: refetchMaintenance } = useQuery({
    queryKey: ['tenant-maintenance-calls', activeTenant.id],
    queryFn: () => maintenanceGateway.getMaintenanceCalls({ tenant_id: activeTenant.id }),
  });

  const scheduleAmenityMutation = useMutation({
    mutationFn: (dto: CreateAmenitySessionDto) => sessionsGateway.bookAmenitySession(dto),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-amenity-sessions'] });
      refetchSessions();
      const localDate = formatLocalSessionDate(newSession.start_time, newSession.booking_date);
      const localWindow = formatLocalSessionTimeWindow(
        newSession.start_time,
        newSession.end_time,
        newSession.booking_date
      );
      setSessionSuccessMsg(
        `Session successfully scheduled for ${newSession.amenity_name} on ${localDate} (${localWindow})!`
      );
      setActionError(null);
      setAmenitySubTab('my-sessions');
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to schedule amenity session.');
      setSessionSuccessMsg(null);
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: (sessionId: string) => sessionsGateway.cancelAmenitySession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-amenity-sessions'] });
      refetchSessions();
    },
  });

  const createMaintenanceMutation = useMutation({
    mutationFn: (dto: CreateMaintenanceCallDto) => maintenanceGateway.createMaintenanceCall(dto),
    onSuccess: (newCall) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-maintenance-calls'] });
      refetchMaintenance();
      setMaintenanceSuccessMsg(
        `Maintenance Call placed successfully! Ticket #${newCall.ticket_number} has been logged and assigned.`
      );
      setActionError(null);
      setMaintenanceSubTab('tracker');
    },
    onError: (err: Error) => {
      setActionError(err.message || 'Failed to submit maintenance call.');
      setMaintenanceSuccessMsg(null);
    },
  });

  const cancelMaintenanceMutation = useMutation({
    mutationFn: (callId: string) => maintenanceGateway.cancelMaintenanceCall(callId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-maintenance-calls'] });
      refetchMaintenance();
    },
  });

  const updateMaintenanceStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MaintenanceStatus }) =>
      maintenanceGateway.updateMaintenanceCallStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-maintenance-calls'] });
      refetchMaintenance();
    },
  });

  const buildAmenitySessionDto = (data: AmenityBookingFormData): CreateAmenitySessionDto => {
    const localStart = new Date(`${data.booking_date}T${data.start_time}:00`);
    const localEnd = new Date(`${data.booking_date}T${data.end_time}:00`);

    return {
      amenity_id: data.amenity_id,
      tenant_id: activeTenant.id,
      property_id: activeTenant.property_id || undefined,
      unit_number: activeTenant.unit_number || undefined,
      booking_date: data.booking_date,
      start_time: !isNaN(localStart.getTime()) ? localStart.toISOString() : data.start_time,
      end_time: !isNaN(localEnd.getTime()) ? localEnd.toISOString() : data.end_time,
      attendees_count: data.attendees_count,
      notes: data.notes,
    };
  };

  const buildMaintenanceCallDto = (data: MaintenanceCallFormData): CreateMaintenanceCallDto => ({
    tenant_id: activeTenant.id,
    property_id: activeTenant.property_id || undefined,
    unit_number: data.unit_number,
    category: data.category,
    priority: data.priority,
    title: data.title,
    description: data.description,
    permission_to_enter: data.permission_to_enter,
    preferred_time_window: data.preferred_time_window,
    contact_phone: data.contact_phone,
  });

  const activeSessionsCount = amenitySessions.filter((s) => s.status === 'confirmed').length;
  const activeMaintenanceCount = maintenanceCalls.filter(
    (c) => c.status === 'reported' || c.status === 'dispatched' || c.status === 'in_progress'
  ).length;

  return {
    activeFeature,
    setActiveFeature,
    amenitySubTab,
    setAmenitySubTab,
    maintenanceSubTab,
    setMaintenanceSubTab,
    selectedAmenityId,
    setSelectedAmenityId,
    activeTenantId,
    setActiveTenantId,
    tenantsList,
    activeTenant,
    amenities,
    currentAmenity,
    amenitySessions,
    maintenanceCalls,
    activeSessionsCount,
    activeMaintenanceCount,
    todayLocalStr,
    tomorrowStr,
    sessionSuccessMsg,
    setSessionSuccessMsg,
    maintenanceSuccessMsg,
    setMaintenanceSuccessMsg,
    actionError,
    setActionError,
    scheduleAmenityMutation,
    cancelSessionMutation,
    createMaintenanceMutation,
    cancelMaintenanceMutation,
    updateMaintenanceStatusMutation,
    buildAmenitySessionDto,
    buildMaintenanceCallDto,
  };
}

