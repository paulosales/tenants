import React, { useState } from 'react';
import {
  BedDouble,
  Bath,
  DollarSign,
  Filter,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type { LocationDetectionStatus } from '../../hooks/useUserCityDetection';
import {
  DEFAULT_RENTAL_FILTERS,
  type BathroomFilter,
  type BedroomFilter,
  type RentalFiltersState,
  type SortOption,
} from '../../utils/rentalFilters';

interface RentalFilterBarProps {
  filters: RentalFiltersState;
  availableCities: string[];
  availableFeatureTags: string[];
  totalCount: number;
  filteredCount: number;
  matchingSuitesCount: number;
  locationStatus?: LocationDetectionStatus;
  onDetectLocation?: () => void;
  onChange: (next: RentalFiltersState) => void;
}

const BED_OPTIONS: { value: BedroomFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: '0', label: 'Studio' },
  { value: '1', label: '1+ Bd' },
  { value: '2', label: '2+ Bd' },
  { value: '3', label: '3+ Bd' },
];

export const RentalFilterBar: React.FC<RentalFilterBarProps> = ({
  filters,
  availableCities,
  availableFeatureTags,
  totalCount,
  filteredCount,
  matchingSuitesCount,
  locationStatus = 'idle',
  onDetectLocation,
  onChange,
}) => {
  const [showFeaturesDrawer, setShowFeaturesDrawer] = useState(false);

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.city !== 'all' ||
    filters.beds !== 'any' ||
    filters.baths !== 'any' ||
    filters.minPriceDollars !== null ||
    filters.maxPriceDollars !== null ||
    filters.selectedFeatures.length > 0 ||
    filters.availableOnly;

  const activeFilterCount =
    (filters.searchQuery.trim() ? 1 : 0) +
    (filters.city !== 'all' ? 1 : 0) +
    (filters.beds !== 'any' ? 1 : 0) +
    (filters.baths !== 'any' ? 1 : 0) +
    (filters.minPriceDollars !== null || filters.maxPriceDollars !== null ? 1 : 0) +
    filters.selectedFeatures.length +
    (filters.availableOnly ? 1 : 0);

  const updateField = <K extends keyof RentalFiltersState>(
    key: K,
    value: RentalFiltersState[K]
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleFeatureTag = (tag: string) => {
    const exists = filters.selectedFeatures.some(
      (f) => f.toLowerCase() === tag.toLowerCase()
    );
    const nextFeatures = exists
      ? filters.selectedFeatures.filter((f) => f.toLowerCase() !== tag.toLowerCase())
      : [...filters.selectedFeatures, tag];
    updateField('selectedFeatures', nextFeatures);
  };

  const parsePriceInput = (raw: string): number | null => {
    const cleaned = raw.trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.round(num);
  };

  return (
    <section
      aria-label="Apartment Search Filters"
      className="bg-white border border-slate-200 rounded-2xl shadow-lg shadow-slate-900/5 p-4 sm:p-5 space-y-4"
    >
      {/* Row 1: Primary Search + City + Quick Bedroom Pills */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        <div className="lg:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="Search communities, neighborhoods, or features"
            value={filters.searchQuery}
            onChange={(e) => updateField('searchQuery', e.target.value)}
            placeholder="Search neighborhood, address, building, or feature..."
            className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() => updateField('searchQuery', '')}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="lg:col-span-3 flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              aria-label="Filter by city"
              value={filters.city}
              onChange={(e) => updateField('city', e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">All Cities ({availableCities.length})</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
          {onDetectLocation && (
            <button
              type="button"
              aria-label="Detect my city"
              title="Filter by my current city"
              disabled={locationStatus === 'detecting'}
              onClick={onDetectLocation}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 ${
                locationStatus === 'matched' && filters.city !== 'all'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
              }`}
            >
              {locationStatus === 'detecting' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LocateFixed className="w-4 h-4" />
              )}
              <span className="hidden xl:inline">Near Me</span>
            </button>
          )}
        </div>

        <div className="lg:col-span-4 flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          <span className="hidden sm:inline-flex items-center gap-1 pl-2 pr-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
            <BedDouble className="w-3.5 h-3.5" />
            Beds
          </span>
          {BED_OPTIONS.map((opt) => {
            const active = filters.beds === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => updateField('beds', opt.value)}
                className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 2: Price Range, Baths, Availability, Feature Drawer Toggle & Sort */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-slate-100">
        {/* Price Range */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
          <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <input
            type="number"
            min={0}
            step={50}
            aria-label="Minimum monthly rent in dollars"
            placeholder="Min $"
            value={filters.minPriceDollars ?? ''}
            onChange={(e) => updateField('minPriceDollars', parsePriceInput(e.target.value))}
            className="w-20 bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
          />
          <span className="text-slate-300 text-xs">–</span>
          <input
            type="number"
            min={0}
            step={50}
            aria-label="Maximum monthly rent in dollars"
            placeholder="Max $"
            value={filters.maxPriceDollars ?? ''}
            onChange={(e) => updateField('maxPriceDollars', parsePriceInput(e.target.value))}
            className="w-20 bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
          />
        </div>

        {/* Bathrooms */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
          <Bath className="w-3.5 h-3.5 text-slate-500" />
          <select
            aria-label="Minimum bathrooms"
            value={filters.baths}
            onChange={(e) => updateField('baths', e.target.value as BathroomFilter)}
            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="any">Any Baths</option>
            <option value="1">1+ Baths</option>
            <option value="1.5">1.5+ Baths</option>
            <option value="2">2+ Baths</option>
          </select>
        </div>

        {/* Available Suites Only */}
        <button
          type="button"
          aria-pressed={filters.availableOnly}
          onClick={() => updateField('availableOnly', !filters.availableOnly)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            filters.availableOnly
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              filters.availableOnly ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          />
          Available Now Only
        </button>

        {/* Feature Chips Toggle */}
        {availableFeatureTags.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFeaturesDrawer((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              showFeaturesDrawer || filters.selectedFeatures.length > 0
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Features</span>
            {filters.selectedFeatures.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px]">
                {filters.selectedFeatures.length}
              </span>
            )}
          </button>
        )}

        {/* Right side: Result Summary + Sort + Reset */}
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <div className="text-xs text-slate-500 font-medium hidden md:flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>
              <strong className="text-slate-900">{filteredCount}</strong> of {totalCount} properties
              {' · '}
              <strong className="text-emerald-700">{matchingSuitesCount}</strong> matching suites
            </span>
          </div>

          <select
            aria-label="Sort rental listings"
            value={filters.sortBy}
            onChange={(e) => updateField('sortBy', e.target.value as SortOption)}
            className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 cursor-pointer"
          >
            <option value="recommended">Sort: Recommended</option>
            <option value="price_asc">Rent: Low to High</option>
            <option value="price_desc">Rent: High to Low</option>
            <option value="most_available">Most Available Units</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...DEFAULT_RENTAL_FILTERS,
                  sortBy: filters.sortBy,
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear ({activeFilterCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Feature Chips Drawer */}
      {showFeaturesDrawer && availableFeatureTags.length > 0 && (
        <div className="pt-3 border-t border-slate-100 animate-fade-in">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Filter by Building & Suite Features</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableFeatureTags.map((tag) => {
              const selected = filters.selectedFeatures.some(
                (f) => f.toLowerCase() === tag.toLowerCase()
              );
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleFeatureTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                    selected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

