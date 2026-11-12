import React, { useMemo } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import type { Amenity, AmenityCalendarEvent, TenantWithUnit } from '@tenants/shared-types';
import {
  formatMinutes12h,
  getLocalTimeZoneLabel,
  timeInputToMinutes,
} from '../../utils/dateTime';
import { ModalDialog } from '../common/ModalDialog';
import { buildHalfHourTimeOptions, findSlotConflict } from './calendarEventStrategies';
import type { AmenityBookingFormData } from './tenantPortalConstants';

interface AmenitySessionFormModalProps {
  isOpen: boolean;
  amenity: Amenity;
  activeTenant: TenantWithUnit;
  todayLocalStr: string;
  calendarEvents: AmenityCalendarEvent[];
  form: UseFormReturn<AmenityBookingFormData>;
  isSubmittingBooking: boolean;
  onSubmit: (data: AmenityBookingFormData) => void;
  onClose: () => void;
}

export const AmenitySessionFormModal: React.FC<AmenitySessionFormModalProps> = ({
  isOpen,
  amenity,
  activeTenant,
  todayLocalStr,
  calendarEvents,
  form,
  isSubmittingBooking,
  onSubmit,
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const watchedDate = watch('booking_date');
  const watchedStart = watch('start_time');
  const watchedEnd = watch('end_time');

  const startOptions = useMemo(() => {
    const lastStart = Math.max(
      amenity.open_time_minutes,
      amenity.close_time_minutes - Math.max(30, amenity.min_duration_minutes || 60)
    );
    const list = buildHalfHourTimeOptions(amenity.open_time_minutes, lastStart, 30);
    if (watchedStart && !list.includes(watchedStart)) list.push(watchedStart);
    return list.sort();
  }, [amenity, watchedStart]);

  const endOptions = useMemo(() => {
    const startMins = timeInputToMinutes(watchedStart || '14:00');
    const minEnd = Math.max(
      amenity.open_time_minutes + 30,
      startMins + Math.max(30, amenity.min_duration_minutes || 60)
    );
    const maxEnd = Math.min(
      amenity.close_time_minutes,
      startMins + Math.max(60, amenity.max_duration_minutes || 240)
    );
    const list = buildHalfHourTimeOptions(minEnd, Math.max(minEnd, maxEnd), 30);
    if (watchedEnd && !list.includes(watchedEnd)) list.push(watchedEnd);
    return list.sort();
  }, [watchedStart, watchedEnd, amenity]);

  const { estimatedHours, estimatedTotalDollars, hasTimeConflict } = useMemo(() => {
    const sMins = timeInputToMinutes(watchedStart || '14:00');
    const eMins = timeInputToMinutes(watchedEnd || '16:00');
    const diffHours = eMins > sMins ? (eMins - sMins) / 60 : 0;
    const total = (diffHours * amenity.hourly_rate_cents) / 100;
    const conflict = findSlotConflict(calendarEvents, watchedDate, sMins, eMins);
    return {
      estimatedHours: diffHours,
      estimatedTotalDollars: total,
      hasTimeConflict: conflict,
    };
  }, [watchedDate, watchedStart, watchedEnd, amenity.hourly_rate_cents, calendarEvents]);

  return (
    <ModalDialog
      isOpen={isOpen}
      title="Schedule Amenity Session"
      subtitle={`${amenity.name} · Local Time (${getLocalTimeZoneLabel()})`}
      titleId="schedule-amenity-modal-title"
      maxWidthClass="max-w-lg"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {hasTimeConflict && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>
              The selected time window overlaps an existing reservation. Please choose a vacant slot
              on the calendar.
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
              max={amenity.capacity}
              {...register('attendees_count')}
              className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Max capacity: {amenity.capacity} guests
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
              {amenity.hourly_rate_cents === 0
                ? 'Complimentary building privilege'
                : `$${(amenity.hourly_rate_cents / 100).toFixed(2)}/hr × ${estimatedHours.toFixed(1)}h`}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-slate-900">
              ${estimatedTotalDollars.toFixed(2)}
            </span>
            <span className="block text-[10px] text-slate-400">
              {amenity.hourly_rate_cents === 0
                ? 'Complimentary'
                : `${estimatedHours.toFixed(1)} Hour Session`}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
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
            {(isSubmitting || isSubmittingBooking) && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Confirm & Schedule Amenity Session</span>
          </button>
        </div>
      </form>
    </ModalDialog>
  );
};
