import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CheckCircle2, Clock, Sparkles, User, XCircle } from 'lucide-react';
import type { AmenitySessionBooking, PropertyWithStats } from '@tenants/shared-types';
import { useTenantSessionsGateway } from '../context/ApiContext';
import { formatLocalSessionDate, formatLocalSessionTimeWindow } from '../utils/dateTime';
import { AlertBanner } from './common/AlertBanner';
import { SESSION_STATUS_BADGE } from './tenant/tenantPortalConstants';

interface AmenityApprovalsViewProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
}

export const AmenityApprovalsView: React.FC<AmenityApprovalsViewProps> = ({
  properties,
  selectedPropertyId,
}) => {
  const queryClient = useQueryClient();
  const sessionsGateway = useTenantSessionsGateway();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>(
    'all'
  );
  const [reviewingSession, setReviewingSession] = useState<{
    session: AmenitySessionBooking;
    decision: 'confirmed' | 'rejected';
  } | null>(null);
  const [managerNote, setManagerNote] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['manager-amenity-sessions'],
    queryFn: () => sessionsGateway.getTenantAmenitySessions(),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: 'confirmed' | 'rejected';
      notes?: string;
    }) => sessionsGateway.reviewAmenitySession(id, { status, notes }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['manager-amenity-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-amenity-sessions'] });
      setFeedbackMsg(
        `Amenity schedule for ${updated.amenity_name} (${updated.tenant_name || 'Resident'}) has been ${updated.status === 'confirmed' ? 'ACCEPTED' : 'REJECTED'}.`
      );
      setReviewingSession(null);
      setManagerNote('');
    },
  });

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedPropertyId && s.property_id && s.property_id !== selectedPropertyId) {
        return false;
      }
      if (statusFilter !== 'all' && s.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [sessions, selectedPropertyId, statusFilter]);

  const pendingCount = sessions.filter((s) => s.status === 'pending').length;
  const activePropName = properties.find((p) => p.id === selectedPropertyId)?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Amenity Schedule Approvals
          </h2>
          <p className="text-sm text-slate-500">
            Accept or reject scheduled resident amenity requests
            {activePropName ? ` at ${activePropName}` : ''} (local time windows shown).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {(['all', 'pending', 'confirmed', 'rejected'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize border transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st}
              {st === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>
      </div>

      {feedbackMsg && (
        <AlertBanner
          variant="success"
          message={feedbackMsg}
          onDismiss={() => setFeedbackMsg(null)}
        />
      )}

      {isLoading ? (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 text-sm text-slate-500">
          Loading scheduled amenity sessions...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Matching Amenity Schedules</h3>
          <p className="text-xs text-slate-500 mt-1">
            Pending resident requests and confirmed amenity sessions appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((session) => {
            const badgeClass =
              SESSION_STATUS_BADGE[session.status] || 'bg-slate-100 text-slate-700';
            const canReview = session.status === 'pending' || session.status === 'confirmed';

            return (
              <div
                key={session.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{session.amenity_name}</h3>
                        <p className="text-xs text-slate-500">
                          {session.tenant_name || 'Resident'}{' '}
                          {session.unit_number ? `· Unit ${session.unit_number}` : ''}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>
                      {session.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 bg-slate-50 rounded-xl p-3 text-xs border border-slate-100">
                    <div className="flex items-center space-x-2 text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <div>
                        <div className="font-bold">
                          {formatLocalSessionDate(session.start_time, session.booking_date)}
                        </div>
                        <div className="text-slate-500">
                          {formatLocalSessionTimeWindow(session.start_time, session.end_time)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-700">
                      <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>{session.attendees_count} guest(s)</span>
                    </div>
                  </div>

                  {session.notes && (
                    <p className="mt-3 text-xs text-slate-600 italic bg-slate-50/70 px-3 py-2 rounded-xl border border-slate-100">
                      “{session.notes}”
                    </p>
                  )}
                </div>

                {canReview && session.status !== 'cancelled' && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                    {session.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewingSession({ session, decision: 'confirmed' });
                          setManagerNote('');
                        }}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept Schedule</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setReviewingSession({ session, decision: 'rejected' });
                        setManagerNote('');
                      }}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject Schedule</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reviewingSession && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {reviewingSession.decision === 'confirmed'
                ? 'Accept Amenity Reservation'
                : 'Reject Amenity Reservation'}
            </h3>
            <p className="text-xs text-slate-600">
              <strong>{reviewingSession.session.amenity_name}</strong> for{' '}
              {reviewingSession.session.tenant_name || 'Resident'} on{' '}
              {formatLocalSessionDate(
                reviewingSession.session.start_time,
                reviewingSession.session.booking_date
              )}
              .
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Note to Resident (Optional)
              </label>
              <textarea
                rows={3}
                value={managerNote}
                onChange={(e) => setManagerNote(e.target.value)}
                placeholder={
                  reviewingSession.decision === 'confirmed'
                    ? 'Gate code or setup instructions...'
                    : 'Reason for rejecting this time slot...'
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setReviewingSession(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewMutation.isPending}
                onClick={() =>
                  reviewMutation.mutate({
                    id: reviewingSession.session.id,
                    status: reviewingSession.decision,
                    notes: managerNote || undefined,
                  })
                }
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer ${
                  reviewingSession.decision === 'rejected'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {reviewMutation.isPending
                  ? 'Updating...'
                  : reviewingSession.decision === 'confirmed'
                    ? 'Accept Booking'
                    : 'Reject Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

