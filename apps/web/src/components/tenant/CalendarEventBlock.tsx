import React from 'react';
import { Lock, User } from 'lucide-react';
import type { AmenityCalendarEvent } from '@tenants/shared-types';
import {
  clampMinutes,
  formatTimeRange12h,
  getCalendarEventPresentation,
} from './calendarEventStrategies';

interface CalendarEventBlockProps {
  event: AmenityCalendarEvent;
  dateStr: string;
  startMinutes: number;
  endMinutes: number;
  gridStartMinutes: number;
  gridEndMinutes: number;
  hourHeightPx: number;
  isAdmin: boolean;
  onInspectEvent: (event: AmenityCalendarEvent) => void;
}

export const CalendarEventBlock: React.FC<CalendarEventBlockProps> = ({
  event,
  dateStr,
  startMinutes,
  endMinutes,
  gridStartMinutes,
  gridEndMinutes,
  hourHeightPx,
  isAdmin,
  onInspectEvent,
}) => {
  const clampedStart = clampMinutes(startMinutes, gridStartMinutes, gridEndMinutes);
  const clampedEnd = clampMinutes(endMinutes, gridStartMinutes, gridEndMinutes);
  if (clampedEnd <= clampedStart) return null;

  const topPx = ((clampedStart - gridStartMinutes) / 60) * hourHeightPx;
  const heightPx = Math.max(28, ((clampedEnd - clampedStart) / 60) * hourHeightPx - 2);
  const timeRangeLabel = formatTimeRange12h(startMinutes, endMinutes);
  const presentation = getCalendarEventPresentation(event, isAdmin);

  if (!presentation.interactive) {
    return (
      <div
        key={`${event.id}-${dateStr}-${startMinutes}`}
        data-testid={`calendar-event-${event.id}`}
        style={{ top: `${topPx + 1}px`, height: `${heightPx}px` }}
        title="This time slot is already scheduled."
        className={`absolute left-1 right-1 z-10 rounded-lg border-l-4 px-2 py-1 overflow-hidden shadow-2xs ${presentation.containerClass}`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-[11px] font-bold truncate flex items-center space-x-1">
            <Lock className="w-3 h-3 shrink-0 text-slate-500" />
            <span>{presentation.title}</span>
          </span>
          <span className="text-[9px] font-bold uppercase text-slate-500 shrink-0">
            {presentation.badgeText}
          </span>
        </div>
        <div className="text-[10px] text-slate-600 truncate">{timeRangeLabel}</div>
      </div>
    );
  }

  return (
    <button
      key={`${event.id}-${dateStr}-${startMinutes}`}
      type="button"
      data-testid={`calendar-event-${event.id}`}
      onClick={(e) => {
        e.stopPropagation();
        onInspectEvent(event);
      }}
      style={{ top: `${topPx + 1}px`, height: `${heightPx}px` }}
      className={`absolute left-1 right-1 z-10 rounded-lg border-l-4 px-2 py-1 text-left overflow-hidden shadow-xs transition-colors cursor-pointer ${presentation.containerClass}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-bold truncate flex items-center space-x-1">
          {presentation.showUserIcon && <User className="w-3 h-3 shrink-0 opacity-75" />}
          <span className="truncate">{presentation.title}</span>
        </span>
        <span className="text-[9px] font-extrabold uppercase px-1 rounded bg-white/70 shrink-0">
          {presentation.badgeText}
        </span>
      </div>
      <div className="text-[10px] opacity-85 truncate">{timeRangeLabel}</div>
    </button>
  );
};
