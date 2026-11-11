import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Building2,
  Columns2,
  LayoutGrid,
  LocateFixed,
  LogIn,
  Map as MapIcon,
  Sparkles,
  X,
} from 'lucide-react';
import type { CreateTenancyApplicationDto, PublicPropertyListing } from '@tenants/shared-types';
import { usePublicPortalGateway } from '../../context/ApiContext';
import { useUserCityDetection } from '../../hooks/useUserCityDetection';
import { AlertBanner } from '../common/AlertBanner';
import {
  DEFAULT_RENTAL_FILTERS,
  filterAndSortProperties,
  formatMonthlyRent,
  getPropertyRentRange,
  readInitialFiltersFromUrl,
  unitMatchesFilters,
  type RentalFiltersState,
} from '../../utils/rentalFilters';
import { PublicPropertyCard } from './PublicPropertyCard';
import { PropertyPriceMap } from './PropertyPriceMap';
import { PropertyDetailView } from './PropertyDetailView';
import { RentalFilterBar } from './RentalFilterBar';
import { TenancyApplicationModal } from './TenancyApplicationModal';

interface PublicPortalViewProps {
  onOpenLogin: () => void;
}

type LayoutViewMode = 'split' | 'list' | 'map';

interface ApplicationTarget {
  property: PublicPropertyListing;
  preferredUnitId?: string;
}

function readInitialDetailPropertyId(): string | null {
  if (typeof window === 'undefined') return null;
  const val = new URLSearchParams(window.location.search).get('property');
  return val && val.trim() ? val.trim() : null;
}

export const PublicPortalView: React.FC<PublicPortalViewProps> = ({ onOpenLogin }) => {
  const publicGateway = usePublicPortalGateway();

  const [filters, setFilters] = useState<RentalFiltersState>(() => ({
    ...DEFAULT_RENTAL_FILTERS,
    ...readInitialFiltersFromUrl(),
  }));
  const initialUrlHasCity = useMemo(() => Boolean(readInitialFiltersFromUrl().city), []);
  const userChangedCityRef = useRef(false);
  const [viewMode, setViewMode] = useState<LayoutViewMode>('split');
  const [detailPropertyId, setDetailPropertyId] = useState<string | null>(() =>
    readInitialDetailPropertyId()
  );
  const [highlightedPropertyId, setHighlightedPropertyId] = useState<string | null>(null);
  const [selectedMapPropertyId, setSelectedMapPropertyId] = useState<string | null>(null);
  const [applicationTarget, setApplicationTarget] = useState<ApplicationTarget | null>(null);
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

  // Fetch fresh property showcase when detail view is open (with list cache fallback)
  const { data: fetchedDetailProperty } = useQuery({
    queryKey: ['public-property-detail', detailPropertyId],
    queryFn: () => publicGateway.getPublicProperty(detailPropertyId!),
    enabled: Boolean(detailPropertyId),
  });

  // Sync URL query params cleanly without full page reloads
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    try {
      const url = new URL(window.location.href);
      if (filters.beds !== 'any') url.searchParams.set('beds', filters.beds);
      else url.searchParams.delete('beds');

      if (filters.city !== 'all') url.searchParams.set('city', filters.city);
      else url.searchParams.delete('city');

      if (filters.minPriceDollars !== null) {
        url.searchParams.set('minPrice', String(filters.minPriceDollars));
      } else {
        url.searchParams.delete('minPrice');
      }

      if (filters.maxPriceDollars !== null) {
        url.searchParams.set('maxPrice', String(filters.maxPriceDollars));
      } else {
        url.searchParams.delete('maxPrice');
      }

      if (detailPropertyId) url.searchParams.set('property', detailPropertyId);
      else url.searchParams.delete('property');

      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Ignore history mutation errors in test environments
    }
  }, [filters, detailPropertyId]);

  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    for (const p of properties) {
      if (p.city) cities.add(p.city);
    }
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const {
    status: locationStatus,
    detectedCity,
    wasManualTrigger,
    detectNow,
    dismissStatusFeedback,
  } = useUserCityDetection({
    properties,
    availableCities,
    disabled: initialUrlHasCity || Boolean(detailPropertyId),
    onCityDetected: (city) => {
      if (!userChangedCityRef.current) {
        setFilters((prev) => ({ ...prev, city }));
      }
    },
  });

  const handleFiltersChange = (next: RentalFiltersState) => {
    if (next.city !== filters.city) {
      userChangedCityRef.current = true;
    }
    setFilters(next);
  };

  const handleDetectLocation = () => {
    userChangedCityRef.current = false;
    detectNow();
  };

  const availableFeatureTags = useMemo(() => {
    const tags = new Map<string, string>();
    for (const p of properties) {
      for (const f of p.features || []) {
        tags.set(f.label.toLowerCase(), f.label);
      }
      for (const a of p.amenities || []) {
        tags.set(a.toLowerCase(), a);
      }
    }
    return Array.from(tags.values()).sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const filteredProperties = useMemo(
    () => filterAndSortProperties(properties, filters),
    [properties, filters]
  );

  const matchingSuitesCount = useMemo(() => {
    return filteredProperties.reduce(
      (sum, p) => sum + p.vacant_units.filter((u) => unitMatchesFilters(u, filters)).length,
      0
    );
  }, [filteredProperties, filters]);

  const portfolioStats = useMemo(() => {
    const totalAvailable = properties.reduce((s, p) => s + p.available_units, 0);
    const minStarts = properties
      .map((p) => getPropertyRentRange(p).minCents)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const lowestCents = minStarts.length > 0 ? Math.min(...minStarts) : null;
    return {
      communities: properties.length,
      availableSuites: totalAvailable,
      citiesCount: availableCities.length,
      startingFrom: formatMonthlyRent(lowestCents),
    };
  }, [properties, availableCities.length]);

  const activeDetailProperty = useMemo(() => {
    if (!detailPropertyId) return null;
    return (
      fetchedDetailProperty ||
      properties.find((p) => p.id === detailPropertyId) ||
      null
    );
  }, [detailPropertyId, fetchedDetailProperty, properties]);

  const applyMutation = useMutation({
    mutationFn: (dto: CreateTenancyApplicationDto) => publicGateway.submitPublicApplication(dto),
    onSuccess: (res) => {
      const targetName = applicationTarget?.property.name || 'the property';
      const managersText =
        res.managers_notified > 0
          ? `Routed to ${res.managers_notified} property manager(s) at ${targetName}.`
          : `Sent to the property management team at ${targetName}.`;
      setConfirmationMsg(`${res.message} ${managersText}`);
      setSubmitError(null);
      setApplicationTarget(null);
    },
    onError: (err) => {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit application');
    },
  });

  const openApplicationModal = (property: PublicPropertyListing, preferredUnitId?: string) => {
    setSubmitError(null);
    setApplicationTarget({ property, preferredUnitId });
  };

  const openDetailsView = (property: PublicPropertyListing) => {
    setDetailPropertyId(property.id);
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setDetailPropertyId(null)}
            className="flex items-center space-x-3 text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Residential Rental Marketplace
              </h1>
              <p className="text-xs text-slate-500">
                Direct Leasing • Live Unit Availability & Interactive Map
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Staff &amp; Resident Sign In</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {confirmationMsg && (
          <AlertBanner
            variant="success"
            message={`Application Submitted: ${confirmationMsg}`}
            onDismiss={() => setConfirmationMsg(null)}
          />
        )}

        {error && (
          <AlertBanner
            variant="error"
            message={error instanceof Error ? error.message : 'Unable to fetch listings right now.'}
          />
        )}

        {activeDetailProperty ? (
          <PropertyDetailView
            property={activeDetailProperty}
            initialBedroomFilter={filters.beds}
            onBack={() => setDetailPropertyId(null)}
            onApply={openApplicationModal}
          />
        ) : (
          <>
            {/* Hero Banner with Quick Rent Presets */}
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-7 sm:p-10 shadow-xl">
              <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
              <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div className="max-w-2xl space-y-3">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-sky-200">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Zero Broker Fees · Instant Manager Routing</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                    Find Your Next Apartment — Filter by Suites, Map &amp; Price Range
                  </h2>
                  <p className="text-slate-300 text-sm sm:text-base">
                    Compare live monthly rent ranges on our interactive neighborhood map, inspect
                    full community galleries, and apply directly for any vacant suite.
                  </p>

                  {/* Quick One-Click Search Shortcuts */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, beds: '2' }))}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        filters.beds === '2'
                          ? 'bg-white text-indigo-900 border-white'
                          : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                      }`}
                    >
                      2+ Bedroom Suites
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, beds: '1' }))}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        filters.beds === '1'
                          ? 'bg-white text-indigo-900 border-white'
                          : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                      }`}
                    >
                      1+ Bedroom Suites
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFilters((f) => ({ ...f, maxPriceDollars: 2000, beds: 'any' }))
                      }
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        filters.maxPriceDollars === 2000
                          ? 'bg-white text-indigo-900 border-white'
                          : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                      }`}
                    >
                      Under $2,000/mo
                    </button>
                  </div>
                </div>

                {/* Quick Portfolio KPI Strip */}
                <div className="grid grid-cols-3 gap-3 shrink-0">
                  <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 text-center">
                    <p className="text-2xl font-extrabold">{portfolioStats.communities}</p>
                    <p className="text-[11px] text-slate-300 font-medium">Communities</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 text-center">
                    <p className="text-2xl font-extrabold text-emerald-300">
                      {portfolioStats.availableSuites}
                    </p>
                    <p className="text-[11px] text-slate-300 font-medium">Vacant Suites</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 text-center">
                    <p className="text-lg sm:text-xl font-extrabold text-sky-200">
                      {portfolioStats.startingFrom}
                    </p>
                    <p className="text-[11px] text-slate-300 font-medium">Starting / mo</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Filter Bar */}
            <RentalFilterBar
              filters={filters}
              availableCities={availableCities}
              availableFeatureTags={availableFeatureTags}
              totalCount={properties.length}
              filteredCount={filteredProperties.length}
              matchingSuitesCount={matchingSuitesCount}
              locationStatus={locationStatus}
              onDetectLocation={handleDetectLocation}
              onChange={handleFiltersChange}
            />

            {/* Contextual Auto-Detected Local City Indicator */}
            {detectedCity && filters.city.toLowerCase() === detectedCity.toLowerCase() && (
              <div
                data-testid="detected-city-banner"
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900"
              >
                <div className="flex items-center gap-2 font-medium">
                  <LocateFixed className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    Showing properties in <strong>{detectedCity}</strong> based on your current
                    location.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleFiltersChange({ ...filters, city: 'all' })}
                  className="font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                >
                  View all cities
                </button>
              </div>
            )}

            {wasManualTrigger &&
              (locationStatus === 'outside_area' ||
                locationStatus === 'denied' ||
                locationStatus === 'unavailable') && (
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <LocateFixed className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                      {locationStatus === 'outside_area'
                        ? 'We currently have no listed properties in your detected city — showing all communities.'
                        : locationStatus === 'denied'
                        ? 'Location permission is blocked in your browser — please choose a city manually.'
                        : 'Browser location is unavailable on this device — please choose a city manually.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss location notice"
                    onClick={dismissStatusFeedback}
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

            {/* View Switcher Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600 font-medium">
                Showing <strong className="text-slate-900">{filteredProperties.length}</strong>{' '}
                rental communit{filteredProperties.length === 1 ? 'y' : 'ies'} with{' '}
                <strong className="text-emerald-700">{matchingSuitesCount}</strong> matching vacant
                suite{matchingSuitesCount === 1 ? '' : 's'}
              </p>

              <div className="inline-flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === 'split'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Columns2 className="w-3.5 h-3.5" />
                  <span>Split List &amp; Map</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Grid View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('map')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    viewMode === 'map'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Map Only</span>
                </button>
              </div>
            </div>

            {/* Results Content */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="h-96 rounded-2xl bg-white border border-slate-200 animate-pulse p-6"
                  />
                ))}
              </div>
            ) : filteredProperties.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-lg font-bold text-slate-800">
                  No rental communities match those filters
                </h3>
                <p className="text-sm text-slate-500">
                  Try widening your monthly rent ceiling, clearing bedroom filters, or searching a
                  different neighborhood.
                </p>
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_RENTAL_FILTERS)}
                  className="inline-flex items-center px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : viewMode === 'map' ? (
              <PropertyPriceMap
                properties={filteredProperties}
                highlightedPropertyId={highlightedPropertyId}
                selectedPropertyId={selectedMapPropertyId}
                onSelectProperty={(p) => setSelectedMapPropertyId(p.id)}
                onOpenDetails={openDetailsView}
                onApply={(p) => openApplicationModal(p)}
                heightClass="h-[580px]"
              />
            ) : viewMode === 'list' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProperties.map((prop) => (
                  <PublicPropertyCard
                    key={prop.id}
                    property={prop}
                    filters={filters}
                    isHighlighted={highlightedPropertyId === prop.id}
                    isSelected={selectedMapPropertyId === prop.id}
                    onHover={setHighlightedPropertyId}
                    onOpenDetails={openDetailsView}
                    onApply={openApplicationModal}
                  />
                ))}
              </div>
            ) : (
              /* Split View: Cards on Left, Sticky Interactive Map on Right */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-5">
                  {filteredProperties.map((prop) => (
                    <PublicPropertyCard
                      key={prop.id}
                      property={prop}
                      filters={filters}
                      isHighlighted={highlightedPropertyId === prop.id}
                      isSelected={selectedMapPropertyId === prop.id}
                      onHover={setHighlightedPropertyId}
                      onOpenDetails={openDetailsView}
                      onApply={openApplicationModal}
                    />
                  ))}
                </div>

                <div className="lg:col-span-5 lg:sticky lg:top-24">
                  <PropertyPriceMap
                    properties={filteredProperties}
                    highlightedPropertyId={highlightedPropertyId}
                    selectedPropertyId={selectedMapPropertyId}
                    onSelectProperty={(p) => setSelectedMapPropertyId(p.id)}
                    onOpenDetails={openDetailsView}
                    onApply={(p) => openApplicationModal(p)}
                    heightClass="h-[540px]"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <TenancyApplicationModal
        property={applicationTarget?.property ?? null}
        initialPreferredUnitId={applicationTarget?.preferredUnitId ?? null}
        isSubmitting={applyMutation.isPending}
        submitError={submitError}
        onDismissError={() => setSubmitError(null)}
        onClose={() => setApplicationTarget(null)}
        onSubmit={(dto) => applyMutation.mutate(dto)}
      />
    </div>
  );
};
