import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

// Default timezone untuk Indonesia (Jakarta)
export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

// Daftar timezone yang tersedia
export const TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB - Jakarta (UTC+7)' },
  { value: 'Asia/Makassar', label: 'WITA - Makassar (UTC+8)' },
  { value: 'Asia/Jayapura', label: 'WIT - Jayapura (UTC+9)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Malaysia (UTC+8)' },
  { value: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
];

/**
 * Get user's timezone from localStorage or use default (Jakarta)
 */
export function getUserTimezone(): string {
  return localStorage.getItem('user-timezone') || DEFAULT_TIMEZONE;
}

/**
 * Set user's timezone to localStorage
 */
export function setUserTimezone(timezone: string): void {
  localStorage.setItem('user-timezone', timezone);
}

/**
 * Convert local datetime-local input value to UTC for storage
 * @param localDateTimeString - Format: "2024-10-21T20:05" (from datetime-local input)
 * @param timezone - User's timezone (default: Jakarta)
 * @returns ISO string in UTC
 */
export function convertLocalToUTC(localDateTimeString: string, timezone: string = getUserTimezone()): string {
  // Parse the local datetime string as if it's in the user's timezone
  const localDate = new Date(localDateTimeString);
  
  // Convert from user's timezone to UTC
  const utcDate = fromZonedTime(localDate, timezone);
  
  return utcDate.toISOString();
}

/**
 * Convert UTC datetime to local timezone for display
 * @param utcDateString - ISO string in UTC
 * @param timezone - User's timezone (default: Jakarta)
 * @returns Date object in local timezone
 */
export function convertUTCToLocal(utcDateString: string, timezone: string = getUserTimezone()): Date {
  const utcDate = new Date(utcDateString);
  return toZonedTime(utcDate, timezone);
}

/**
 * Format UTC datetime to local datetime-local input format
 * @param utcDateString - ISO string in UTC
 * @param timezone - User's timezone (default: Jakarta)
 * @returns Format: "2024-10-21T20:05" for datetime-local input
 */
export function formatUTCToLocalInput(utcDateString: string, timezone: string = getUserTimezone()): string {
  const localDate = convertUTCToLocal(utcDateString, timezone);
  
  // Format to YYYY-MM-DDTHH:mm for datetime-local input
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Format UTC datetime to readable local format
 * @param utcDateString - ISO string in UTC
 * @param timezone - User's timezone (default: Jakarta)
 * @param format - Date format (default: 'dd MMM yyyy, HH:mm')
 * @returns Formatted string in local timezone
 */
export function formatUTCToLocalDisplay(
  utcDateString: string, 
  timezone: string = getUserTimezone(),
  format: string = 'EEE, dd MMM yyyy HH:mm'
): string {
  return formatInTimeZone(new Date(utcDateString), timezone, format, { locale: undefined });
}

/**
 * Get current time in user's timezone formatted for datetime-local input
 * @param timezone - User's timezone (default: Jakarta)
 * @returns Format: "2024-10-21T20:05" for datetime-local input
 */
export function getCurrentLocalTime(timezone: string = getUserTimezone()): string {
  const now = new Date();
  const localNow = toZonedTime(now, timezone);
  
  const year = localNow.getFullYear();
  const month = String(localNow.getMonth() + 1).padStart(2, '0');
  const day = String(localNow.getDate()).padStart(2, '0');
  const hours = String(localNow.getHours()).padStart(2, '0');
  const minutes = String(localNow.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get timezone offset display (e.g., "WIB (UTC+7)")
 * @param timezone - Timezone identifier
 * @returns Display string with offset
 */
export function getTimezoneDisplay(timezone: string = getUserTimezone()): string {
  const now = new Date();
  const formatted = formatInTimeZone(now, timezone, 'zzz');
  return formatted;
}
