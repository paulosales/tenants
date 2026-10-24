import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { createZodResolver } from '../utils/zodResolver';
import { z } from 'zod';
import {
  Sparkles,
  Plus,
  Users,
  DollarSign,
  Shield,
  FileText,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  PropertyWithStats,
  AdminAmenity,
  CreateAmenityDto,
} from '@tenants/shared-types';

const amenitySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1'),
  fee_dollars: z.coerce.number().min(0, 'Fee cannot be negative'),
  deposit_dollars: z.coerce.number().min(0, 'Deposit cannot be negative'),
  rules: z.string().optional(),
  is_active: z.boolean(),
});

type AmenityFormData = z.infer<typeof amenitySchema>;

interface AmenitiesViewProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  onSelectProperty: (id: string | null) => void;
}

export const AmenitiesView: React.FC<AmenitiesViewProps> = ({
  properties,
  selectedPropertyId,
  onSelectProperty,
}) => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState<AdminAmenity | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const activePropertyId = selectedPropertyId || (properties.length > 0 ? properties[0].id : '');

  const { data: amenities = [], isLoading } = useQuery({
    queryKey: ['amenities', activePropertyId],
    queryFn: () => (activePropertyId ? api.getPropertyAmenities(activePropertyId) : Promise.resolve([])),
    enabled: Boolean(activePropertyId),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AmenityFormData>({
    resolver: createZodResolver(amenitySchema),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: AmenityFormData) => {
      const payload: CreateAmenityDto = {
        name: data.name,
        description: data.description || undefined,
        capacity: data.capacity,
        fee_cents: Math.round(data.fee_dollars * 100),
        deposit_cents: Math.round(data.deposit_dollars * 100),
        rules: data.rules || undefined,
        is_active: data.is_active,
      };

      if (editingAmenity) {
        return api.updatePropertyAmenity(editingAmenity.id, {
          ...payload,
          is_active: data.is_active,
        });
      } else {
        return api.createPropertyAmenity(activePropertyId, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenities', activePropertyId] });
      closeModal();
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to save amenity');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePropertyAmenity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenities', activePropertyId] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to delete amenity');
    },
  });

  const openCreateModal = () => {
    setEditingAmenity(null);
    reset({
      name: '',
      description: '',
      capacity: 10,
      fee_dollars: 0,
      deposit_dollars: 0,
      rules: '',
      is_active: true,
    });
    setActionError(null);
    setModalOpen(true);
  };

  const openEditModal = (a: AdminAmenity) => {
    setEditingAmenity(a);
    reset({
      name: a.name,
      description: a.description || '',
      capacity: a.capacity,
      fee_dollars: (a.fee_cents || 0) / 100,
      deposit_dollars: (a.deposit_cents || 0) / 100,
      rules: a.rules || '',
      is_active: a.is_active,
    });
    setActionError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingAmenity(null);
    setActionError(null);
    reset();
  };

  const onSubmit = (data: AmenityFormData) => {
    saveMutation.mutate(data);
  };

  const currentPropertyName =
    properties.find((p) => p.id === activePropertyId)?.name || 'Selected Property';

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Amenities & Common Areas</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configuring common facilities for <span className="font-semibold text-slate-800">{currentPropertyName}</span>
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
            id="btn-add-amenity"
            onClick={openCreateModal}
            disabled={!activePropertyId}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium text-sm shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Amenity</span>
          </button>
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

      {/* Amenities Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p>Loading amenities...</p>
        </div>
      ) : amenities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
          <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No amenities configured</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Add party lounges, pools, gyms, or conference rooms for {currentPropertyName}.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            <span>Add Amenity</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {amenities.map((a) => {
            const feeDisplay = a.fee_cents > 0 ? `$${(a.fee_cents / 100).toFixed(2)}/session` : 'Complimentary';
            const depositDisplay = a.deposit_cents > 0 ? `$${(a.deposit_cents / 100).toFixed(2)}` : 'None';

            return (
              <div
                key={a.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{a.name}</h3>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                          a.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => openEditModal(a)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete amenity ${a.name}?`)) {
                            deleteMutation.mutate(a.id);
                          }
                        }}
                        className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {a.description && (
                    <p className="text-xs text-slate-600 mt-2.5 line-clamp-2">{a.description}</p>
                  )}

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <div className="flex items-center justify-center text-slate-400 mb-1">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-xs font-bold text-slate-900">{a.capacity}</p>
                      <p className="text-[10px] text-slate-400 uppercase">Cap</p>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-xl">
                      <div className="flex items-center justify-center text-slate-400 mb-1">
                        <DollarSign className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-xs font-bold text-indigo-600 truncate">{feeDisplay}</p>
                      <p className="text-[10px] text-slate-400 uppercase">Fee</p>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-xl">
                      <div className="flex items-center justify-center text-slate-400 mb-1">
                        <Shield className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-xs font-bold text-slate-700 truncate">{depositDisplay}</p>
                      <p className="text-[10px] text-slate-400 uppercase">Deposit</p>
                    </div>
                  </div>

                  {a.rules && (
                    <div className="mt-3.5 p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-start space-x-2 text-[11px] text-slate-500">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{a.rules}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Amenity Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingAmenity ? 'Edit Amenity' : 'New Common Area Amenity'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amenity Name *</label>
                <input
                  type="text"
                  {...register('name')}
                  placeholder="e.g. Skyline Rooftop Lounge"
                  className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  {...register('description')}
                  placeholder="Panoramic view, sound system, and lounge seating."
                  className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Capacity</label>
                  <input
                    type="number"
                    {...register('capacity')}
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.capacity && (
                    <p className="text-xs text-rose-600 mt-1">{errors.capacity.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('fee_dollars')}
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deposit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register('deposit_dollars')}
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Rules</label>
                <textarea
                  rows={2}
                  {...register('rules')}
                  placeholder="Reservation required 24h in advance. Quiet hours after 10 PM."
                  className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active"
                  {...register('is_active')}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <label htmlFor="is_active" className="text-sm text-slate-700 select-none">
                  Amenity is active and open for booking
                </label>
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
                  <span>{editingAmenity ? 'Save Changes' : 'Create Amenity'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
