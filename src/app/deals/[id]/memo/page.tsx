import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeal, latestMemo } from "@/lib/db/repo";
import { MEMO_DISCLAIMER } from "@/lib/ai/prompts";

export const dynamic = "force-dynamic";

export default async function MemoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) notFound();
  const memo = latestMemo(id);

  // Separate the mandatory disclaimer (shown as a banner) from the memo body.
  let body = memo?.content ?? "";
  if (body.startsWith(MEMO_DISCLAIMER)) {
    body = body.slice(MEMO_DISCLAIMER.length).trimStart();
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 6 }}>
        <Link href={`/deals/${id}`} className="small muted">
          ← Back to {deal.company}
        </Link>
      </div>

      <div className="row" style={{ alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 className="page-title">Investment Committee Memo</h1>
          <div className="muted">
            {deal.company} · {deal.sector} · {deal.deal_type}
          </div>
        </div>
        <span className="spacer" />
        {memo && (
          <a className="btn btn-primary" href={`/api/deals/${id}/memo/export`}>
            Export to Word (.docx)
          </a>
        )}
      </div>

      {!memo ? (
        <div className="empty">
          No memo generated yet. Approve findings on the deal page, then
          generate the draft memo.
        </div>
      ) : (
        <>
          <div className="disclaimer">{MEMO_DISCLAIMER}</div>
          <div className="muted small" style={{ marginBottom: 14 }}>
            Assembled from {memo.finding_ids.length} approved finding(s) ·{" "}
            {new Date(memo.created_at).toLocaleString()}
          </div>
          <div className="memo">{body}</div>
        </>
      )}
    </div>
  );
}
