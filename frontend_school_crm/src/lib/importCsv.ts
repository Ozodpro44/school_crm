/**
 * Delimited-text parsing for the student import.
 *
 * Excel saves "CSV" with the list separator of the OS locale: `;` on
 * Uzbek/Russian Windows, `,` on English ones, and "Text (Tab delimited)" uses
 * tabs. The importer used to split on `,` only, so a `;` file produced one
 * cell per row and every row was skipped without a word.
 */

export interface ParsedRow {
  /** 1-based line number in the source file (for error messages). */
  line: number;
  cells: string[];
}

const CANDIDATE_DELIMITERS = [",", ";", "\t"] as const;

/** Picks the delimiter that occurs most in the first non-empty line (outside quotes). */
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  const count = (d: string) => counts[d] ?? 0;
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (Object.values(counts).some((n) => n > 0)) break;
    } else if (!inQuotes && ch in counts) counts[ch] = count(ch) + 1;
  }
  let best: string = ",";
  for (const d of CANDIDATE_DELIMITERS) {
    if (count(d) > count(best)) best = d;
  }
  return best;
}

/** RFC-4180-style parser: quoted fields, doubled quotes, newlines inside quotes, BOM, CRLF. */
export function parseDelimited(input: string): { rows: ParsedRow[]; delimiter: string } {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: ParsedRow[] = [];

  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const endRow = () => {
    cells.push(field.trim());
    field = "";
    if (cells.some((c) => c !== "")) rows.push({ line: rowStartLine, cells });
    cells = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(field.trim());
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
      rowStartLine = line;
    } else {
      field += ch;
    }
  }
  if (field !== "" || cells.length > 0) endRow();

  return { rows, delimiter };
}

const HEADER_WORDS =
  /(full\s*name|name|ism|familiya|fio|class|sinf|phone|telefon|parent|payment|oylik|tolov|имя|фио|исм|класс|синф|телефон|родител|оплат|тўлов)/i;

/** A first row is a header when it names columns and holds no phone number. */
export function looksLikeHeader(cells: string[]): boolean {
  const hasPhone = cells.some((c) => c.replace(/\D/g, "").length >= 7);
  return !hasPhone && cells.some((c) => HEADER_WORDS.test(c));
}
