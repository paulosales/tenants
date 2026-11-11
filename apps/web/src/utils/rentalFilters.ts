import type { PublicPropertyListing, PublicUnitSummary } from '@tenants/shared-types';

export type BedroomFilter = 'any' | '0' | '1' | '2' | '3';
export type BathroomFilter = 'any' | '1' | '1.5' | '2';
export type SortOption = 'recommended' | 'price_asc' | 'price_desc' | 'most_available';

export interface RentalFiltersState {
  searchQuery: string;
  city: string;
  beds: BedroomFilter;
  baths: BathroomFilter;
  minPriceDollars: number | null;
  maxPriceDollars: number | null;
  selectedFeatures: string[];
  availableOnly: boolean;
  sortBy: SortOption;
}

export const DEFAULT_RENTAL_FILTERS: RentalFiltersState = {
  searchQuery: '',
  city: 'all',
  beds: 'any',
  baths: 'any',
  minPriceDollars: null,
  maxPriceDollars: null,
  selectedFeatures: [],
  availableOnly: false,
  sortBy: 'recommended',
};

export function readInitialFiltersFromUrl(): Partial<RentalFiltersState> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const partial: Partial<RentalFiltersState> = {};

  const bedsParam = params.get('beds');
  if (bedsParam === '0' || bedsParam === '1' || bedsParam === '2' || bedsParam === '3') {
    partial.beds = bedsParam;
  }

  const cityParam = params.get('city');
  if (cityParam && cityParam.trim()) {
    partial.city = cityParam.trim();
  }

  const minPrice = params.get('minPrice');
  if (minPrice && !Number.isNaN(Number(minPrice))) {
    partial.minPriceDollars = Math.max(0, Number(minPrice));
  }

  const maxPrice = params.get('maxPrice');
  if (maxPrice && !Number.isNaN(Number(maxPrice))) {
    partial.maxPriceDollars = Math.max(0, Number(maxPrice));
  }

  return partial;
}

export function formatMonthlyRent(cents?: number | null): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents) || cents <= 0) {
    return 'Inquire';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));
}

export function getPropertyRentRange(property: PublicPropertyListing): {
  minCents: number | null;
  maxCents: number | null;
  label: string;
} {
  const unitRents = property.vacant_units
    .map((u) => u.monthly_rent_cents)
    .filter((v): v is number => typeof v === 'number' && v > 0);

  const minCents =
    unitRents.length > 0
      ? Math.min(...unitRents)
      : typeof property.min_rent_cents === 'number' && property.min_rent_cents > 0
      ? property.min_rent_cents
      : null;

  const maxCents =
    unitRents.length > 0
      ? Math.max(...unitRents)
      : typeof property.max_rent_cents === 'number' && property.max_rent_cents > 0
      ? property.max_rent_cents
      : minCents;

  if (!minCents) {
    return { minCents: null, maxCents: null, label: 'Contact for Rates' };
  }
  if (!maxCents || minCents === maxCents) {
    return { minCents, maxCents: minCents, label: `${formatMonthlyRent(minCents)}/mo` };
  }
  return {
    minCents,
    maxCents,
    label: `${formatMonthlyRent(minCents)} – ${formatMonthlyRent(maxCents)}/mo`,
  };
}

export function unitMatchesFilters(unit: PublicUnitSummary, filters: RentalFiltersState): boolean {
  if (filters.beds !== 'any') {
    if (filters.beds === '0') {
      if (unit.bedrooms !== 0) return false;
    } else if (unit.bedrooms < Number(filters.beds)) {
      return false;
    }
  }

  if (filters.baths !== 'any') {
    if (unit.bathrooms < Number(filters.baths)) return false;
  }

  const rentCents = unit.monthly_rent_cents ?? 0;
  if (filters.minPriceDollars !== null && rentCents > 0) {
    if (rentCents < filters.minPriceDollars * 100) return false;
  }
  if (filters.maxPriceDollars !== null && rentCents > 0) {
    if (rentCents > filters.maxPriceDollars * 100) return false;
  }

  return true;
}

export function filterAndSortProperties(
  properties: PublicPropertyListing[],
  filters: RentalFiltersState
): PublicPropertyListing[] {
  const q = filters.searchQuery.trim().toLowerCase();
  const hasUnitCriteria =
    filters.beds !== 'any' ||
    filters.baths !== 'any' ||
    filters.minPriceDollars !== null ||
    filters.maxPriceDollars !== null;

  const filtered = properties.filter((p) => {
    if (filters.city !== 'all' && p.city.toLowerCase() !== filters.city.toLowerCase()) {
      return false;
    }

    if (q) {
      const featureText = (p.features || []).map((f) => f.label).join(' ');
      const haystack = `${p.name} ${p.city} ${p.state_province} ${p.address_line1} ${p.address_line2 || ''} ${p.amenities.join(' ')} ${featureText}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filters.selectedFeatures.length > 0) {
      const propFeatureLabels = new Set([
        ...(p.features || []).map((f) => f.label.toLowerCase()),
        ...p.amenities.map((a) => a.toLowerCase()),
      ]);
      for (const wanted of filters.selectedFeatures) {
        if (!propFeatureLabels.has(wanted.toLowerCase())) {
          return false;
        }
      }
    }

    if (filters.availableOnly && p.available_units <= 0) {
      return false;
    }

    if (hasUnitCriteria) {
      const matchingUnits = p.vacant_units.filter((u) => unitMatchesFilters(u, filters));
      if (matchingUnits.length === 0) return false;
    }

    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (filters.sortBy === 'price_asc') {
      const ra = getPropertyRentRange(a).minCents ?? Number.MAX_SAFE_INTEGER;
      const rb = getPropertyRentRange(b).minCents ?? Number.MAX_SAFE_INTEGER;
      return ra - rb;
    }
    if (filters.sortBy === 'price_desc') {
      const ra = getPropertyRentRange(a).minCents ?? 0;
      const rb = getPropertyRentRange(b).minCents ?? 0;
      return rb - ra;
    }
    if (filters.sortBy === 'most_available') {
      return b.available_units - a.available_units;
    }
    return b.available_units - a.available_units || a.name.localeCompare(b.name);
  });

  return sorted;
}

