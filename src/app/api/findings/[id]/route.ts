import { NextResponse } from "next/server";
import { getFinding, updateFinding } from "@/lib/db/repo";
import type { ReviewStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const finding = getFinding(id);
  if (!finding) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }
  return NextResponse.json({ finding });
}

const VALID_STATUS: ReviewStatus[] = ["pending", "approved", "rejected", "edited"];
const VALID_TYPES = ["Risk", "Opportunity", "Open Question"];
const VALID_SEVERITY = ["High", "Medium", "Low", null];

// PATCH = the human review gate action: approve / reject / edit a finding.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getFinding(id)) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.review_status !== undefined) {
    if (!VALID_STATUS.includes(body.review_status)) {
      return NextResponse.json(
        { error: `review_status must be one of ${VALID_STATUS.join(", ")}` },
        { status: 400 },
      );
    }
    patch.review_status = body.review_status;
  }

  // Field edits. Supplying any editable field marks the finding "edited" unless
  // an explicit review_status was also provided.
  let touchedFields = false;
  if (typeof body.title === "string") {
    patch.title = body.title.slice(0, 200);
    touchedFields = true;
  }
  if (typeof body.rationale === "string") {
    patch.rationale = body.rationale;
    touchedFields = true;
  }
  if (body.severity !== undefined) {
    if (!VALID_SEVERITY.includes(body.severity)) {
      return NextResponse.json(
        { error: "severity must be High, Medium, Low, or null" },
        { status: 400 },
      );
    }
    patch.severity = body.severity;
    touchedFields = true;
  }
  if (body.finding_type !== undefined) {
    if (!VALID_TYPES.includes(body.finding_type)) {
      return NextResponse.json(
        { error: `finding_type must be one of ${VALID_TYPES.join(", ")}` },
        { status: 400 },
      );
    }
    patch.finding_type = body.finding_type;
    touchedFields = true;
  }
  if (body.estimated_value_impact !== undefined) {
    patch.estimated_value_impact =
      body.estimated_value_impact === null
        ? null
        : String(body.estimated_value_impact);
    touchedFields = true;
  }

  if (touchedFields && patch.review_status === undefined) {
    patch.review_status = "edited";
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields supplied" }, { status: 400 });
  }

  const finding = updateFinding(id, patch as any);
  return NextResponse.json({ finding });
}
