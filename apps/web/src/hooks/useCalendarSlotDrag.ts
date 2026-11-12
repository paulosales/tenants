import { useMemo, useRef, useState } from 'react';
import type { Amenity } from '@tenants/shared-types';
import { computeSmartEndMinutes } from '../components/tenant/calendarEventStrategies';

export interface DraftCalendarSelection {
  dateStr: string;
  startMinutes: number;
  endMinutes: number;
}

interface UseCalendarSlotDragOptions {
  amenity: Amenity;
  isRangeVacant: (dateStr: string, startMins: number, endMins: number) => boolean;
  onCommitRange: (dateStr: string, startMinutes: number, endMinutes: number) => void;
}

/**
 * Encapsulates pointer drag-selection across hourly calendar cells without duplicate
 * click/mouseup commits (SRP).
 */
export function useCalendarSlotDrag({
  amenity,
  isRangeVacant,
  onCommitRange,
}: UseCalendarSlotDragOptions) {
  const [dragSelection, setDragSelection] = useState<{
    dateStr: string;
    anchorMinutes: number;
    hoverMinutes: number;
  } | null>(null);
  const handledMouseUpRef = useRef(false);

  const commit = (dateStr: string, startMins: number, rawEndMins: number) => {
    const endMins = computeSmartEndMinutes(amenity, startMins, rawEndMins);
    onCommitRange(dateStr, startMins, endMins);
  };

  const handleMouseDownSlot = (dateStr: string, slotStartMins: number, canBook: boolean) => {
    if (!canBook) return;
    handledMouseUpRef.current = false;
    setDragSelection({
      dateStr,
      anchorMinutes: slotStartMins,
      hoverMinutes: slotStartMins,
    });
  };

  const handleMouseEnterSlot = (dateStr: string, slotStartMins: number, canBook: boolean) => {
    if (!dragSelection || dragSelection.dateStr !== dateStr || !canBook) return;
    const minStart = Math.min(dragSelection.anchorMinutes, slotStartMins);
    const maxEnd = Math.max(dragSelection.anchorMinutes, slotStartMins) + 60;
    if (isRangeVacant(dateStr, minStart, maxEnd)) {
      setDragSelection((prev) => (prev ? { ...prev, hoverMinutes: slotStartMins } : null));
    }
  };

  const handleWindowMouseUp = () => {
    if (!dragSelection) return;
    handledMouseUpRef.current = true;
    const startMins = Math.min(dragSelection.anchorMinutes, dragSelection.hoverMinutes);
    const rawEnd = Math.max(dragSelection.anchorMinutes, dragSelection.hoverMinutes) + 60;
    const defaultSpan = Math.max(
      rawEnd - startMins,
      Math.min(120, amenity.max_duration_minutes || 120)
    );
    const endMins = Math.min(amenity.close_time_minutes, startMins + defaultSpan);
    const targetDate = dragSelection.dateStr;
    setDragSelection(null);
    commit(targetDate, startMins, endMins);
  };

  const handleSlotClick = (dateStr: string, slotStartMins: number, canBook: boolean) => {
    if (!canBook) return;
    if (handledMouseUpRef.current) {
      handledMouseUpRef.current = false;
      return;
    }
    const defaultDuration = Math.min(
      Math.max(120, amenity.min_duration_minutes || 60),
      amenity.max_duration_minutes || 240
    );
    commit(dateStr, slotStartMins, slotStartMins + defaultDuration);
  };

  const activeDragPreview: DraftCalendarSelection | null = useMemo(() => {
    if (!dragSelection) return null;
    return {
      dateStr: dragSelection.dateStr,
      startMinutes: Math.min(dragSelection.anchorMinutes, dragSelection.hoverMinutes),
      endMinutes: Math.max(dragSelection.anchorMinutes, dragSelection.hoverMinutes) + 60,
    };
  }, [dragSelection]);

  return {
    activeDragPreview,
    handleMouseDownSlot,
    handleMouseEnterSlot,
    handleWindowMouseUp,
    handleSlotClick,
    clearDrag: () => setDragSelection(null),
  };
}
