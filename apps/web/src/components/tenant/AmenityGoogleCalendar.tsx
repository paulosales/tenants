import React, { useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Plus,
  Sparkles,
  User,
} from 'lucide-react';
import type { Amenity, AmenityCalendarEvent } from '@tenants/shared-types';
import {
  addDaysLocal,
  formatLocalYyyyMmDd,
  formatMinutes12h,
  getLocalTimeZoneLabel,
  minutesToTimeInput,
  parseLocalYyyyMmDd,
  splitEventIntoLocalDaySegments,
  startOfWeekLocal,
} from '../../utils/dateTime';

const HOUR_HEIGHT_PX = 52;
const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface DraftCalendarSelection {
  dateStr: string;
  startMinutes: number;
  endMinutes: number;
}

interface AmenityGoogleCalendarProps {
  amenity: Amenity;
  events: AmenityCalendarEvent[];
  isLoading: boolean;
  isAdmin: boolean;
  anchorDateStr: string;
  viewMode: 'week' | 'day';
  draftSelection: DraftCalendarSelection | null;
  onChangeAnchorDate: (dateStr: string) => void;
  onChangeViewMode: (mode: 'week' | 'day') => void;
  onSelectVacantSlot: (dateStr: string, startMinutes: number, endMinutes: number) => void;
  onOpenNewSessionModal: () => void;
  onInspectEvent: (event: AmenityCalendarEvent) => void;
}

interface PositionedSegment {
  event: AmenityCalendarEvent;
  dateStr: string;
  startMinutes: number;
  endMinutes: number;
}

function clampMinutes(mins: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, mins));
}

function getTzShortAbbreviation(): string {
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

function formatHeaderRange(days: Date[], viewMode: 'week' | 'day'): string {
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

export const AmenityGoogleCalendar: React.FC<AmenityGoogleCalendarProps> = ({
  amenity,
  events,
  isLoading,
  isAdmin,
  anchorDateStr,
  viewMode,
  draftSelection,
  onChangeAnchorDate,
  onChangeViewMode,
  onSelectVacantSlot,
  onOpenNewSessionModal,
  onInspectEvent,
}) => {
  const [dragSelection, setDragSelection] = useState<{
    dateStr: string;
    anchorMinutes: number;
    hoverMinutes: number;
  } | null>(null);
  const handledMouseUpRef = useRef(false);

  const todayStr = formatLocalYyyyMmDd(new Date());
  const anchorDate = useMemo(() => parseLocalYyyyMmDd(anchorDateStr), [anchorDateStr]);

  const visibleDays = useMemo(() => {
    if (viewMode === 'day') {
      return [anchorDate];
    }
    const weekStart = startOfWeekLocal(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStart, i));
  }, [anchorDate, viewMode]);

  const segmentsByDate = useMemo(() => {
    const map = new Map<string, PositionedSegment[]>();
    for (const ev of events) {
      const segs = splitEventIntoLocalDaySegments(ev.start_time, ev.end_time);
      for (const seg of segs) {
        const list = map.get(seg.dateStr) || [];
        list.push({ event: ev, ...seg });
        map.set(seg.dateStr, list);
      }
    }
    return map;
  }, [events]);

  const { gridStartHour, gridEndHour } = useMemo(() => {
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
  }, [amenity.open_time_minutes, amenity.close_time_minutes, segmentsByDate]);

  const hours = useMemo(
    () => Array.from({ length: gridEndHour - gridStartHour }, (_, i) => gridStartHour + i),
    [gridStartHour, gridEndHour]
  );

  const gridStartMinutes = gridStartHour * 60;
  const gridEndMinutes = gridEndHour * 60;
  const totalGridHeightPx = hours.length * HOUR_HEIGHT_PX;
  const tzShort = useMemo(() => getTzShortAbbreviation(), []);

  const stepDays = viewMode === 'week' ? 7 : 1;

  const isSlotVacant = (dateStr: string, startMins: number, endMins: number): boolean => {
    if (startMins < amenity.open_time_minutes || endMins > amenity.close_time_minutes) {
      return false;
    }
    const dayEvents = segmentsByDate.get(dateStr) || [];
    return !dayEvents.some((ev) => ev.startMinutes < endMins && ev.endMinutes > startMins);
  };

  const isSlotPast = (dateStr: string, endMins: number): boolean => {
    const slotEnd = parseLocalYyyyMmDd(dateStr);
    slotEnd.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0);
    return slotEnd.getTime() <= Date.now();
  };

  const commitDragOrClick = (dateStr: string, startMins: number, endMins: number) => {
    const minDuration = Math.max(30, amenity.min_duration_minutes || 60);
    const maxDuration = Math.max(minDuration, amenity.max_duration_minutes || 240);
    const chosenDuration = clampMinutes(endMins - startMins, minDuration, maxDuration);
    const computedEnd = Math.min(amenity.close_time_minutes, startMins + chosenDuration);
    onSelectVacantSlot(dateStr, startMins, Math.max(startMins + minDuration, computedEnd));
  };

  const handleMouseDownSlot = (
    dateStr: string,
    slotStartMins: number,
    canBook: boolean
  ) => {
    if (!canBook) return;
    handledMouseUpRef.current = false;
    setDragSelection({
      dateStr,
      anchorMinutes: slotStartMins,
      hoverMinutes: slotStartMins,
    });
  };

  const handleMouseEnterSlot = (
    dateStr: string,
    slotStartMins: number,
    canBook: boolean
  ) => {
    if (!dragSelection || dragSelection.dateStr !== dateStr || !canBook) return;
    const minStart = Math.min(dragSelection.anchorMinutes, slotStartMins);
    const maxEnd = Math.max(dragSelection.anchorMinutes, slotStartMins) + 60;
    if (isSlotVacant(dateStr, minStart, maxEnd)) {
      setDragSelection((prev) => (prev ? { ...prev, hoverMinutes: slotStartMins } : null));
    }
  };

  const handleMouseUpWindow = () => {
    if (!dragSelection) return;
    handledMouseUpRef.current = true;
    const startMins = Math.min(dragSelection.anchorMinutes, dragSelection.hoverMinutes);
    const rawEnd = Math.max(dragSelection.anchorMinutes, dragSelection.hoverMinutes) + 60;
    const defaultSpan = Math.max(rawEnd - startMins, Math.min(120, amenity.max_duration_minutes || 120));
    const endMins = Math.min(amenity.close_time_minutes, startMins + defaultSpan);
    const targetDate = dragSelection.dateStr;
    setDragSelection(null);
    commitDragOrClick(targetDate, startMins, endMins);
  };

  const activePreview: DraftCalendarSelection | null = useMemo(() => {
    if (dragSelection) {
      const startMinutes = Math.min(dragSelection.anchorMinutes, dragSelection.hoverMinutes);
      const endMinutes = Math.max(dragSelection.anchorMinutes, dragSelection.hoverMinutes) + 60;
      return { dateStr: dragSelection.dateStr, startMinutes, endMinutes };
    }
    return draftSelection;
  }, [dragSelection, draftSelection]);

  return (
    <div
      className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden select-none"
      onMouseUp={handleMouseUpWindow}
      onMouseLeave={() => setDragSelection(null)}
    >
      {/* Google-Calendar Style Top Toolbar */}
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
              onClick={() => onChangeAnchorDate(formatLocalYyyyMmDd(addDaysLocal(anchorDate, -stepDays)))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              id="calendar-range-label"
              className="px-2.5 text-xs font-bold text-slate-800 min-w-[140px] text-center"
            >
              {formatHeaderRange(visibleDays, viewMode)}
            </span>
            <button
              type="button"
              id="calendar-next-btn"
              aria-label="Next period"
              onClick={() => onChangeAnchorDate(formatLocalYyyyMmDd(addDaysLocal(anchorDate, stepDays)))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => onChangeViewMode('week')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('day')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'day'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Day
            </button>
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

      {/* Operating Hours + Occupancy Legend */}
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

      {/* Scrollable Google-Calendar Time Grid */}
      <div className="overflow-x-auto">
        <div className={viewMode === 'week' ? 'min-w-[740px]' : 'min-w-[340px]'}>
          {/* Day Headers Row */}
          <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
            <div className="w-16 shrink-0 py-2.5 px-2 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400 border-r border-slate-200 flex items-end justify-end">
              {tzShort}
            </div>
            <div
              className={`flex-1 grid ${
                visibleDays.length === 7 ? 'grid-cols-7' : 'grid-cols-1'
              }`}
            >
              {visibleDays.map((day) => {
                const dStr = formatLocalYyyyMmDd(day);
                const isToday = dStr === todayStr;
                return (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => {
                      onChangeAnchorDate(dStr);
                      if (viewMode === 'week') onChangeViewMode('day');
                    }}
                    className="py-2.5 px-2 text-center border-r last:border-r-0 border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span
                      className={`block text-[10px] font-bold uppercase tracking-wider ${
                        isToday ? 'text-indigo-600' : 'text-slate-500'
                      }`}
                    >
                      {SHORT_WEEKDAYS[day.getDay()]}
                    </span>
                    <span
                      className={`mt-1 mx-auto w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold ${
                        isToday
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-800'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hourly Time Grid */}
          <div className="relative max-h-[560px] overflow-y-auto">
            {isLoading && (
              <div className="absolute top-2 right-3 z-20 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold">
                Syncing availability...
              </div>
            )}

            <div className="flex" style={{ height: `${totalGridHeightPx}px` }}>
              {/* Left Time Gutter */}
              <div className="w-16 shrink-0 border-r border-slate-200 bg-slate-50/40 relative">
                {hours.map((hr) => (
                  <div
                    key={hr}
                    style={{ height: `${HOUR_HEIGHT_PX}px` }}
                    className="relative pr-2 text-right"
                  >
                    <span className="text-[10px] font-semibold text-slate-400 -top-2 relative">
                      {formatMinutes12h(hr * 60)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day Columns */}
              <div
                className={`flex-1 grid relative ${
                  visibleDays.length === 7 ? 'grid-cols-7' : 'grid-cols-1'
                }`}
              >
                {visibleDays.map((day) => {
                  const dateStr = formatLocalYyyyMmDd(day);
                  const dayEvents = segmentsByDate.get(dateStr) || [];
                  const isTodayCol = dateStr === todayStr;

                  return (
                    <div
                      key={dateStr}
                      className={`relative border-r last:border-r-0 border-slate-200 ${
                        isTodayCol ? 'bg-indigo-50/15' : 'bg-white'
                      }`}
                    >
                      {/* Clickable Hourly Vacant Cells */}
                      {hours.map((hr) => {
                        const slotStartMins = hr * 60;
                        const slotEndMins = slotStartMins + 60;
                        const hhmm = minutesToTimeInput(slotStartMins);
                        const withinHours =
                          slotStartMins >= amenity.open_time_minutes &&
                          slotEndMins <= amenity.close_time_minutes;
                        const past = isSlotPast(dateStr, slotEndMins);
                        const vacant = isSlotVacant(dateStr, slotStartMins, slotEndMins);
                        const canBook = withinHours && !past && vacant;

                        return (
                          <button
                            key={hhmm}
                            type="button"
                            data-testid={`calendar-slot-${dateStr}-${hhmm}`}
                            aria-label={
                              canBook
                                ? `Schedule ${amenity.name} on ${dateStr} at ${formatMinutes12h(
                                    slotStartMins
                                  )}`
                                : withinHours
                                  ? `${dateStr} at ${formatMinutes12h(slotStartMins)} unavailable`
                                  : `${dateStr} at ${formatMinutes12h(slotStartMins)} closed`
                            }
                            disabled={!canBook}
                            onMouseDown={() => handleMouseDownSlot(dateStr, slotStartMins, canBook)}
                            onMouseEnter={() =>
                              handleMouseEnterSlot(dateStr, slotStartMins, canBook)
                            }
                            onClick={() => {
                              if (!canBook) return;
                              if (handledMouseUpRef.current) {
                                handledMouseUpRef.current = false;
                                return;
                              }
                              const defaultDuration = Math.min(
                                Math.max(120, amenity.min_duration_minutes || 60),
                                amenity.max_duration_minutes || 240
                              );
                              commitDragOrClick(dateStr, slotStartMins, slotStartMins + defaultDuration);
                            }}
                            style={{ height: `${HOUR_HEIGHT_PX}px` }}
                            className={`w-full block border-b border-slate-100 text-left px-1.5 relative group transition-colors ${
                              !withinHours
                                ? 'bg-slate-100/70 cursor-not-allowed'
                                : past
                                  ? 'bg-slate-50/80 cursor-not-allowed'
                                  : canBook
                                    ? 'hover:bg-indigo-50/85 cursor-pointer'
                                    : 'cursor-default'
                            }`}
                          >
                            {/* Half-hour guideline */}
                            <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-slate-100 pointer-events-none" />

                            {canBook && (
                              <span className="hidden group-hover:inline-flex items-center space-x-1 text-[10px] font-bold text-indigo-700 bg-indigo-100/90 px-1.5 py-0.5 rounded-md mt-1">
                                <Plus className="w-2.5 h-2.5" />
                                <span>{formatMinutes12h(slotStartMins)}</span>
                              </span>
                            )}
                            {!withinHours && (
                              <span className="text-[9px] font-medium text-slate-300 mt-1 inline-block">
                                Closed
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* Draft Ghost Event Preview while Selecting / Creating */}
                      {activePreview && activePreview.dateStr === dateStr && (
                        <div
                          className="absolute left-1 right-1 z-10 rounded-lg border-2 border-dashed border-indigo-500 bg-indigo-100/80 px-2 py-1 text-[11px] font-bold text-indigo-900 pointer-events-none shadow-xs"
                          style={{
                            top: `${
                              ((clampMinutes(
                                activePreview.startMinutes,
                                gridStartMinutes,
                                gridEndMinutes
                              ) -
                                gridStartMinutes) /
                                60) *
                              HOUR_HEIGHT_PX
                            }px`,
                            height: `${Math.max(
                              28,
                              ((clampMinutes(
                                activePreview.endMinutes,
                                gridStartMinutes,
                                gridEndMinutes
                              ) -
                                clampMinutes(
                                  activePreview.startMinutes,
                                  gridStartMinutes,
                                  gridEndMinutes
                                )) /
                                60) *
                                HOUR_HEIGHT_PX
                            )}px`,
                          }}
                        >
                          <div className="truncate flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 shrink-0 text-indigo-600" />
                            <span>New Session</span>
                          </div>
                          <div className="text-[10px] font-medium text-indigo-700 truncate">
                            {formatMinutes12h(activePreview.startMinutes)} –{' '}
                            {formatMinutes12h(activePreview.endMinutes)}
                          </div>
                        </div>
                      )}

                      {/* Scheduled Session Event Blocks */}
                      {dayEvents.map((seg) => {
                        const clampedStart = clampMinutes(
                          seg.startMinutes,
                          gridStartMinutes,
                          gridEndMinutes
                        );
                        const clampedEnd = clampMinutes(
                          seg.endMinutes,
                          gridStartMinutes,
                          gridEndMinutes
                        );
                        if (clampedEnd <= clampedStart) return null;

                        const topPx = ((clampedStart - gridStartMinutes) / 60) * HOUR_HEIGHT_PX;
                        const heightPx = Math.max(
                          28,
                          ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT_PX - 2
                        );
                        const ev = seg.event;
                        const timeRangeLabel = `${formatMinutes12h(
                          seg.startMinutes
                        )} – ${formatMinutes12h(seg.endMinutes)}`;

                        // Non-admin viewing another resident's slot: zero identity/PII rendered
                        const isPrivateBusy = !isAdmin && !ev.is_own;

                        if (isPrivateBusy) {
                          return (
                            <div
                              key={`${ev.id}-${seg.dateStr}-${seg.startMinutes}`}
                              data-testid={`calendar-event-${ev.id}`}
                              style={{ top: `${topPx + 1}px`, height: `${heightPx}px` }}
                              title="This time slot is already scheduled."
                              className="absolute left-1 right-1 z-10 rounded-lg border-l-4 border-slate-500 bg-slate-200/90 text-slate-800 px-2 py-1 overflow-hidden shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-bold truncate flex items-center space-x-1">
                                  <Lock className="w-3 h-3 shrink-0 text-slate-500" />
                                  <span>Reserved</span>
                                </span>
                                <span className="text-[9px] font-bold uppercase text-slate-500 shrink-0">
                                  Busy
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-600 truncate">
                                {timeRangeLabel}
                              </div>
                            </div>
                          );
                        }

                        const isPending = ev.status === 'pending';
                        const cardColorClass =
                          isAdmin && !ev.is_own
                            ? isPending
                              ? 'border-amber-500 bg-amber-50/95 text-amber-950 hover:bg-amber-100'
                              : 'border-emerald-600 bg-emerald-50/95 text-emerald-950 hover:bg-emerald-100'
                            : 'border-indigo-600 bg-indigo-100/95 text-indigo-950 hover:bg-indigo-200/80';

                        const primaryTitle = isAdmin
                          ? ev.scheduled_by_name
                            ? `${ev.scheduled_by_name}${
                                ev.unit_number ? ` · Unit ${ev.unit_number}` : ''
                              }`
                            : ev.is_own
                              ? 'Your Session'
                              : 'Scheduled Session'
                          : 'Your Session';

                        return (
                          <button
                            key={`${ev.id}-${seg.dateStr}-${seg.startMinutes}`}
                            type="button"
                            data-testid={`calendar-event-${ev.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onInspectEvent(ev);
                            }}
                            style={{ top: `${topPx + 1}px`, height: `${heightPx}px` }}
                            className={`absolute left-1 right-1 z-10 rounded-lg border-l-4 px-2 py-1 text-left overflow-hidden shadow-xs transition-colors cursor-pointer ${cardColorClass}`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold truncate flex items-center space-x-1">
                                {isAdmin && <User className="w-3 h-3 shrink-0 opacity-75" />}
                                <span className="truncate">{primaryTitle}</span>
                              </span>
                              <span className="text-[9px] font-extrabold uppercase px-1 rounded bg-white/70 shrink-0">
                                {ev.status}
                              </span>
                            </div>
                            <div className="text-[10px] opacity-85 truncate">{timeRangeLabel}</div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
