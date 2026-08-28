import { NextResponse } from "next/server";
import { getDeal } from "@/lib/db/repo";
import { ingestDocument } from "@/lib/ingest";
import { extOf } from "@/lib/parsing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["pdf", "docx", "xlsx", "xls", "txt", "csv"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json(
      { error: "No files uploaded (expected form field 'files')" },
      { status: 400 },
    );
  }

  const created: unknown[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const file of files) {
    const ext = extOf(file.name);
    if (!ALLOWED.has(ext)) {
      errors.push({
        filename: file.name,
        error: `Unsupported file type .${ext}. Allowed: PDF, DOCX, XLSX, TXT, CSV.`,
      });
      continue;
    }
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const doc = await ingestDocument(id, file.name, buffer, file.type);
      created.push(doc);
    } catch (err: any) {
      console.error(`[provenire] failed to ingest ${file.name}:`, err);
      errors.push({ filename: file.name, error: err?.message ?? "parse failed" });
    }
  }

  return NextResponse.json({ created, errors }, { status: created.length ? 201 : 400 });
}
