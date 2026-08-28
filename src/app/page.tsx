import Link from "next/link";
import { listDeals, findingReviewSummary } from "@/lib/db/repo";
import NewDealForm from "@/components/NewDealForm";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const deals = listDeals();

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 className="page-title">Deals</h1>
        <p className="muted">
          Create a deal, upload data-room documents, and produce grounded
          diligence findings and a draft Investment Committee memo.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 22 }}>
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Your deals</span>
            <span className="muted small">{deals.length} total</span>
          </div>
          <div className="panel-body">
            {deals.length === 0 ? (
              <div className="empty">
                No deals yet. Create one on the right, or run{" "}
                <span className="mono">npm run seed</span> to load the sample
                deal (Project Atlas).
              </div>
            ) : (
              deals.map((d) => {
                const r = findingReviewSummary(d.id);
                return (
                  <Link
                    key={d.id}
                    href={`/deals/${d.id}`}
                    className="deal-list-item"
                  >
                    <div className="row">
                      <strong style={{ fontSize: 15 }}>{d.company}</strong>
                      <span className="spacer" />
                      <span className="chip">{d.deal_type}</span>
                    </div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {d.sector}
                      {d.deal_size_or_revenue_range
                        ? ` · ${d.deal_size_or_revenue_range}`
                        : ""}
                    </div>
                    <div className="row small" style={{ marginTop: 8, gap: 14 }}>
                      <span className="muted">{r.total} findings</span>
                      <span style={{ color: "var(--opp)" }}>
                        {r.approved + r.edited} approved
                      </span>
                      <span className="muted">{r.pending} pending</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">New deal</span>
          </div>
          <div className="panel-body">
            <NewDealForm />
          </div>
        </div>
      </div>
    </div>
  );
}
