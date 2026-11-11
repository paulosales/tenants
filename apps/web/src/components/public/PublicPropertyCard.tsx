import React from 'react';
import { DoorOpen, MapPin, Send, Users } from 'lucide-react';
import type { PublicPropertyListing } from '@tenants/shared-types';

interface PublicPropertyCardProps {
  property: PublicPropertyListing;
  onApply: (property: PublicPropertyListing) => void;
}

export const PublicPropertyCard: React.FC<PublicPropertyCardProps> = ({ property, onApply }) => {
  return (
    <article className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between">
      <div className="p-6 sm:p-7 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                property.available_units > 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>
                {property.available_units > 0
                  ? `${property.available_units} Vacant Units Available`
                  : 'Join Waitlist / Pre-Leasing'}
              </span>
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-2.5">{property.name}</h2>
            <p className="text-xs text-slate-500 flex items-center space-x-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                {property.address_line1}
                {property.address_line2 ? `, ${property.address_line2}` : ''}, {property.city},{' '}
                {property.state_province} {property.postal_code}
              </span>
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-semibold text-slate-400 uppercase block">Total Units</span>
            <span className="text-2xl font-extrabold text-slate-900">{property.total_units}</span>
          </div>
        </div>

        {property.vacant_units.length > 0 && (
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Available Floorplans
            </p>
            <div className="flex flex-wrap gap-2">
              {property.vacant_units.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Unit {u.unit_number} · {u.bedrooms}bd / {u.bathrooms}ba ·{' '}
                  {u.square_feet.toLocaleString()} sqft
                </span>
              ))}
            </div>
          </div>
        )}

        {property.amenities.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Community Amenities
            </p>
            <div className="flex flex-wrap gap-1.5">
              {property.amenities.map((amenityName) => (
                <span
                  key={amenityName}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium"
                >
                  {amenityName}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 sm:px-7 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500 inline-flex items-center space-x-1.5">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {property.manager_count > 0
              ? `${property.manager_count} on-site property manager(s)`
              : 'Managed community'}
          </span>
        </span>

        <button
          type="button"
          onClick={() => onApply(property)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Apply to Be a Tenant</span>
        </button>
      </div>
    </article>
  );
};

