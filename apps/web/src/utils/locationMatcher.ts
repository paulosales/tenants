import type { PublicPropertyListing } from '@tenants/shared-types';

export const DEFAULT_METRO_MATCH_RADIUS_KM = 65;

export interface CoordinateCityMatch {
  city: string;
  distanceKm: number;
  propertyName: string;
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Computes great-circle Haversine distance in kilometers between two WGS84 coordinates.
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

/**
 * Matches a raw city string against available portfolio cities case-insensitively,
 * returning the canonical city string from `availableCities`.
 */
export function matchCityNameFromAvailable(
  rawCityName: string | null | undefined,
  availableCities: string[]
): string | null {
  if (!rawCityName) return null;
  const normalized = rawCityName.trim().toLowerCase();
  if (!normalized) return null;

  for (const city of availableCities) {
    if (city.trim().toLowerCase() === normalized) {
      return city;
    }
  }
  return null;
}

/**
 * Matches the user's current coordinates locally against mapped properties without
 * leaking exact GPS coordinates to any third-party geocoder.
 */
export function matchPropertyCityByCoordinates(
  userLat: number,
  userLng: number,
  properties: PublicPropertyListing[],
  maxRadiusKm: number = DEFAULT_METRO_MATCH_RADIUS_KM
): CoordinateCityMatch | null {
  let closest: CoordinateCityMatch | null = null;

  for (const prop of properties) {
    if (
      typeof prop.latitude !== 'number' ||
      !Number.isFinite(prop.latitude) ||
      typeof prop.longitude !== 'number' ||
      !Number.isFinite(prop.longitude) ||
      !prop.city?.trim()
    ) {
      continue;
    }

    const distanceKm = calculateDistanceKm(userLat, userLng, prop.latitude, prop.longitude);
    if (distanceKm <= maxRadiusKm && (!closest || distanceKm < closest.distanceKm)) {
      closest = {
        city: prop.city,
        distanceKm,
        propertyName: prop.name,
      };
    }
  }

  return closest;
}

/**
 * Free, zero-API-key OpenStreetMap Nominatim reverse-geocoding fallback used only when
 * properties in the catalog lack coordinates.
 */
export async function reverseGeocodeCityName(
  lat: number,
  lng: number,
  fetcher: typeof fetch = fetch,
  timeoutMs: number = 4000
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller && typeof window !== 'undefined'
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      String(lat)
    )}&lon=${encodeURIComponent(String(lng))}&zoom=10&addressdetails=1`;

    const resp = await fetcher(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!resp.ok) return null;

    const payload = (await resp.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        county?: string;
      };
    };

    const rawCity =
      payload.address?.city ||
      payload.address?.town ||
      payload.address?.village ||
      payload.address?.municipality ||
      payload.address?.county ||
      null;

    return rawCity ? rawCity.trim() : null;
  } catch {
    return null;
  } finally {
    if (timer !== null && typeof window !== 'undefined') {
      window.clearTimeout(timer);
    }
  }
}

