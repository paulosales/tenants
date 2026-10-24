import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { createZodResolver } from '../utils/zodResolver';
import { z } from 'zod';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  DoorClosed,
  Calendar,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Loader2,
  Filter,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  PropertyWithStats,
  TenantWithUnit,
  CreateTenantDto,
  TenantStatus,
} from '@tenants/shared-types';

const tenantSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email address is required'),
  phone: z.string().min(5, 'Valid phone number is required'),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  assigned_unit_id: z.string().optional(),
  lease_start_date: z.string().optional(),
  lease_end_date: z.string().optional(),
  status: z.enum(['active', 'past', 'applicant']),
});

type TenantFormData = z.infer<typeof tenantSchema>;

interface TenantsViewProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
}

export const TenantsView: React.FC<TenantsViewProps> = ({
  properties,
  selectedPropertyId,
}) => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithUnit | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // Load tenants with optional property and status filters
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants', selectedPropertyId, statusFilter, searchQuery],
    queryFn: () =>
      api.getTenants({
        property_id: selectedPropertyId || undefined,
        status: statusFilter !== 'all' ? (statusFilter as TenantStatus) : undefined,
        q: searchQuery || undefined,
      }),
  });

  // Query units for the modal unit assignment selector
  const activePropertyIdForModal = editingTenant?.property_id || selectedPropertyId || (properties[0]?.id || '');
  const { data: availableUnits = [] } = useQuery({
    queryKey: ['units', activePropertyIdForModal],
    queryFn: () => (activePropertyIdForModal ? api.getUnits(activePropertyIdForModal) : Promise.resolve([])),
    enabled: Boolean(activePropertyIdForModal),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TenantFormData>({
    resolver: createZodResolver(tenantSchema),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: TenantFormData) => {
      const payload: CreateTenantDto = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        emergency_contact_name: data.emergency_contact_name || undefined,
        emergency_contact_phone: data.emergency_contact_phone || undefined,
        assigned_unit_id: data.assigned_unit_id && data.assigned_unit_id !== 'none' ? data.assigned_unit_id : null,
        lease_start_date: data.lease_start_date || null,
        lease_end_date: data.lease_end_date || null,
        status: data.status as TenantStatus,
      };

      if (editingTenant) {
        return api.updateTenant(editingTenant.id, {
          ...payload,
          status: data.status as TenantStatus,
        });
      } else {
        return api.createTenant(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      closeModal();
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to save tenant');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTenant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to delete tenant');
    },
  });

  const openCreateModal = () => {
    setEditingTenant(null);
    reset({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      assigned_unit_id: 'none',
      lease_start_date: '',
      lease_end_date: '',
      status: 'active',
    });
    setActionError(null);
    setModalOpen(true);
  };

  const openEditModal = (t: TenantWithUnit) => {
    setEditingTenant(t);
    reset({
      first_name: t.first_name,
      last_name: t.last_name,
      email: t.email,
      phone: t.phone,
      emergency_contact_name: t.emergency_contact_name || '',
      emergency_contact_phone: t.emergency_contact_phone || '',
      assigned_unit_id: t.assigned_unit_id || 'none',
      lease_start_date: t.lease_start_date || '',
      lease_end_date: t.lease_end_date || '',
      status: t.status,
    });
    setActionError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTenant(null);
    setActionError(null);
    reset();
  };

  const onSubmit = (data: TenantFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Tenants Directory</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage leases, unit occupancy assignments, and emergency contact details.
          </p>
        </div>

        <button
          id="btn-add-tenant"
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Tenant</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tenant name, email, or unit..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400 mr-1" />
          {['all', 'active', 'applicant', 'past'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                statusFilter === status
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tenants Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p>Loading tenant directory...</p>
          </div>
        ) : tenants.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No tenants found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              No tenant records match your query or active property filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 sm:px-6">Tenant Name</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Assigned Residence</th>
                  <th className="py-3.5 px-4">Lease Term</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {tenants.map((t) => {
                  const statusBadges: Record<string, string> = {
                    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    applicant: 'bg-sky-50 text-sky-700 border-sky-200',
                    past: 'bg-slate-100 text-slate-600 border-slate-200',
                  };

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                            {t.first_name[0]}
                            {t.last_name[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {t.first_name} {t.last_name}
                            </div>
                            {t.emergency_contact_name && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                ICE: {t.emergency_contact_name} ({t.emergency_contact_phone})
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 space-y-1">
                        <div className="flex items-center text-xs text-slate-600">
                          <Mail className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          <span>{t.email}</span>
                        </div>
                        <div className="flex items-center text-xs text-slate-600">
                          <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          <span>{t.phone}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {t.unit_number ? (
                          <div className="flex items-center space-x-1.5">
                            <DoorClosed className="w-4 h-4 text-indigo-600" />
                            <div>
                              <span className="font-bold text-slate-800">Unit {t.unit_number}</span>
                              <p className="text-[11px] text-slate-400">{t.property_name}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-600">
                        {t.lease_start_date && t.lease_end_date ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {t.lease_start_date} → {t.lease_end_date}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No lease active</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider ${
                            statusBadges[t.status] || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(t)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Tenant"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete tenant ${t.first_name} ${t.last_name}?`)) {
                              deleteMutation.mutate(t.id);
                            }
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Tenant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Tenant Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingTenant ? 'Edit Tenant Profile' : 'Add New Tenant'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    {...register('first_name')}
                    placeholder="Marcus"
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.first_name && (
                    <p className="text-xs text-rose-600 mt-1">{errors.first_name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    {...register('last_name')}
                    placeholder="Vance"
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.last_name && (
                    <p className="text-xs text-rose-600 mt-1">{errors.last_name.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    {...register('email')}
                    placeholder="marcus@example.com"
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    {...register('phone')}
                    placeholder="+1 (555) 0192"
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned Unit
                </label>
                <select
                  {...register('assigned_unit_id')}
                  className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="none">-- Unassigned --</option>
                  {availableUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.unit_number} ({u.bedrooms} Bed, {u.bathrooms} Bath) - {u.status}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Assigning a unit automatically marks its status as Occupied.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    {...register('emergency_contact_name')}
                    placeholder="Sandra Vance"
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Emergency Phone
                  </label>
                  <input
                    type="tel"
                    {...register('emergency_contact_phone')}
                    placeholder="+1 (555) 0199"
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lease Start</label>
                  <input
                    type="date"
                    {...register('lease_start_date')}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lease End</label>
                  <input
                    type="date"
                    {...register('lease_end_date')}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status *</label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="applicant">Applicant</option>
                  <option value="past">Past</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || saveMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
                >
                  {(isSubmitting || saveMutation.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>{editingTenant ? 'Save Changes' : 'Create Tenant'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
