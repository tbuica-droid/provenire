import { parsePdf } from "./pdf";
import { parseDocx } from "./docx";
import { parseXlsx } from "./xlsx";

export interface Segment {
  location: string;
  text: string;
}

// A chunk ready to be embedded/stored. source_doc is the filename the model cites.
export interface ParsedChunk {
  source_doc: string;
  location: string;
  text: string;
  chunk_index: number;
}

export interface ParseResult {
  charCount: number;
  segmentCount: number;
  chunks: ParsedChunk[];
}

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
};

export function extOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function mimeFor(filename: string, provided?: string): string {
  if (provided && provided !== "application/octet-stream") return provided;
  return EXT_MIME[extOf(filename)] ?? "application/octet-stream";
}

// Lightweight doc-kind inference for display + to make sure an org/HRIS doc is
// recognizable. Retrieval itself is category-driven, not doc-kind driven.
export function inferDocKind(filename: string): string {
  const n = filename.toLowerCase();
  if (/(org|hris|headcount|roster|staffing|people)/.test(n)) return "Org/HRIS";
  if (/(financ|p&l|pnl|qoe|ebitda|income|balance|statement)/.test(n))
    return "Financials";
  if (/(cap.?table|equity|option)/.test(n)) return "Cap Table";
  if (/(contract|agreement|msa|sow|lease|nda)/.test(n)) return "Contract";
  if (/(cim|teaser|overview|deck|memorandum|pitch)/.test(n)) return "CIM";
  return "Other";
}

async function segmentsFor(
  filename: string,
  mime: string,
  buffer: Buffer,
): Promise<Segment[]> {
  const ext = extOf(filename);
  if (mime.includes("pdf") || ext === "pdf") return parsePdf(buffer);
  if (mime.includes("word") || ext === "docx") return parseDocx(buffer);
  if (mime.includes("sheet") || mime.includes("excel") || ext === "xlsx" || ext === "xls")
    return parseXlsx(buffer);
  // Fallback: treat as UTF-8 text.
  return [{ location: "Document", text: buffer.toString("utf-8") }];
}

// Split a segment into chunks of ~maxChars on line/sentence boundaries, keeping
// the segment's location. Continuation parts are tagged so locations stay unique.
function chunkSegment(
  seg: Segment,
  source_doc: string,
  startIndex: number,
  maxChars: number,
  overlap: number,
): ParsedChunk[] {
  const text = seg.text.trim();
  if (text.length <= maxChars) {
    return [{ source_doc, location: seg.location, text, chunk_index: startIndex }];
  }

  const out: ParsedChunk[] = [];
  // Prefer to break on newlines, then sentence ends, then hard cut.
  let pos = 0;
  let part = 0;
  while (pos < text.length) {
    let end = Math.min(pos + maxChars, text.length);
    if (end < text.length) {
      const slice = text.slice(pos, end);
      const nl = slice.lastIndexOf("\n");
      const dot = slice.lastIndexOf(". ");
      const brk = Math.max(nl, dot);
      if (brk > maxChars * 0.5) end = pos + brk + 1;
    }
    const piece = text.slice(pos, end).trim();
    if (piece.length > 0) {
      out.push({
        source_doc,
        location: part === 0 ? seg.location : `${seg.location} (cont. ${part})`,
        text: piece,
        chunk_index: startIndex + out.length,
      });
    }
    if (end >= text.length) break;
    pos = Math.max(end - overlap, pos + 1);
    part++;
  }
  return out;
}

export async function extractAndChunk(
  filename: string,
  mime: string,
  buffer: Buffer,
  opts: { maxChars?: number; overlap?: number } = {},
): Promise<ParseResult> {
  const maxChars = opts.maxChars ?? 1200;
  const overlap = opts.overlap ?? 150;

  const segments = await segmentsFor(filename, mime, buffer);
  const chunks: ParsedChunk[] = [];
  let charCount = 0;
  for (const seg of segments) {
    charCount += seg.text.length;
    const segChunks = chunkSegment(
      seg,
      filename,
      chunks.length,
      maxChars,
      overlap,
    );
    chunks.push(...segChunks);
  }
  // Re-index sequentially.
  chunks.forEach((c, i) => (c.chunk_index = i));

  return { charCount, segmentCount: segments.length, chunks };
}
