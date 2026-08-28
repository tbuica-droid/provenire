import type { Segment } from "./index";

// DOCX has no pages, but legal/financial documents carry their own structure
// (Article / Section / numbered clauses). We extract raw text, then group
// paragraphs under the nearest preceding heading so citations read like
// "§8.2 Change of Control" rather than an opaque paragraph index.
const HEADING_RE =
  /^(\d{1,3}(\.\d{1,3})*[.)]?\s+\S|article\s+[ivxlcdm\d]+|section\s+\d+|§\s*\d+|schedule\s+[a-z0-9]+|appendix\s+[a-z0-9]+|exhibit\s+[a-z0-9]+|[A-Z][A-Z0-9 &\-]{4,}$)/i;

export async function parseDocx(buffer: Buffer): Promise<Segment[]> {
  const mod: any = await import("mammoth");
  const mammoth = mod.default ?? mod;
  const { value } = await mammoth.extractRawText({ buffer });

  const paragraphs: string[] = String(value)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const segments: Segment[] = [];
  let currentHeading = "Preamble";
  let buf: string[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    segments.push({
      location: `Section: ${currentHeading}`.slice(0, 120),
      text: buf.join("\n"),
    });
    buf = [];
  };

  for (const p of paragraphs) {
    if (HEADING_RE.test(p) && p.length < 90) {
      flush();
      currentHeading = p;
      buf.push(p); // keep the heading line inside its section for context
    } else {
      buf.push(p);
    }
  }
  flush();

  return segments.length > 0
    ? segments
    : [{ location: "Document", text: String(value).trim() }];
}
