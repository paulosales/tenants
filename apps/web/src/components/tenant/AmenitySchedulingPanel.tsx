import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Amenity, AmenityCalendarEvent, TenantWithUnit } from '@tenants/shared-types';
import type { DraftCalendarSelection } from '../../hooks/useCalendarSlotDrag';
import { createZodResolver } from '../../utils/zodResolver';
import {
  minutesToTimeInput,
  parseLocalYyyyMmDd,
  timeInputToMinutes,
} from '../../utils/dateTime';
import { AmenityEventDetailsModal } from './AmenityEventDetailsModal';
import { AmenityGoogleCalendar } from './AmenityGoogleCalendar';
import { AmenitySelectorStrip } from './AmenitySelectorStrip';
import { AmenitySessionFormModal } from './AmenitySessionFormModal';
import { amenityBookingSchema, type AmenityBookingFormData } from './tenantPortalConstants';

interface AmenitySchedulingPanelProps {
  amenities: Amenity[];
  selectedAmenityId: string;
  currentAmenity: Amenity;
  activeTenant: TenantWithUnit;
  todayLocalStr: string;
  tomorrowStr: string;
  isAdmin: boolean;
  calendarEvents: AmenityCalendarEvent[];
  isCalendarLoading: boolean;
  calendarAnchorDate: string;
  calendarViewMode: 'week' | 'day';
  isSubmittingBooking: boolean;
  isCancelling: boolean;
  onSelectAmenity: (amenityId: string) => void;
  onChangeCalendarAnchorDate: (dateStr: string) => void;
  onChangeCalendarViewMode: (mode: 'week' | 'day') => void;
  onSubmitBooking: (data: AmenityBookingFormData, onSuccessCallback: () => void) => void;
  onCancelSession: (sessionId: string) => void;
}

export const AmenitySchedulingPanel: React.FC<AmenitySchedulingPanelProps> = ({
  amenities,
  currentAmenity,
  activeTenant,
  todayLocalStr,
  tomorrowStr,
  isAdmin,
  calendarEvents,
  isCalendarLoading,
  calendarAnchorDate,
  calendarViewMode,
  isSubmittingBooking,
  isCancelling,
  onSelectAmenity,
  onChangeCalendarAnchorDate,
  onChangeCalendarViewMode,
  onSubmitBooking,
  onCancelSession,
}) => {
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [draftSelection, setDraftSelection] = useState<DraftCalendarSelection | null>(null);
  const [inspectedEvent, setInspectedEvent] = useState<AmenityCalendarEvent | null>(null);

  const form = useForm<AmenityBookingFormData>({
    resolver: createZodResolver(amenityBookingSchema),
    defaultValues: {
      amenity_id: currentAmenity.id,
      booking_date: tomorrowStr,
      start_time: '14:00',
      end_time: '16:00',
      attendees_count: 2,
      notes: '',
    },
  });

  const { setValue, watch, reset } = form;
  const watchedDate = watch('booking_date');
  const watchedStart = watch('start_time');
  const watchedEnd = watch('end_time');

  const activeDraftForGrid: DraftCalendarSelection | null = useMemo(() => {
    if (!bookingModalOpen || !watchedDate || !watchedStart || !watchedEnd) return draftSelection;
    return {
      dateStr: watchedDate,
      startMinutes: timeInputToMinutes(watchedStart),
      endMinutes: timeInputToMinutes(watchedEnd),
    };
  }, [bookingModalOpen, watchedDate, watchedStart, watchedEnd, draftSelection]);

  const openModalWithSlot = (dateStr: string, startMinutes: number, endMinutes: number) => {
    const clampedStart = Math.max(currentAmenity.open_time_minutes, startMinutes);
    const clampedEnd = Math.min(
      currentAmenity.close_time_minutes,
      Math.max(clampedStart + Math.max(30, currentAmenity.min_duration_minutes || 60), endMinutes)
    );

    reset({
      amenity_id: currentAmenity.id,
      booking_date: dateStr,
      start_time: minutesToTimeInput(clampedStart),
      end_time: minutesToTimeInput(clampedEnd),
      attendees_count: Math.min(2, currentAmenity.capacity || 2),
      notes: '',
    });
    setDraftSelection({ dateStr, startMinutes: clampedStart, endMinutes: clampedEnd });
    setBookingModalOpen(true);
  };

  const handleOpenQuickCreate = () => {
    const defaultStart = Math.min(
      Math.max(currentAmenity.open_time_minutes, 14 * 60),
      Math.max(currentAmenity.open_time_minutes, currentAmenity.close_time_minutes - 120)
    );
    const defaultEnd = Math.min(currentAmenity.close_time_minutes, defaultStart + 120);
    const defaultDate =
      parseLocalYyyyMmDd(calendarAnchorDate) > parseLocalYyyyMmDd(todayLocalStr)
        ? calendarAnchorDate
        : tomorrowStr;
    openModalWithSlot(defaultDate, defaultStart, defaultEnd);
  };

  const closeModal = () => {
    setBookingModalOpen(false);
    setDraftSelection(null);
  };

  return (
    <div className="space-y-6">
      <AmenitySelectorStrip
        amenities={amenities}
        selectedAmenityId={currentAmenity.id}
        onSelectAmenity={(amenityId) => {
          setValue('amenity_id', amenityId);
          onSelectAmenity(amenityId);
        }}
      />

      <AmenityGoogleCalendar
        amenity={currentAmenity}
        events={calendarEvents}
        isLoading={isCalendarLoading}
        isAdmin={isAdmin}
        anchorDateStr={calendarAnchorDate}
        viewMode={calendarViewMode}
        draftSelection={activeDraftForGrid}
        onChangeAnchorDate={onChangeCalendarAnchorDate}
        onChangeViewMode={onChangeCalendarViewMode}
        onSelectVacantSlot={openModalWithSlot}
        onOpenNewSessionModal={handleOpenQuickCreate}
        onInspectEvent={setInspectedEvent}
      />

      <AmenitySessionFormModal
        isOpen={bookingModalOpen}
        amenity={currentAmenity}
        activeTenant={activeTenant}
        todayLocalStr={todayLocalStr}
        calendarEvents={calendarEvents}
        form={form}
        isSubmittingBooking={isSubmittingBooking}
        onSubmit={(data) => {
          onSubmitBooking({ ...data, amenity_id: currentAmenity.id }, () => {
            closeModal();
          });
        }}
        onClose={closeModal}
      />

      <AmenityEventDetailsModal
        amenityName={currentAmenity.name}
        event={inspectedEvent}
        isAdmin={isAdmin}
        isCancelling={isCancelling}
        onCancelSession={onCancelSession}
        onClose={() => setInspectedEvent(null)}
      />
    </div>
  );
};
