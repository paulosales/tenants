import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, Users, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import type { Amenity, CreateReservationRequest, Reservation } from '@tenants/shared-types';
import { useOptimisticBooking } from '@tenants/shared-ui';

interface AmenityCalendarProps {
  amenities: Amenity[];
  fetchReservationsFn: (amenityId: string, start: string, end: string) => Promise<Reservation[]>;
  createReservationFn: (req: CreateReservationRequest) => Promise<Reservation>;
}

export const AmenityReservationCalendar: React.FC<AmenityCalendarProps> = ({
  amenities,
  fetchReservationsFn,
  createReservationFn,
}) => {
  const [selectedAmenityId, setSelectedAmenityId] = useState<string>(
    amenities[0]?.id || ''
  );
  const [bookingDate, setBookingDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // default to tomorrow
    return d.toISOString().split('T')[0];
  });
  const [startTimeStr, setStartTimeStr] = useState('14:00');
  const [durationHours, setDurationHours] = useState(2);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const activeAmenity = amenities.find((a) => a.id === selectedAmenityId) || amenities[0];

  // Query ground-truth reservations for the selected date
  const startOfDay = `${bookingDate}T00:00:00Z`;
  const endOfDay = `${bookingDate}T23:59:59Z`;

  const { data: reservations = [], isLoading: isLoadingReservations } = useQuery({
    queryKey: ['reservations', selectedAmenityId, bookingDate],
    queryFn: () => fetchReservationsFn(selectedAmenityId, startOfDay, endOfDay),
    enabled: !!selectedAmenityId,
  });

  // Optimistic Booking Mutation with automatic rollback on 409 conflict
  const bookingMutation = useOptimisticBooking(
    selectedAmenityId,
    createReservationFn,
    () => {
      setBookingSuccess('Amenity slot secured and confirmed!');
      setBookingError(null);
    },
    (err: any) => {
      setBookingError(err.message || 'Double booking collision detected. Reverted state.');
      setBookingSuccess(null);
    }
  );

  const calculateTotalCents = () => {
    if (!activeAmenity) return 0;
    return activeAmenity.hourly_rate_cents * durationHours;
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);
    setBookingSuccess(null);

    const [hours, minutes] = startTimeStr.split(':').map(Number);
    const startDate = new Date(`${bookingDate}T00:00:00Z`);
    startDate.setUTCHours(hours, minutes, 0, 0);

    const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

    const req: CreateReservationRequest = {
      amenity_id: selectedAmenityId,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      notes: `Resident reservation for ${activeAmenity?.name}`,
    };

    bookingMutation.mutate(req);
  };

  return (
    <div className="space-y-6">
      {/* Amenity Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {amenities.map((amenity) => {
          const isSelected = selectedAmenityId === amenity.id;
          return (
            <div
              key={amenity.id}
              onClick={() => {
                setSelectedAmenityId(amenity.id);
                setBookingError(null);
                setBookingSuccess(null);
              }}
              className={`glass-panel p-4 rounded-xl cursor-pointer transition-all border ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-950/30 shadow-lg shadow-indigo-500/10'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <h4 className="font-heading font-bold text-sm text-white">{amenity.name}</h4>
                <span className="text-xs text-indigo-400 font-bold">
                  ${(amenity.hourly_rate_cents / 100).toFixed(0)}/hr
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{amenity.description}</p>
              <div className="flex items-center space-x-3 mt-3 text-[10px] text-slate-400 border-t border-slate-800/80 pt-2">
                <span className="flex items-center space-x-1">
                  <Users className="h-3 w-3 text-slate-500" />
                  <span>Cap: {amenity.capacity}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Clock className="h-3 w-3 text-slate-500" />
                  <span>
                    {Math.floor(amenity.open_time_minutes / 60)}:00 - {Math.floor(amenity.close_time_minutes / 60)}:00
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Reservation & Availability Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline View of Bookings */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-6">
            <div>
              <h3 className="text-lg font-heading font-bold text-white flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-indigo-400" />
                <span>Daily Availability Timeline</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Displaying reserved intervals for {activeAmenity?.name} on {bookingDate}.
              </p>
            </div>
            <input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Timeline Slots */}
          {isLoadingReservations ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading ground-truth availability...</div>
          ) : (
            <div className="space-y-3">
              {reservations.length === 0 ? (
                <div className="py-12 text-center text-xs text-emerald-400 flex flex-col items-center">
                  <CheckCircle2 className="h-8 w-8 mb-2 opacity-60" />
                  <span>All slots on {bookingDate} are currently vacant and open for reservations.</span>
                </div>
              ) : (
                reservations.map((res) => {
                  const start = new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const end = new Date(res.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isTemp = res.id.startsWith('temp-');

                  return (
                    <div
                      key={res.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        isTemp
                          ? 'bg-indigo-950/40 border-indigo-700/60 text-indigo-300 animate-pulse'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Clock className={`h-4 w-4 ${isTemp ? 'text-indigo-400' : 'text-amber-400'}`} />
                        <div>
                          <span className="font-bold text-white">{start} - {end}</span>
                          <span className="text-[10px] text-slate-500 ml-2">({res.notes || 'Reserved'})</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                        isTemp ? 'bg-indigo-900 text-indigo-300' : 'bg-amber-950 text-amber-300 border border-amber-800/40'
                      }`}>
                        {isTemp ? 'Optimistic Sync' : res.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Booking Form with Engine-Level Guard */}
        <div className="glass-panel rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <form onSubmit={handleBook} className="space-y-4">
            <h3 className="text-lg font-heading font-bold text-white pb-3 border-b border-slate-800">
              Schedule Reservation
            </h3>

            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Start Time (UTC)</label>
              <input
                type="time"
                value={startTimeStr}
                onChange={(e) => setStartTimeStr(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Duration</label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value={1}>1 Hour</option>
                <option value={2}>2 Hours</option>
                <option value={3}>3 Hours</option>
                <option value={4}>4 Hours</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Rate</span>
                <span>${(activeAmenity?.hourly_rate_cents || 0) / 100}/hr</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Duration</span>
                <span>{durationHours} hour(s)</span>
              </div>
              <div className="flex justify-between text-white font-bold border-t border-slate-800 pt-1.5">
                <span>Total Due</span>
                <span className="text-indigo-400">${(calculateTotalCents() / 100).toFixed(2)}</span>
              </div>
            </div>

            {bookingError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{bookingError}</span>
              </div>
            )}

            {bookingSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{bookingSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={bookingMutation.isPending}
              className="w-full mt-4 py-3 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{bookingMutation.isPending ? 'Verifying Availability...' : 'Confirm & Reserve Slot'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
