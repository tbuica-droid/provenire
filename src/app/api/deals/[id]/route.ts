import { NextResponse } from "next/server";
import {
  getDeal,
  listDocuments,
  listFindings,
  findingReviewSummary,
  latestMemo,
} from "@/lib/db/repo";

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
  return NextResponse.json({
    deal,
    documents: listDocuments(id),
    findings: listFindings(id),
    review: findingReviewSummary(id),
    memo: latestMemo(id) ?? null,
  });
}
