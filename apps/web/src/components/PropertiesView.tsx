import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { createZodResolver } from '../utils/zodResolver';
import { z } from 'zod';
import {
  Building2,
  Plus,
  MapPin,
  DoorClosed,
  Users,
  Edit2,
  Trash2,
  Car,
  AlertCircle,
  X,
  Loader2,
  Filter,
} from 'lucide-react';
import { usePropertiesGateway } from '../context/ApiContext';
import { ConfirmModal } from './common/ConfirmModal';
import type { PropertyWithStats, CreatePropertyDto } from '@tenants/shared-types';
import { TablePagination } from './TablePagination';
import { SortableColumnHeader, TableColumnFilterInput } from './DataTableHeader';
import { useDataTable } from '../hooks/useDataTable';

const propertySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  address_line1: z.string().min(3, 'Address line 1 is required'),
  address_line2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state_province: z.string().min(2, 'State or province is required'),
  postal_code: z.string().min(3, 'Postal code is required'),
});

type PropertyFormData = z.infer<typeof propertySchema>;

interface PropertiesViewProps {
  onSelectPropertyForUnits: (propertyId: string) => void;
  onSelectPropertyForParking: (propertyId: string) => void;
}

export const PropertiesView: React.FC<PropertiesViewProps> = ({
  onSelectPropertyForUnits,
  onSelectPropertyForParking,
}) => {
  const queryClient = useQueryClient();
  const propertiesGateway = usePropertiesGateway();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyWithStats | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteProperty, setConfirmDeleteProperty] = useState<PropertyWithStats | null>(null);

  const { data: properties = [], isLoading, error } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesGateway.getProperties(),
  });

  const {
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    sortKey,
    sortDirection,
    handleSort,
    columnFilters,
    setColumnFilter,
    clearAllFilters,
    hasActiveFilters,
    showFilterRow,
    setShowFilterRow,
    totalRecords,
    paginatedData,
  } = useDataTable<PropertyWithStats>({
    data: properties,
    initialPageSize: 25,
    initialSortKey: 'name',
    initialSortDirection: 'asc',
    filterPredicate: (prop, filters) => {
      if (filters.name) {
        const q = filters.name.toLowerCase();
        const fullLocation = `${prop.name} ${prop.address_line1} ${prop.address_line2 || ''} ${prop.city} ${prop.state_province} ${prop.postal_code}`.toLowerCase();
        if (!fullLocation.includes(q)) return false;
      }
      if (filters.unit_count) {
        const minUnits = Number(filters.unit_count);
        if (!isNaN(minUnits) && Number(prop.unit_count || 0) < minUnits) return false;
      }
      if (filters.occupancy) {
        const minOcc = Number(filters.occupancy);
        const units = Number(prop.unit_count || 0);
        const occupied = Number(prop.occupied_units_count || 0);
        const rate = units > 0 ? Math.round((occupied / units) * 100) : 0;
        if (!isNaN(minOcc) && rate < minOcc) return false;
      }
      if (filters.tenant_count) {
        const minTenants = Number(filters.tenant_count);
        if (!isNaN(minTenants) && Number(prop.tenant_count || 0) < minTenants) return false;
      }
      return true;
    },
    sortComparator: (a, b, key, dir) => {
      let cmp = 0;
      if (key === 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
      } else if (key === 'unit_count') {
        cmp = Number(a.unit_count || 0) - Number(b.unit_count || 0);
      } else if (key === 'occupancy') {
        const rateA = Number(a.unit_count || 0) > 0 ? Number(a.occupied_units_count || 0) / Number(a.unit_count) : 0;
        const rateB = Number(b.unit_count || 0) > 0 ? Number(b.occupied_units_count || 0) / Number(b.unit_count) : 0;
        cmp = rateA - rateB;
      } else if (key === 'tenant_count') {
        cmp = Number(a.tenant_count || 0) - Number(b.tenant_count || 0);
      }
      return dir === 'asc' ? cmp : -cmp;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PropertyFormData>({
    resolver: createZodResolver(propertySchema),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: PropertyFormData) => {
      const payload: CreatePropertyDto = {
        name: data.name,
        address_line1: data.address_line1,
        address_line2: data.address_line2 || undefined,
        city: data.city,
        state_province: data.state_province,
        postal_code: data.postal_code,
      };

      if (editingProperty) {
        return propertiesGateway.updateProperty(editingProperty.id, payload);
      } else {
        return propertiesGateway.createProperty(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      closeModal();
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to save property');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => propertiesGateway.deleteProperty(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Cannot delete property. It may contain units.');
    },
  });

  const openCreateModal = () => {
    setEditingProperty(null);
    reset({
      name: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state_province: '',
      postal_code: '',
    });
    setActionError(null);
    setModalOpen(true);
  };

  const openEditModal = (prop: PropertyWithStats) => {
    setEditingProperty(prop);
    reset({
      name: prop.name,
      address_line1: prop.address_line1,
      address_line2: prop.address_line2 || '',
      city: prop.city,
      state_province: prop.state_province,
      postal_code: prop.postal_code,
    });
    setActionError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProperty(null);
    setActionError(null);
    reset();
  };

  const onSubmit = (data: PropertyFormData) => {
    saveMutation.mutate(data);
  };

  // Portfolio-wide calculation
  const totalUnits = properties.reduce((acc, p) => acc + Number(p.unit_count || 0), 0);
  const totalOccupied = properties.reduce((acc, p) => acc + Number(p.occupied_units_count || 0), 0);
  const totalTenants = properties.reduce((acc, p) => acc + Number(p.tenant_count || 0), 0);
  const portfolioOccupancy = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Properties Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your real estate assets, address locations, unit capacities, and parking allocations.
          </p>
        </div>
        <button
          id="btn-add-property"
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Property</span>
        </button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Properties</p>
            <p className="text-xl font-bold text-slate-900">{properties.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
            <DoorClosed className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Units</p>
            <p className="text-xl font-bold text-slate-900">{totalUnits}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Active Tenants</p>
            <p className="text-xl font-bold text-slate-900">{totalTenants}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <span className="font-bold text-base">%</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Occupancy</p>
            <p className="text-xl font-bold text-slate-900">{portfolioOccupancy}%</p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
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

      {/* Properties Table / Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p>Loading properties...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">Failed to load properties.</div>
        ) : properties.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No properties yet</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Get started by creating your first property to manage units, tenants, and parking layouts.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              <span>Create Property</span>
            </button>
          </div>
        ) : (
          <div>
            {/* Table Controls Bar */}
            <div className="px-4 sm:px-6 py-2.5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowFilterRow(!showFilterRow)}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    showFilterRow
                      ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{showFilterRow ? 'Hide Column Filters' : 'Filter Columns'}</span>
                  {hasActiveFilters && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-indigo-500 text-white rounded-full">
                      Filtered
                    </span>
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                  >
                    Clear all filters
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-400">
                {totalRecords} {totalRecords === 1 ? 'property' : 'properties'} found
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4 sm:px-6">
                      <SortableColumnHeader
                        columnKey="name"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        label="Property Name & Location"
                      />
                    </th>
                    <th className="py-3.5 px-4">
                      <SortableColumnHeader
                        columnKey="unit_count"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        label="Units & Capacity"
                      />
                    </th>
                    <th className="py-3.5 px-4">
                      <SortableColumnHeader
                        columnKey="occupancy"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        label="Occupancy"
                      />
                    </th>
                    <th className="py-3.5 px-4">
                      <SortableColumnHeader
                        columnKey="tenant_count"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        label="Tenants"
                      />
                    </th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>

                  {showFilterRow && (
                    <tr className="border-b border-slate-200 bg-slate-100/70 text-xs">
                      <th className="py-2 px-4 sm:px-6">
                        <TableColumnFilterInput
                          value={columnFilters.name || ''}
                          onChange={(val) => setColumnFilter('name', val)}
                          placeholder="Search name, city, address..."
                        />
                      </th>
                      <th className="py-2 px-4">
                        <TableColumnFilterInput
                          value={columnFilters.unit_count || ''}
                          onChange={(val) => setColumnFilter('unit_count', val)}
                          placeholder="Min units..."
                        />
                      </th>
                      <th className="py-2 px-4">
                        <TableColumnFilterInput
                          value={columnFilters.occupancy || ''}
                          onChange={(val) => setColumnFilter('occupancy', val)}
                          placeholder="Min %..."
                        />
                      </th>
                      <th className="py-2 px-4">
                        <TableColumnFilterInput
                          value={columnFilters.tenant_count || ''}
                          onChange={(val) => setColumnFilter('tenant_count', val)}
                          placeholder="Min tenants..."
                        />
                      </th>
                      <th className="py-2 px-4 sm:px-6 text-right">
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearAllFilters}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                        )}
                      </th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        <p className="font-semibold text-slate-800">No properties match your filter criteria.</p>
                        <p className="text-xs text-slate-400 mt-1">Try adjusting or clearing your column filters.</p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearAllFilters}
                            className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Clear all filters</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((prop) => {
                      const units = Number(prop.unit_count || 0);
                      const occupied = Number(prop.occupied_units_count || 0);
                      const occupancyRate = units > 0 ? Math.round((occupied / units) * 100) : 0;

                      return (
                        <tr key={prop.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-4 sm:px-6">
                            <div className="font-semibold text-slate-900">{prop.name}</div>
                            <div className="flex items-center text-xs text-slate-500 mt-1">
                              <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                              <span>
                                {prop.address_line1}
                                {prop.address_line2 ? `, ${prop.address_line2}` : ''}, {prop.city},{' '}
                                {prop.state_province} {prop.postal_code}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="font-medium text-slate-800">{units}</span> units
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-full rounded-full transition-all"
                                  style={{ width: `${occupancyRate}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-slate-600">{occupancyRate}%</span>
                            </div>
                            <span className="text-[11px] text-slate-400">{occupied} occupied</span>
                          </td>
                          <td className="py-4 px-4 text-slate-700 font-medium">{prop.tenant_count}</td>
                          <td className="py-4 px-4 sm:px-6 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => onSelectPropertyForUnits(prop.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                              title="Manage Units"
                            >
                              Units
                            </button>
                            <button
                              onClick={() => onSelectPropertyForParking(prop.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-1"
                              title="Parking Visual Builder"
                            >
                              <Car className="w-3.5 h-3.5" />
                              <span>Parking</span>
                            </button>
                            <button
                              onClick={() => openEditModal(prop)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteProperty(prop)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Property"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalRecords={totalRecords}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {/* Create / Edit Property Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingProperty ? 'Edit Property' : 'Create New Property'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Property Name *</label>
                <input
                  type="text"
                  {...register('name')}
                  placeholder="e.g. Grandview Heights"
                  className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address Line 1 *</label>
                <input
                  type="text"
                  {...register('address_line1')}
                  placeholder="e.g. 1200 Grandview Avenue"
                  className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {errors.address_line1 && (
                  <p className="text-xs text-rose-600 mt-1">{errors.address_line1.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  {...register('address_line2')}
                  placeholder="e.g. Suite 400 or Tower B"
                  className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                  <input
                    type="text"
                    {...register('city')}
                    placeholder="Seattle"
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.city && <p className="text-xs text-rose-600 mt-1">{errors.city.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State / Prov *</label>
                  <input
                    type="text"
                    {...register('state_province')}
                    placeholder="WA"
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.state_province && (
                    <p className="text-xs text-rose-600 mt-1">{errors.state_province.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Postal Code *</label>
                  <input
                    type="text"
                    {...register('postal_code')}
                    placeholder="98101"
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors.postal_code && (
                    <p className="text-xs text-rose-600 mt-1">{errors.postal_code.message}</p>
                  )}
                </div>
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
                  <span>{editingProperty ? 'Save Changes' : 'Create Property'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(confirmDeleteProperty)}
        title="Delete Property"
        message={
          confirmDeleteProperty
            ? `Are you sure you want to delete ${confirmDeleteProperty.name}?`
            : ''
        }
        confirmLabel="Delete Property"
        isLoading={deleteMutation.isPending}
        onCancel={() => setConfirmDeleteProperty(null)}
        onConfirm={() => {
          if (confirmDeleteProperty) {
            deleteMutation.mutate(confirmDeleteProperty.id);
            setConfirmDeleteProperty(null);
          }
        }}
      />
    </div>
  );
};
