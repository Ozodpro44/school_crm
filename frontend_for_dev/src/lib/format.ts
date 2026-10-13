import type { Language } from "@/lib/i18n/types";

// BCP-47 tags per UI language, so dates/numbers follow the language the
// developer picked instead of a hard-coded en-US/en-GB.
const LOCALES: Record<Language, string> = { en: "en-GB", ru: "ru-RU", uz: "uz-UZ" };

/** The platform bills in UZS (plan prices carry no currency column of their own). */
export const PLATFORM_CURRENCY = "UZS";

export function localeOf(language: Language): string {
  return LOCALES[language] ?? "en-GB";
}

export function formatMoney(amount: number | undefined | null, currency = "USD", language: Language = "en"): string {
  const value = Number.isFinite(amount) ? Number(amount) : 0;
  try {
    return new Intl.NumberFormat(localeOf(language), {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "UZS" ? 0 : value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    // Unknown currency code from the backend — never crash a table over it.
    return `${value.toLocaleString(localeOf(language))} ${currency}`;
  }
}

export function formatNumber(n: number | undefined | null, language: Language = "en"): string {
  return (Number.isFinite(n) ? Number(n) : 0).toLocaleString(localeOf(language));
}

export function formatDate(iso: string | null | undefined, language: Language = "en"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(localeOf(language), { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined, language: Language = "en"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(localeOf(language), {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function formatUptime(seconds?: number): string {
  if (!seconds || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function initialsOf(name?: string, fallback = "?"): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/** Date-only form value ("YYYY-MM-DD") from an ISO timestamp, for <input type="date">. */
export function toDateInput(iso?: string | null): string {
  return iso ? iso.split("T")[0] : "";
}

/** <input type="date"> gives "YYYY-MM-DD"; the backend's time fields need RFC3339. */
export function toRFC3339(date: string): string | undefined {
  return date ? `${date}T00:00:00Z` : undefined;
}
