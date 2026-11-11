import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Expand,
  FileText,
  MapPin,
  Maximize2,
  PawPrint,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { PropertyFeature, PublicPropertyListing } from '@tenants/shared-types';
import { sanitizeRichHtml } from '../../utils/htmlSanitizer';
import { formatMonthlyRent, getPropertyRentRange } from '../../utils/rentalFilters';
import { PropertyPriceMap } from './PropertyPriceMap';

interface PropertyDetailViewProps {
  property: PublicPropertyListing;
  initialBedroomFilter?: 'any' | '0' | '1' | '2' | '3';
  onBack: () => void;
  onApply: (property: PublicPropertyListing, preferredUnitId?: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  community: 'Community & Building',
  suite: 'In-Suite Finishes',
  utilities: 'Utilities & Sustainability',
  policies: 'Policies & Parking',
  transit: 'Transit & Neighborhood',
};

export const PropertyDetailView: React.FC<PropertyDetailViewProps> = ({
  property,
  initialBedroomFilter = 'any',
  onBack,
  onApply,
}) => {
  const photos = property.photos || [];
  const initialIndex = Math.max(
    0,
    photos.findIndex((p) => p.is_cover)
  );

  const [activePhotoIndex, setActivePhotoIndex] = useState(initialIndex);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [bedFilter, setBedFilter] = useState<'any' | '0' | '1' | '2' | '3'>(initialBedroomFilter);
  const [copiedLink, setCopiedLink] = useState(false);

  const rentRange = getPropertyRentRange(property);
  const sanitizedDescription = useMemo(
    () => sanitizeRichHtml(property.rich_description || ''),
    [property.rich_description]
  );

  const groupedFeatures = useMemo(() => {
    const groups: Record<string, PropertyFeature[]> = {};
    const features = property.features || [];

    for (const f of features) {
      const cat = f.category || 'community';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f);
    }

    if (features.length === 0 && property.amenities.length > 0) {
      groups.community = property.amenities.map((label, idx) => ({
        id: `legacy-${idx}`,
        property_id: property.id,
        label,
        category: 'community',
        display_order: idx,
        created_at: '',
      }));
    }

    return Object.entries(groups);
  }, [property.features, property.amenities, property.id]);

  const filteredUnits = useMemo(() => {
    return property.vacant_units.filter((u) => {
      if (bedFilter === 'any') return true;
      if (bedFilter === '0') return u.bedrooms === 0;
      if (bedFilter === '3') return u.bedrooms >= 3;
      return u.bedrooms === Number(bedFilter);
    });
  }, [property.vacant_units, bedFilter]);

  const floorplanSummary = useMemo(() => {
    const byBeds = new Map<number, { count: number; minRent: number; maxSqft: number }>();
    for (const u of property.vacant_units) {
      const prev = byBeds.get(u.bedrooms);
      const rent = u.monthly_rent_cents || 0;
      if (!prev) {
        byBeds.set(u.bedrooms, {
          count: 1,
          minRent: rent,
          maxSqft: u.square_feet,
        });
      } else {
        byBeds.set(u.bedrooms, {
          count: prev.count + 1,
          minRent: prev.minRent > 0 && rent > 0 ? Math.min(prev.minRent, rent) : prev.minRent || rent,
          maxSqft: Math.max(prev.maxSqft, u.square_feet),
        });
      }
    }
    return Array.from(byBeds.entries()).sort((a, b) => a[0] - b[0]);
  }, [property.vacant_units]);

  const activePhoto = photos[activePhotoIndex] || null;

  const goPrevPhoto = () => {
    if (photos.length <= 1) return;
    setActivePhotoIndex((i) => (i - 1 + photos.length) % photos.length);
  };

  const goNextPhoto = () => {
    if (photos.length <= 1) return;
    setActivePhotoIndex((i) => (i + 1) % photos.length);
  };

  const handleShareLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('property', property.id);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url.toString());
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Sub-Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-indigo-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Rental Communities</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleShareLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onApply(property, filteredUnits[0]?.id || property.vacant_units[0]?.id)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Apply Now</span>
          </button>
        </div>
      </div>

      {/* Hero Photo Gallery Section (Aurora Heights Showcase Style) */}
      <section className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg shadow-slate-900/5">
        <div className="relative h-72 sm:h-[420px] bg-slate-900">
          {activePhoto ? (
            <img
              src={activePhoto.cdn_url}
              alt={activePhoto.caption || `${property.name} showcase photo`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900 flex flex-col items-center justify-center text-indigo-200">
              <Building2 className="w-16 h-16 opacity-60 mb-2" />
              <span className="text-sm font-medium opacity-80">Community Photography Coming Soon</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-slate-950/15" />

          {/* Gallery Controls */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={goPrevPhoto}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-md transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={goNextPhoto}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-md transition-colors cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Top Bar Inside Gallery */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-md">
              <DoorOpen className="w-3.5 h-3.5" />
              {property.available_units} Vacant Suite{property.available_units === 1 ? '' : 's'}
            </span>

            {activePhoto && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white text-xs font-semibold backdrop-blur-md cursor-pointer"
              >
                <Expand className="w-3.5 h-3.5" />
                <span>
                  View Photo ({activePhotoIndex + 1}/{photos.length})
                </span>
              </button>
            )}
          </div>

          {/* Bottom Property Identity Overlay */}
          <div className="absolute bottom-5 left-5 right-5 flex flex-col md:flex-row md:items-end justify-between gap-4 text-white">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-200 uppercase tracking-wider">
                <span>Featured Rental Community</span>
                <span>•</span>
                <span>{property.city}, {property.state_province}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {property.name}
              </h1>
              <p className="text-sm text-slate-200 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>
                  {property.address_line1}
                  {property.address_line2 ? `, ${property.address_line2}` : ''}, {property.city},{' '}
                  {property.state_province} {property.postal_code}
                </span>
              </p>
              {activePhoto?.caption && (
                <p className="text-xs text-slate-300/90 flex items-center gap-1 pt-0.5">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{activePhoto.caption}</span>
                </p>
              )}
            </div>

            <div className="bg-white/95 backdrop-blur-md text-slate-900 rounded-2xl px-4 py-3 shadow-xl shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Monthly Rent Range
              </p>
              <p className="text-xl font-extrabold text-indigo-700">{rentRange.label}</p>
            </div>
          </div>
        </div>

        {/* Thumbnail Strip */}
        {photos.length > 1 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2.5 overflow-x-auto">
            {photos.map((photo, idx) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActivePhotoIndex(idx)}
                className={`relative w-24 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                  idx === activePhotoIndex
                    ? 'border-indigo-600 ring-2 ring-indigo-500/30 scale-[1.02]'
                    : 'border-transparent opacity-75 hover:opacity-100'
                }`}
              >
                <img
                  src={photo.cdn_url}
                  alt={photo.caption || `Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {photo.is_cover && (
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-bold">
                    Cover
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Main Content + Sticky Leasing Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Main Content (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Rich Community Overview */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">About This Community</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Community highlights, finish packages, and living experience
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {property.pet_policy && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                    <PawPrint className="w-3.5 h-3.5" />
                    {property.pet_policy}
                  </span>
                )}
                {property.lease_terms && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-semibold">
                    <FileText className="w-3.5 h-3.5" />
                    {property.lease_terms}
                  </span>
                )}
              </div>
            </div>

            {sanitizedDescription ? (
              <div
                className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-4 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_a]:text-indigo-600 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
              />
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed">
                Welcome to <strong>{property.name}</strong> in {property.city},{' '}
                {property.state_province}. Featuring {property.total_units} professionally managed
                residences with dedicated on-site management, responsive maintenance teams, and
                resident amenity spaces.
              </p>
            )}
          </section>

          {/* Categorized Building & Suite Features */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <span>Property Features & Resident Perks</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Designed for effortless daily living, managed in-house
              </p>
            </div>

            {groupedFeatures.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                Contact the leasing team for the complete list of suite and building features.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {groupedFeatures.map(([category, items]) => (
                  <div
                    key={category}
                    className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 space-y-2.5"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                      {CATEGORY_LABELS[category] || category}
                    </h3>
                    <ul className="space-y-2">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start gap-2 text-sm text-slate-700 font-medium"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Available Suites & Floorplans */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Available Suites & Floorplans
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a specific suite below to pre-fill your rental application
                </p>
              </div>

              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { value: 'any', label: 'All' },
                  { value: '0', label: 'Studio' },
                  { value: '1', label: '1 Bd' },
                  { value: '2', label: '2 Bd' },
                  { value: '3', label: '3+ Bd' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBedFilter(opt.value as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      bedFilter === opt.value
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredUnits.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  No vacant suites match that bedroom selection right now.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Switch bedrooms above or submit a priority waitlist application.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUnits.map((u) => (
                  <div
                    key={u.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-indigo-50/30 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-extrabold">
                          Suite {u.unit_number}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          Floor {u.floor}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                          Available Now
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 pt-1">
                        <span className="inline-flex items-center gap-1">
                          <BedDouble className="w-3.5 h-3.5 text-slate-400" />
                          {u.bedrooms === 0 ? 'Studio' : `${u.bedrooms} Bedroom`}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Bath className="w-3.5 h-3.5 text-slate-400" />
                          {u.bathrooms} Bath
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                          {u.square_feet} sq ft
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-left sm:text-right">
                        <p className="text-lg font-extrabold text-slate-900">
                          {formatMonthlyRent(u.monthly_rent_cents)}
                          <span className="text-xs font-semibold text-slate-500">/mo</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onApply(property, u.id)}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
                      >
                        Apply for Suite {u.unit_number}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Embedded Neighborhood Map */}
          <section className="space-y-3">
            <h2 className="text-xl font-extrabold text-slate-900">Neighborhood & Map</h2>
            <PropertyPriceMap
              properties={[property]}
              selectedPropertyId={property.id}
              singlePropertyMode
              heightClass="h-80"
              onApply={(p) => onApply(p, filteredUnits[0]?.id)}
            />
          </section>
        </div>

        {/* Right Sticky Leasing Sidebar (4 cols) */}
        <aside className="lg:col-span-4 lg:sticky lg:top-6 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-5">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Direct Community Leasing
              </p>
              <h3 className="text-xl font-extrabold text-slate-900">{property.name}</h3>
              <p className="text-xs text-slate-500">
                {property.city}, {property.state_province} • {property.total_units} residences
              </p>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Rent Range</span>
                <span className="font-extrabold text-indigo-800">{rentRange.label}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Vacant Suites Now</span>
                <span className="font-bold text-emerald-700">{property.available_units} available</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">On-Site Managers</span>
                <span className="font-semibold text-slate-800 inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  {property.manager_count} dedicated
                </span>
              </div>
            </div>

            {floorplanSummary.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Floorplan Summary
                </p>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {floorplanSummary.map(([beds, info]) => (
                    <div
                      key={beds}
                      className="flex items-center justify-between px-3.5 py-2.5 text-xs bg-white"
                    >
                      <div>
                        <span className="font-bold text-slate-800">
                          {beds === 0 ? 'Studio' : `${beds} Bedroom`}
                        </span>
                        <span className="text-slate-400 ml-1.5">({info.count} avail.)</span>
                      </div>
                      <span className="font-bold text-emerald-700">
                        From {formatMonthlyRent(info.minRent)}/mo
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => onApply(property, filteredUnits[0]?.id || property.vacant_units[0]?.id)}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply to Be a Tenant</span>
            </button>

            <div className="flex items-start gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Applications go directly to the property manager overseeing {property.name} with
                zero broker fees.
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Full-Screen Photo Lightbox */}
      {lightboxOpen && activePhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Property Photo Gallery Lightbox"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Close gallery"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-5 right-5 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative max-w-5xl w-full flex items-center justify-center">
            {photos.length > 1 && (
              <button
                type="button"
                aria-label="Previous lightbox photo"
                onClick={goPrevPhoto}
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white mr-3 cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={activePhoto.cdn_url}
              alt={activePhoto.caption || property.name}
              className="max-h-[80vh] w-auto rounded-2xl shadow-2xl object-contain"
            />

            {photos.length > 1 && (
              <button
                type="button"
                aria-label="Next lightbox photo"
                onClick={goNextPhoto}
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white ml-3 cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          <p className="mt-4 text-sm text-slate-200 font-medium">
            {activePhoto.caption || property.name} ({activePhotoIndex + 1} / {photos.length})
          </p>
        </div>
      )}
    </div>
  );
};

