export function getLocalTimeZoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  } catch {
    return 'Local';
  }
}

export function formatLocalYyyyMmDd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayLocalStr(): string {
  return formatLocalYyyyMmDd(new Date());
}

export function getTomorrowLocalStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatLocalYyyyMmDd(d);
}

export function formatLocalSessionDate(startTimeStr?: string, bookingDate?: string): string {
  if (startTimeStr && (startTimeStr.includes('T') || startTimeStr.includes('Z'))) {
    const d = new Date(startTimeStr);
    if (!isNaN(d.getTime())) {
      return formatLocalYyyyMmDd(d);
    }
  }
  return bookingDate || 'N/A';
}

export function formatLocalSessionTimeWindow(
  startTimeStr: string,
  endTimeStr: string,
  _bookingDate?: string
): string {
  if (!startTimeStr || !endTimeStr) return 'N/A';

  if (startTimeStr.includes('T') || startTimeStr.includes('Z')) {
    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const startLocal = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endLocal = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let tz = '';
      try {
        tz =
          new Intl.DateTimeFormat([], { timeZoneName: 'short' })
            .formatToParts(start)
            .find((p) => p.type === 'timeZoneName')?.value || '';
      } catch {
        // Fallback if timeZoneName part is unavailable
      }
      return tz ? `${startLocal} - ${endLocal} (${tz})` : `${startLocal} - ${endLocal}`;
    }
  }

  return `${startTimeStr} - ${endTimeStr}`;
}

export function formatUtcTimeWindow(startTimeStr: string, endTimeStr: string): string {
  if (!startTimeStr || !endTimeStr) return '';
  try {
    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const sH = String(start.getUTCHours()).padStart(2, '0');
      const sM = String(start.getUTCMinutes()).padStart(2, '0');
      const eH = String(end.getUTCHours()).padStart(2, '0');
      const eM = String(end.getUTCMinutes()).padStart(2, '0');
      return `${sH}:${sM} - ${eH}:${eM} UTC`;
    }
  } catch {
    // Ignore parse error
  }
  return '';
}

export function parseLocalYyyyMmDd(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function addDaysLocal(base: Date, days: number): Date {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, 0, 0, 0, 0);
  return next;
}

export function startOfWeekLocal(base: Date): Date {
  const normalized = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  const dayOfWeek = normalized.getDay(); // 0 (Sun) .. 6 (Sat)
  return addDaysLocal(normalized, -dayOfWeek);
}

export function minutesToTimeInput(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeInputToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function formatMinutes12h(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, totalMinutes));
  const h24 = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export interface LocalDaySegment {
  dateStr: string;
  startMinutes: number;
  endMinutes: number;
}

/** Splits a UTC timestamp interval across local calendar days for vertical time-grid layout. */
export function splitEventIntoLocalDaySegments(
  startIso: string,
  endIso: string
): LocalDaySegment[] {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return [];

  const segments: LocalDaySegment[] = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const endDayMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);

  while (cursor <= endDayMidnight) {
    const nextMidnight = addDaysLocal(cursor, 1);
    const segStartMs = Math.max(start.getTime(), cursor.getTime());
    const segEndMs = Math.min(end.getTime(), nextMidnight.getTime());

    if (segEndMs > segStartMs) {
      const startMinutes = Math.round((segStartMs - cursor.getTime()) / 60000);
      const endMinutes = Math.round((segEndMs - cursor.getTime()) / 60000);
      segments.push({
        dateStr: formatLocalYyyyMmDd(cursor),
        startMinutes,
        endMinutes,
      });
    }
    cursor = nextMidnight;
  }

  return segments;
}

