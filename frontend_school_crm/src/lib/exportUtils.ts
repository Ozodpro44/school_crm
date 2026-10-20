import { csvField } from "./htmlEscape";

export function exportTableToCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;

  const first = data[0] as Record<string, unknown>;
  const headers = Object.keys(first);
  const csvContent = [
    headers.map(csvField).join(","),
    ...data.map((row) => headers.map((header) => csvField((row as Record<string, unknown>)[header])).join(",")),
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Suffix printed after an UZS amount, per interface language.
const UZS_SUFFIX: Record<string, string> = {
  "uz-latn": "so'm",
  "uz-cyrl": "сўм",
  en: "UZS",
};

function storedLanguage(): string {
  if (typeof window === "undefined") return "uz-latn";
  try {
    return window.localStorage.getItem("language") || "uz-latn";
  } catch {
    return "uz-latn";
  }
}

/**
 * Formats money the same way everywhere. UZS is built by hand ("2 000 000 so'm")
 * instead of through Intl: the result of Intl for the "uz" locale depends on the
 * browser's ICU data, so the same amount used to print as "UZS 2,000,000" on one
 * device and "2 000 000 so'm" on another. A non-numeric amount counts as 0.
 */
export function formatCurrency(amount: number, currency?: string): string {
  const cur = currency || "UZS";
  const value = Number.isFinite(amount) ? amount : 0;

  if (cur === "UZS") {
    const lang = storedLanguage();
    const suffix = UZS_SUFFIX[lang] ?? (lang.startsWith("uz") ? UZS_SUFFIX["uz-latn"] : UZS_SUFFIX.en);
    const grouped = Math.abs(Math.round(value))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
    return `${value < 0 ? "-" : ""}${grouped}\u00A0${suffix}`;
  }

  const lang = storedLanguage();
  const locale = lang.startsWith("uz") ? "uz-UZ" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${cur}`;
  }
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
