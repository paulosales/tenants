import React from 'react';
import { useForm } from 'react-hook-form';
import { CalendarDays, Check, Clock, Loader2, Sparkles } from 'lucide-react';
import type { Amenity, TenantWithUnit } from '@tenants/shared-types';
import { createZodResolver } from '../../utils/zodResolver';
import { getLocalTimeZoneLabel } from '../../utils/dateTime';
import { amenityBookingSchema, type AmenityBookingFormData } from './tenantPortalConstants';

interface AmenitySchedulingPanelProps {
  amenities: Amenity[];
  selectedAmenityId: string;
  currentAmenity: Amenity;
  activeTenant: TenantWithUnit;
  todayLocalStr: string;
  tomorrowStr: string;
  isSubmittingBooking: boolean;
  onSelectAmenity: (amenityId: string) => void;
  onSubmitBooking: (data: AmenityBookingFormData, onReset: () => void) => void;
}

export const AmenitySchedulingPanel: React.FC<AmenitySchedulingPanelProps> = ({
  amenities,
  selectedAmenityId,
  currentAmenity,
  activeTenant,
  todayLocalStr,
  tomorrowStr,
  isSubmittingBooking,
  onSelectAmenity,
  onSubmitBooking,
}) => {
  const {
    register,
    handleSubmit,
    setValue,
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

  const handleCardSelect = (amenityId: string) => {
    setValue('amenity_id', amenityId);
    onSelectAmenity(amenityId);
  };

  const handleFormSubmit = (data: AmenityBookingFormData) => {
    onSubmitBooking(data, () => {
      reset({
        amenity_id: selectedAmenityId,
        booking_date: tomorrowStr,
        start_time: '14:00',
        end_time: '16:00',
        attendees_count: 2,
        notes: '',
      });
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Amenity Cards Selection */}
      <div className="lg:col-span-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Select Building Amenity</h3>
            <p className="text-xs text-slate-500">Choose a community space to schedule a reservation</p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {amenities.length} Available
          </span>
        </div>

        <div className="space-y-3">
          {amenities.map((amenity) => {
            const isSelected = selectedAmenityId === amenity.id;
            const feeDollars = amenity.hourly_rate_cents / 100;

            return (
              <div
                key={amenity.id}
                id={`amenity-card-${amenity.id}`}
                onClick={() => handleCardSelect(amenity.id)}
                className={`p-4 rounded-2xl cursor-pointer transition-all border text-left ${
                  isSelected
                    ? 'bg-indigo-50/70 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isSelected ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-snug">{amenity.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{amenity.description}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <span className="text-sm font-extrabold text-slate-900">
                      {feeDollars === 0 ? 'Complimentary' : `$${feeDollars}/hr`}
                    </span>
                    <span className="block text-[11px] text-slate-500">Max {amenity.capacity} guests</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {Math.floor(amenity.open_time_minutes / 60)}:00 -{' '}
                      {Math.floor(amenity.close_time_minutes / 60)}:00
                    </span>
                  </span>
                  <span>•</span>
                  <span>Min {amenity.min_duration_minutes / 60}h slot</span>
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

      {/* Right Column: Interactive Scheduling Wizard Form */}
      <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between pb-5 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Schedule Amenity Session</h3>
              <p className="text-xs text-slate-500">
                Configuring reservation for <span className="font-semibold text-slate-800">{currentAmenity.name}</span>
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {currentAmenity.hourly_rate_cents === 0 ? 'Free Access' : `$${currentAmenity.hourly_rate_cents / 100}/hr`}
          </span>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5 mt-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Session Date *
            </label>
            <input
              type="date"
              id="amenity-booking-date"
              min={todayLocalStr}
              {...register('booking_date')}
              className="w-full px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
            />
            {errors.booking_date && (
              <p className="text-xs text-rose-600 mt-1">{errors.booking_date.message}</p>
            )}
          </div>

          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Start Time *
                </label>
                <select
                  id="amenity-start-time"
                  {...register('start_time')}
                  className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="08:00">08:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="12:00">12:00 PM (Noon)</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="16:00">04:00 PM</option>
                  <option value="18:00">06:00 PM</option>
                  <option value="20:00">08:00 PM</option>
                </select>
                {errors.start_time && (
                  <p className="text-xs text-rose-600 mt-1">{errors.start_time.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  End Time *
                </label>
                <select
                  id="amenity-end-time"
                  {...register('end_time')}
                  className="w-full px-3 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="10:00">10:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="14:00">02:00 PM</option>
                  <option value="16:00">04:00 PM</option>
                  <option value="18:00">06:00 PM</option>
                  <option value="20:00">08:00 PM</option>
                  <option value="22:00">10:00 PM</option>
                </select>
                {errors.end_time && (
                  <p className="text-xs text-rose-600 mt-1">{errors.end_time.message}</p>
                )}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center space-x-1">
              <Clock className="w-3 h-3 text-indigo-500" />
              <span>Times shown in your local time zone ({getLocalTimeZoneLabel()}).</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
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
                Amenity maximum capacity is {currentAmenity.capacity} guests.
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
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
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Pricing Breakdown</span>
              <p className="text-xs text-slate-500">
                {currentAmenity.hourly_rate_cents === 0
                  ? 'Included in monthly lease building privileges'
                  : 'Standard resident rate billed to tenant ledger upon completion'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-slate-900">
                {currentAmenity.hourly_rate_cents === 0
                  ? '$0.00'
                  : `$${((currentAmenity.hourly_rate_cents * 2) / 100).toFixed(2)}`}
              </span>
              <span className="block text-[10px] text-slate-400">
                {currentAmenity.hourly_rate_cents === 0 ? 'Complimentary' : 'Est. 2 Hour Session'}
              </span>
            </div>
          </div>

          <button
            type="submit"
            id="submit-amenity-session-btn"
            disabled={isSubmitting || isSubmittingBooking}
            className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            {(isSubmitting || isSubmittingBooking) && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Confirm & Schedule Amenity Session</span>
          </button>
        </form>
      </div>
    </div>
  );
};

