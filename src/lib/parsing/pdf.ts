import type { Segment } from "./index";

// Extract text per page using pdfjs-dist (maintained). We emit one segment per
// PAGE with a "Page N" location so findings cite a real page reference. pdfjs is
// also far more tolerant of varied real-world PDFs than the legacy alternatives.
export async function parsePdf(buffer: Buffer): Promise<Segment[]> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
    // No worker in Node — run on the main thread.
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;

  const segments: Segment[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | undefined;
    let text = "";
    for (const item of content.items as any[]) {
      if (typeof item.str !== "string") continue;
      const y = item.transform?.[5];
      if (lastY !== undefined && y !== undefined && Math.abs(lastY - y) > 1) {
        text += "\n";
      }
      text += item.str;
      if (item.hasEOL) text += "\n";
      lastY = y;
    }
    const trimmed = text.replace(/[ \t]+\n/g, "\n").trim();
    if (trimmed.length > 0) {
      segments.push({ location: `Page ${i}`, text: trimmed });
    }
  }

  await pdf.cleanup?.();
  return segments;
}
