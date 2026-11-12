import React from 'react';
import { Calendar, Clock, User, Users, X } from 'lucide-react';
import type { AmenityCalendarEvent } from '@tenants/shared-types';
import {
  formatLocalSessionDate,
  formatLocalSessionTimeWindow,
  formatLocalYyyyMmDd,
} from '../../utils/dateTime';
import { ModalDialog } from '../common/ModalDialog';
import { SESSION_STATUS_BADGE } from './tenantPortalConstants';

interface AmenityEventDetailsModalProps {
  amenityName: string;
  event: AmenityCalendarEvent | null;
  isAdmin: boolean;
  isCancelling: boolean;
  onCancelSession: (sessionId: string) => void;
  onClose: () => void;
}

export const AmenityEventDetailsModal: React.FC<AmenityEventDetailsModalProps> = ({
  amenityName,
  event,
  isAdmin,
  isCancelling,
  onCancelSession,
  onClose,
}) => {
  return (
    <ModalDialog
      isOpen={Boolean(event)}
      title={amenityName}
      subtitle="Amenity Session Details"
      titleId="inspect-amenity-event-title"
      onClose={onClose}
    >
      {event && (
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500 uppercase tracking-wider">Status</span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold ${
                SESSION_STATUS_BADGE[event.status as keyof typeof SESSION_STATUS_BADGE] ||
                'bg-slate-100 text-slate-800'
              }`}
            >
              {event.status.toUpperCase()}
            </span>
          </div>

          {isAdmin && (
            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-indigo-700 font-semibold">
                <User className="w-4 h-4" />
                <span>Scheduled By (Admin Only)</span>
              </span>
              <span className="font-bold text-indigo-950">
                {event.scheduled_by_name || 'Resident'}
                {event.unit_number ? ` · Unit ${event.unit_number}` : ''}
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
                    event.start_time,
                    formatLocalYyyyMmDd(new Date(event.start_time))
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-slate-700">
              <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
              <div>
                <div className="text-[10px] text-slate-400">Local Window</div>
                <div className="font-bold">
                  {formatLocalSessionTimeWindow(event.start_time, event.end_time)}
                </div>
              </div>
            </div>
          </div>

          {event.attendees_count != null && (
            <div className="flex items-center justify-between px-1 text-slate-700">
              <span className="flex items-center space-x-1.5 text-slate-500">
                <Users className="w-3.5 h-3.5" />
                <span>Party Size</span>
              </span>
              <span className="font-bold">{event.attendees_count} Guests</span>
            </div>
          )}

          {event.notes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-600 italic">
              “{event.notes}”
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            {(isAdmin || event.is_own) && (
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => {
                  onCancelSession(event.id);
                  onClose();
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Session</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </ModalDialog>
  );
};
