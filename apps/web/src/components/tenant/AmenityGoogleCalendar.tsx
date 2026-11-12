import React, { useMemo } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import type { Amenity, AmenityCalendarEvent } from '@tenants/shared-types';
import {
  useCalendarSlotDrag,
  type DraftCalendarSelection,
} from '../../hooks/useCalendarSlotDrag';
import {
  addDaysLocal,
  formatLocalYyyyMmDd,
  formatMinutes12h,
  minutesToTimeInput,
  parseLocalYyyyMmDd,
  splitEventIntoLocalDaySegments,
  startOfWeekLocal,
} from '../../utils/dateTime';
import { CalendarEventBlock } from './CalendarEventBlock';
import { CalendarToolbar } from './CalendarToolbar';
import {
  clampMinutes,
  computeAdaptiveHourBounds,
  formatTimeRange12h,
  getTzShortAbbreviation,
} from './calendarEventStrategies';

export type { DraftCalendarSelection };

const HOUR_HEIGHT_PX = 52;
const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  const todayStr = formatLocalYyyyMmDd(new Date());
  const anchorDate = useMemo(() => parseLocalYyyyMmDd(anchorDateStr), [anchorDateStr]);

  const visibleDays = useMemo(() => {
    if (viewMode === 'day') return [anchorDate];
    const weekStart = startOfWeekLocal(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStart, i));
  }, [anchorDate, viewMode]);

  const segmentsByDate = useMemo(() => {
    const map = new Map<string, PositionedSegment[]>();
    for (const ev of events) {
      for (const seg of splitEventIntoLocalDaySegments(ev.start_time, ev.end_time)) {
        const list = map.get(seg.dateStr) || [];
        list.push({ event: ev, ...seg });
        map.set(seg.dateStr, list);
      }
    }
    return map;
  }, [events]);

  const { gridStartHour, gridEndHour } = useMemo(
    () => computeAdaptiveHourBounds(amenity, segmentsByDate),
    [amenity, segmentsByDate]
  );

  const hours = useMemo(
    () => Array.from({ length: gridEndHour - gridStartHour }, (_, i) => gridStartHour + i),
    [gridStartHour, gridEndHour]
  );

  const gridStartMinutes = gridStartHour * 60;
  const gridEndMinutes = gridEndHour * 60;
  const totalGridHeightPx = hours.length * HOUR_HEIGHT_PX;
  const tzShort = useMemo(() => getTzShortAbbreviation(), []);

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

  const {
    activeDragPreview,
    handleMouseDownSlot,
    handleMouseEnterSlot,
    handleWindowMouseUp,
    handleSlotClick,
    clearDrag,
  } = useCalendarSlotDrag({
    amenity,
    isRangeVacant: isSlotVacant,
    onCommitRange: onSelectVacantSlot,
  });

  const activePreview = activeDragPreview || draftSelection;

  return (
    <div
      className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden select-none"
      onMouseUp={handleWindowMouseUp}
      onMouseLeave={clearDrag}
    >
      <CalendarToolbar
        amenity={amenity}
        isAdmin={isAdmin}
        todayStr={todayStr}
        anchorDate={anchorDate}
        visibleDays={visibleDays}
        viewMode={viewMode}
        onChangeAnchorDate={onChangeAnchorDate}
        onChangeViewMode={onChangeViewMode}
        onOpenNewSessionModal={onOpenNewSessionModal}
      />

      <div className="overflow-x-auto">
        <div className={viewMode === 'week' ? 'min-w-[740px]' : 'min-w-[340px]'}>
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
                        isToday ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-800'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative max-h-[560px] overflow-y-auto">
            {isLoading && (
              <div className="absolute top-2 right-3 z-20 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold">
                Syncing availability...
              </div>
            )}

            <div className="flex" style={{ height: `${totalGridHeightPx}px` }}>
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
                            onMouseDown={() =>
                              handleMouseDownSlot(dateStr, slotStartMins, canBook)
                            }
                            onMouseEnter={() =>
                              handleMouseEnterSlot(dateStr, slotStartMins, canBook)
                            }
                            onClick={() => handleSlotClick(dateStr, slotStartMins, canBook)}
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
                            {formatTimeRange12h(
                              activePreview.startMinutes,
                              activePreview.endMinutes
                            )}
                          </div>
                        </div>
                      )}

                      {dayEvents.map((seg) => (
                        <CalendarEventBlock
                          key={`${seg.event.id}-${seg.dateStr}-${seg.startMinutes}`}
                          event={seg.event}
                          dateStr={seg.dateStr}
                          startMinutes={seg.startMinutes}
                          endMinutes={seg.endMinutes}
                          gridStartMinutes={gridStartMinutes}
                          gridEndMinutes={gridEndMinutes}
                          hourHeightPx={HOUR_HEIGHT_PX}
                          isAdmin={isAdmin}
                          onInspectEvent={onInspectEvent}
                        />
                      ))}
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
