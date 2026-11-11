import React from 'react';
import {
  Building2,
  ChevronRight,
  DoorClosed,
  Home,
  Phone,
  PhoneCall,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { TenantWithUnit } from '@tenants/shared-types';
import { SearchableSelect } from '../SearchableSelect';

interface TenantPortalHeaderProps {
  activeTenant: TenantWithUnit;
  tenantsList: TenantWithUnit[];
  activeTenantId: string;
  onChangeActiveTenant: (tenantId: string) => void;
  onBackToAdmin?: () => void;
  activeFeature: 'amenities' | 'maintenance';
  onChangeFeature: (feature: 'amenities' | 'maintenance') => void;
  amenitySubTab: 'schedule' | 'my-sessions';
  onChangeAmenitySubTab: (tab: 'schedule' | 'my-sessions') => void;
  maintenanceSubTab: 'tracker' | 'new-call';
  onChangeMaintenanceSubTab: (tab: 'tracker' | 'new-call') => void;
  activeSessionsCount: number;
  totalSessionsCount: number;
  activeMaintenanceCount: number;
  totalMaintenanceCount: number;
}

export const TenantPortalHeader: React.FC<TenantPortalHeaderProps> = ({
  activeTenant,
  tenantsList,
  activeTenantId,
  onChangeActiveTenant,
  onBackToAdmin,
  activeFeature,
  onChangeFeature,
  amenitySubTab,
  onChangeAmenitySubTab,
  maintenanceSubTab,
  onChangeMaintenanceSubTab,
  activeSessionsCount,
  totalSessionsCount,
  activeMaintenanceCount,
  totalMaintenanceCount,
}) => {
  return (
    <>
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner shrink-0">
              <Home className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Verified Resident
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {activeTenant.property_name || 'Apex Living Property'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tracking-tight">
                Welcome back, {activeTenant.first_name} {activeTenant.last_name}
              </h2>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-300">
                <div className="flex items-center space-x-1.5">
                  <DoorClosed className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-white">Unit {activeTenant.unit_number || '101'}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Phone className="w-4 h-4 text-indigo-400" />
                  <span>{activeTenant.phone || 'No phone'}</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span>Lease Active</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href="tel:+18005552739"
              id="emergency-call-btn"
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs tracking-wide shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 transition-all transform active:scale-95"
              title="Call 24/7 Emergency Maintenance Hotline"
            >
              <PhoneCall className="w-4 h-4 animate-bounce" />
              <span>24/7 Emergency Call</span>
            </a>

            {tenantsList.length > 1 && (
              <div className="w-48 sm:w-56">
                <SearchableSelect
                  options={tenantsList.map((t) => ({
                    value: t.id,
                    label: `${t.first_name} ${t.last_name}`,
                    sublabel: `Unit ${t.unit_number || 'Unassigned'}`,
                  }))}
                  value={activeTenantId}
                  onChange={onChangeActiveTenant}
                  variant="dark"
                  size="sm"
                  placeholder="Switch Resident..."
                  searchPlaceholder="Search resident name..."
                />
              </div>
            )}

            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700 transition-colors flex items-center justify-center space-x-1.5"
              >
                <span>Admin View</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <button
            onClick={() => {
              onChangeFeature('amenities');
              onChangeAmenitySubTab('my-sessions');
            }}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 transition-all text-left group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl group-hover:scale-110 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Amenity Bookings
                </span>
                <span className="text-sm font-bold text-white">
                  {activeSessionsCount} Active Session{activeSessionsCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
          </button>

          <button
            onClick={() => {
              onChangeFeature('maintenance');
              onChangeMaintenanceSubTab('tracker');
            }}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 transition-all text-left group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Maintenance Calls
                </span>
                <span className="text-sm font-bold text-white">
                  {activeMaintenanceCount} Open Request{activeMaintenanceCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
          </button>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/30 border border-slate-700/40">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Emergency Dispatch
                </span>
                <span className="text-xs font-mono font-bold text-rose-300">+1 (800) 555-APEX</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              24/7 LIVE
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            id="tab-amenities-feature"
            onClick={() => onChangeFeature('amenities')}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
              activeFeature === 'amenities'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Amenities Session Scheduling</span>
            {activeSessionsCount > 0 && (
              <span
                className={`ml-1.5 px-2 py-0.5 text-xs rounded-full font-bold ${
                  activeFeature === 'amenities' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                {activeSessionsCount}
              </span>
            )}
          </button>

          <button
            id="tab-maintenance-feature"
            onClick={() => onChangeFeature('maintenance')}
            className={`flex-1 sm:flex-none flex items-center justify-center space-x-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
              activeFeature === 'maintenance'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Maintenance Call & Dispatch</span>
            {activeMaintenanceCount > 0 && (
              <span
                className={`ml-1.5 px-2 py-0.5 text-xs rounded-full font-bold ${
                  activeFeature === 'maintenance' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {activeMaintenanceCount}
              </span>
            )}
          </button>
        </div>

        {activeFeature === 'amenities' && (
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto justify-center">
            <button
              onClick={() => onChangeAmenitySubTab('schedule')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                amenitySubTab === 'schedule' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Book New Session
            </button>
            <button
              onClick={() => onChangeAmenitySubTab('my-sessions')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                amenitySubTab === 'my-sessions'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              My Booked Sessions ({totalSessionsCount})
            </button>
          </div>
        )}

        {activeFeature === 'maintenance' && (
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto justify-center">
            <button
              onClick={() => onChangeMaintenanceSubTab('tracker')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                maintenanceSubTab === 'tracker'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Calls & Requests ({totalMaintenanceCount})
            </button>
            <button
              onClick={() => onChangeMaintenanceSubTab('new-call')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                maintenanceSubTab === 'new-call'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              + Place Maintenance Call
            </button>
          </div>
        )}
      </div>
    </>
  );
};

