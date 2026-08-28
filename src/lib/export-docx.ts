import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { MEMO_DISCLAIMER, DEFAULT_MEMO_SECTIONS } from "./ai/prompts";
import type { Deal } from "./types";

const SECTION_NAMES = new Set(
  [...DEFAULT_MEMO_SECTIONS, "Outstanding Items"].map((s) => s.toLowerCase()),
);

// Normalize a line for heading detection: strip markdown #, numbering, trailing colons.
function headingKey(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/[:*_]+$/g, "")
    .replace(/\*\*/g, "")
    .trim()
    .toLowerCase();
}

function isHeading(line: string): boolean {
  const key = headingKey(line);
  if (SECTION_NAMES.has(key)) return true;
  // Markdown headings or short bold-only lines also treated as headings.
  if (/^#{1,3}\s+\S/.test(line)) return true;
  return false;
}

function cleanText(line: string): string {
  return line.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim();
}

export async function memoToDocx(deal: Deal, memo: string): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Title block.
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "INVESTMENT COMMITTEE MEMORANDUM", bold: true, size: 30 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `${deal.company} — ${deal.sector} — ${deal.deal_type}`,
          italics: true,
          size: 22,
        }),
      ],
    }),
  );

  const lines = memo.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      children.push(new Paragraph({ children: [] }));
      continue;
    }

    // The mandatory disclaimer — render as a prominent boxed/shaded warning.
    if (line.trim().startsWith(MEMO_DISCLAIMER.slice(0, 20))) {
      children.push(
        new Paragraph({
          shading: { type: "clear", fill: "FFF4E5" },
          spacing: { after: 200 },
          children: [
            new TextRun({ text: line.trim(), bold: true, color: "8A4B00" }),
          ],
        }),
      );
      continue;
    }

    if (isHeading(line)) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: cleanText(line), bold: true })],
        }),
      );
      continue;
    }

    // Bullets.
    const bullet = line.match(/^\s*([-*•])\s+(.*)$/);
    if (bullet) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: cleanText(bullet[2]) })],
        }),
      );
      continue;
    }

    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: cleanText(line) })],
      }),
    );
  }

  const doc = new Document({
    creator: "Provenire (provenire)",
    title: `IC Memo — ${deal.company}`,
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
