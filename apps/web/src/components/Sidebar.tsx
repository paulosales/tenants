import React, { useMemo } from 'react';
import { Building2, DoorClosed, Users, Sparkles, Car, ShieldCheck } from 'lucide-react';
import type { PropertyWithStats } from '@tenants/shared-types';
import { SearchableSelect, type SearchableOption } from './SearchableSelect';

export type AdminTab = 'properties' | 'units' | 'tenants' | 'amenities' | 'parking';

interface SidebarProps {
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  onSelectProperty: (id: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  properties,
  selectedPropertyId,
  onSelectProperty,
}) => {
  const propertyOptions: SearchableOption[] = useMemo(() => {
    return [
      { value: '', label: `All Portfolio (${properties.length})` },
      ...properties.map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: `${p.city}, ${p.state_province}`,
        badge: `${p.unit_count} units`,
      })),
    ];
  }, [properties]);
  const navItems = [
    { id: 'properties' as AdminTab, label: 'Properties', icon: Building2 },
    { id: 'units' as AdminTab, label: 'Units', icon: DoorClosed },
    { id: 'tenants' as AdminTab, label: 'Tenants', icon: Users },
    { id: 'amenities' as AdminTab, label: 'Amenities', icon: Sparkles },
    { id: 'parking' as AdminTab, label: 'Parking Map', icon: Car },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-base text-white tracking-tight">TenantsPlatform</h1>
          <div className="flex items-center space-x-1 text-xs text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Admin Center</span>
          </div>
        </div>
      </div>

      {/* Property Context Selector */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          Active Property
        </label>
        <SearchableSelect
          id="global-property-selector"
          options={propertyOptions}
          value={selectedPropertyId || ''}
          onChange={(val) => onSelectProperty(val ? val : null)}
          variant="dark"
          size="sm"
          searchPlaceholder="Search properties..."
          placeholder={`All Portfolio (${properties.length})`}
        />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1.5">
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Management
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/30">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Axum Engine v0.1.0</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">PostgreSQL & Redis Healthy</p>
      </div>
    </aside>
  );
};
