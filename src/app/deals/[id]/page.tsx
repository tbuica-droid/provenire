import { notFound } from "next/navigation";
import { getDeal } from "@/lib/db/repo";
import DealWorkspace from "@/components/DealWorkspace";

export const dynamic = "force-dynamic";

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) notFound();
  return <DealWorkspace dealId={id} initialDeal={deal} />;
}
