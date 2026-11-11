import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  ExternalLink,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
} from 'lucide-react';
import type { PublicPropertyListing } from '@tenants/shared-types';
import { getPropertyRentRange } from '../../utils/rentalFilters';

interface PropertyPriceMapProps {
  properties: PublicPropertyListing[];
  highlightedPropertyId?: string | null;
  selectedPropertyId?: string | null;
  onSelectProperty?: (property: PublicPropertyListing) => void;
  onOpenDetails?: (property: PublicPropertyListing) => void;
  onApply?: (property: PublicPropertyListing) => void;
  singlePropertyMode?: boolean;
  heightClass?: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);

  const existing = document.getElementById('google-maps-js-sdk') as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.google?.maps));
      existing.addEventListener('error', reject);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.onload = () => resolve(window.google?.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function formatGoogleMapsExternalUrl(lat: number, lng: number, queryLabel?: string): string {
  const q = queryLabel ? encodeURIComponent(`${lat},${lng}`) : `${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * Interactive property map displaying price-range pills per property coordinate.
 * Boots native Google Maps JS SDK when `VITE_GOOGLE_MAPS_API_KEY` is configured and falls
 * back gracefully to an interactive coordinate viewport in local/test environments.
 */
export const PropertyPriceMap: React.FC<PropertyPriceMapProps> = ({
  properties,
  highlightedPropertyId = null,
  selectedPropertyId = null,
  onSelectProperty,
  onOpenDetails,
  onApply,
  singlePropertyMode = false,
  heightClass = 'h-[540px]',
}) => {
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleFailed, setGoogleFailed] = useState(false);

  const mappedProperties = useMemo(
    () =>
      properties.filter(
        (p) =>
          typeof p.latitude === 'number' &&
          Number.isFinite(p.latitude) &&
          typeof p.longitude === 'number' &&
          Number.isFinite(p.longitude)
      ),
    [properties]
  );

  const [focusedCity, setFocusedCity] = useState<string>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(singlePropertyMode ? 2 : 1);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePinId, setActivePinId] = useState<string | null>(selectedPropertyId);

  useEffect(() => {
    if (selectedPropertyId !== undefined) {
      setActivePinId(selectedPropertyId);
    }
  }, [selectedPropertyId]);

  const activeProperty = useMemo(
    () => mappedProperties.find((p) => p.id === (activePinId || highlightedPropertyId)) || null,
    [mappedProperties, activePinId, highlightedPropertyId]
  );

  const cities = useMemo(() => {
    const uniq = Array.from(new Set(mappedProperties.map((p) => p.city)));
    return uniq;
  }, [mappedProperties]);

  const visibleMappedProperties = useMemo(() => {
    if (focusedCity === 'all') return mappedProperties;
    const inCity = mappedProperties.filter((p) => p.city === focusedCity);
    return inCity.length > 0 ? inCity : mappedProperties;
  }, [mappedProperties, focusedCity]);

  // Real Google Maps SDK initialization when VITE_GOOGLE_MAPS_API_KEY is supplied
  useEffect(() => {
    if (!googleApiKey || !mapCanvasRef.current || mappedProperties.length === 0) return;

    let cancelled = false;
    loadGoogleMapsScript(googleApiKey)
      .then((maps) => {
        if (cancelled || !maps || !mapCanvasRef.current) return;
        const first = mappedProperties[0];
        const map = new maps.Map(mapCanvasRef.current, {
          center: { lat: first.latitude!, lng: first.longitude! },
          zoom: singlePropertyMode ? 14 : 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        const bounds = new maps.LatLngBounds();

        class PricePillOverlay extends maps.OverlayView {
          private div: HTMLDivElement | null = null;
          constructor(
            private readonly pos: any,
            private readonly prop: PublicPropertyListing
          ) {
            super();
          }
          onAdd() {
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.transform = 'translate(-50%, -100%)';
            div.style.cursor = 'pointer';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = getPropertyRentRange(this.prop).label;
            btn.style.background =
              this.prop.id === activePinId ? '#4338ca' : '#0f172a';
            btn.style.color = '#ffffff';
            btn.style.fontWeight = '700';
            btn.style.fontSize = '12px';
            btn.style.padding = '5px 10px';
            btn.style.borderRadius = '9999px';
            btn.style.border = '2px solid #ffffff';
            btn.style.boxShadow = '0 4px 12px rgba(15,23,42,0.3)';
            btn.onclick = () => {
              setActivePinId(this.prop.id);
              onSelectProperty?.(this.prop);
            };
            div.appendChild(btn);
            this.div = div;
            this.getPanes()?.overlayMouseTarget.appendChild(div);
          }
          draw() {
            if (!this.div) return;
            const proj = this.getProjection();
            const pt = proj?.fromLatLngToDivPixel(this.pos);
            if (pt) {
              this.div.style.left = `${pt.x}px`;
              this.div.style.top = `${pt.y}px`;
            }
          }
          onRemove() {
            this.div?.parentNode?.removeChild(this.div);
            this.div = null;
          }
        }

        for (const prop of visibleMappedProperties) {
          const pos = new maps.LatLng(prop.latitude!, prop.longitude!);
          bounds.extend(pos);
          const overlay = new PricePillOverlay(pos, prop);
          overlay.setMap(map);
        }

        if (!singlePropertyMode && visibleMappedProperties.length > 1) {
          map.fitBounds(bounds, 56);
        }

        setGoogleReady(true);
      })
      .catch(() => {
        if (!cancelled) setGoogleFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [googleApiKey, visibleMappedProperties, singlePropertyMode, activePinId, mappedProperties, onSelectProperty]);

  // Normalized Web Mercator screen coordinates for built-in interactive vector geo map fallback
  const projectedPins = useMemo(() => {
    if (visibleMappedProperties.length === 0) return [];
    const lats = visibleMappedProperties.map((p) => p.latitude!);
    const lngs = visibleMappedProperties.map((p) => p.longitude!);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = Math.max(0.03, (maxLat - minLat) / zoomLevel);
    const lngSpan = Math.max(0.04, (maxLng - minLng) / zoomLevel);
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;

    return visibleMappedProperties.map((prop) => {
      const xPct =
        visibleMappedProperties.length === 1
          ? 50
          : 14 + (((prop.longitude! - (midLng - lngSpan / 2)) / lngSpan) * 72);
      const yPct =
        visibleMappedProperties.length === 1
          ? 44
          : 18 + (1 - (prop.latitude! - (midLat - latSpan / 2)) / latSpan) * 62;

      return {
        property: prop,
        xPct: Math.min(88, Math.max(12, xPct)),
        yPct: Math.min(82, Math.max(14, yPct)),
        rentLabel: getPropertyRentRange(prop).label,
      };
    });
  }, [visibleMappedProperties, zoomLevel]);

  const effectiveHeight = isExpanded ? 'h-[680px]' : heightClass;
  const centerProp = activeProperty || visibleMappedProperties[0];

  return (
    <div
      data-testid="property-price-map"
      className={`relative rounded-3xl border border-slate-200 bg-slate-100 overflow-hidden shadow-sm flex flex-col ${effectiveHeight}`}
    >
      {/* Map Top Controls Bar */}
      <div className="z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block leading-tight">
              Interactive Properties & Price Map
            </span>
            <span className="text-[11px] text-slate-500">
              {googleReady && !googleFailed
                ? 'Google Maps Live Price Layer'
                : `${visibleMappedProperties.length} mapped communit${visibleMappedProperties.length === 1 ? 'y' : 'ies'} with live rent ranges`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!singlePropertyMode && cities.length > 1 && (
            <div className="hidden sm:flex items-center bg-slate-100 rounded-xl p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setFocusedCity('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  focusedCity === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                All Regions
              </button>
              {cities.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFocusedCity(c)}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    focusedCity === c ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {centerProp?.latitude != null && centerProp?.longitude != null && (
            <a
              href={formatGoogleMapsExternalUrl(
                centerProp.latitude,
                centerProp.longitude,
                centerProp.name
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-[11px] font-semibold transition-colors"
            >
              <span>Open Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {!singlePropertyMode && (
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              title={isExpanded ? 'Compact map' : 'Expand map'}
              className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Map Surface */}
      <div className="relative flex-1 overflow-hidden">
        {googleApiKey && !googleFailed ? (
          <div ref={mapCanvasRef} className="w-full h-full" />
        ) : (
          <div className="w-full h-full relative select-none bg-[#e8eef5]">
            {/* Cartographic arterial roads & waterfront texture aesthetic */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 800 500"
              preserveAspectRatio="none"
            >
              <defs>
                <pattern id="map-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                  <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#dbe4ee" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="800" height="500" fill="url(#map-grid)" />
              <path d="M -20 390 Q 220 330 430 395 T 830 355 L 830 520 L -20 520 Z" fill="#cde4f7" opacity="0.65" />
              <path d="M 0 140 C 210 110 490 210 800 130" fill="none" stroke="#ffffff" strokeWidth="7" />
              <path d="M 0 265 C 260 295 530 220 800 260" fill="none" stroke="#fde68a" strokeWidth="5" opacity="0.85" />
              <path d="M 240 0 L 295 500" fill="none" stroke="#ffffff" strokeWidth="6" />
              <path d="M 555 0 L 510 500" fill="none" stroke="#ffffff" strokeWidth="5" />
              <ellipse cx="145" cy="115" rx="70" ry="38" fill="#d1fae5" opacity="0.7" />
              <ellipse cx="645" cy="215" rx="58" ry="34" fill="#d1fae5" opacity="0.7" />
            </svg>

            {/* Zoom Controls */}
            {!singlePropertyMode && (
              <div className="absolute top-3 right-3 z-10 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  type="button"
                  aria-label="Zoom in map"
                  onClick={() => setZoomLevel((z) => Math.min(2.5, Number((z + 0.3).toFixed(1))))}
                  className="p-2 text-slate-700 hover:bg-slate-50 border-b border-slate-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Zoom out map"
                  onClick={() => setZoomLevel((z) => Math.max(0.7, Number((z - 0.3).toFixed(1))))}
                  className="p-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Empty Coordinates State */}
            {projectedPins.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <MapPin className="w-10 h-10 text-slate-400 mb-2" />
                <p className="text-sm font-bold text-slate-700">No Mapped Coordinates Yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Administrators can set latitude and longitude coordinates in Properties Management.
                </p>
              </div>
            )}

            {/* Interactive Map Price Range Pins */}
            {projectedPins.map(({ property, xPct, yPct, rentLabel }) => {
              const isHighlighted =
                highlightedPropertyId === property.id || activePinId === property.id;
              return (
                <button
                  key={property.id}
                  type="button"
                  data-testid={`map-pin-${property.id}`}
                  style={{ left: `${xPct}%`, top: `${yPct}%` }}
                  onClick={() => {
                    setActivePinId(property.id);
                    onSelectProperty?.(property);
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-full z-10 group transition-all cursor-pointer ${
                    isHighlighted ? 'z-20 scale-110' : 'hover:scale-105'
                  }`}
                >
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold shadow-lg border-2 whitespace-nowrap ${
                      isHighlighted
                        ? 'bg-indigo-600 text-white border-white ring-4 ring-indigo-500/30'
                        : 'bg-slate-900 text-white border-white hover:bg-indigo-700'
                    }`}
                  >
                    <Layers className="w-3 h-3 text-sky-300" />
                    <span>{rentLabel}</span>
                  </span>
                  <span
                    className={`block w-2.5 h-2.5 rotate-45 mx-auto -mt-1.5 border-r-2 border-b-2 border-white ${
                      isHighlighted ? 'bg-indigo-600' : 'bg-slate-900'
                    }`}
                  />
                </button>
              );
            })}

            {/* Google-style Bottom Floating Selected Property Card */}
            {activeProperty && (
              <div
                data-testid="map-selected-card"
                className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 z-30 bg-white rounded-2xl border border-slate-200 shadow-xl p-3.5 flex gap-3 items-center animate-in fade-in duration-150"
              >
                {activeProperty.photos?.[0]?.cdn_url ? (
                  <img
                    src={activeProperty.photos[0].cdn_url}
                    alt={activeProperty.name}
                    className="w-16 h-16 rounded-xl object-cover bg-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 flex items-center justify-center text-white shrink-0">
                    <MapPin className="w-6 h-6" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold text-slate-900 truncate">
                    {activeProperty.name}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {activeProperty.city}, {activeProperty.state_province}
                  </p>
                  <p className="text-xs font-bold text-indigo-700 mt-0.5">
                    {getPropertyRentRange(activeProperty).label} ·{' '}
                    <span className="text-emerald-700">
                      {activeProperty.available_units} ready
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {onOpenDetails && (
                      <button
                        type="button"
                        onClick={() => onOpenDetails(activeProperty)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-indigo-600 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Explore Property
                      </button>
                    )}
                    {onApply && (
                      <button
                        type="button"
                        onClick={() => onApply(activeProperty)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold cursor-pointer"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

