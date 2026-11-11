import React from 'react';
import { Check, CheckCircle2, PhoneCall, User, Wrench } from 'lucide-react';
import type { MaintenanceCall, MaintenanceStatus } from '@tenants/shared-types';
import {
  CATEGORY_INFO,
  MAINTENANCE_PIPELINE_STEPS,
  MAINTENANCE_STATUS_BADGE,
  PRIORITY_BADGE,
} from './tenantPortalConstants';

interface MaintenanceTrackerListProps {
  calls: MaintenanceCall[];
  unitNumber?: string;
  onPlaceNewCall: () => void;
  onResolveCall: (callId: string) => void;
  onCancelCall: (callId: string) => void;
}

const ORDERED_PIPELINE: MaintenanceStatus[] = ['reported', 'dispatched', 'in_progress', 'resolved'];

export const MaintenanceTrackerList: React.FC<MaintenanceTrackerListProps> = ({
  calls,
  unitNumber,
  onPlaceNewCall,
  onResolveCall,
  onCancelCall,
}) => {
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Maintenance Calls & Service Tracker</h3>
          <p className="text-xs text-slate-500">
            Real-time status of service requests, technician assignments, and scheduled visits
          </p>
        </div>
        <button
          id="open-new-call-btn"
          onClick={onPlaceNewCall}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>+ Place New Call</span>
        </button>
      </div>

      {calls.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">All Systems Operational</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            You have no active maintenance calls. If anything requires attention in Unit {unitNumber || '101'}, place a
            call anytime.
          </p>
          <button
            onClick={onPlaceNewCall}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
          >
            Report an Issue
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {calls.map((call) => {
            const categoryData = CATEGORY_INFO[call.category] || CATEGORY_INFO.general;
            const CategoryIcon = categoryData.icon;
            const isResolved = call.status === 'resolved';
            const isCancelled = call.status === 'cancelled';
            const priorityClass = PRIORITY_BADGE[call.priority] || PRIORITY_BADGE.routine;
            const statusClass = MAINTENANCE_STATUS_BADGE[call.status] || MAINTENANCE_STATUS_BADGE.reported;
            const currentIdx = ORDERED_PIPELINE.indexOf(call.status);

            return (
              <div
                key={call.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isResolved
                    ? 'bg-slate-50/50 border-slate-200'
                    : isCancelled
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : 'bg-white border-slate-200 shadow-2xs hover:shadow-sm hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-2.5 rounded-xl border ${categoryData.bg} shrink-0 mt-0.5`}>
                      <CategoryIcon className={`w-5 h-5 ${categoryData.color}`} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">#{call.ticket_number}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${priorityClass}`}>
                          {call.priority.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400">• Unit {call.unit_number}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-1 leading-snug">{call.title}</h4>
                      <p className="text-xs text-slate-600 mt-1">{call.description}</p>
                    </div>
                  </div>

                  <div className="shrink-0 self-start sm:self-auto text-left sm:text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${statusClass}`}>
                      {call.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-1">
                      Logged {new Date(call.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Status Pipeline Visualizer */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-4 gap-2 text-center text-[11px]">
                  {MAINTENANCE_PIPELINE_STEPS.map((step, idx) => {
                    const isCurrent = call.status === step.id;
                    const isPast = currentIdx >= idx;

                    return (
                      <div key={step.id} className="flex flex-col items-center">
                        <div
                          className={`w-full h-1.5 rounded-full mb-1.5 ${
                            isPast ? (isResolved ? 'bg-emerald-500' : 'bg-indigo-600') : 'bg-slate-200'
                          }`}
                        />
                        <span
                          className={`font-semibold ${
                            isCurrent ? 'text-indigo-600 font-bold' : isPast ? 'text-slate-800' : 'text-slate-400'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Technician & Appointment Info */}
                <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Assigned Technician</span>
                      <span className="font-bold text-slate-800">
                        {call.assigned_technician || 'Engineering Dispatch Queue (Evaluating)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {call.technician_phone && (
                      <a
                        href={`tel:${call.technician_phone}`}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center space-x-1.5 transition-colors"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Call Tech</span>
                      </a>
                    )}

                    {!isResolved && !isCancelled && (
                      <button
                        onClick={() => onResolveCall(call.id)}
                        className="px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold text-xs transition-colors flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Resolved</span>
                      </button>
                    )}

                    {!isResolved && !isCancelled && (
                      <button
                        onClick={() => onCancelCall(call.id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition-colors"
                      >
                        Cancel Call
                      </button>
                    )}
                  </div>
                </div>

                {call.resolution_notes && (
                  <div className="mt-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                    <span className="font-bold block mb-0.5">Resolution Report:</span>
                    {call.resolution_notes}
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

