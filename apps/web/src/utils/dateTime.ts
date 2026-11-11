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

