import React from 'react';
import { Check, Clock, Sparkles } from 'lucide-react';
import type { Amenity } from '@tenants/shared-types';

interface AmenitySelectorStripProps {
  amenities: Amenity[];
  selectedAmenityId: string;
  onSelectAmenity: (amenityId: string) => void;
}

export const AmenitySelectorStrip: React.FC<AmenitySelectorStripProps> = ({
  amenities,
  selectedAmenityId,
  onSelectAmenity,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Select Building Amenity</h3>
          <p className="text-xs text-slate-500">
            Choose an amenity below to view its live availability calendar and schedule a time slot
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {amenities.length} Available
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {amenities.map((amenity) => {
          const isSelected = selectedAmenityId === amenity.id;
          const feeDollars = amenity.hourly_rate_cents / 100;

          return (
            <div
              key={amenity.id}
              id={`amenity-card-${amenity.id}`}
              onClick={() => onSelectAmenity(amenity.id)}
              className={`p-4 rounded-2xl cursor-pointer transition-all border text-left flex flex-col justify-between ${
                isSelected
                  ? 'bg-indigo-50/75 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 leading-snug truncate">
                      {amenity.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {amenity.description}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-slate-900 shrink-0">
                  {feeDollars === 0 ? 'Free' : `$${feeDollars}/hr`}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>
                    {Math.floor(amenity.open_time_minutes / 60)}:00–
                    {Math.floor(amenity.close_time_minutes / 60)}:00
                  </span>
                </span>
                <span>•</span>
                <span>Max {amenity.capacity}</span>
                {isSelected && (
                  <span className="ml-auto flex items-center space-x-1 text-indigo-600 font-semibold">
                    <Check className="w-3.5 h-3.5" />
                    <span>Selected</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
