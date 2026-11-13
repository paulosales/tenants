import React, { useMemo } from 'react';
import { Filter, Search } from 'lucide-react';
import type { PropertyWithStats } from '@tenants/shared-types';
import { SearchableSelect, type SearchableOption } from '../SearchableSelect';

interface StaffRosterFiltersProps {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  onSelectProperty?: (id: string | null) => void;
  activeRoleFilter: string;
  onChangeRoleFilter: (role: string) => void;
  searchTerm: string;
  onChangeSearchTerm: (term: string) => void;
  statusFilter: string;
  onChangeStatusFilter: (status: string) => void;
  counts: {
    total: number;
    managers: number;
    maintainers: number;
    security: number;
    cleaners: number;
  };
}

export const StaffRosterFilters: React.FC<StaffRosterFiltersProps> = ({
  properties,
  selectedPropertyId,
  onSelectProperty,
  activeRoleFilter,
  onChangeRoleFilter,
  searchTerm,
  onChangeSearchTerm,
  statusFilter,
  onChangeStatusFilter,
  counts,
}) => {
  const propertyOptions: SearchableOption[] = useMemo(
    () => [
      { value: '', label: `All Portfolio (${properties.length})` },
      ...properties.map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: `${p.city}, ${p.state_province}`,
      })),
    ],
    [properties]
  );

  const roleTabs = [
    { id: 'all', label: `All Staff (${counts.total})` },
    { id: 'manager', label: `Managers (${counts.managers})` },
    { id: 'maintainer', label: `Technical Maintainers (${counts.maintainers})` },
    { id: 'security', label: `Security (${counts.security})` },
    { id: 'cleaner', label: `Cleaners (${counts.cleaners})` },
  ];

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-slate-400 font-semibold uppercase text-[11px] mr-1 flex items-center">
          <Filter className="w-3.5 h-3.5 mr-1" /> Role:
        </span>
        {roleTabs.map((tab) => {
          const isActive = activeRoleFilter === tab.id;
          return (
            <button
              key={tab.id}
              id={`filter-role-${tab.id}`}
              onClick={() => onChangeRoleFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="staff-search-input"
            type="text"
            placeholder="Search by name, title, email, phone, or specialization..."
            value={searchTerm}
            onChange={(e) => onChangeSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        <div className="sm:col-span-3">
          <SearchableSelect
            id="staff-property-filter"
            options={propertyOptions}
            value={selectedPropertyId || ''}
            onChange={(val) => onSelectProperty?.(val ? val : null)}
            size="sm"
            placeholder="Filter by Property"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            id="staff-status-filter"
            value={statusFilter}
            onChange={(e) => onChangeStatusFilter(e.target.value)}
            className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Onsite</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
    </div>
  );
};

