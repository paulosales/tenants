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
  Search,
  Filter,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';
import { useAmenitiesGateway } from '../context/ApiContext';
import type {
  PropertyWithStats,
  AdminAmenity,
  CreateAmenityDto,
} from '@tenants/shared-types';
import { SearchableSelect } from './SearchableSelect';
import { TablePagination } from './TablePagination';
import {
  SortableColumnHeader,
  TableColumnFilterInput,
  TableColumnFilterSelect,
} from './DataTableHeader';
import { useDataTable } from '../hooks/useDataTable';

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
  const amenitiesGateway = useAmenitiesGateway();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState<AdminAmenity | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const activePropertyId = selectedPropertyId || (properties.length > 0 ? properties[0].id : '');

  const { data: amenities = [], isLoading } = useQuery({
    queryKey: ['amenities', activePropertyId],
    queryFn: () => (activePropertyId ? amenitiesGateway.getPropertyAmenities(activePropertyId) : Promise.resolve([])),
    enabled: Boolean(activePropertyId),
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
  } = useDataTable<AdminAmenity>({
    data: amenities,
    initialPageSize: 25,
    initialSortKey: 'name',
    initialSortDirection: 'asc',
    filterPredicate: (a, filters) => {
      // Global search
      if (globalSearch) {
        const q = globalSearch.toLowerCase();
        const searchPool = `${a.name} ${a.description || ''} ${a.rules || ''}`.toLowerCase();
        if (!searchPool.includes(q)) return false;
      }

      // Column filters
      if (filters.name) {
        const q = filters.name.toLowerCase();
        const pool = `${a.name} ${a.description || ''}`.toLowerCase();
        if (!pool.includes(q)) return false;
      }
      if (filters.capacity) {
        const q = filters.capacity.trim();
        if (!a.capacity.toString().includes(q)) return false;
      }
      if (filters.fee) {
        const q = filters.fee.toLowerCase().replace('$', '').trim();
        const feeDollars = (a.fee_cents / 100).toFixed(2);
        const feeStr = a.fee_cents === 0 ? '0 free complimentary' : `${feeDollars} ${a.fee_cents}`;
        if (!feeStr.includes(q)) return false;
      }
      if (filters.deposit) {
        const q = filters.deposit.toLowerCase().replace('$', '').trim();
        const depDollars = (a.deposit_cents / 100).toFixed(2);
        const depStr = a.deposit_cents === 0 ? '0 none free' : `${depDollars} ${a.deposit_cents}`;
        if (!depStr.includes(q)) return false;
      }
      if (filters.rules) {
        const q = filters.rules.toLowerCase();
        if (!(a.rules || '').toLowerCase().includes(q)) return false;
      }
      if (filters.status && filters.status !== 'all') {
        const wantActive = filters.status === 'active';
        if (a.is_active !== wantActive) return false;
      }

      return true;
    },
    sortComparator: (a, b, key, dir) => {
      let cmp = 0;
      if (key === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (key === 'capacity') {
        cmp = a.capacity - b.capacity;
      } else if (key === 'fee') {
        cmp = a.fee_cents - b.fee_cents;
      } else if (key === 'deposit') {
        cmp = a.deposit_cents - b.deposit_cents;
      } else if (key === 'rules') {
        cmp = (a.rules || '').localeCompare(b.rules || '');
      } else if (key === 'status') {
        cmp = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0);
      }
      return dir === 'desc' ? -cmp : cmp;
    },
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
        return amenitiesGateway.updatePropertyAmenity(editingAmenity.id, {
          ...payload,
          is_active: data.is_active,
        });
      } else {
        return amenitiesGateway.createPropertyAmenity(activePropertyId, payload);
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
    mutationFn: (id: string) => amenitiesGateway.deletePropertyAmenity(id),
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

        <div className="flex flex-wrap items-center gap-3">
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

      {/* Toolbar: Search, Filters, and View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search amenity name, description, rules..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          {/* Table vs Grid View Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
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

      {/* Main Content Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p>Loading amenities...</p>
          </div>
        ) : amenities.length === 0 ? (
          <div className="p-12 text-center">
            <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No amenities configured</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Add party lounges, pools, gyms, or conference rooms for {currentPropertyName}.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Amenity</span>
            </button>
          </div>
        ) : (
          <div>
            {viewMode === 'table' ? (
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
                          label="Amenity"
                        />
                      </th>
                      <th className="py-3.5 px-4">
                        <SortableColumnHeader
                          columnKey="capacity"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          label="Capacity"
                        />
                      </th>
                      <th className="py-3.5 px-4">
                        <SortableColumnHeader
                          columnKey="fee"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          label="Session Fee"
                        />
                      </th>
                      <th className="py-3.5 px-4">
                        <SortableColumnHeader
                          columnKey="deposit"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          label="Deposit"
                        />
                      </th>
                      <th className="py-3.5 px-4">
                        <SortableColumnHeader
                          columnKey="rules"
                          currentSortKey={sortKey}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                          label="Operational Rules"
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
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>

                    {showFilterRow && (
                      <tr className="border-b border-slate-200 bg-slate-100/70 text-xs">
                        <th className="py-2 px-4 sm:px-6">
                          <TableColumnFilterInput
                            value={columnFilters.name || ''}
                            onChange={(val) => setColumnFilter('name', val)}
                            placeholder="Filter amenity..."
                          />
                        </th>
                        <th className="py-2 px-4">
                          <TableColumnFilterInput
                            value={columnFilters.capacity || ''}
                            onChange={(val) => setColumnFilter('capacity', val)}
                            placeholder="Filter cap..."
                          />
                        </th>
                        <th className="py-2 px-4">
                          <TableColumnFilterInput
                            value={columnFilters.fee || ''}
                            onChange={(val) => setColumnFilter('fee', val)}
                            placeholder="Filter fee..."
                          />
                        </th>
                        <th className="py-2 px-4">
                          <TableColumnFilterInput
                            value={columnFilters.deposit || ''}
                            onChange={(val) => setColumnFilter('deposit', val)}
                            placeholder="Filter deposit..."
                          />
                        </th>
                        <th className="py-2 px-4">
                          <TableColumnFilterInput
                            value={columnFilters.rules || ''}
                            onChange={(val) => setColumnFilter('rules', val)}
                            placeholder="Filter rules..."
                          />
                        </th>
                        <th className="py-2 px-4">
                          <TableColumnFilterSelect
                            value={columnFilters.status || 'all'}
                            onChange={(val) => setColumnFilter('status', val)}
                            options={[
                              { value: 'all', label: 'All Statuses' },
                              { value: 'active', label: 'Active' },
                              { value: 'inactive', label: 'Inactive' },
                            ]}
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
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <p className="font-semibold text-slate-800">No amenities match your filter criteria.</p>
                          <p className="text-xs text-slate-400 mt-1">Try clearing or adjusting your column filters.</p>
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
                      paginatedData.map((a) => {
                        const feeDisplay = a.fee_cents > 0 ? `$${(a.fee_cents / 100).toFixed(2)}` : 'Free';
                        const depositDisplay = a.deposit_cents > 0 ? `$${(a.deposit_cents / 100).toFixed(2)}` : 'None';

                        return (
                          <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 px-4 sm:px-6">
                              <div className="font-bold text-slate-900">{a.name}</div>
                              {a.description && (
                                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{a.description}</p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-slate-700">
                              <div className="inline-flex items-center space-x-1 text-xs font-semibold bg-slate-100 px-2 py-0.5 rounded-md">
                                <Users className="w-3.5 h-3.5 text-slate-500" />
                                <span>{a.capacity} guests</span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                {feeDisplay}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-xs font-medium text-slate-600">
                                {depositDisplay}
                              </span>
                            </td>
                            <td className="py-4 px-4 max-w-xs">
                              {a.rules ? (
                                <p className="text-xs text-slate-600 line-clamp-2" title={a.rules}>
                                  {a.rules}
                                </p>
                              ) : (
                                <span className="text-xs text-slate-400 italic">None</span>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                                  a.is_active
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                }`}
                              >
                                {a.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="py-4 px-4 sm:px-6 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => openEditModal(a)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit Amenity"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete amenity ${a.name}?`)) {
                                    deleteMutation.mutate(a.id);
                                  }
                                }}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Amenity"
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
            ) : (
              /* Grid Cards View */
              <div className="p-5">
                {paginatedData.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-800">No amenities match your filter criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing or adjusting your column filters.</p>
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
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {paginatedData.map((a) => {
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
              </div>
            )}

            {/* Pagination Controls with 25, 50, 100 selector */}
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
