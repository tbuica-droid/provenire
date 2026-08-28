import * as XLSX from "xlsx";
import type { Segment } from "./index";

// Spreadsheets are the backbone of financials and HRIS/org exports. We render
// each sheet as a readable table and group rows so each segment carries a
// "Sheet 'X' rows a–b" location. The header row is repeated into every segment
// so a retrieved chunk is self-describing (a model citing "Sheet 'Org Chart',
// Engineering row" can trace it).
const ROWS_PER_SEGMENT = 18;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    // Keep numbers legible but exact.
    return Number.isInteger(v) ? String(v) : String(v);
  }
  return String(v).replace(/\s+/g, " ").trim();
}

export function parseXlsx(buffer: Buffer): Segment[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const segments: Segment[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (rows.length === 0) continue;

    const header = rows[0].map(cell);
    const headerLine = header.length ? header.join(" | ") : "";

    for (let start = 1; start < rows.length; start += ROWS_PER_SEGMENT) {
      const end = Math.min(start + ROWS_PER_SEGMENT, rows.length);
      const lines: string[] = [];
      if (headerLine) lines.push(`Columns: ${headerLine}`);
      for (let r = start; r < end; r++) {
        const vals = rows[r].map(cell);
        if (vals.every((v) => v === "")) continue;
        lines.push(`Row ${r + 1}: ${vals.join(" | ")}`);
      }
      if (lines.length <= (headerLine ? 1 : 0)) continue;
      segments.push({
        location: `Sheet '${sheetName}' rows ${start + 1}-${end}`,
        text: lines.join("\n"),
      });
    }

    // If the sheet had only a header row, still surface it.
    if (rows.length === 1 && headerLine) {
      segments.push({
        location: `Sheet '${sheetName}' header`,
        text: `Columns: ${headerLine}`,
      });
    }
  }

  return segments;
}
