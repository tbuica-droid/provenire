import { NextResponse } from "next/server";
import { getDeal, latestMemo } from "@/lib/db/repo";
import { memoToDocx } from "@/lib/export-docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  const memo = latestMemo(id);
  if (!memo) {
    return NextResponse.json(
      { error: "No memo generated yet." },
      { status: 404 },
    );
  }

  const buffer = await memoToDocx(deal, memo.content);
  const safeCompany = deal.company.replace(/[^a-z0-9]+/gi, "_");
  const filename = `IC_Memo_${safeCompany}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
