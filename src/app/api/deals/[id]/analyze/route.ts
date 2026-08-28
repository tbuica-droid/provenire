import { NextResponse } from "next/server";
import { getDeal, chunkCount, replaceFindings } from "@/lib/db/repo";
import { analyzeDeal } from "@/lib/ai/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Analysis fans out 4 category calls at high effort; allow generous time.
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  if (chunkCount(id) === 0) {
    return NextResponse.json(
      { error: "Upload at least one document before running analysis." },
      { status: 400 },
    );
  }

  try {
    const result = await analyzeDeal(deal);
    replaceFindings(id, result.runId, result.findings);
    return NextResponse.json({
      run_id: result.runId,
      total: result.findings.length,
      ungrounded: result.ungrounded,
      per_category: result.perCategory,
    });
  } catch (err: any) {
    console.error("[provenire] analysis failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Analysis failed" },
      { status: 500 },
    );
  }
}
