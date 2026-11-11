import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicPropertyListing } from '@tenants/shared-types';
import {
  matchCityNameFromAvailable,
  matchPropertyCityByCoordinates,
  reverseGeocodeCityName,
} from '../utils/locationMatcher';

export type LocationDetectionStatus =
  | 'idle'
  | 'detecting'
  | 'matched'
  | 'outside_area'
  | 'denied'
  | 'unavailable';

interface UseUserCityDetectionOptions {
  properties: PublicPropertyListing[];
  availableCities: string[];
  disabled?: boolean;
  onCityDetected: (city: string) => void;
}

export interface UseUserCityDetectionResult {
  status: LocationDetectionStatus;
  detectedCity: string | null;
  wasManualTrigger: boolean;
  detectNow: () => void;
  dismissStatusFeedback: () => void;
}

/**
 * Detects the visitor's city via Browser Geolocation and automatically filters listings
 * if the portfolio contains properties in that city.
 */
export function useUserCityDetection({
  properties,
  availableCities,
  disabled = false,
  onCityDetected,
}: UseUserCityDetectionOptions): UseUserCityDetectionResult {
  const [status, setStatus] = useState<LocationDetectionStatus>('idle');
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [wasManualTrigger, setWasManualTrigger] = useState(false);

  const hasAutoAttemptedRef = useRef(false);
  const mountedRef = useRef(true);
  const propertiesRef = useRef(properties);
  const citiesRef = useRef(availableCities);
  const onCityDetectedRef = useRef(onCityDetected);

  propertiesRef.current = properties;
  citiesRef.current = availableCities;
  onCityDetectedRef.current = onCityDetected;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runDetection = useCallback((manual: boolean) => {
    setWasManualTrigger(manual);

    if (typeof navigator === 'undefined' || !navigator.geolocation?.getCurrentPosition) {
      setStatus('unavailable');
      return;
    }

    setStatus('detecting');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (!mountedRef.current) return;
        const { latitude, longitude } = position.coords;

        // 1. Privacy-first local Haversine match against mapped portfolio coordinates
        const coordinateMatch = matchPropertyCityByCoordinates(
          latitude,
          longitude,
          propertiesRef.current
        );
        if (coordinateMatch) {
          const canonical =
            matchCityNameFromAvailable(coordinateMatch.city, citiesRef.current) ||
            coordinateMatch.city;
          setDetectedCity(canonical);
          setStatus('matched');
          onCityDetectedRef.current(canonical);
          return;
        }

        // 2. Reverse-geocode fallback ONLY if some properties have no coordinates stored
        const hasUnmappedProperties = propertiesRef.current.some(
          (p) => typeof p.latitude !== 'number' || typeof p.longitude !== 'number'
        );
        if (hasUnmappedProperties) {
          const rawCity = await reverseGeocodeCityName(latitude, longitude);
          if (!mountedRef.current) return;
          const matchedCity = matchCityNameFromAvailable(rawCity, citiesRef.current);
          if (matchedCity) {
            setDetectedCity(matchedCity);
            setStatus('matched');
            onCityDetectedRef.current(matchedCity);
            return;
          }
        }

        setDetectedCity(null);
        setStatus('outside_area');
      },
      (err) => {
        if (!mountedRef.current) return;
        setDetectedCity(null);
        if (err?.code === 1) {
          setStatus('denied');
        } else {
          setStatus('unavailable');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  }, []);

  // Automatically attempt once on initial load after properties arrive unless URL specifies a city
  useEffect(() => {
    if (disabled || hasAutoAttemptedRef.current || properties.length === 0) {
      return;
    }
    hasAutoAttemptedRef.current = true;
    runDetection(false);
  }, [disabled, properties.length, runDetection]);

  const detectNow = useCallback(() => {
    runDetection(true);
  }, [runDetection]);

  const dismissStatusFeedback = useCallback(() => {
    setWasManualTrigger(false);
  }, []);

  return {
    status,
    detectedCity,
    wasManualTrigger,
    detectNow,
    dismissStatusFeedback,
  };
}

