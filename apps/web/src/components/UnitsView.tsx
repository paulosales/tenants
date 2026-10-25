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
import { SearchableSelect } from './SearchableSelect';
import { SearchableMultiSelect } from './SearchableMultiSelect';
import { TablePagination } from './TablePagination';
import {
  SortableColumnHeader,
  TableColumnFilterInput,
  TableColumnFilterSelect,
} from './DataTableHeader';
import { useDataTable } from '../hooks/useDataTable';

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
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // Default to first property if none selected
  const activePropertyId = selectedPropertyId || (properties.length > 0 ? properties[0].id : '');

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units', activePropertyId],
    queryFn: () => (activePropertyId ? api.getUnits(activePropertyId) : Promise.resolve([])),
    enabled: Boolean(activePropertyId),
  });

  // Query tenants for assignment to units
  const { data: allTenants = [] } = useQuery({
    queryKey: ['tenants', 'for-units-view'],
    queryFn: () => api.getTenants({}),
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
  } = useDataTable<UnitWithTenant>({
    data: units,
    initialPageSize: 25,
    initialSortKey: 'unit_number',
    initialSortDirection: 'asc',
    filterPredicate: (unit, filters) => {
      if (statusFilter !== 'all' && unit.status !== statusFilter) return false;
      if (filters.unit_number) {
        if (!unit.unit_number.toLowerCase().includes(filters.unit_number.toLowerCase())) return false;
      }
      if (filters.floor) {
        const floorStr = String(unit.floor);
        if (!floorStr.includes(filters.floor.trim())) return false;
      }
      if (filters.layout) {
        const q = filters.layout.toLowerCase();
        const layoutStr = `${unit.bedrooms} bed ${unit.bathrooms} bath ${unit.square_feet} sq ft`.toLowerCase();
        if (!layoutStr.includes(q)) return false;
      }
      if (filters.status && filters.status !== 'all') {
        if (unit.status !== filters.status) return false;
      }
      if (filters.tenants) {
        const q = filters.tenants.toLowerCase();
        const tenantsMatch = (unit.tenants || []).some(
          (t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
        );
        const legacyMatch =
          unit.tenant_name?.toLowerCase().includes(q) ||
          unit.tenant_email?.toLowerCase().includes(q);
        if (!tenantsMatch && !legacyMatch) return false;
      }
      return true;
    },
    sortComparator: (a, b, key, dir) => {
      let cmp = 0;
      if (key === 'unit_number') {
        cmp = a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true });
      } else if (key === 'floor') {
        cmp = a.floor - b.floor;
      } else if (key === 'layout') {
        cmp = a.bedrooms * 1000 + a.square_feet - (b.bedrooms * 1000 + b.square_feet);
      } else if (key === 'status') {
        cmp = a.status.localeCompare(b.status);
      } else if (key === 'tenants') {
        const countA = a.tenants?.length || (a.tenant_name ? 1 : 0);
        const countB = b.tenants?.length || (b.tenant_name ? 1 : 0);
        if (countA !== countB) {
          cmp = countA - countB;
        } else {
          const nameA = a.tenants?.[0]?.name || a.tenant_name || '';
          const nameB = b.tenants?.[0]?.name || b.tenant_name || '';
          cmp = nameA.localeCompare(nameB);
        }
      }
      return dir === 'asc' ? cmp : -cmp;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
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
        tenant_ids: selectedTenantIds,
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
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
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
    setSelectedTenantIds([]);
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
    const initialTenantIds =
      unit.tenants && unit.tenants.length > 0
        ? unit.tenants.map((t) => t.id)
        : unit.tenant_id
        ? [unit.tenant_id]
        : [];
    setSelectedTenantIds(initialTenantIds);
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
    setSelectedTenantIds([]);
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
          <div className="w-64">
            <SearchableSelect
              options={properties.map((p) => ({
                value: p.id,
                label: p.name,
                sublabel: `${p.city}, ${p.state_province}`,
                badge: `${p.unit_count} units`,
              }))}
              value={activePropertyId}
              onChange={onSelectProperty}
              placeholder="Select a property..."
              searchPlaceholder="Search properties..."
            />
          </div>

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

      {/* Filter Tabs & Column Filter Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400 mr-1" />
          {['all', 'vacant', 'occupied', 'maintenance'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
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
              Clear filters
            </button>
          )}
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
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4 sm:px-6">
                      <SortableColumnHeader
                        columnKey="unit_number"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        label="Unit #"
                      />
                    </th>
                    <th className="py-3.5 px-4">
                      <SortableColumnHeader
                        columnKey="floor"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        label="Floor"
                      />
                    </th>
                    <th className="py-3.5 px-4">
                      <SortableColumnHeader
                        columnKey="layout"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        label="Layout & Area"
                      />
                    </th>
                    <th className="py-3.5 px-4">
                      <SortableColumnHeader
                        columnKey="status"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        label="Status"
                      />
                    </th>
                    <th className="py-3.5 px-4">
                      <SortableColumnHeader
                        columnKey="tenants"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        label="Assigned Tenants"
                      />
                    </th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>

                  {showFilterRow && (
                    <tr className="border-b border-slate-200 bg-slate-100/70 text-xs">
                      <th className="py-2 px-4 sm:px-6">
                        <TableColumnFilterInput
                          value={columnFilters.unit_number || ''}
                          onChange={(val) => setColumnFilter('unit_number', val)}
                          placeholder="Filter unit #..."
                        />
                      </th>
                      <th className="py-2 px-4">
                        <TableColumnFilterInput
                          value={columnFilters.floor || ''}
                          onChange={(val) => setColumnFilter('floor', val)}
                          placeholder="Filter floor..."
                        />
                      </th>
                      <th className="py-2 px-4">
                        <TableColumnFilterInput
                          value={columnFilters.layout || ''}
                          onChange={(val) => setColumnFilter('layout', val)}
                          placeholder="Filter beds/sq ft..."
                        />
                      </th>
                      <th className="py-2 px-4">
                        <TableColumnFilterSelect
                          value={columnFilters.status || 'all'}
                          onChange={(val) => setColumnFilter('status', val)}
                          options={[
                            { value: 'all', label: 'All Statuses' },
                            { value: 'vacant', label: 'Vacant' },
                            { value: 'occupied', label: 'Occupied' },
                            { value: 'maintenance', label: 'Maintenance' },
                          ]}
                        />
                      </th>
                      <th className="py-2 px-4">
                        <TableColumnFilterInput
                          value={columnFilters.tenants || ''}
                          onChange={(val) => setColumnFilter('tenants', val)}
                          placeholder="Search tenant name/email..."
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
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <p className="font-semibold text-slate-800">No units match your filter criteria.</p>
                        <p className="text-xs text-slate-400 mt-1">Try clearing or updating your filters.</p>
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
                    paginatedData.map((u) => {
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
                            {u.tenants && u.tenants.length > 0 ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center space-x-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    <Users className="w-3 h-3" />
                                    <span>
                                      {u.tenants.length} {u.tenants.length === 1 ? 'Tenant' : 'Tenants'}
                                    </span>
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {u.tenants.map((t) => (
                                    <span
                                      key={t.id}
                                      title={t.email}
                                      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                                    >
                                      {t.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : u.tenant_name ? (
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

      {/* Create / Edit Unit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bathrooms</label>
                  <input
                    type="number"
                    step="0.5"
                    {...register('bathrooms')}
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sq Ft</label>
                  <input
                    type="number"
                    {...register('square_feet')}
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Assigned Tenants (Multiple)
                  </label>
                  {selectedTenantIds.length > 0 && (
                    <span className="text-xs text-indigo-600 font-medium">
                      {selectedTenantIds.length} selected
                    </span>
                  )}
                </div>
                <SearchableMultiSelect
                  id="unit-tenant-select"
                  options={allTenants.map((t) => {
                    const isCurrent = editingUnit?.id && t.assigned_unit_id === editingUnit.id;
                    const isUnassigned = !t.assigned_unit_id;
                    return {
                      value: t.id,
                      label: `${t.first_name} ${t.last_name}`,
                      sublabel: `${t.email} • ${t.phone || 'No phone'}`,
                      badge: isCurrent
                        ? 'Assigned'
                        : isUnassigned
                        ? 'Available'
                        : t.unit_number
                        ? `Unit ${t.unit_number}`
                        : 'Assigned',
                      badgeColor: isCurrent ? 'indigo' : isUnassigned ? 'emerald' : 'slate',
                    };
                  })}
                  value={selectedTenantIds}
                  onChange={(newIds) => {
                    setSelectedTenantIds(newIds);
                    if (newIds.length > 0 && watch('status') === 'vacant') {
                      setValue('status', 'occupied', { shouldValidate: true });
                    }
                  }}
                  placeholder="Select one or multiple tenants..."
                  searchPlaceholder="Filter by name, email, or status..."
                  emptyMessage="No matching tenants found"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  You can assign multiple tenants to this unit (e.g. roommates or family members).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status *</label>
                <SearchableSelect
                  options={[
                    { value: 'vacant', label: 'Vacant', badge: 'Available', badgeColor: 'emerald' },
                    { value: 'occupied', label: 'Occupied', badge: 'Leased', badgeColor: 'amber' },
                    { value: 'maintenance', label: 'Maintenance', badge: 'Service', badgeColor: 'rose' },
                  ]}
                  value={watch('status')}
                  onChange={(val) => setValue('status', val as UnitStatus, { shouldValidate: true })}
                  placeholder="Select status..."
                />
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
