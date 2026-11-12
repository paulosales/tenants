import React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import type { Amenity } from '@tenants/shared-types';
import {
  addDaysLocal,
  formatLocalYyyyMmDd,
  formatMinutes12h,
  getLocalTimeZoneLabel,
} from '../../utils/dateTime';
import { formatCalendarHeaderRange } from './calendarEventStrategies';

interface CalendarToolbarProps {
  amenity: Amenity;
  isAdmin: boolean;
  todayStr: string;
  anchorDate: Date;
  visibleDays: Date[];
  viewMode: 'week' | 'day';
  onChangeAnchorDate: (dateStr: string) => void;
  onChangeViewMode: (mode: 'week' | 'day') => void;
  onOpenNewSessionModal: () => void;
}

export const CalendarToolbar: React.FC<CalendarToolbarProps> = ({
  amenity,
  isAdmin,
  todayStr,
  anchorDate,
  visibleDays,
  viewMode,
  onChangeAnchorDate,
  onChangeViewMode,
  onOpenNewSessionModal,
}) => {
  const stepDays = viewMode === 'week' ? 7 : 1;

  return (
    <>
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Schedule Amenity Session
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {amenity.hourly_rate_cents === 0
                  ? 'Free Access'
                  : `$${amenity.hourly_rate_cents / 100}/hr`}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Configuring reservation for{' '}
              <span className="font-semibold text-slate-800">{amenity.name}</span> · Click any
              vacant slot to book
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="calendar-today-btn"
            onClick={() => onChangeAnchorDate(todayStr)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              id="calendar-prev-btn"
              aria-label="Previous period"
              onClick={() =>
                onChangeAnchorDate(formatLocalYyyyMmDd(addDaysLocal(anchorDate, -stepDays)))
              }
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              id="calendar-range-label"
              className="px-2.5 text-xs font-bold text-slate-800 min-w-[140px] text-center"
            >
              {formatCalendarHeaderRange(visibleDays, viewMode)}
            </span>
            <button
              type="button"
              id="calendar-next-btn"
              aria-label="Next period"
              onClick={() =>
                onChangeAnchorDate(formatLocalYyyyMmDd(addDaysLocal(anchorDate, stepDays)))
              }
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200">
            {(['week', 'day'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChangeViewMode(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  viewMode === mode
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {mode === 'week' ? 'Week' : 'Day'}
              </button>
            ))}
          </div>

          <button
            type="button"
            id="calendar-create-btn"
            onClick={onOpenNewSessionModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      <div className="px-5 py-2.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <div className="flex flex-wrap items-center gap-3 text-slate-600">
          <span className="inline-flex items-center space-x-1 font-medium">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>
              Hours:{' '}
              {amenity.open_time_minutes === 0 && amenity.close_time_minutes >= 1440
                ? 'Open 24/7'
                : `${formatMinutes12h(amenity.open_time_minutes)} – ${formatMinutes12h(
                    amenity.close_time_minutes
                  )}`}
            </span>
          </span>
          <span>•</span>
          <span>Min {amenity.min_duration_minutes / 60}h</span>
          <span>•</span>
          <span>Max {amenity.capacity} guests</span>
          <span>•</span>
          <span className="text-slate-500">TZ: {getLocalTimeZoneLabel()}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center space-x-1.5 text-slate-600">
            <span className="w-3 h-3 rounded bg-white border border-emerald-400 inline-block" />
            <span>Vacant (click to schedule)</span>
          </span>
          <span className="inline-flex items-center space-x-1.5 text-slate-600">
            <span className="w-3 h-3 rounded bg-indigo-500 inline-block" />
            <span>{isAdmin ? 'Confirmed Session' : 'Your Session'}</span>
          </span>
          <span className="inline-flex items-center space-x-1.5 text-slate-600">
            <span
              className={`w-3 h-3 rounded inline-block ${
                isAdmin ? 'bg-amber-400' : 'bg-slate-400'
              }`}
            />
            <span>{isAdmin ? 'Pending Approval' : 'Reserved (Private)'}</span>
          </span>
        </div>
      </div>
    </>
  );
};
