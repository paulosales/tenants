import React from 'react';
import { useForm } from 'react-hook-form';
import { Check, Loader2, Wrench } from 'lucide-react';
import type { MaintenanceCategory, TenantWithUnit } from '@tenants/shared-types';
import { createZodResolver } from '../../utils/zodResolver';
import {
  CATEGORY_INFO,
  PRIORITY_OPTIONS,
  maintenanceCallSchema,
  type MaintenanceCallFormData,
} from './tenantPortalConstants';

interface MaintenanceCallFormProps {
  activeTenant: TenantWithUnit;
  isSubmittingCall: boolean;
  onCancel: () => void;
  onSubmitCall: (data: MaintenanceCallFormData, onReset: () => void) => void;
}

export const MaintenanceCallForm: React.FC<MaintenanceCallFormProps> = ({
  activeTenant,
  isSubmittingCall,
  onCancel,
  onSubmitCall,
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MaintenanceCallFormData>({
    resolver: createZodResolver(maintenanceCallSchema),
    defaultValues: {
      category: 'plumbing',
      priority: 'routine',
      unit_number: activeTenant.unit_number || '101',
      title: '',
      description: '',
      permission_to_enter: true,
      preferred_time_window: 'Morning (08:00 - 12:00)',
      contact_phone: activeTenant.phone || '+1 (555) 019-2831',
    },
  });

  const handleFormSubmit = (data: MaintenanceCallFormData) => {
    onSubmitCall(data, () => {
      reset({
        category: 'plumbing',
        priority: 'routine',
        unit_number: activeTenant.unit_number || '101',
        title: '',
        description: '',
        permission_to_enter: true,
        preferred_time_window: 'Morning (08:00 - 12:00)',
        contact_phone: activeTenant.phone || '+1 (555) 019-2831',
      });
    });
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm max-w-3xl mx-auto">
      <div className="flex items-center justify-between pb-5 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Place Maintenance Call</h3>
            <p className="text-xs text-slate-500">
              Submit an issue ticket to property engineering & maintenance dispatch
            </p>
          </div>
        </div>

        <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-800 font-semibold">
          View Active Requests
        </button>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 mt-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
            Issue Category *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(Object.keys(CATEGORY_INFO) as MaintenanceCategory[]).map((cat) => {
              const info = CATEGORY_INFO[cat];
              const Icon = info.icon;
              const isSelected = watch('category') === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setValue('category', cat)}
                  className={`p-3 rounded-xl border text-left flex items-center space-x-2.5 transition-all ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20 shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : info.color}`} />
                  <span
                    className={`text-xs font-semibold truncate ${
                      isSelected ? 'text-indigo-950 font-bold' : 'text-slate-700'
                    }`}
                  >
                    {info.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
            Priority Level *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRIORITY_OPTIONS.map((p) => {
              const isSelected = watch('priority') === p.level;
              return (
                <button
                  key={p.level}
                  type="button"
                  onClick={() => setValue('priority', p.level)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    isSelected ? `${p.activeBorder} ring-2 ring-indigo-500/10 shadow-xs` : `${p.border} hover:bg-slate-50`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{p.title}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <span className="text-[11px] text-slate-500 block mt-0.5">{p.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Issue Summary Title *
            </label>
            <input
              type="text"
              id="maintenance-title"
              {...register('title')}
              placeholder="e.g. Master bathroom faucet dripping continuously"
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.title && <p className="text-xs text-rose-600 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Residence Unit *
            </label>
            <input
              type="text"
              id="maintenance-unit-number"
              {...register('unit_number')}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
            />
            {errors.unit_number && (
              <p className="text-xs text-rose-600 mt-1">{errors.unit_number.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            Detailed Problem Description *
          </label>
          <textarea
            id="maintenance-description"
            rows={4}
            {...register('description')}
            placeholder="Describe what happened, where the issue is located, when it started, and any symptoms (leaking, noise, smell, power loss)..."
            className="w-full px-3.5 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.description && (
            <p className="text-xs text-rose-600 mt-1">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Preferred Service Window
            </label>
            <select
              id="maintenance-time-window"
              {...register('preferred_time_window')}
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Morning (08:00 - 12:00)">Morning (08:00 - 12:00)</option>
              <option value="Afternoon (12:00 - 16:00)">Afternoon (12:00 - 16:00)</option>
              <option value="Evening (16:00 - 19:00)">Evening (16:00 - 19:00)</option>
              <option value="Anytime (Earliest available)">Anytime (Earliest available)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Technician Callback Phone *
            </label>
            <input
              type="tel"
              id="maintenance-contact-phone"
              {...register('contact_phone')}
              placeholder="+1 (555) 019-2831"
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.contact_phone && (
              <p className="text-xs text-rose-600 mt-1">{errors.contact_phone.message}</p>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start space-x-3">
          <input
            type="checkbox"
            id="permission_to_enter"
            {...register('permission_to_enter')}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <label htmlFor="permission_to_enter" className="text-xs font-bold text-slate-900 cursor-pointer">
              Grant Permission to Enter Unit If Absent
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Allows authorized property maintenance technicians to access your unit to resolve this issue if you are
              not home during the scheduled time window.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            id="submit-maintenance-call-btn"
            disabled={isSubmitting || isSubmittingCall}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            {(isSubmitting || isSubmittingCall) && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Place Maintenance Call</span>
          </button>
        </div>
      </form>
    </div>
  );
};

