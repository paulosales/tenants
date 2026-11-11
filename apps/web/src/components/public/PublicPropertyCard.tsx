import React from 'react';
import {
  ArrowUpRight,
  Building2,
  Camera,
  CheckCircle2,
  DoorOpen,
  MapPin,
  PawPrint,
  Sparkles,
} from 'lucide-react';
import type { PublicPropertyListing, PublicUnitSummary } from '@tenants/shared-types';
import {
  formatMonthlyRent,
  getPropertyRentRange,
  unitMatchesFilters,
  type RentalFiltersState,
} from '../../utils/rentalFilters';

interface PublicPropertyCardProps {
  property: PublicPropertyListing;
  filters?: RentalFiltersState;
  isHighlighted?: boolean;
  isSelected?: boolean;
  onHover?: (propertyId: string | null) => void;
  onOpenDetails: (property: PublicPropertyListing) => void;
  onApply: (property: PublicPropertyListing, preferredUnitId?: string) => void;
}

function stripHtmlSummary(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const PublicPropertyCard: React.FC<PublicPropertyCardProps> = ({
  property,
  filters,
  isHighlighted = false,
  isSelected = false,
  onHover,
  onOpenDetails,
  onApply,
}) => {
  const photos = property.photos || [];
  const coverPhoto = photos.find((p) => p.is_cover) || photos[0] || null;
  const rentRange = getPropertyRentRange(property);

  const matchingUnits: PublicUnitSummary[] = filters
    ? property.vacant_units.filter((u) => unitMatchesFilters(u, filters))
    : property.vacant_units;

  const displayFeatures =
    property.features && property.features.length > 0
      ? property.features.map((f) => f.label)
      : property.amenities;

  const summaryExcerpt = stripHtmlSummary(property.rich_description);

  return (
    <article
      onMouseEnter={() => onHover?.(property.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`group bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col ${
        isSelected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-indigo-900/10'
          : isHighlighted
          ? 'border-indigo-300 shadow-md'
          : 'border-slate-200'
      }`}
    >
      {/* Hero Image Banner */}
      <div
        onClick={() => onOpenDetails(property)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenDetails(property);
          }
        }}
        className="relative h-52 bg-slate-900 overflow-hidden cursor-pointer"
      >
        {coverPhoto ? (
          <img
            src={coverPhoto.cdn_url}
            alt={coverPhoto.caption || `${property.name} exterior`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 via-indigo-900 to-slate-900 flex items-center justify-center">
            <Building2 className="w-12 h-12 text-indigo-300/70" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />

        {/* Top badges: availability & photo count */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md ${
              matchingUnits.length > 0
                ? 'bg-emerald-500/95 text-white'
                : 'bg-slate-800/85 text-slate-200'
            }`}
          >
            {matchingUnits.length > 0
              ? `${matchingUnits.length} Matching Suite${matchingUnits.length === 1 ? '' : 's'}`
              : `${property.available_units} Available`}
          </span>

          {photos.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900/75 text-white text-[11px] font-semibold backdrop-blur-md">
              <Camera className="w-3 h-3" />
              {photos.length}
            </span>
          )}
        </div>

        {/* Bottom overlay: Rent Range Pill & Property Title */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold tracking-tight truncate group-hover:text-indigo-200 transition-colors">
              {property.name}
            </h3>
            <p className="text-xs text-slate-200 flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
              <span className="truncate">
                {property.address_line1}, {property.city}, {property.state_province}
              </span>
            </p>
          </div>

          <span className="shrink-0 px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-extrabold shadow-lg">
            {rentRange.label}
          </span>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-5 flex-1 flex flex-col space-y-4">
        {/* Policies / Quick Meta */}
        {(property.pet_policy || property.lease_terms) && (
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
            {property.pet_policy && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80">
                <PawPrint className="w-3 h-3" />
                {property.pet_policy}
              </span>
            )}
            {property.lease_terms && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80">
                {property.lease_terms}
              </span>
            )}
          </div>
        )}

        {/* Excerpt */}
        {summaryExcerpt && (
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{summaryExcerpt}</p>
        )}

        {/* Features */}
        {displayFeatures.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {displayFeatures.slice(0, 5).map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50/80 text-indigo-700 text-[11px] font-medium border border-indigo-100"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>{label}</span>
              </span>
            ))}
            {displayFeatures.length > 5 && (
              <button
                type="button"
                onClick={() => onOpenDetails(property)}
                className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 text-[11px] font-semibold cursor-pointer"
              >
                +{displayFeatures.length - 5} more
              </button>
            )}
          </div>
        )}

        {/* Available Floorplans / Suites Table Preview */}
        <div className="pt-2 border-t border-slate-100 space-y-2 flex-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
              Available Suites
            </span>
            <span className="text-slate-400">
              {matchingUnits.length} / {property.total_units} total
            </span>
          </div>

          {matchingUnits.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">
              {property.vacant_units.length > 0
                ? 'No units match current filters — view all property suites.'
                : 'Currently at full occupancy — waitlist applications welcome.'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {matchingUnits.slice(0, 3).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/70 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <DoorOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Suite {u.unit_number}</span>
                      <span className="text-slate-400 font-normal">• Fl {u.floor}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {u.bedrooms === 0 ? 'Studio' : `${u.bedrooms} Bed`} / {u.bathrooms} Bath •{' '}
                      {u.square_feet} sq ft
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-extrabold text-emerald-700">
                      {formatMonthlyRent(u.monthly_rent_cents)}/mo
                    </span>
                    <button
                      type="button"
                      onClick={() => onApply(property, u.id)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
              {matchingUnits.length > 3 && (
                <button
                  type="button"
                  onClick={() => onOpenDetails(property)}
                  className="w-full py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                >
                  View all {matchingUnits.length} available suites &rarr;
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer CTAs */}
      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onOpenDetails(property)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs text-slate-700 bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-pointer"
        >
          <span>Explore Community</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onApply(property, matchingUnits[0]?.id)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Apply to Be a Tenant</span>
        </button>
      </div>
    </article>
  );
};
