import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Sidebar, type AdminTab } from './components/Sidebar';
import { PropertiesView } from './components/PropertiesView';
import { UnitsView } from './components/UnitsView';
import { TenantsView } from './components/TenantsView';
import { AmenitiesView } from './components/AmenitiesView';
import { ParkingLayoutEditor } from './components/ParkingLayoutEditor';
import { api } from './api/client';
import { Building2, Bell, Shield } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const AdminAppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('properties');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  // Fetch properties globally for sidebar context & stats
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api.getProperties(),
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

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* 1. Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        onSelectProperty={setSelectedPropertyId}
      />

      {/* 2. Main Administration Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
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

        {/* Dynamic View Container */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'properties' && (
            <PropertiesView
              onSelectPropertyForUnits={handleSelectPropertyForUnits}
              onSelectPropertyForParking={handleSelectPropertyForParking}
            />
          )}

          {currentTab === 'units' && (
            <UnitsView
              properties={properties}
              selectedPropertyId={selectedPropertyId}
              onSelectProperty={setSelectedPropertyId}
            />
          )}

          {currentTab === 'tenants' && (
            <TenantsView
              properties={properties}
              selectedPropertyId={selectedPropertyId}
            />
          )}

          {currentTab === 'amenities' && (
            <AmenitiesView
              properties={properties}
              selectedPropertyId={selectedPropertyId}
              onSelectProperty={setSelectedPropertyId}
            />
          )}

          {currentTab === 'parking' && (
            <ParkingLayoutEditor
              properties={properties}
              selectedPropertyId={selectedPropertyId}
              onSelectProperty={setSelectedPropertyId}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAppContent />
    </QueryClientProvider>
  );
}
