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

    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      ...options,
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
