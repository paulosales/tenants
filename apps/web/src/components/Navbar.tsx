import React from 'react';
import { Building2, Calendar, Car, Shield, User, LogOut } from 'lucide-react';
import type { UserSummary } from '@tenants/shared-types';

interface NavbarProps {
  activeTab: 'parking' | 'calendar' | 'my-bookings';
  setActiveTab: (tab: 'parking' | 'calendar' | 'my-bookings') => void;
  isAdminMode: boolean;
  setIsAdminMode: (admin: boolean) => void;
  currentUser: UserSummary | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isAdminMode,
  setIsAdminMode,
  currentUser,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('parking')}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-heading font-bold text-lg text-white tracking-tight">Apex Living</span>
            <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/60">
              Tenants Suite
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2">
          <button
            onClick={() => setActiveTab('parking')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'parking'
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Car className="h-4 w-4" />
            <span className="hidden sm:inline">Parking Map</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'calendar'
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Amenities</span>
          </button>
        </nav>

        {/* User Context & Admin Mode Toggle */}
        <div className="flex items-center space-x-3">
          {currentUser?.role === 'super_admin' || currentUser?.role === 'property_manager' ? (
            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                isAdminMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800/70 text-slate-300 border-slate-700 hover:border-slate-600'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>{isAdminMode ? 'Admin Editor' : 'Tenant View'}</span>
            </button>
          ) : null}

          {currentUser ? (
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <div className="flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200">{currentUser.full_name}</span>
                <span className="text-[10px] text-slate-400 capitalize">{currentUser.role.replace('_', ' ')}</span>
              </div>
              <button
                onClick={onLogout}
                title="Logout"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                <User className="h-4 w-4" />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
