import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts a string to title case (each word capitalized)
 * Used for displaying student names stored in ALL CAPS
 */
export function toTitleCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats a date to DD.MM.YYYY format
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, ".");
}

/**
 * Formats a number with space as thousands separator (e.g., 10000 -> "10 000")
 */
export function formatNumberWithSpaces(value: string | number): string {
  const num = typeof value === "string" ? value : String(value);
  const parts = num.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.join(".");
}

/**
 * Removes formatting spaces from formatted number (e.g., "10 000" -> "10000")
 */
export function removeNumberFormatting(value: string): string {
  return value.replace(/\s/g, "");
}

/**
 * Formats a phone number to Uzbekistan format
 * Examples:
 *   "998901234567" -> "+998 (90) 123-45-67"
 *   "+998901234567" -> "+998 (90) 123-45-67"
 *   "901234567" -> "+998 (90) 123-45-67"
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return "";

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // If less than 9 digits, return as is
  if (cleaned.length < 9) return phone;

  // Remove leading 998 if present (country code)
  let digits = cleaned;
  if (cleaned.startsWith("998")) {
    digits = cleaned.slice(3);
  }

  // Get only the last 9 digits (area code + number)
  digits = digits.slice(-9);

  // Format: +998 (XX) XXX-XX-XX
  return `+998 (${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7)}`;
}

/**
 * Validates if a phone number is in valid Uzbekistan format
 */
export function isValidUzbekPhone(phone: string): boolean {
  if (!phone) return false;

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // Should be 12 digits (998 + 9 digits) or 9 digits
  return cleaned.length === 12 || cleaned.length === 9 || (cleaned.length === 11 && cleaned.startsWith("998"));
}
