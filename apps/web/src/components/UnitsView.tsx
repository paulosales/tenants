import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { createZodResolver } from '../utils/zodResolver';
import { z } from 'zod';
import {
  DoorClosed,
  Plus,
  Users,
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
  UnitWithTenant,
  CreateUnitDto,
  UnitStatus,
} from '@tenants/shared-types';

const unitSchema = z.object({
  unit_number: z.string().min(1, 'Unit number is required'),
  floor: z.coerce.number().int().min(-5, 'Invalid floor'),
  bedrooms: z.coerce.number().int().min(0, 'Bedrooms must be 0 or more'),
  bathrooms: z.coerce.number().min(0.5, 'Bathrooms must be at least 0.5'),
  square_feet: z.coerce.number().int().min(50, 'Square feet must be at least 50'),
  status: z.enum(['vacant', 'occupied', 'maintenance']),
});

type UnitFormData = z.infer<typeof unitSchema>;

interface UnitsViewProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  onSelectProperty: (id: string | null) => void;
}

export const UnitsView: React.FC<UnitsViewProps> = ({
  properties,
  selectedPropertyId,
  onSelectProperty,
}) => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitWithTenant | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // Default to first property if none selected
  const activePropertyId = selectedPropertyId || (properties.length > 0 ? properties[0].id : '');

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units', activePropertyId],
    queryFn: () => (activePropertyId ? api.getUnits(activePropertyId) : Promise.resolve([])),
    enabled: Boolean(activePropertyId),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UnitFormData>({
    resolver: createZodResolver(unitSchema),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: UnitFormData) => {
      const payload: CreateUnitDto = {
        unit_number: data.unit_number,
        floor: data.floor,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        square_feet: data.square_feet,
        status: data.status,
      };

      if (editingUnit) {
        return api.updateUnit(editingUnit.id, {
          ...payload,
          status: data.status as UnitStatus,
        });
      } else {
        return api.createUnit(activePropertyId, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', activePropertyId] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      closeModal();
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to save unit');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units', activePropertyId] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to delete unit');
    },
  });

  const openCreateModal = () => {
    setEditingUnit(null);
    reset({
      unit_number: '',
      floor: 1,
      bedrooms: 1,
      bathrooms: 1.0,
      square_feet: 650,
      status: 'vacant',
    });
    setActionError(null);
    setModalOpen(true);
  };

  const openEditModal = (unit: UnitWithTenant) => {
    setEditingUnit(unit);
    reset({
      unit_number: unit.unit_number,
      floor: unit.floor,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      square_feet: unit.square_feet,
      status: unit.status,
    });
    setActionError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUnit(null);
    setActionError(null);
    reset();
  };

  const onSubmit = (data: UnitFormData) => {
    saveMutation.mutate(data);
  };

  const filteredUnits = units.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    return true;
  });

  const vacantCount = units.filter((u) => u.status === 'vacant').length;
  const occupiedCount = units.filter((u) => u.status === 'occupied').length;
  const maintenanceCount = units.filter((u) => u.status === 'maintenance').length;

  const currentPropertyName =
    properties.find((p) => p.id === activePropertyId)?.name || 'Selected Property';

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Units Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Managing units for <span className="font-semibold text-slate-800">{currentPropertyName}</span>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={activePropertyId}
            onChange={(e) => onSelectProperty(e.target.value)}
            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            id="btn-add-unit"
            onClick={openCreateModal}
            disabled={!activePropertyId}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Unit</span>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold uppercase text-slate-400">Total Units</p>
          <p className="text-lg font-bold text-slate-900">{units.length}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold uppercase text-emerald-600">Vacant</p>
          <p className="text-lg font-bold text-emerald-600">{vacantCount}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold uppercase text-indigo-600">Occupied</p>
          <p className="text-lg font-bold text-indigo-600">{occupiedCount}</p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold uppercase text-amber-600">Maintenance</p>
          <p className="text-lg font-bold text-amber-600">{maintenanceCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <Filter className="w-4 h-4 text-slate-400 mr-1" />
        {['all', 'vacant', 'occupied', 'maintenance'].map((status) => (
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

      {/* Units Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p>Loading units...</p>
          </div>
        ) : filteredUnits.length === 0 ? (
          <div className="p-12 text-center">
            <DoorClosed className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No units found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              There are no units matching this filter for {currentPropertyName}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 sm:px-6">Unit #</th>
                  <th className="py-3.5 px-4">Floor</th>
                  <th className="py-3.5 px-4">Layout & Area</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned Tenant</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUnits.map((u) => {
                  const statusColors: Record<string, string> = {
                    vacant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    occupied: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
                  };

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4 sm:px-6 font-bold text-slate-900">
                        {u.unit_number}
                      </td>
                      <td className="py-4 px-4 text-slate-600">Floor {u.floor}</td>
                      <td className="py-4 px-4 text-slate-600">
                        {u.bedrooms} Bed, {u.bathrooms} Bath • {u.square_feet} sq ft
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider ${
                            statusColors[u.status] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {u.tenant_name ? (
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-indigo-500" />
                            <div>
                              <p className="font-medium text-slate-800">{u.tenant_name}</p>
                              <p className="text-xs text-slate-400">{u.tenant_email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Unit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete unit ${u.unit_number}?`)) {
                              deleteMutation.mutate(u.id);
                            }
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Unit"
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

      {/* Create / Edit Unit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingUnit ? `Edit Unit ${editingUnit.unit_number}` : 'Add Unit'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit # *</label>
                  <input
                    type="text"
                    {...register('unit_number')}
                    placeholder="e.g. 101 or PH-2"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.unit_number && (
                    <p className="text-xs text-rose-600 mt-1">{errors.unit_number.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Floor Level *</label>
                  <input
                    type="number"
                    {...register('floor')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.floor && (
                    <p className="text-xs text-rose-600 mt-1">{errors.floor.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bedrooms</label>
                  <input
                    type="number"
                    {...register('bedrooms')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bathrooms</label>
                  <input
                    type="number"
                    step="0.5"
                    {...register('bathrooms')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sq Ft</label>
                  <input
                    type="number"
                    {...register('square_feet')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status *</label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="vacant">Vacant</option>
                  <option value="occupied">Occupied</option>
                  <option value="maintenance">Maintenance</option>
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
                  <span>{editingUnit ? 'Save Changes' : 'Create Unit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
