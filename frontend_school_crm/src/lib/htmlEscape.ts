/** Escape a value for safe interpolation into HTML text or quoted attributes. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Neutralise spreadsheet formula injection: prefix a quote to string cells
 * that start with = + - @ tab or carriage return.
 */
export function neutralizeCsvFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Produce one safely quoted CSV field. */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const raw = typeof value === "string" ? neutralizeCsvFormula(value) : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}
