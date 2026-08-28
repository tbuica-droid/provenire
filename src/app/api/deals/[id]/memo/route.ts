import { NextResponse } from "next/server";
import {
  getDeal,
  listApprovedFindings,
  saveMemo,
  latestMemo,
} from "@/lib/db/repo";
import { assembleMemo } from "@/lib/ai/memo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getDeal(id)) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  return NextResponse.json({ memo: latestMemo(id) ?? null });
}

// POST = generate a fresh memo. The review gate is enforced here: only approved
// (or edited) findings are passed to Part B, and generation is refused if none
// have been reviewed-in.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const approved = listApprovedFindings(id);
  if (approved.length === 0) {
    return NextResponse.json(
      {
        error:
          "No approved findings. Review the findings and approve (or edit) at least one before generating the memo.",
      },
      { status: 400 },
    );
  }

  try {
    const content = await assembleMemo(deal, approved);
    const memo = saveMemo(
      id,
      content,
      approved.map((f) => f.id),
    );
    return NextResponse.json({ memo }, { status: 201 });
  } catch (err: any) {
    console.error("[provenire] memo assembly failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Memo assembly failed" },
      { status: 500 },
    );
  }
}
