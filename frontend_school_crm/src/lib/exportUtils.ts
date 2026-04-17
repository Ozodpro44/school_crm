
export function exportTableToCSV(data: unknown[], filename: string) {
  if (data.length === 0) return;

  const first = data[0] as Record<string, unknown>;
  const headers = Object.keys(first);
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((header) => {
        const value = (row as Record<string, unknown>)[header];
        if (typeof value === "string" && value.includes(",")) {
          return `"${value}"`;
        }
        return value;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

import { settingsDB } from "./storage";

export function formatCurrency(amount: number, currency?: string): string {
  const settings = typeof window !== "undefined" ? settingsDB.get() : undefined;
  const cur = currency || settings?.currency || "USD";
  let locale = "en-US";
  const lang = typeof window !== "undefined" ? localStorage.getItem("language") : null;
  
  if (lang) {
    if (lang.startsWith("uz")) {
      locale = "uz-UZ";
    } else if (lang.startsWith("en")) {
      locale = "en-US";
    } else {
      locale = lang;
    }
  } else if (typeof navigator !== "undefined") {
    locale = navigator.language || "en-US";
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch (e) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  }
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
