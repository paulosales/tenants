import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  ExternalLink,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
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

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const DEFAULT_CENTER: [number, number] = [49.8951, -97.1384];

function buildOpenStreetMapExternalUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${encodeURIComponent(String(lat))}&mlon=${encodeURIComponent(String(lng))}#map=16/${lat}/${lng}`;
}

function createPricePillElement(
  property: PublicPropertyListing,
  rentLabel: string,
  isHighlighted: boolean,
  onClick: () => void
): { wrapper: HTMLDivElement; pillButton: HTMLButtonElement; arrowTip: HTMLSpanElement } {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.transform = 'translate(-50%, -100%)';
  wrapper.style.display = 'inline-flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.alignItems = 'center';

  const pillButton = document.createElement('button');
  pillButton.type = 'button';
  pillButton.setAttribute('data-testid', `map-pin-${property.id}`);
  pillButton.setAttribute('aria-label', `${property.name}: ${rentLabel}`);
  pillButton.textContent = rentLabel;
  pillButton.style.fontWeight = '800';
  pillButton.style.fontSize = '12px';
  pillButton.style.lineHeight = '1.2';
  pillButton.style.padding = '6px 12px';
  pillButton.style.borderRadius = '9999px';
  pillButton.style.border = '2px solid #ffffff';
  pillButton.style.whiteSpace = 'nowrap';
  pillButton.style.cursor = 'pointer';
  pillButton.style.transition = 'transform 150ms ease, background-color 150ms ease, box-shadow 150ms ease';

  const arrowTip = document.createElement('span');
  arrowTip.style.width = '10px';
  arrowTip.style.height = '10px';
  arrowTip.style.transform = 'rotate(45deg)';
  arrowTip.style.marginTop = '-6px';
  arrowTip.style.borderRight = '2px solid #ffffff';
  arrowTip.style.borderBottom = '2px solid #ffffff';

  applyPillStyle(pillButton, arrowTip, isHighlighted);

  pillButton.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });

  wrapper.appendChild(pillButton);
  wrapper.appendChild(arrowTip);

  return { wrapper, pillButton, arrowTip };
}

function applyPillStyle(
  pillButton: HTMLButtonElement,
  arrowTip: HTMLSpanElement,
  isHighlighted: boolean
) {
  pillButton.style.backgroundColor = isHighlighted ? '#4f46e5' : '#0f172a';
  pillButton.style.color = '#ffffff';
  pillButton.style.boxShadow = isHighlighted
    ? '0 8px 20px rgba(79, 70, 229, 0.45), 0 0 0 4px rgba(99, 102, 241, 0.25)'
    : '0 4px 12px rgba(15, 23, 42, 0.35)';
  pillButton.style.transform = isHighlighted ? 'scale(1.08)' : 'scale(1)';
  arrowTip.style.backgroundColor = isHighlighted ? '#4f46e5' : '#0f172a';
}

/**
 * Interactive property map powered by Leaflet + free OpenStreetMap tiles (zero API key required),
 * rendering live monthly rent price-range pills per property coordinate.
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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markerControlsRef = useRef<
    Map<
      string,
      {
        marker: L.Marker;
        pillButton: HTMLButtonElement;
        arrowTip: HTMLSpanElement;
      }
    >
  >(new Map());
  const onSelectRef = useRef(onSelectProperty);
  onSelectRef.current = onSelectProperty;

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

  const cities = useMemo(
    () => Array.from(new Set(mappedProperties.map((p) => p.city))),
    [mappedProperties]
  );

  const visibleMappedProperties = useMemo(() => {
    if (focusedCity === 'all') return mappedProperties;
    const inCity = mappedProperties.filter((p) => p.city === focusedCity);
    return inCity.length > 0 ? inCity : mappedProperties;
  }, [mappedProperties, focusedCity]);

  // Reset city focus cleanly if filtered results exclude the selected region
  useEffect(() => {
    if (focusedCity !== 'all' && !cities.includes(focusedCity)) {
      setFocusedCity('all');
    }
  }, [cities, focusedCity]);

  const fitVisibleBounds = (map: L.Map, list: PublicPropertyListing[]) => {
    if (list.length === 0) return;
    try {
      if (list.length === 1 || singlePropertyMode) {
        map.setView([list[0].latitude!, list[0].longitude!], singlePropertyMode ? 15 : 13, {
          animate: false,
        });
        return;
      }
      const bounds = L.latLngBounds(list.map((p) => [p.latitude!, p.longitude!] as [number, number]));
      map.fitBounds(bounds, { padding: [52, 52], maxZoom: 14, animate: false });
    } catch {
      // Ignore layout/bounds computation errors in zero-dimension headless test DOMs
    }
  };

  // Initialize Leaflet Map + free OpenStreetMap tile layer once on mount
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let map: L.Map;
    try {
      map = L.map(container, {
        center: DEFAULT_CENTER,
        zoom: 12,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer(OSM_TILE_URL, {
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);

      if (!singlePropertyMode) {
        map.on('click', () => {
          setActivePinId(null);
        });
      }

      const layer = L.layerGroup().addTo(map);
      leafletMapRef.current = map;
      markersLayerRef.current = layer;
    } catch {
      return;
    }

    return () => {
      markerControlsRef.current.clear();
      markersLayerRef.current = null;
      leafletMapRef.current = null;
      try {
        map.remove();
      } catch {
        // Ignore cleanup issues in simulated DOM environments
      }
    };
  }, [singlePropertyMode]);

  // Synchronize container height transitions with Leaflet tile renderer
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;
    const id = window.setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {
        // Ignore in headless tests
      }
    }, 150);
    return () => window.clearTimeout(id);
  }, [isExpanded, heightClass]);

  // Sync markers and fit bounds whenever visible properties list changes
  useEffect(() => {
    const map = leafletMapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerControlsRef.current.clear();

    for (const prop of visibleMappedProperties) {
      const rentLabel = getPropertyRentRange(prop).label;
      const isHighlighted = highlightedPropertyId === prop.id || activePinId === prop.id;

      const { wrapper, pillButton, arrowTip } = createPricePillElement(
        prop,
        rentLabel,
        isHighlighted,
        () => {
          setActivePinId(prop.id);
          onSelectRef.current?.(prop);
          try {
            map.panTo([prop.latitude!, prop.longitude!]);
          } catch {
            // Ignore in JSDOM
          }
        }
      );

      const icon = L.divIcon({
        className: 'property-price-pill-icon',
        html: wrapper,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([prop.latitude!, prop.longitude!], {
        icon,
        zIndexOffset: isHighlighted ? 1000 : 0,
      }).addTo(layer);

      markerControlsRef.current.set(prop.id, { marker, pillButton, arrowTip });
    }

    fitVisibleBounds(map, visibleMappedProperties);
    // Intentionally omit highlight/selection state so card hover doesn't reset user's pan/zoom
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMappedProperties, singlePropertyMode]);

  // Update marker pill colors/elevation smoothly in-place on hover or selection
  useEffect(() => {
    for (const [id, ctrl] of markerControlsRef.current.entries()) {
      const active = highlightedPropertyId === id || activePinId === id;
      applyPillStyle(ctrl.pillButton, ctrl.arrowTip, active);
      try {
        ctrl.marker.setZIndexOffset(active ? 1000 : 0);
      } catch {
        // Ignore in simulated DOM
      }
    }
  }, [highlightedPropertyId, activePinId]);

  const effectiveHeight = isExpanded ? 'h-[680px]' : heightClass;
  const centerProp = activeProperty || visibleMappedProperties[0];

  return (
    <div
      data-testid="property-price-map"
      className={`relative rounded-3xl border border-slate-200 bg-slate-100 overflow-hidden shadow-sm flex flex-col ${effectiveHeight}`}
    >
      {/* Map Top Controls Bar */}
      <div className="relative z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 block leading-tight">
              Interactive Properties &amp; Price Map
            </span>
            <span className="text-[11px] text-slate-500">
              OpenStreetMap · {visibleMappedProperties.length} mapped communit
              {visibleMappedProperties.length === 1 ? 'y' : 'ies'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!singlePropertyMode && cities.length > 1 && (
            <div className="hidden sm:flex items-center bg-slate-100 rounded-xl p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setFocusedCity('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${focusedCity === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
              >
                All Regions
              </button>
              {cities.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFocusedCity(c)}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${focusedCity === c ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                    }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {centerProp?.latitude != null && centerProp?.longitude != null && (
            <a
              href={buildOpenStreetMapExternalUrl(centerProp.latitude, centerProp.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-[11px] font-semibold transition-colors"
            >
              <span>OpenStreetMap</span>
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

      {/* Live Leaflet Map Surface */}
      <div className="relative flex-1 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Empty Coordinates Overlay */}
        {visibleMappedProperties.length === 0 && (
          <div className="absolute inset-0 z-[1100] bg-slate-100/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            <MapPin className="w-10 h-10 text-slate-400 mb-2" />
            <p className="text-sm font-bold text-slate-700">No Mapped Coordinates Yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Administrators can set latitude and longitude coordinates in Properties Management.
            </p>
          </div>
        )}

        {/* Custom Zoom & Fit-Bounds Controls */}
        {visibleMappedProperties.length > 0 && (
          <div className="absolute top-3 right-3 z-[1100] flex flex-col bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
            <button
              type="button"
              aria-label="Zoom in map"
              onClick={() => {
                try {
                  leafletMapRef.current?.zoomIn();
                } catch {
                  // Ignore in headless tests
                }
              }}
              className="p-2 text-slate-700 hover:bg-slate-50 border-b border-slate-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Zoom out map"
              onClick={() => {
                try {
                  leafletMapRef.current?.zoomOut();
                } catch {
                  // Ignore in headless tests
                }
              }}
              className="p-2 text-slate-700 hover:bg-slate-50 border-b border-slate-200 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            {!singlePropertyMode && (
              <button
                type="button"
                aria-label="Fit map to visible properties"
                title="Fit visible properties"
                onClick={() => {
                  if (leafletMapRef.current) {
                    fitVisibleBounds(leafletMapRef.current, visibleMappedProperties);
                  }
                }}
                className="p-2 text-indigo-600 hover:bg-indigo-50 cursor-pointer"
              >
                <LocateFixed className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Bottom Floating Selected Property Card */}
        {activeProperty && (
          <div
            data-testid="map-selected-card"
            className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 z-[1100] bg-white rounded-2xl border border-slate-200 shadow-xl p-3.5 flex gap-3 items-center animate-in fade-in duration-150"
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
    </div>
  );
};
