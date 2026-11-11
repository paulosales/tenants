import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Building2, LogIn, Search, Sparkles } from 'lucide-react';
import type { CreateTenancyApplicationDto, PublicPropertyListing } from '@tenants/shared-types';
import { usePublicPortalGateway } from '../../context/ApiContext';
import { AlertBanner } from '../common/AlertBanner';
import { PublicPropertyCard } from './PublicPropertyCard';
import { TenancyApplicationModal } from './TenancyApplicationModal';

interface PublicPortalViewProps {
  onOpenLogin: () => void;
}

export const PublicPortalView: React.FC<PublicPortalViewProps> = ({ onOpenLogin }) => {
  const publicGateway = usePublicPortalGateway();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<PublicPropertyListing | null>(null);
  const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    data: properties = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['public-properties'],
    queryFn: () => publicGateway.getPublicProperties(),
  });

  const filteredProperties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.state_province.toLowerCase().includes(q) ||
        p.address_line1.toLowerCase().includes(q)
    );
  }, [properties, searchQuery]);

  const applyMutation = useMutation({
    mutationFn: (dto: CreateTenancyApplicationDto) => publicGateway.submitPublicApplication(dto),
    onSuccess: (res) => {
      const managersText =
        res.managers_notified > 0
          ? `Routed to ${res.managers_notified} property manager(s) at ${selectedProperty?.name}.`
          : `Sent to the property management team at ${selectedProperty?.name}.`;
      setConfirmationMsg(`${res.message} ${managersText}`);
      setSubmitError(null);
      setSelectedProperty(null);
    },
    onError: (err) => {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit application');
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900 tracking-tight">
                ApexLiving Residences
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Public Leasing Portal
              </span>
            </div>
          </div>

          <button
            id="open-login-btn"
            onClick={onOpenLogin}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs sm:text-sm font-bold transition-colors shadow-sm cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In to Workspace</span>
          </button>
        </div>
      </header>

      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>No account required to browse and apply</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
              Find your next residence and apply directly to property management
            </h1>
            <p className="text-slate-300 mt-3 text-sm sm:text-base leading-relaxed">
              Explore managed residential towers, inspect real-time unit availability and resort-grade
              amenities, and submit your tenancy application in under two minutes.
            </p>
          </div>

          <div className="w-full lg:w-96">
            <label htmlFor="public-property-search" className="sr-only">
              Search properties
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                id="public-property-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by building name, city, or street..."
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white/15"
              />
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 space-y-6">
        {confirmationMsg && (
          <AlertBanner
            variant="success"
            message={confirmationMsg}
            onDismiss={() => setConfirmationMsg(null)}
          />
        )}

        {error && (
          <AlertBanner
            variant="error"
            message={error instanceof Error ? error.message : 'Unable to load available properties.'}
          />
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((skeleton) => (
              <div
                key={skeleton}
                className="h-72 rounded-3xl bg-white border border-slate-200 p-6 animate-pulse"
              />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900">No Matching Properties Found</h3>
            <p className="text-sm text-slate-500 mt-1">
              Try clearing your search filter to see all residential communities accepting applications.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredProperties.map((property) => (
              <PublicPropertyCard
                key={property.id}
                property={property}
                onApply={(p) => {
                  setSelectedProperty(p);
                  setSubmitError(null);
                }}
              />
            ))}
          </div>
        )}
      </main>

      <TenancyApplicationModal
        property={selectedProperty}
        isSubmitting={applyMutation.isPending}
        submitError={submitError}
        onDismissError={() => setSubmitError(null)}
        onClose={() => setSelectedProperty(null)}
        onSubmit={(dto) => applyMutation.mutate(dto)}
      />
    </div>
  );
};
