/**
 * printExport.ts
 * Utilities for PDF (via browser print dialog) and improved CSV export.
 *
 * PDF approach: open a styled HTML document in a new window and call window.print().
 * The browser's native print-to-PDF handles all fonts and Cyrillic perfectly.
 */

export interface PrintColumn {
  header: string;
  key: string;
  align?: "left" | "right" | "center";
  format?: (val: unknown) => string;
}

export interface PrintOptions {
  title: string;
  subtitle?: string;
  columns: PrintColumn[];
  data: Record<string, unknown>[];
  filename?: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function esc(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(opts: PrintOptions, forPrint: boolean): string {
  const { title, subtitle, columns, data } = opts;

  const thCells = columns
    .map(
      (c) =>
        `<th class="${c.align === "right" ? "right" : c.align === "center" ? "center" : ""}">${esc(c.header)}</th>`
    )
    .join("");

  const tbodyRows = data
    .map((row) => {
      const tds = columns
        .map((c) => {
          const raw = row[c.key];
          const val = c.format ? c.format(raw) : raw;
          return `<td class="${c.align === "right" ? "right" : c.align === "center" ? "center" : ""}">${esc(val)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  const now = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      color: #1e293b;
      padding: ${forPrint ? "0" : "24px"};
      background: white;
    }
    .header { margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: 700; color: #1e293b; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 3px; }
    .meta { font-size: 10px; color: #94a3b8; margin-top: 4px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    thead tr {
      background: #f1f5f9;
    }
    th {
      text-align: left;
      padding: 7px 10px;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
      white-space: nowrap;
    }
    td {
      padding: 6px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #f8fafc; }
    th.right, td.right { text-align: right; }
    th.center, td.center { text-align: center; }
    .footer { margin-top: 16px; font-size: 10px; color: #94a3b8; text-align: right; }
    ${forPrint ? `
    @media print {
      body { padding: 0; }
      @page { margin: 15mm 12mm; size: A4 landscape; }
    }` : ""}
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${esc(title)}</div>
    ${subtitle ? `<div class="subtitle">${esc(subtitle)}</div>` : ""}
    <div class="meta">Generated: ${esc(now)} &nbsp;|&nbsp; ${esc(data.length)} records</div>
  </div>
  <table>
    <thead><tr>${thCells}</tr></thead>
    <tbody>${tbodyRows}</tbody>
  </table>
  <div class="footer">School CRM &mdash; ${esc(title)}</div>
  ${forPrint ? `<script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; };<\/script>` : ""}
</body>
</html>`;
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Opens a print-preview window. The user can print or save as PDF.
 * Handles Cyrillic natively since the browser renders it.
 */
export function printReport(opts: PrintOptions): void {
  const html = buildHtml(opts, true);
  const w = window.open("", "_blank", "width=1000,height=700");
  if (!w) {
    alert("Pop-up blocked. Please allow pop-ups for this site.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

/**
 * Downloads a CSV with UTF-8 BOM so Excel opens Cyrillic correctly.
 * Values containing commas, quotes, or newlines are properly quoted.
 */
export function downloadCSV(opts: PrintOptions): void {
  const { title, columns, data, filename } = opts;

  const quote = (v: unknown): string => {
    const s = String(v ?? "");
    // Always quote to be safe with Cyrillic in some Excel builds
    return `"${s.replace(/"/g, '""')}"`;
  };

  const header = columns.map((c) => quote(c.header)).join(",");
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const raw = row[c.key];
        return quote(c.format ? c.format(raw) : raw);
      })
      .join(",")
  );

  const csv = [header, ...rows].join("\r\n");
  // UTF-8 BOM makes Excel recognise Cyrillic automatically
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (filename || title.replace(/\s+/g, "-").toLowerCase()) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
