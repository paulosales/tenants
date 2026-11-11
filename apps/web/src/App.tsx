import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Bell, Building2, Home, Shield } from 'lucide-react';
import type { PropertyWithStats } from '@tenants/shared-types';
import { ApiProvider, usePropertiesGateway } from './context/ApiContext';
import { AmenitiesView } from './components/AmenitiesView';
import { ParkingLayoutEditor } from './components/ParkingLayoutEditor';
import { PropertiesView } from './components/PropertiesView';
import { Sidebar, type AdminTab } from './components/Sidebar';
import { StaffView } from './components/StaffView';
import { TenantsView } from './components/TenantsView';
import { TenantView } from './components/TenantView';
import { UnitsView } from './components/UnitsView';

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
  onSelectProperty: (id: string | null) => void;
  onNavigateTab: (tab: AdminTab) => void;
  onSelectPropertyForUnits: (propertyId: string) => void;
  onSelectPropertyForParking: (propertyId: string) => void;
}

/**
 * OCP-compliant View Registry mapping AdminTab keys to view factories.
 * Adding new tabs requires registering an entry here without modifying AdminAppContent conditionals.
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
  staff: (ctx) => (
    <StaffView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      onSelectProperty={ctx.onSelectProperty}
    />
  ),
  amenities: (ctx) => (
    <AmenitiesView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      onSelectProperty={ctx.onSelectProperty}
    />
  ),
  parking: (ctx) => (
    <ParkingLayoutEditor
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      onSelectProperty={ctx.onSelectProperty}
    />
  ),
  'tenant-view': (ctx) => (
    <TenantView
      properties={ctx.properties}
      selectedPropertyId={ctx.selectedPropertyId}
      onBackToAdmin={() => ctx.onNavigateTab('properties')}
    />
  ),
};

export const AdminAppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('properties');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const propertiesGateway = usePropertiesGateway();

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesGateway.getProperties(),
  });

  const activeProperty = properties.find((p) => p.id === selectedPropertyId);

  const handleSelectPropertyForUnits = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setCurrentTab('units');
  };

  const handleSelectPropertyForParking = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setCurrentTab('parking');
  };

  const renderContext: ViewRenderContext = {
    properties,
    selectedPropertyId,
    onSelectProperty: setSelectedPropertyId,
    onNavigateTab: setCurrentTab,
    onSelectPropertyForUnits: handleSelectPropertyForUnits,
    onSelectPropertyForParking: handleSelectPropertyForParking,
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        onSelectProperty={setSelectedPropertyId}
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

          <div className="flex items-center space-x-4">
            <button
              id="header-toggle-tenant-view"
              onClick={() => setCurrentTab(currentTab === 'tenant-view' ? 'properties' : 'tenant-view')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                currentTab === 'tenant-view'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title="Toggle between Admin Center and Tenant Portal"
            >
              <Home className="w-3.5 h-3.5" />
              <span>{currentTab === 'tenant-view' ? 'Admin Center' : 'Tenant View'}</span>
            </button>

            <button
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-indigo-600 absolute top-2 right-2 ring-2 ring-white"></span>
            </button>

            <div className="h-5 w-px bg-slate-200" />

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                AD
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-none">Property Administrator</p>
                <div className="flex items-center space-x-1 text-[11px] text-emerald-600 mt-0.5">
                  <Shield className="w-3 h-3" />
                  <span>Super Admin</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {VIEW_REGISTRY[currentTab](renderContext)}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider>
        <AdminAppContent />
      </ApiProvider>
    </QueryClientProvider>
  );
}
