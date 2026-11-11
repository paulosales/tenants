import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Wrench, X } from 'lucide-react';
import type { MaintenanceCall, PropertyStaff } from '@tenants/shared-types';

interface AssignCallModalProps {
  staff: PropertyStaff | null;
  eligibleCalls: MaintenanceCall[];
  isLoadingCalls: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirmAssign: (params: {
    callId: string;
    staffId: string;
    scheduledDate?: string;
    notes?: string;
  }) => void;
}

export const AssignCallModal: React.FC<AssignCallModalProps> = ({
  staff,
  eligibleCalls,
  isLoadingCalls,
  isSubmitting,
  error,
  onClose,
  onConfirmAssign,
}) => {
  const [selectedCallId, setSelectedCallId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (staff) {
      setSelectedCallId('');
      setScheduledDate(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
      setNotes('');
    }
  }, [staff]);

  if (!staff) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Assign Maintenance Call to Maintainer</h3>
              <p className="text-[11px] text-slate-500">
                Dispatching to:{' '}
                <span className="font-semibold text-slate-800">
                  {staff.first_name} {staff.last_name}
                </span>{' '}
                ({staff.title})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Maintainer Phone</span>
              <span className="font-semibold text-slate-800">{staff.phone}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Specialization</span>
              <span className="font-semibold text-indigo-600">
                {staff.specialization || 'General Maintenance'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Load</span>
              <span className="font-semibold text-amber-700">{staff.assigned_calls_count} active tickets</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Open Maintenance Call *
            </label>

            {isLoadingCalls ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                Loading available maintenance tickets...
              </div>
            ) : eligibleCalls.length === 0 ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs text-center">
                <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                No open maintenance calls pending assignment for this property.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {eligibleCalls.map((call) => {
                  const isSelected = selectedCallId === call.id;
                  return (
                    <div
                      key={call.id}
                      id={`call-option-${call.id}`}
                      onClick={() => setSelectedCallId(call.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-500 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          {call.ticket_number} - Unit {call.unit_number}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            call.priority === 'emergency'
                              ? 'bg-red-100 text-red-800'
                              : call.priority === 'urgent'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {call.priority}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 font-medium">{call.title}</p>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1.5">
                        <span>Category: {call.category}</span>
                        <span>•</span>
                        <span>Status: {call.status}</span>
                        {call.assigned_technician && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 font-semibold">
                              Currently: {call.assigned_technician}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Scheduled Dispatch Date & Time
            </label>
            <input
              type="datetime-local"
              id="assign-scheduled-date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Instructions / Dispatch Notes (Optional)
            </label>
            <textarea
              id="assign-notes"
              rows={2}
              placeholder="e.g. Bring replacement cartridge for bathroom faucet valve..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="confirm-assign-button"
              disabled={!selectedCallId || isSubmitting}
              onClick={() => {
                if (selectedCallId) {
                  onConfirmAssign({
                    callId: selectedCallId,
                    staffId: staff.id,
                    scheduledDate: scheduledDate || undefined,
                    notes: notes || undefined,
                  });
                }
              }}
              className="flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Confirm & Dispatch Maintainer</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

