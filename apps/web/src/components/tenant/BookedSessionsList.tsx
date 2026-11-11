import React from 'react';
import { Calendar, Clock, Sparkles, User, X } from 'lucide-react';
import type { AmenitySessionBooking } from '@tenants/shared-types';
import {
  formatLocalSessionDate,
  formatLocalSessionTimeWindow,
  formatUtcTimeWindow,
} from '../../utils/dateTime';
import { SESSION_STATUS_BADGE } from './tenantPortalConstants';

interface BookedSessionsListProps {
  sessions: AmenitySessionBooking[];
  isCancelling: boolean;
  onCancelSession: (sessionId: string) => void;
  onBrowseAmenities: () => void;
}

export const BookedSessionsList: React.FC<BookedSessionsListProps> = ({
  sessions,
  isCancelling,
  onCancelSession,
  onBrowseAmenities,
}) => {
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-900">My Scheduled Amenity Sessions</h3>
          <p className="text-xs text-slate-500">
            Track confirmed bookings, upcoming passes, and review reservation details
          </p>
        </div>
        <button
          onClick={onBrowseAmenities}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Book Another Amenity</span>
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No Amenity Sessions Scheduled</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            You currently have no scheduled sessions. Explore our amenities and reserve a slot for private use!
          </p>
          <button
            onClick={onBrowseAmenities}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
          >
            Browse Amenities
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((session) => {
            const isCancelled = session.status === 'cancelled';
            const badgeClass = SESSION_STATUS_BADGE[session.status] || 'bg-slate-100 text-slate-800';
            const hasIsoTimes =
              Boolean(session.start_time) &&
              (session.start_time.includes('T') || session.start_time.includes('Z'));

            return (
              <div
                key={session.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isCancelled
                    ? 'bg-slate-50/60 border-slate-200 opacity-70'
                    : 'bg-white border-slate-200 shadow-2xs hover:shadow-sm hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        isCancelled ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{session.amenity_name}</h4>
                      <span className="text-xs text-slate-500">Unit {session.unit_number || '101'}</span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeClass}`}>
                    {session.status.toUpperCase()}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Date</span>
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatLocalSessionDate(session.start_time, session.booking_date)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Time Window</span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium border border-indigo-100">
                        Local
                      </span>
                    </span>
                    <div className="text-right">
                      <span className="font-semibold text-slate-900">
                        {formatLocalSessionTimeWindow(session.start_time, session.end_time, session.booking_date)}
                      </span>
                      {hasIsoTimes && (
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {formatUtcTimeWindow(session.start_time, session.end_time)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 text-slate-500">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Party Size</span>
                    </span>
                    <span className="font-semibold text-slate-900">{session.attendees_count} Attendees</span>
                  </div>

                  {session.notes && (
                    <div className="mt-2 p-2 bg-slate-50 rounded-lg text-slate-600 text-[11px] italic">
                      "{session.notes}"
                    </div>
                  )}
                </div>

                {!isCancelled && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => onCancelSession(session.id)}
                      disabled={isCancelling}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel Session</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

