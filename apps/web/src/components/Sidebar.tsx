import React, { useMemo } from 'react';
import {
  Building2,
  CalendarCheck,
  Car,
  DoorClosed,
  FileCheck2,
  Home,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Wrench,
} from 'lucide-react';
import type { PropertyWithStats, Role } from '@tenants/shared-types';
import { SearchableSelect, type SearchableOption } from './SearchableSelect';

export type AdminTab =
  | 'properties'
  | 'units'
  | 'tenants'
  | 'applications'
  | 'staff'
  | 'messages'
  | 'amenities'
  | 'amenity-approvals'
  | 'parking'
  | 'maintenance'
  | 'users'
  | 'tenant-view';

export const ROLE_ALLOWED_TABS: Record<Role, AdminTab[]> = {
  super_admin: [
    'properties',
    'units',
    'tenants',
    'applications',
    'staff',
    'messages',
    'amenities',
    'amenity-approvals',
    'parking',
    'maintenance',
    'users',
    'tenant-view',
  ],
  property_manager: [
    'applications',
    'amenity-approvals',
    'staff',
    'messages',
    'parking',
    'maintenance',
    'properties',
    'units',
    'tenants',
    'amenities',
  ],
  maintenance_staff: ['maintenance', 'messages'],
  staff: ['messages'],
  tenant: ['tenant-view'],
};

interface SidebarProps {
  currentTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  onSelectProperty: (id: string | null) => void;
  userRole?: Role;
}

const ALL_NAV_ITEMS: Array<{
  id: AdminTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'properties', label: 'Properties', icon: Building2 },
  { id: 'units', label: 'Units', icon: DoorClosed },
  { id: 'tenants', label: 'Tenants', icon: Users },
  { id: 'applications', label: 'Applications', icon: FileCheck2 },
  { id: 'staff', label: 'Staff & Team', icon: ShieldCheck },
  { id: 'messages', label: 'Staff Messages', icon: MessageSquare },
  { id: 'amenities', label: 'Amenities', icon: Sparkles },
  { id: 'amenity-approvals', label: 'Amenity Approvals', icon: CalendarCheck },
  { id: 'parking', label: 'Parking Map', icon: Car },
  { id: 'maintenance', label: 'Maintenance Calls', icon: Wrench },
  { id: 'users', label: 'Users & Roles', icon: UserCog },
  { id: 'tenant-view', label: 'Tenant View', icon: Home },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  properties,
  selectedPropertyId,
  onSelectProperty,
  userRole = 'super_admin',
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

  const allowedSet = useMemo(() => new Set(ROLE_ALLOWED_TABS[userRole] || []), [userRole]);
  const navItems = useMemo(
    () => ALL_NAV_ITEMS.filter((item) => allowedSet.has(item.id)),
    [allowedSet]
  );

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
