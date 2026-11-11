import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Phone, PlayCircle, UserCheck, Wrench } from 'lucide-react';
import type {
  MaintenanceCall,
  MaintenanceStatus,
  PropertyWithStats,
  UserSummary,
} from '@tenants/shared-types';
import { useMaintenanceGateway } from '../context/ApiContext';
import { AlertBanner } from './common/AlertBanner';
import { MAINTENANCE_STATUS_BADGE, PRIORITY_BADGE } from './tenant/tenantPortalConstants';

interface MaintainerCallsViewProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  currentUser?: UserSummary | null;
}

const NEXT_STATUS_ACTIONS: Array<{ status: MaintenanceStatus; label: string; style: string }> = [
  {
    status: 'dispatched',
    label: 'Accept / Dispatch',
    style: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  {
    status: 'in_progress',
    label: 'Start Work',
    style: 'bg-sky-600 hover:bg-sky-700 text-white border-sky-600',
  },
  {
    status: 'resolved',
    label: 'Mark Solved',
    style: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
  },
];

export const MaintainerCallsView: React.FC<MaintainerCallsViewProps> = ({
  properties,
  selectedPropertyId,
  currentUser,
}) => {
  const queryClient = useQueryClient();
  const maintenanceGateway = useMaintenanceGateway();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [onlyMyAssigned, setOnlyMyAssigned] = useState(false);
  const [solvingCall, setSolvingCall] = useState<{
    call: MaintenanceCall;
    nextStatus: MaintenanceStatus;
  } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const effectivePropertyId = selectedPropertyId || currentUser?.property_id || undefined;

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['maintainer-calls', effectivePropertyId, statusFilter],
    queryFn: () =>
      maintenanceGateway.getMaintenanceCalls({
        property_id: effectivePropertyId,
        status: statusFilter,
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: MaintenanceStatus;
      notes?: string;
    }) => maintenanceGateway.updateMaintenanceCallStatus(id, status, notes),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['maintainer-calls'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-calls'] });
      setFeedbackMsg(
        `Ticket ${updated.ticket_number} updated to ${updated.status.replace('_', ' ').toUpperCase()}.`
      );
      setSolvingCall(null);
      setResolutionNotes('');
    },
  });

  const visibleCalls = useMemo(() => {
    if (!onlyMyAssigned || !currentUser?.staff_id) return calls;
    return calls.filter((c) => c.assigned_staff_id === currentUser.staff_id);
  }, [calls, onlyMyAssigned, currentUser]);

  const activePropName = properties.find((p) => p.id === effectivePropertyId)?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Maintenance Call Queue & Work Orders
          </h2>
          <p className="text-sm text-slate-500">
            Receive incoming maintenance dispatches
            {activePropName ? ` for ${activePropName}` : ''}, update progress, and mark resolved.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentUser?.staff_id && (
            <button
              type="button"
              onClick={() => setOnlyMyAssigned((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                onlyMyAssigned
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {onlyMyAssigned ? 'Showing My Assigned Calls' : 'Only Assigned to Me'}
            </button>
          )}

          {(['all', 'reported', 'dispatched', 'in_progress', 'resolved'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize border transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st.replace('_', ' ')}
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
          Loading maintenance work orders...
        </div>
      ) : visibleCalls.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Maintenance Calls Matching Filter</h3>
          <p className="text-xs text-slate-500 mt-1">
            Switch filter tabs or clear "Only Assigned to Me" to see all building tickets.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleCalls.map((call) => (
            <div
              key={call.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {call.ticket_number}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        PRIORITY_BADGE[call.priority] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {call.priority}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        MAINTENANCE_STATUS_BADGE[call.status] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {call.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg">
                      {call.property_name || 'Property'} · Unit {call.unit_number}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{call.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{call.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="inline-flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Resident: {call.tenant_name || 'Tenant'} ({call.contact_phone})
                      </span>
                    </span>
                    <span className="inline-flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Window: {call.preferred_time_window}</span>
                    </span>
                    {call.assigned_technician && (
                      <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Assigned: {call.assigned_technician}</span>
                      </span>
                    )}
                  </div>

                  {call.resolution_notes && (
                    <div className="mt-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                      <strong>Resolution Notes:</strong> {call.resolution_notes}
                    </div>
                  )}
                </div>

                {call.status !== 'resolved' && call.status !== 'cancelled' && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {NEXT_STATUS_ACTIONS.filter((act) => act.status !== call.status).map((act) => (
                      <button
                        key={act.status}
                        type="button"
                        onClick={() => {
                          if (act.status === 'resolved') {
                            setSolvingCall({ call, nextStatus: 'resolved' });
                            setResolutionNotes(call.resolution_notes || '');
                          } else {
                            updateStatusMutation.mutate({ id: call.id, status: act.status });
                          }
                        }}
                        className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${act.style}`}
                      >
                        {act.status === 'resolved' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <PlayCircle className="w-3.5 h-3.5" />
                        )}
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve Work Order Modal */}
      {solvingCall && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Complete Work Order — {solvingCall.call.ticket_number}
            </h3>
            <p className="text-xs text-slate-600">{solvingCall.call.title}</p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resolution Notes
              </label>
              <textarea
                rows={4}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Replaced P-trap gasket, tested drain under pressure — no leaks."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setSolvingCall(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateStatusMutation.isPending}
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: solvingCall.call.id,
                    status: solvingCall.nextStatus,
                    notes: resolutionNotes || 'Resolved by technical maintenance staff',
                  })
                }
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                {updateStatusMutation.isPending ? 'Saving...' : 'Mark Call Solved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

