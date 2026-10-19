/**
 * Timezone utility for Asia/Tashkent (GMT+5)
 */

const TASHKENT_TIMEZONE = "Asia/Tashkent";

/**
 * Formats a date to the Tashkent timezone
 * @param date - Date string or Date object
 * @param options - Intl.DateTimeFormatOptions for customization
 * @returns Formatted date string in Tashkent timezone
 */
export function formatInTashkent(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "-";
  
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    // Check if it's a valid date
    if (isNaN(dateObj.getTime())) {
      return "-";
    }

    // Explicit options replace the defaults instead of being merged into them:
    // merging made the date-only and time-only helpers print date AND time.
    const defaultOptions: Intl.DateTimeFormatOptions = options ?? {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    };

    return dateObj.toLocaleString("en-GB", {
      ...defaultOptions,
      timeZone: TASHKENT_TIMEZONE,
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "-";
  }
}

/**
 * Formats a date to short date format in Tashkent timezone
 * @param date - Date string or Date object
 * @returns Formatted date string (DD/MM/YYYY)
 */
export function formatDateInTashkent(date: string | Date): string {
  return formatInTashkent(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Formats a date to time only in Tashkent timezone
 * @param date - Date string or Date object
 * @returns Formatted time string (HH:MM:SS)
 */
export function formatTimeInTashkent(date: string | Date): string {
  return formatInTashkent(date, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Formats a date to full datetime in Tashkent timezone
 * @param date - Date string or Date object
 * @returns Formatted datetime string (DD/MM/YYYY, HH:MM:SS)
 */
export function formatDateTimeInTashkent(date: string | Date): string {
  const dateStr = formatDateInTashkent(date);
  const timeStr = formatTimeInTashkent(date);
  return `${dateStr}, ${timeStr}`;
}

/**
 * Returns the browser-local calendar date as YYYY-MM-DD.
 * Unlike `toISOString().slice(0, 10)` this does not shift to the UTC day.
 */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses a YYYY-MM-DD string as a local-midnight Date (not UTC). */
export function parseLocalDate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}
