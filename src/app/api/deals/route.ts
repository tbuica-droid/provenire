import { NextResponse } from "next/server";
import { createDeal, listDeals, findingReviewSummary } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const deals = listDeals().map((d) => ({
    ...d,
    review: findingReviewSummary(d.id),
  }));
  return NextResponse.json({ deals });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const company = String(body?.company ?? "").trim();
  const sector = String(body?.sector ?? "").trim();
  const deal_type = String(body?.deal_type ?? "").trim();
  const deal_size_or_revenue_range = String(
    body?.deal_size_or_revenue_range ?? "",
  ).trim();

  if (!company || !sector || !deal_type) {
    return NextResponse.json(
      { error: "company, sector and deal_type are required" },
      { status: 400 },
    );
  }

  const deal = createDeal({
    company,
    sector,
    deal_type,
    deal_size_or_revenue_range,
  });
  return NextResponse.json({ deal }, { status: 201 });
}
