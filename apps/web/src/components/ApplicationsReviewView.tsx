import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileCheck2,
  Mail,
  Phone,
  Users,
  XCircle,
} from 'lucide-react';
import type {
  PropertyWithStats,
  TenancyApplication,
  TenancyApplicationStatus,
} from '@tenants/shared-types';
import { useApplicationsGateway } from '../context/ApiContext';
import { AlertBanner } from './common/AlertBanner';

interface ApplicationsReviewViewProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
}

const APP_STATUS_BADGE: Record<TenancyApplicationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  under_review: 'bg-sky-100 text-sky-800 border-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
};

export const ApplicationsReviewView: React.FC<ApplicationsReviewViewProps> = ({
  properties,
  selectedPropertyId,
}) => {
  const queryClient = useQueryClient();
  const applicationsGateway = useApplicationsGateway();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reviewingApp, setReviewingApp] = useState<{
    app: TenancyApplication;
    decision: 'approved' | 'rejected' | 'under_review';
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [onboardAsTenant, setOnboardAsTenant] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['tenancy-applications', selectedPropertyId, statusFilter],
    queryFn: () =>
      applicationsGateway.getApplications({
        property_id: selectedPropertyId || undefined,
        status: statusFilter,
      }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      decision,
      notes,
      onboard,
    }: {
      id: string;
      decision: TenancyApplicationStatus;
      notes: string;
      onboard: boolean;
    }) =>
      applicationsGateway.reviewApplication(id, {
        status: decision,
        review_notes: notes || undefined,
        onboard_as_tenant: decision === 'approved' ? onboard : false,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['tenancy-applications'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setFeedbackMsg(
        `Application for ${updated.applicant_first_name} ${updated.applicant_last_name} marked as ${updated.status.toUpperCase()}.`
      );
      setReviewingApp(null);
      setReviewNotes('');
    },
  });

  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const activePropName = properties.find((p) => p.id === selectedPropertyId)?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Tenancy Applications</h2>
          <p className="text-sm text-slate-500">
            Review prospective resident applications
            {activePropName ? ` for ${activePropName}` : ' across all managed properties'} and
            onboard approved applicants.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {(['all', 'pending', 'under_review', 'approved', 'rejected'] as const).map((st) => (
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
        <div className="p-10 text-center text-slate-500 text-sm bg-white rounded-3xl border border-slate-200">
          Loading applications...
        </div>
      ) : applications.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <FileCheck2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Applications in Queue</h3>
          <p className="text-xs text-slate-500 mt-1">
            Applications submitted through the Public Property Portal appear here for review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-5"
            >
              <div className="space-y-2.5 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase ${
                      APP_STATUS_BADGE[app.status] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {app.status.replace('_', ' ')}
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {app.applicant_first_name} {app.applicant_last_name}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700">
                    {app.property_name || 'Managed Property'}
                    {app.preferred_unit_number ? ` · Unit ${app.preferred_unit_number}` : ''}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
                  <span className="inline-flex items-center space-x-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{app.applicant_email}</span>
                  </span>
                  <span className="inline-flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{app.applicant_phone}</span>
                  </span>
                  <span className="inline-flex items-center space-x-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                    <span>${(app.monthly_income_cents / 100).toLocaleString()}/mo income</span>
                  </span>
                  <span className="inline-flex items-center space-x-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {app.occupants_count} occupant(s) · {app.employment_status.replace('_', ' ')}
                    </span>
                  </span>
                  {app.desired_move_in_date && (
                    <span className="inline-flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Target move-in: {app.desired_move_in_date}</span>
                    </span>
                  )}
                </div>

                {app.notes && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3.5 py-2 border border-slate-100">
                    “{app.notes}”
                  </p>
                )}

                {app.review_notes && (
                  <p className="text-xs text-indigo-700 bg-indigo-50 rounded-xl px-3.5 py-2 border border-indigo-100">
                    Manager decision note: {app.review_notes}
                  </p>
                )}
              </div>

              {app.status !== 'approved' && app.status !== 'rejected' && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {app.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewingApp({ app, decision: 'under_review' });
                        setReviewNotes('');
                      }}
                      className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Start Review</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setReviewingApp({ app, decision: 'approved' });
                      setOnboardAsTenant(true);
                      setReviewNotes('');
                    }}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReviewingApp({ app, decision: 'rejected' });
                      setReviewNotes('');
                    }}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation / Review Decision Modal (replaces native confirm/prompt) */}
      {reviewingApp && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {reviewingApp.decision === 'approved'
                ? 'Approve Tenancy Application'
                : reviewingApp.decision === 'rejected'
                  ? 'Reject Tenancy Application'
                  : 'Move Application to Review'}
            </h3>
            <p className="text-xs text-slate-600">
              Applicant:{' '}
              <strong>
                {reviewingApp.app.applicant_first_name} {reviewingApp.app.applicant_last_name}
              </strong>{' '}
              ({reviewingApp.app.applicant_email})
            </p>

            {reviewingApp.decision === 'approved' && (
              <label className="flex items-start space-x-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onboardAsTenant}
                  onChange={(e) => setOnboardAsTenant(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600"
                />
                <span>
                  Automatically onboard applicant as an Active Tenant and mark preferred unit as
                  Occupied
                </span>
              </label>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Review Notes (Optional)
              </label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Income verified, lease packet prepared..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewingApp(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewMutation.isPending}
                onClick={() =>
                  reviewMutation.mutate({
                    id: reviewingApp.app.id,
                    decision: reviewingApp.decision,
                    notes: reviewNotes,
                    onboard: onboardAsTenant,
                  })
                }
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer ${
                  reviewingApp.decision === 'rejected'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {reviewMutation.isPending ? 'Saving...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

