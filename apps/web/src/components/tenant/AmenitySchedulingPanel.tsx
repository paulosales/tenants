import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Loader2,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import type { Amenity, AmenityCalendarEvent, TenantWithUnit } from '@tenants/shared-types';
import { createZodResolver } from '../../utils/zodResolver';
import {
  formatLocalSessionDate,
  formatLocalSessionTimeWindow,
  formatLocalYyyyMmDd,
  formatMinutes12h,
  getLocalTimeZoneLabel,
  minutesToTimeInput,
  parseLocalYyyyMmDd,
  splitEventIntoLocalDaySegments,
  timeInputToMinutes,
} from '../../utils/dateTime';
import { ModalDialog } from '../common/ModalDialog';
import {
  AmenityGoogleCalendar,
  type DraftCalendarSelection,
} from './AmenityGoogleCalendar';
import {
  amenityBookingSchema,
  SESSION_STATUS_BADGE,
  type AmenityBookingFormData,
} from './tenantPortalConstants';

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

function buildTimeOptions(minMins: number, maxMins: number, step = 30): string[] {
  const options: string[] = [];
  for (let m = minMins; m <= maxMins; m += step) {
    options.push(minutesToTimeInput(m));
  }
  return options;
}

export const AmenitySchedulingPanel: React.FC<AmenitySchedulingPanelProps> = ({
  amenities,
  selectedAmenityId,
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AmenityBookingFormData>({
    resolver: createZodResolver(amenityBookingSchema),
    defaultValues: {
      amenity_id: selectedAmenityId,
      booking_date: tomorrowStr,
      start_time: '14:00',
      end_time: '16:00',
      attendees_count: 2,
      notes: '',
    },
  });

  const watchedDate = watch('booking_date');
  const watchedStart = watch('start_time');
  const watchedEnd = watch('end_time');

  const startOptions = useMemo(() => {
    const step = 30;
    const lastStart = Math.max(
      currentAmenity.open_time_minutes,
      currentAmenity.close_time_minutes - Math.max(30, currentAmenity.min_duration_minutes || 60)
    );
    const list = buildTimeOptions(currentAmenity.open_time_minutes, lastStart, step);
    if (watchedStart && !list.includes(watchedStart)) list.push(watchedStart);
    return list.sort();
  }, [
    currentAmenity.open_time_minutes,
    currentAmenity.close_time_minutes,
    currentAmenity.min_duration_minutes,
    watchedStart,
  ]);

  const endOptions = useMemo(() => {
    const startMins = timeInputToMinutes(watchedStart || '14:00');
    const minEnd = Math.max(
      currentAmenity.open_time_minutes + 30,
      startMins + Math.max(30, currentAmenity.min_duration_minutes || 60)
    );
    const maxEnd = Math.min(
      currentAmenity.close_time_minutes,
      startMins + Math.max(60, currentAmenity.max_duration_minutes || 240)
    );
    const list = buildTimeOptions(minEnd, Math.max(minEnd, maxEnd), 30);
    if (watchedEnd && !list.includes(watchedEnd)) list.push(watchedEnd);
    return list.sort();
  }, [
    watchedStart,
    watchedEnd,
    currentAmenity.open_time_minutes,
    currentAmenity.close_time_minutes,
    currentAmenity.min_duration_minutes,
    currentAmenity.max_duration_minutes,
  ]);

  const activeDraftForGrid: DraftCalendarSelection | null = useMemo(() => {
    if (!bookingModalOpen || !watchedDate || !watchedStart || !watchedEnd) return draftSelection;
    return {
      dateStr: watchedDate,
      startMinutes: timeInputToMinutes(watchedStart),
      endMinutes: timeInputToMinutes(watchedEnd),
    };
  }, [bookingModalOpen, watchedDate, watchedStart, watchedEnd, draftSelection]);

  const { estimatedHours, estimatedTotalDollars, hasTimeConflict } = useMemo(() => {
    const sMins = timeInputToMinutes(watchedStart || '14:00');
    const eMins = timeInputToMinutes(watchedEnd || '16:00');
    const diffHours = eMins > sMins ? (eMins - sMins) / 60 : 0;
    const total = (diffHours * currentAmenity.hourly_rate_cents) / 100;

    let conflict = false;
    if (watchedDate && eMins > sMins) {
      for (const ev of calendarEvents) {
        const segs = splitEventIntoLocalDaySegments(ev.start_time, ev.end_time);
        if (
          segs.some(
            (seg) =>
              seg.dateStr === watchedDate && seg.startMinutes < eMins && seg.endMinutes > sMins
          )
        ) {
          conflict = true;
          break;
        }
      }
    }
    return {
      estimatedHours: diffHours,
      estimatedTotalDollars: total,
      hasTimeConflict: conflict,
    };
  }, [watchedDate, watchedStart, watchedEnd, currentAmenity.hourly_rate_cents, calendarEvents]);

  const handleCardSelect = (amenityId: string) => {
    setValue('amenity_id', amenityId);
    onSelectAmenity(amenityId);
  };

  const openModalWithSlot = (dateStr: string, startMinutes: number, endMinutes: number) => {
    const clampedStart = Math.max(currentAmenity.open_time_minutes, startMinutes);
    const clampedEnd = Math.min(
      currentAmenity.close_time_minutes,
      Math.max(clampedStart + Math.max(30, currentAmenity.min_duration_minutes || 60), endMinutes)
    );
    const startStr = minutesToTimeInput(clampedStart);
    const endStr = minutesToTimeInput(clampedEnd);

    reset({
      amenity_id: currentAmenity.id,
      booking_date: dateStr,
      start_time: startStr,
      end_time: endStr,
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

  const handleFormSubmit = (data: AmenityBookingFormData) => {
    onSubmitBooking({ ...data, amenity_id: currentAmenity.id }, () => {
      setBookingModalOpen(false);
      setDraftSelection(null);
      reset({
        amenity_id: currentAmenity.id,
        booking_date: tomorrowStr,
        start_time: '14:00',
        end_time: '16:00',
        attendees_count: 2,
        notes: '',
      });
    });
  };

  const closeModal = () => {
    setBookingModalOpen(false);
    setDraftSelection(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Strip: Select Amenity to View Its Calendar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Select Building Amenity</h3>
            <p className="text-xs text-slate-500">
              Choose an amenity below to view its live availability calendar and schedule a time slot
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {amenities.length} Available
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {amenities.map((amenity) => {
            const isSelected = currentAmenity.id === amenity.id;
            const feeDollars = amenity.hourly_rate_cents / 100;

            return (
              <div
                key={amenity.id}
                id={`amenity-card-${amenity.id}`}
                onClick={() => handleCardSelect(amenity.id)}
                className={`p-4 rounded-2xl cursor-pointer transition-all border text-left flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-50/75 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-slate-900 leading-snug truncate">
                        {amenity.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                        {amenity.description}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900 shrink-0">
                    {feeDollars === 0 ? 'Free' : `$${feeDollars}/hr`}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      {Math.floor(amenity.open_time_minutes / 60)}:00–
                      {Math.floor(amenity.close_time_minutes / 60)}:00
                    </span>
                  </span>
                  <span>•</span>
                  <span>Max {amenity.capacity}</span>
                  {isSelected && (
                    <span className="ml-auto flex items-center space-x-1 text-indigo-600 font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      <span>Selected</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Google-Calendar-Style Interactive Scheduler */}
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
        onInspectEvent={(ev) => setInspectedEvent(ev)}
      />

      {/* Google-Calendar Style Event Creation Modal */}
      <ModalDialog
        isOpen={bookingModalOpen}
        title="Schedule Amenity Session"
        subtitle={`${currentAmenity.name} · Local Time (${getLocalTimeZoneLabel()})`}
        titleId="schedule-amenity-modal-title"
        maxWidthClass="max-w-lg"
        onClose={closeModal}
      >
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {hasTimeConflict && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>
                The selected time window overlaps an existing reservation. Please choose a vacant
                slot on the calendar.
              </span>
            </div>
          )}

          <div>
            <label
              htmlFor="amenity-booking-date"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Session Date *
            </label>
            <input
              type="date"
              id="amenity-booking-date"
              min={todayLocalStr}
              {...register('booking_date')}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            {errors.booking_date && (
              <p className="text-xs text-rose-600 mt-1">{errors.booking_date.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="amenity-start-time"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Start Time *
              </label>
              <select
                id="amenity-start-time"
                {...register('start_time')}
                className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {startOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {formatMinutes12h(timeInputToMinutes(opt))} ({opt})
                  </option>
                ))}
              </select>
              {errors.start_time && (
                <p className="text-xs text-rose-600 mt-1">{errors.start_time.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="amenity-end-time"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                End Time *
              </label>
              <select
                id="amenity-end-time"
                {...register('end_time')}
                className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {endOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {formatMinutes12h(timeInputToMinutes(opt))} ({opt})
                  </option>
                ))}
              </select>
              {errors.end_time && (
                <p className="text-xs text-rose-600 mt-1">{errors.end_time.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="amenity-attendees-count"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Number of Attendees *
              </label>
              <input
                type="number"
                id="amenity-attendees-count"
                min="1"
                max={currentAmenity.capacity}
                {...register('attendees_count')}
                className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Max capacity: {currentAmenity.capacity} guests
              </p>
              {errors.attendees_count && (
                <p className="text-xs text-rose-600 mt-1">{errors.attendees_count.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Host Residence Unit
              </label>
              <input
                type="text"
                disabled
                value={`Unit ${activeTenant.unit_number || '101'} (${activeTenant.first_name} ${activeTenant.last_name})`}
                className="w-full px-3 py-2.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-sm cursor-not-allowed font-medium"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="amenity-notes"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
            >
              Session Notes & Special Requests (Optional)
            </label>
            <textarea
              id="amenity-notes"
              rows={2}
              {...register('notes')}
              placeholder="e.g. Birthday dinner with family, need projector connection or extra patio chairs..."
              className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Estimated Total
              </span>
              <p className="text-xs text-slate-500">
                {currentAmenity.hourly_rate_cents === 0
                  ? 'Complimentary building privilege'
                  : `$${(currentAmenity.hourly_rate_cents / 100).toFixed(2)}/hr × ${estimatedHours.toFixed(1)}h`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-slate-900">
                ${estimatedTotalDollars.toFixed(2)}
              </span>
              <span className="block text-[10px] text-slate-400">
                {currentAmenity.hourly_rate_cents === 0
                  ? 'Complimentary'
                  : `${estimatedHours.toFixed(1)} Hour Session`}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-amenity-session-btn"
              disabled={isSubmitting || isSubmittingBooking || hasTimeConflict}
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/25 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {(isSubmitting || isSubmittingBooking) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              <span>Confirm & Schedule Amenity Session</span>
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Event Details Modal (Admin sees scheduler identity; Tenant only opens their own events) */}
      <ModalDialog
        isOpen={Boolean(inspectedEvent)}
        title={currentAmenity.name}
        subtitle="Amenity Session Details"
        titleId="inspect-amenity-event-title"
        onClose={() => setInspectedEvent(null)}
      >
        {inspectedEvent && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Status</span>
              <span
                className={`px-2.5 py-0.5 rounded-full font-bold ${
                  SESSION_STATUS_BADGE[inspectedEvent.status as keyof typeof SESSION_STATUS_BADGE] ||
                  'bg-slate-100 text-slate-800'
                }`}
              >
                {inspectedEvent.status.toUpperCase()}
              </span>
            </div>

            {isAdmin && (
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
                <span className="flex items-center space-x-1.5 text-indigo-700 font-semibold">
                  <User className="w-4 h-4" />
                  <span>Scheduled By (Admin Only)</span>
                </span>
                <span className="font-bold text-indigo-950">
                  {inspectedEvent.scheduled_by_name || 'Resident'}
                  {inspectedEvent.unit_number ? ` · Unit ${inspectedEvent.unit_number}` : ''}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center space-x-2 text-slate-700">
                <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400">Date</div>
                  <div className="font-bold">
                    {formatLocalSessionDate(
                      inspectedEvent.start_time,
                      formatLocalYyyyMmDd(new Date(inspectedEvent.start_time))
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-slate-700">
                <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400">Local Window</div>
                  <div className="font-bold">
                    {formatLocalSessionTimeWindow(
                      inspectedEvent.start_time,
                      inspectedEvent.end_time
                    )}
                  </div>
                </div>
              </div>
            </div>

            {inspectedEvent.attendees_count != null && (
              <div className="flex items-center justify-between px-1 text-slate-700">
                <span className="flex items-center space-x-1.5 text-slate-500">
                  <Users className="w-3.5 h-3.5" />
                  <span>Party Size</span>
                </span>
                <span className="font-bold">{inspectedEvent.attendees_count} Guests</span>
              </div>
            )}

            {inspectedEvent.notes && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-600 italic">
                “{inspectedEvent.notes}”
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              {(isAdmin || inspectedEvent.is_own) && (
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => {
                    onCancelSession(inspectedEvent.id);
                    setInspectedEvent(null);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel Session</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectedEvent(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
};
