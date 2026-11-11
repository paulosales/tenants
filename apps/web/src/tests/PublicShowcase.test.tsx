import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '../context/ApiContext';
import { PublicPortalView } from '../components/public/PublicPortalView';
import { PropertyShowcaseModal } from '../components/admin/PropertyShowcaseModal';
import { sanitizeRichHtml } from '../utils/htmlSanitizer';
import {
  calculateDistanceKm,
  matchCityNameFromAvailable,
  matchPropertyCityByCoordinates,
  reverseGeocodeCityName,
} from '../utils/locationMatcher';
import {
  DEFAULT_RENTAL_FILTERS,
  filterAndSortProperties,
  getPropertyRentRange,
  readInitialFiltersFromUrl,
} from '../utils/rentalFilters';
import type { IApiGateways } from '../api/interfaces';
import type { PropertyWithStats, PublicPropertyListing } from '@tenants/shared-types';

const auroraProperty: PublicPropertyListing = {
  id: 'prop-aurora',
  name: 'Aurora Heights Commons',
  address_line1: '185 Aurora Avenue',
  address_line2: null,
  city: 'Winnipeg',
  state_province: 'MB',
  postal_code: 'R2V 3A9',
  rich_description:
    '<h3>Modern Riverfront Residences</h3><p>Chef-inspired quartz kitchens and balconies.</p><script>window.__xss=1</script>',
  latitude: 49.9612,
  longitude: -97.1394,
  pet_policy: 'Cats & small dogs welcome (max 2)',
  lease_terms: '6 or 12-month lease',
  min_rent_cents: 165000,
  max_rent_cents: 235000,
  total_units: 24,
  available_units: 2,
  manager_count: 1,
  amenities: ['Fitness Studio'],
  features: [
    {
      id: 'feat-1',
      property_id: 'prop-aurora',
      label: 'Heated Underground Parking',
      category: 'community',
      display_order: 0,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'feat-2',
      property_id: 'prop-aurora',
      label: 'In-Suite Laundry',
      category: 'suite',
      display_order: 1,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  photos: [
    {
      id: 'photo-1',
      property_id: 'prop-aurora',
      storage_key: 'seed/aurora-heights-hero.png',
      cdn_url: 'http://localhost:9000/property-media/seed/aurora-heights-hero.png',
      caption: 'Aurora Heights Exterior',
      is_cover: true,
      display_order: 0,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  vacant_units: [
    {
      id: 'unit-101',
      unit_number: '101',
      floor: 1,
      bedrooms: 1,
      bathrooms: 1,
      square_feet: 680,
      monthly_rent_cents: 165000,
      status: 'vacant',
    },
    {
      id: 'unit-204',
      unit_number: '204',
      floor: 2,
      bedrooms: 2,
      bathrooms: 2,
      square_feet: 980,
      monthly_rent_cents: 235000,
      status: 'vacant',
    },
  ],
};

const harborProperty: PublicPropertyListing = {
  id: 'prop-harbor',
  name: 'Harborview Terrace',
  address_line1: '400 Marina Blvd',
  address_line2: null,
  city: 'Seattle',
  state_province: 'WA',
  postal_code: '98101',
  rich_description: '<p>Waterfront loft residences downtown.</p>',
  latitude: 47.6264,
  longitude: -122.3688,
  pet_policy: 'Dogs welcome',
  lease_terms: '12-month lease',
  min_rent_cents: 240000,
  max_rent_cents: 240000,
  total_units: 18,
  available_units: 1,
  manager_count: 1,
  amenities: ['Rooftop Deck'],
  features: [
    {
      id: 'feat-3',
      property_id: 'prop-harbor',
      label: 'Rooftop Deck',
      category: 'community',
      display_order: 0,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
  photos: [],
  vacant_units: [
    {
      id: 'unit-501',
      unit_number: '501',
      floor: 5,
      bedrooms: 1,
      bathrooms: 1,
      square_feet: 760,
      monthly_rent_cents: 240000,
      status: 'vacant',
    },
  ],
};

function makeFakeGateways(): IApiGateways {
  return {
    auth: {
      login: vi.fn(),
      logout: vi.fn(),
      getCurrentUser: vi.fn(),
    },
    publicPortal: {
      getPublicProperties: vi.fn().mockResolvedValue([auroraProperty, harborProperty]),
      getPublicProperty: vi.fn().mockResolvedValue(auroraProperty),
      submitPublicApplication: vi.fn().mockResolvedValue({
        application: { id: 'app-1' } as any,
        managers_notified: 1,
        message: 'Application submitted.',
      }),
    },
    properties: {
      getProperties: vi.fn().mockResolvedValue([]),
      getProperty: vi.fn().mockResolvedValue(auroraProperty),
      createProperty: vi.fn(),
      updateProperty: vi.fn().mockResolvedValue(auroraProperty),
      deleteProperty: vi.fn(),
      getPropertyFeatures: vi.fn().mockResolvedValue(auroraProperty.features),
      addPropertyFeature: vi.fn().mockResolvedValue({
        id: 'feat-new',
        property_id: 'prop-aurora',
        label: 'EV Chargers',
        category: 'community',
        display_order: 2,
        created_at: '2026-01-01T00:00:00Z',
      }),
      deletePropertyFeature: vi.fn().mockResolvedValue(undefined),
      getPropertyPhotos: vi.fn().mockResolvedValue(auroraProperty.photos),
      uploadPropertyPhoto: vi.fn(),
      setCoverPropertyPhoto: vi.fn().mockResolvedValue(auroraProperty.photos![0]),
      deletePropertyPhoto: vi.fn().mockResolvedValue(undefined),
    },
    units: {} as any,
    tenants: {} as any,
    amenities: {} as any,
    parking: {} as any,
    reservations: {} as any,
    maintenance: {} as any,
    staff: {} as any,
    tenantSessions: {} as any,
    applications: {} as any,
    messages: {} as any,
    users: {} as any,
  };
}

function renderWithProviders(ui: React.ReactElement, gateways: IApiGateways) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider gateways={gateways}>{ui}</ApiProvider>
    </QueryClientProvider>
  );
}

describe('Rental Showcase, Filters, OpenStreetMap Price Pins & XSS Sanitization', () => {
  const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    if (originalGeolocation) {
      Object.defineProperty(navigator, 'geolocation', originalGeolocation);
    } else {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: undefined,
      });
    }
  });

  it('strips scripts, inline event handlers, and javascript: hrefs in sanitizeRichHtml', () => {
    const clean = sanitizeRichHtml(
      '<h3>Community</h3><p>Safe <strong>text</strong></p><script>alert("xss")</script><img src="x" onerror="alert(1)" /><a href="javascript:alert(2)" onclick="steal()">Link</a>'
    );
    expect(clean).toContain('<h3>Community</h3>');
    expect(clean).toContain('<strong>text</strong>');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
  });

  it('computes rent ranges, parses Broadstreet-style URL params, and filters/sorts properties', () => {
    expect(getPropertyRentRange(auroraProperty).label).toBe('$1,650 – $2,350/mo');
    expect(getPropertyRentRange(harborProperty).label).toBe('$2,400/mo');

    window.history.replaceState({}, '', '/?beds=2&city=Winnipeg&maxPrice=2500');
    const urlPartial = readInitialFiltersFromUrl();
    expect(urlPartial.beds).toBe('2');
    expect(urlPartial.city).toBe('Winnipeg');
    expect(urlPartial.maxPriceDollars).toBe(2500);

    const twoBedMatches = filterAndSortProperties([auroraProperty, harborProperty], {
      ...DEFAULT_RENTAL_FILTERS,
      beds: '2',
    });
    expect(twoBedMatches).toHaveLength(1);
    expect(twoBedMatches[0].id).toBe('prop-aurora');

    const sortedAsc = filterAndSortProperties([harborProperty, auroraProperty], {
      ...DEFAULT_RENTAL_FILTERS,
      sortBy: 'price_asc',
    });
    expect(sortedAsc.map((p) => p.id)).toEqual(['prop-aurora', 'prop-harbor']);
  });

  it('filters listings, renders interactive map price pills, opens PropertyDetailView, and pre-selects suite', async () => {
    const gateways = makeFakeGateways();
    renderWithProviders(<PublicPortalView onOpenLogin={vi.fn()} />, gateways);

    await waitFor(() => {
      expect(screen.getByText('Aurora Heights Commons')).toBeInTheDocument();
      expect(screen.getByText('Harborview Terrace')).toBeInTheDocument();
    });

    // Interactive Leaflet OpenStreetMap renders rent range pills and floating card on click
    const auroraPin = screen.getByTestId('map-pin-prop-aurora');
    expect(auroraPin).toHaveTextContent('$1,650 – $2,350/mo');
    expect(screen.getByTestId('map-pin-prop-harbor')).toHaveTextContent('$2,400/mo');
    fireEvent.click(auroraPin);
    await waitFor(() => {
      expect(screen.getByTestId('map-selected-card')).toHaveTextContent('Aurora Heights Commons');
    });

    // Quick 2+ Bedroom preset filters out 1-bedroom-only Harborview Terrace
    fireEvent.click(screen.getByRole('button', { name: '2+ Bedroom Suites' }));
    await waitFor(() => {
      expect(screen.queryByText('Harborview Terrace')).not.toBeInTheDocument();
      expect(screen.getAllByText('Aurora Heights Commons').length).toBeGreaterThanOrEqual(1);
    });

    // Explore Aurora Heights Community Detail Showcase
    fireEvent.click(screen.getByRole('button', { name: /Explore Community/i }));
    await waitFor(() => {
      expect(screen.getByText('About This Community')).toBeInTheDocument();
      expect(screen.getByText('Modern Riverfront Residences')).toBeInTheDocument();
    });
    // Script inside seeded rich_description must never appear in the rendered DOM
    expect(document.querySelectorAll('script').length).toBe(0);

    // Click direct Apply for Suite 204
    fireEvent.click(screen.getByRole('button', { name: /Apply for Suite 204/i }));
    await waitFor(() => {
      const select = screen.getByLabelText(/Preferred Vacant Unit/i) as HTMLSelectElement;
      expect(select.value).toBe('unit-204');
    });
  });

  it('allows Admin / Property Manager to save showcase rich description, add/remove features, and manage CDN photos', async () => {
    const gateways = makeFakeGateways();
    const adminProp: PropertyWithStats = {
      ...auroraProperty,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      unit_count: 24,
      occupied_units_count: 22,
      tenant_count: 30,
    };

    renderWithProviders(<PropertyShowcaseModal property={adminProp} onClose={vi.fn()} />, gateways);

    await waitFor(() => {
      expect(screen.getByText(/Showcase & Media: Aurora Heights Commons/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Showcase & Location/i }));
    await waitFor(() => {
      expect(gateways.properties.updateProperty).toHaveBeenCalledWith(
        'prop-aurora',
        expect.objectContaining({
          latitude: 49.9612,
          longitude: -97.1394,
        })
      );
    });

    // Features Tab -> add & remove
    fireEvent.click(screen.getByRole('button', { name: /Features \(/i }));
    await waitFor(() => {
      expect(screen.getByText('Heated Underground Parking')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/New property feature label/i), {
      target: { value: 'EV Chargers' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Feature/i }));
    await waitFor(() => {
      expect(gateways.properties.addPropertyFeature).toHaveBeenCalledWith(
        'prop-aurora',
        expect.objectContaining({ label: 'EV Chargers' })
      );
    });

    fireEvent.click(screen.getByLabelText(/Remove feature Heated Underground Parking/i));
    await waitFor(() => {
      expect(gateways.properties.deletePropertyFeature).toHaveBeenCalledWith(
        'prop-aurora',
        'feat-1'
      );
    });

    // Photos Tab -> shows MinIO photo and deletes via ConfirmModal
    fireEvent.click(screen.getByRole('button', { name: /CDN Photos \(/i }));
    await waitFor(() => {
      expect(screen.getByAltText('Aurora Heights Exterior')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^Remove$/i }));
    await waitFor(() => {
      expect(screen.getByText('Remove CDN Photo?')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Photo' }));
    await waitFor(() => {
      expect(gateways.properties.deletePropertyPhoto).toHaveBeenCalledWith(
        'prop-aurora',
        'photo-1'
      );
    });
  });

  it('matches user coordinates locally to portfolio city within metro radius and handles reverse-geocode fallback', async () => {
    // Winnipeg downtown (~7.3 km from Aurora Heights)
    expect(calculateDistanceKm(49.8951, -97.1384, 49.9612, -97.1394)).toBeLessThan(10);
    const localMatch = matchPropertyCityByCoordinates(49.8951, -97.1384, [
      auroraProperty,
      harborProperty,
    ]);
    expect(localMatch?.city).toBe('Winnipeg');

    // Toronto (far outside any listed property metro area)
    const outsideMatch = matchPropertyCityByCoordinates(43.6532, -79.3832, [
      auroraProperty,
      harborProperty,
    ]);
    expect(outsideMatch).toBeNull();

    // Case-insensitive city matcher returns canonical option casing
    expect(matchCityNameFromAvailable(' winnipeg ', ['Seattle', 'Winnipeg'])).toBe('Winnipeg');

    // Injectable Nominatim fallback parses city safely
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { city: 'Winnipeg' } }),
    }) as unknown as typeof fetch;
    await expect(reverseGeocodeCityName(49.8951, -97.1384, mockFetch)).resolves.toBe('Winnipeg');
  });

  it('automatically filters properties by detected user city and supports View all cities override', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: {
              latitude: 49.8951,
              longitude: -97.1384,
              accuracy: 25,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        },
      },
    });

    const gateways = makeFakeGateways();
    renderWithProviders(<PublicPortalView onOpenLogin={vi.fn()} />, gateways);

    await waitFor(() => {
      expect(screen.getByTestId('detected-city-banner')).toHaveTextContent(
        'Showing properties in Winnipeg based on your current location'
      );
      expect((screen.getByLabelText(/Filter by city/i) as HTMLSelectElement).value).toBe(
        'Winnipeg'
      );
      expect(screen.getAllByText('Aurora Heights Commons').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('Harborview Terrace')).not.toBeInTheDocument();
    });

    // Clicking "View all cities" clears auto city filter and shows Seattle listing too
    fireEvent.click(screen.getByRole('button', { name: /View all cities/i }));
    await waitFor(() => {
      expect((screen.getByLabelText(/Filter by city/i) as HTMLSelectElement).value).toBe('all');
      expect(screen.getByText('Harborview Terrace')).toBeInTheDocument();
    });
  });

  it('leaves all cities visible when user location is in a city without listed properties and honors ?city URL override', async () => {
    // 1. User located in Toronto (no listed properties)
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: {
              latitude: 43.6532,
              longitude: -79.3832,
              accuracy: 25,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        },
      },
    });

    const gateways = makeFakeGateways();
    const firstRender = renderWithProviders(<PublicPortalView onOpenLogin={vi.fn()} />, gateways);

    await waitFor(() => {
      expect(screen.getByText('Aurora Heights Commons')).toBeInTheDocument();
      expect(screen.getByText('Harborview Terrace')).toBeInTheDocument();
      expect((screen.getByLabelText(/Filter by city/i) as HTMLSelectElement).value).toBe('all');
    });
    firstRender.unmount();

    // 2. Explicit ?city=Seattle in URL must NOT be overridden even when GPS says Winnipeg
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({
            coords: {
              latitude: 49.8951,
              longitude: -97.1384,
              accuracy: 25,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        },
      },
    });
    window.history.replaceState({}, '', '/?city=Seattle');

    renderWithProviders(<PublicPortalView onOpenLogin={vi.fn()} />, gateways);
    await waitFor(() => {
      expect((screen.getByLabelText(/Filter by city/i) as HTMLSelectElement).value).toBe('Seattle');
      expect(screen.getByText('Harborview Terrace')).toBeInTheDocument();
      expect(screen.queryByText('Aurora Heights Commons')).not.toBeInTheDocument();
    });
  });
});
