import type { Amenity, AmenityCalendarEvent } from '@tenants/shared-types';
import {
  formatMinutes12h,
  minutesToTimeInput,
  splitEventIntoLocalDaySegments,
} from '../../utils/dateTime';

export type CalendarEventVariant =
  | 'private-reserved'
  | 'own-session'
  | 'admin-pending'
  | 'admin-confirmed';

export interface CalendarEventPresentation {
  variant: CalendarEventVariant;
  isPrivateMasked: boolean;
  interactive: boolean;
  title: string;
  badgeText: string;
  showUserIcon: boolean;
  containerClass: string;
}

const EVENT_VARIANT_CLASSES: Record<CalendarEventVariant, string> = {
  'private-reserved':
    'border-slate-500 bg-slate-200/90 text-slate-800',
  'own-session':
    'border-indigo-600 bg-indigo-100/95 text-indigo-950 hover:bg-indigo-200/80',
  'admin-pending':
    'border-amber-500 bg-amber-50/95 text-amber-950 hover:bg-amber-100',
  'admin-confirmed':
    'border-emerald-600 bg-emerald-50/95 text-emerald-950 hover:bg-emerald-100',
};

/**
 * Open/Closed event presentation strategy: derives UI state & privacy masking
 * for a scheduled slot strictly from the viewer's role and ownership.
 */
export function getCalendarEventPresentation(
  event: AmenityCalendarEvent,
  isAdmin: boolean
): CalendarEventPresentation {
  if (!isAdmin && !event.is_own) {
    return {
      variant: 'private-reserved',
      isPrivateMasked: true,
      interactive: false,
      title: 'Reserved',
      badgeText: 'Busy',
      showUserIcon: false,
      containerClass: EVENT_VARIANT_CLASSES['private-reserved'],
    };
  }

  if (isAdmin) {
    const variant: CalendarEventVariant =
      !event.is_own && event.status === 'pending'
        ? 'admin-pending'
        : !event.is_own
          ? 'admin-confirmed'
          : 'own-session';
    const title = event.scheduled_by_name
      ? `${event.scheduled_by_name}${event.unit_number ? ` · Unit ${event.unit_number}` : ''}`
      : event.is_own
        ? 'Your Session'
        : 'Scheduled Session';
    return {
      variant,
      isPrivateMasked: false,
      interactive: true,
      title,
      badgeText: event.status,
      showUserIcon: true,
      containerClass: EVENT_VARIANT_CLASSES[variant],
    };
  }

  return {
    variant: 'own-session',
    isPrivateMasked: false,
    interactive: true,
    title: 'Your Session',
    badgeText: event.status,
    showUserIcon: false,
    containerClass: EVENT_VARIANT_CLASSES['own-session'],
  };
}

export function clampMinutes(mins: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, mins));
}

export function buildHalfHourTimeOptions(minMins: number, maxMins: number, step = 30): string[] {
  const options: string[] = [];
  for (let m = minMins; m <= maxMins; m += step) {
    options.push(minutesToTimeInput(m));
  }
  return options;
}

export function computeSmartEndMinutes(
  amenity: Amenity,
  startMinutes: number,
  requestedEndMinutes: number
): number {
  const minDuration = Math.max(30, amenity.min_duration_minutes || 60);
  const maxDuration = Math.max(minDuration, amenity.max_duration_minutes || 240);
  const chosenDuration = clampMinutes(requestedEndMinutes - startMinutes, minDuration, maxDuration);
  const computedEnd = Math.min(amenity.close_time_minutes, startMinutes + chosenDuration);
  return Math.max(startMinutes + minDuration, computedEnd);
}

export function findSlotConflict(
  events: AmenityCalendarEvent[],
  dateStr: string,
  startMins: number,
  endMins: number
): boolean {
  if (!dateStr || endMins <= startMins) return false;
  for (const ev of events) {
    const segs = splitEventIntoLocalDaySegments(ev.start_time, ev.end_time);
    if (
      segs.some(
        (seg) => seg.dateStr === dateStr && seg.startMinutes < endMins && seg.endMinutes > startMins
      )
    ) {
      return true;
    }
  }
  return false;
}

export function computeAdaptiveHourBounds(
  amenity: Amenity,
  segmentsByDate: Map<string, Array<{ startMinutes: number; endMinutes: number }>>
): { gridStartHour: number; gridEndHour: number } {
  const is24h = amenity.open_time_minutes === 0 && amenity.close_time_minutes >= 1440;
  let startHr = is24h ? 7 : Math.max(0, Math.min(8, Math.floor(amenity.open_time_minutes / 60)));
  let endHr = is24h ? 22 : Math.min(24, Math.max(21, Math.ceil(amenity.close_time_minutes / 60)));

  for (const segs of segmentsByDate.values()) {
    for (const seg of segs) {
      startHr = Math.min(startHr, Math.floor(seg.startMinutes / 60));
      endHr = Math.max(endHr, Math.ceil(seg.endMinutes / 60));
    }
  }
  if (endHr <= startHr) {
    endHr = Math.min(24, startHr + 12);
  }
  return { gridStartHour: startHr, gridEndHour: endHr };
}

export function getTzShortAbbreviation(): string {
  try {
    return (
      new Intl.DateTimeFormat([], { timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value || 'Local'
    );
  } catch {
    return 'Local';
  }
}

export function formatCalendarHeaderRange(days: Date[], viewMode: 'week' | 'day'): string {
  if (days.length === 0) return '';
  if (viewMode === 'day' || days.length === 1) {
    return days[0].toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  const first = days[0];
  const last = days[days.length - 1];
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  if (sameMonth) {
    const month = first.toLocaleDateString(undefined, { month: 'short' });
    return `${month} ${first.getDate()} – ${last.getDate()}, ${last.getFullYear()}`;
  }
  const startLabel = first.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endLabel = last.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

export function formatTimeRange12h(startMinutes: number, endMinutes: number): string {
  return `${formatMinutes12h(startMinutes)} – ${formatMinutes12h(endMinutes)}`;
}

