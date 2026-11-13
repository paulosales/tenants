import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { HardHat, Loader2, X } from 'lucide-react';
import type { PropertyStaff, PropertyWithStats } from '@tenants/shared-types';
import { createZodResolver } from '../../utils/zodResolver';
import {
  SPECIALIZATION_PLACEHOLDERS,
  staffSchema,
  type StaffFormData,
} from './staffConstants';

interface StaffFormModalProps {
  isOpen: boolean;
  editingStaff: PropertyStaff | null;
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmitForm: (data: StaffFormData) => void;
}

export const StaffFormModal: React.FC<StaffFormModalProps> = ({
  isOpen,
  editingStaff,
  properties,
  selectedPropertyId,
  isSubmitting,
  onClose,
  onSubmitForm,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<StaffFormData>({
    resolver: createZodResolver(staffSchema),
    defaultValues: {
      property_id: selectedPropertyId || (properties[0]?.id ?? ''),
      role: 'maintainer',
      title: '',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      specialization: '',
      shift: 'Day (08:00 - 16:30)',
      status: 'active',
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    if (editingStaff) {
      reset({
        property_id: editingStaff.property_id,
        first_name: editingStaff.first_name,
        last_name: editingStaff.last_name,
        role: editingStaff.role,
        title: editingStaff.title,
        email: editingStaff.email,
        phone: editingStaff.phone,
        specialization: editingStaff.specialization || '',
        shift: editingStaff.shift,
        status: editingStaff.status,
      });
    } else {
      reset({
        property_id: selectedPropertyId || (properties[0]?.id ?? ''),
        role: 'maintainer',
        title: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        specialization: '',
        shift: 'Day (08:00 - 16:30)',
        status: 'active',
      });
    }
  }, [isOpen, editingStaff, selectedPropertyId, properties, reset]);

  if (!isOpen) return null;

  const selectedFormRole = watch('role');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Enter the personnel profile details, department role, and shift schedule.
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

        <form onSubmit={handleSubmit(onSubmitForm)} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3.5">
            <div className="col-span-2">
              <label htmlFor="staff-form-property" className="block text-xs font-semibold text-slate-700 mb-1">
                Assigned Property *
              </label>
              <select
                id="staff-form-property"
                {...register('property_id')}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.city}, {p.state_province})
                  </option>
                ))}
              </select>
              {errors.property_id && <span className="text-[11px] text-red-500">{errors.property_id.message}</span>}
            </div>

            <div>
              <label htmlFor="staff-form-role" className="block text-xs font-semibold text-slate-700 mb-1">
                Department Role *
              </label>
              <select
                id="staff-form-role"
                {...register('role')}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="maintainer">Technical Maintainer</option>
                <option value="manager">Property Manager</option>
                <option value="security">Security & Safety</option>
                <option value="cleaner">Cleaner / Housekeeping</option>
                <option value="other">Other Operations</option>
              </select>
            </div>

            <div>
              <label htmlFor="staff-form-title" className="block text-xs font-semibold text-slate-700 mb-1">
                Job Title / Position *
              </label>
              <input
                id="staff-form-title"
                type="text"
                placeholder="e.g. Lead Plumber, Chief of Security"
                {...register('title')}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              />
              {errors.title && <span className="text-[11px] text-red-500">{errors.title.message}</span>}
            </div>

            <div>
              <label htmlFor="staff-form-first-name" className="block text-xs font-semibold text-slate-700 mb-1">
                First Name *
              </label>
              <input
                id="staff-form-first-name"
                type="text"
                {...register('first_name')}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              />
              {errors.first_name && <span className="text-[11px] text-red-500">{errors.first_name.message}</span>}
            </div>

            <div>
              <label htmlFor="staff-form-last-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Last Name *
              </label>
              <input
                id="staff-form-last-name"
                type="text"
                {...register('last_name')}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              />
              {errors.last_name && <span className="text-[11px] text-red-500">{errors.last_name.message}</span>}
            </div>

            <div>
              <label htmlFor="staff-form-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Work Email *
              </label>
              <input
                id="staff-form-email"
                type="email"
                placeholder="staff@property.example.com"
                {...register('email')}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              />
              {errors.email && <span className="text-[11px] text-red-500">{errors.email.message}</span>}
            </div>

            <div>
              <label htmlFor="staff-form-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone *
              </label>
              <input
                id="staff-form-phone"
                type="text"
                placeholder="+1 (555) 000-0000"
                {...register('phone')}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              />
              {errors.phone && <span className="text-[11px] text-red-500">{errors.phone.message}</span>}
            </div>

            <div className="col-span-2">
              <label htmlFor="staff-form-specialization" className="block text-xs font-semibold text-slate-700 mb-1">
                Technical Specialization / Skills (Optional)
              </label>
              <input
                id="staff-form-specialization"
                type="text"
                placeholder={SPECIALIZATION_PLACEHOLDERS[selectedFormRole] || SPECIALIZATION_PLACEHOLDERS.other}
                {...register('specialization')}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="staff-form-shift" className="block text-xs font-semibold text-slate-700 mb-1">
                Shift & Schedule *
              </label>
              <select
                id="staff-form-shift"
                {...register('shift')}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Morning (06:00 - 14:30)">Morning (06:00 - 14:30)</option>
                <option value="Day (08:00 - 16:30)">Day (08:00 - 16:30)</option>
                <option value="Afternoon (14:00 - 22:30)">Afternoon (14:00 - 22:30)</option>
                <option value="Night (22:00 - 06:30)">Night (22:00 - 06:30)</option>
                <option value="On-Call / 24-7 Dispatch">On-Call / 24-7 Dispatch</option>
              </select>
            </div>

            <div>
              <label htmlFor="staff-form-status" className="block text-xs font-semibold text-slate-700 mb-1">
                Employment Status *
              </label>
              <select
                id="staff-form-status"
                {...register('status')}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Active Onsite</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-staff-button"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingStaff ? 'Save Changes' : 'Create Staff Member'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

