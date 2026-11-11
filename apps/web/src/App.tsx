import React, { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Building2, Home, Loader2, LogOut, Shield } from 'lucide-react';
import type { PropertyWithStats, Role, UserSummary } from '@tenants/shared-types';
import { ApiProvider, usePropertiesGateway } from './context/ApiContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ROLE_BY_KEY } from './constants/roles';
import { AmenitiesView } from './components/AmenitiesView';
import { AmenityApprovalsView } from './components/AmenityApprovalsView';
import { ApplicationsReviewView } from './components/ApplicationsReviewView';
import { LoginPage } from './components/auth/LoginPage';
import { MaintainerCallsView } from './components/MaintainerCallsView';
import { ParkingLayoutEditor } from './components/ParkingLayoutEditor';
import { PropertiesView } from './components/PropertiesView';
import { PublicPortalView } from './components/public/PublicPortalView';
import { ROLE_ALLOWED_TABS, Sidebar, type AdminTab } from './components/Sidebar';
import { StaffMessagesView } from './components/StaffMessagesView';
import { StaffView } from './components/StaffView';
import { TenantsView } from './components/TenantsView';
import { TenantView } from './components/TenantView';
import { UnitsView } from './components/UnitsView';
import { UsersRolesView } from './components/UsersRolesView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface ViewRenderContext {
  properties: PropertyWithStats[];
  selectedPropertyId: string | null;
  currentUser: UserSummary | null;
  onSelectProperty: (id: string | null) => void;
  onNavigateTab: (tab: AdminTab) => void;
  onSelectPropertyForUnits: (propertyId: string) => void;
  onSelectPropertyForParking: (propertyId: string) => void;
}

/**
 * OCP-compliant View Registry mapping AdminTab keys to view factories.
 */
const VIEW_REGISTRY: Record<AdminTab, (ctx: ViewRenderContext) => React.ReactNode> = {
  properties: (ctx) => (
    <PropertiesView
      onSelectPropertyForUnits={ctx.onSelectPropertyForUnits}
      onSelectPropertyForParking={ctx.onSelectPropertyForParking}
    />
  ),
  units: (ctx) => (
    <UnitsView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      onSelectProperty={ctx.onSelectProperty}
    />
  ),
  tenants: (ctx) => (
    <TenantsView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      onSelectTenantForPortal={() => ctx.onNavigateTab('tenant-view')}
    />
  ),
  applications: (ctx) => (
    <ApplicationsReviewView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
    />
  ),
  staff: (ctx) => (
    <StaffView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      onSelectProperty={ctx.onSelectProperty}
    />
  ),
  messages: (ctx) => (
    <StaffMessagesView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      currentUser={ctx.currentUser}
    />
  ),
  amenities: (ctx) => (
    <AmenitiesView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      onSelectProperty={ctx.onSelectProperty}
    />
  ),
  'amenity-approvals': (ctx) => (
    <AmenityApprovalsView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
    />
  ),
  parking: (ctx) => (
    <ParkingLayoutEditor
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      onSelectProperty={ctx.onSelectProperty}
    />
  ),
  maintenance: (ctx) => (
    <MaintainerCallsView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      currentUser={ctx.currentUser}
    />
  ),
  users: (ctx) => (
    <UsersRolesView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      currentUser={ctx.currentUser}
    />
  ),
  'tenant-view': (ctx) => (
    <TenantView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      currentUser={ctx.currentUser}
      onBackToAdmin={
        ctx.currentUser?.role === 'super_admin'
          ? () => ctx.onNavigateTab('properties')
          : undefined
      }
    />
  ),
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'US';
}

export const AdminAppContent: React.FC<{
  user?: UserSummary | null;
  onLogout?: () => void;
}> = ({ user = null, onLogout }) => {
  const role: Role = user?.role || 'super_admin';
  const allowedTabs = useMemo(() => ROLE_ALLOWED_TABS[role] || ['properties'], [role]);

  const [currentTab, setCurrentTab] = useState<AdminTab>(allowedTabs[0]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    user?.property_id || null
  );
  const propertiesGateway = usePropertiesGateway();

  useEffect(() => {
    if (!allowedTabs.includes(currentTab)) {
      setCurrentTab(allowedTabs[0]);
    }
  }, [allowedTabs, currentTab]);

  useEffect(() => {
    if (user?.property_id && role !== 'super_admin') {
      setSelectedPropertyId(user.property_id);
    }
  }, [user?.property_id, role]);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesGateway.getProperties(),
  });

  const activeProperty = properties.find((p) => p.id === selectedPropertyId);

  // Tenants are strictly scoped to Tenant View only (no admin sidebar or navigation)
  if (role === 'tenant') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shadow-sm">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-extrabold text-slate-900 block leading-tight">
                ApexLiving Resident Portal
              </span>
              <span className="text-xs text-slate-500">
                {activeProperty ? activeProperty.name : 'My Residence'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-800">{user?.full_name}</p>
              <p className="text-[11px] text-indigo-600 font-semibold">Tenant · Unit {user?.unit_number || '101'}</p>
            </div>
            {onLogout && (
              <button
                type="button"
                id="logout-btn"
                onClick={onLogout}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          <TenantView
            properties={properties}
            selectedPropertyId={selectedPropertyId}
            currentUser={user}
          />
        </main>
      </div>
    );
  }

  const handleSelectPropertyForUnits = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    if (allowedTabs.includes('units')) setCurrentTab('units');
  };

  const handleSelectPropertyForParking = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    if (allowedTabs.includes('parking')) setCurrentTab('parking');
  };

  const safeTab: AdminTab = allowedTabs.includes(currentTab) ? currentTab : allowedTabs[0];

  const renderContext: ViewRenderContext = {
    properties,
    selectedPropertyId,
    currentUser: user,
    onSelectProperty: setSelectedPropertyId,
    onNavigateTab: setCurrentTab,
    onSelectPropertyForUnits: handleSelectPropertyForUnits,
    onSelectPropertyForParking: handleSelectPropertyForParking,
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Sidebar
        currentTab={safeTab}
        onTabChange={setCurrentTab}
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        onSelectProperty={setSelectedPropertyId}
        userRole={role}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-700">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Workspace Portfolio
              </span>
              <p className="text-sm font-bold text-slate-800 leading-tight">
                {activeProperty ? activeProperty.name : 'All Managed Properties'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {allowedTabs.includes('tenant-view') && (
              <button
                id="header-toggle-tenant-view"
                onClick={() =>
                  setCurrentTab(safeTab === 'tenant-view' ? 'properties' : 'tenant-view')
                }
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  safeTab === 'tenant-view'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Toggle between Admin Center and Tenant Portal"
              >
                <Home className="w-3.5 h-3.5" />
                <span>{safeTab === 'tenant-view' ? 'Admin Center' : 'Tenant View'}</span>
              </button>
            )}

            <div className="h-5 w-px bg-slate-200" />

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {getInitials(user?.full_name || 'Admin')}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-none">
                  {user?.full_name || 'Property Administrator'}
                </p>
                <div className="flex items-center space-x-1 text-[11px] text-emerald-600 mt-0.5">
                  <Shield className="w-3 h-3" />
                  <span>{ROLE_BY_KEY[role]?.label || role}</span>
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                id="logout-btn"
                onClick={onLogout}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {VIEW_REGISTRY[safeTab](renderContext)}
        </main>
      </div>
    </div>
  );
};

export const AppShell: React.FC<{ initialUnauthScreen?: 'portal' | 'login' }> = ({
  initialUnauthScreen = 'portal',
}) => {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  const [unauthScreen, setUnauthScreen] = useState<'portal' | 'login'>(initialUnauthScreen);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Verifying secure session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    if (unauthScreen === 'login') {
      return (
        <LoginPage
          onLogin={login}
          onNavigateToPortal={() => setUnauthScreen('portal')}
        />
      );
    }
    return <PublicPortalView onOpenLogin={() => setUnauthScreen('login')} />;
  }

  return <AdminAppContent user={user} onLogout={logout} />;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
