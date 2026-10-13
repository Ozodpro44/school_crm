/**
 * Minimal .xlsx reader for the student import: returns the cell text of the
 * first worksheet. An .xlsx is a zip of XML parts; we only need
 * xl/sharedStrings.xml and xl/worksheets/sheet*.xml, so this reads the zip
 * directly (stored/deflate entries, via the browser's DecompressionStream)
 * instead of pulling in a spreadsheet library.
 */

interface ZipEntry {
  method: number;
  compressedSize: number;
  localOffset: number;
}

function u16(b: DataView, o: number) {
  return b.getUint16(o, true);
}
function u32(b: DataView, o: number) {
  return b.getUint32(o, true);
}

function readZipDirectory(buf: ArrayBuffer): Map<string, ZipEntry> {
  const view = new DataView(buf);
  // End Of Central Directory: scan backwards (max 64 KiB comment).
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 65536); i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid .xlsx file");
  const count = u16(view, eocd + 10);
  let p = u32(view, eocd + 16);
  const entries = new Map<string, ZipEntry>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (u32(view, p) !== 0x02014b50) throw new Error("Corrupt .xlsx directory");
    const method = u16(view, p + 10);
    const compressedSize = u32(view, p + 20);
    const nameLen = u16(view, p + 28);
    const extraLen = u16(view, p + 30);
    const commentLen = u16(view, p + 32);
    const localOffset = u32(view, p + 42);
    const name = decoder.decode(new Uint8Array(buf, p + 46, nameLen));
    entries.set(name, { method, compressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readEntry(buf: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const view = new DataView(buf);
  const o = entry.localOffset;
  if (u32(view, o) !== 0x04034b50) throw new Error("Corrupt .xlsx entry");
  const dataStart = o + 30 + u16(view, o + 26) + u16(view, o + 28);
  const raw = new Uint8Array(buf, dataStart, entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(raw);
  if (entry.method !== 8) throw new Error("Unsupported .xlsx compression");
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

function unescapeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Concatenates every <t> inside a shared-string / inline-string item (rich text has several). */
function textOf(xml: string): string {
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out += unescapeXml(m[1] ?? "");
  return out;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(textOf(m[1] ?? ""));
  return out;
}

/** "AB12" -> 27 (zero-based column index of the cell reference). */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? "";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return Math.max(0, n - 1);
}

export interface SheetRow {
  /** 1-based row number as shown in Excel. */
  line: number;
  cells: string[];
}

export function parseSheetXml(xml: string, shared: string[]): SheetRow[] {
  const rows: SheetRow[] = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm: RegExpExecArray | null;
  let fallbackLine = 0;
  while ((rm = rowRe.exec(xml))) {
    fallbackLine++;
    const line = Number(/\br="(\d+)"/.exec(rm[1] ?? "")?.[1]) || fallbackLine;
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[2] ?? ""))) {
      const attrs = cm[1] ?? "";
      const body = cm[2] ?? "";
      const ref = /\br="([A-Za-z]+\d+)"/.exec(attrs)?.[1] ?? "";
      const type = /\bt="(\w+)"/.exec(attrs)?.[1] ?? "n";
      let value = "";
      if (type === "inlineStr") {
        value = textOf(body);
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
        value = type === "s" ? shared[Number(v)] ?? "" : unescapeXml(v);
      }
      const idx = ref ? columnIndex(ref) : cells.length;
      while (cells.length < idx) cells.push("");
      cells[idx] = value.trim();
    }
    if (cells.some((c) => c !== "")) rows.push({ line, cells });
  }
  return rows;
}

/** Reads the first worksheet of an .xlsx/.xlsm file as rows of cell text. */
export async function readXlsxFirstSheet(buf: ArrayBuffer): Promise<SheetRow[]> {
  const entries = readZipDirectory(buf);
  const sheetName = [...entries.keys()]
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]))[0];
  if (!sheetName) throw new Error("No worksheet found in .xlsx");
  const sstEntry = entries.get("xl/sharedStrings.xml");
  const shared = sstEntry ? parseSharedStrings(await readEntry(buf, sstEntry)) : [];
  const sheet = entries.get(sheetName)!;
  return parseSheetXml(await readEntry(buf, sheet), shared);
}
