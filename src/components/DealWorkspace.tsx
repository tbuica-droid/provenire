"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Deal,
  DocumentRow,
  Finding,
  Category,
  MemoRow,
} from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import FindingCard, { type FindingPatch } from "./FindingCard";

interface DealData {
  deal: Deal;
  documents: DocumentRow[];
  findings: Finding[];
  review: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    edited: number;
  };
  memo: MemoRow | null;
}

const SEV_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
function sortFindings(a: Finding, b: Finding) {
  const ra = a.severity ? SEV_RANK[a.severity] : 3;
  const rb = b.severity ? SEV_RANK[b.severity] : 3;
  if (ra !== rb) return ra - rb;
  // surface needs-review items higher within a severity band
  return Number(b.needs_human_review) - Number(a.needs_human_review);
}

export default function DealWorkspace({
  dealId,
  initialDeal,
}: {
  dealId: string;
  initialDeal: Deal;
}) {
  const router = useRouter();
  const [data, setData] = useState<DealData | null>(null);
  const [tab, setTab] = useState<"All" | Category>("All");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [memoBusy, setMemoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/deals/${dealId}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [dealId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setInfo(null);
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch(`/api/deals/${dealId}/documents`, {
        method: "POST",
        body: fd,
      });
      const out = await res.json();
      if (out.errors?.length) {
        setError(
          out.errors
            .map((e: any) => `${e.filename}: ${e.error}`)
            .join(" · "),
        );
      }
      if (out.created?.length) {
        setInfo(`Ingested ${out.created.length} document(s).`);
      }
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runAnalysis() {
    setError(null);
    setInfo(null);
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/analyze`, {
        method: "POST",
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Analysis failed");
      setInfo(
        `Analysis complete — ${out.total} findings across 4 categories` +
          (out.ungrounded
            ? ` (${out.ungrounded} flagged ungrounded by the citation backstop)`
            : "") +
          ". Review and approve findings below before generating the memo.",
      );
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function patchFinding(id: string, patch: FindingPatch) {
    const res = await fetch(`/api/findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) await refresh();
  }

  async function generateMemo() {
    setError(null);
    setInfo(null);
    setMemoBusy(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/memo`, { method: "POST" });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Memo generation failed");
      router.push(`/deals/${dealId}/memo`);
    } catch (err: any) {
      setError(err.message);
      setMemoBusy(false);
    }
  }

  const deal = data?.deal ?? initialDeal;
  const findings = data?.findings ?? [];
  const approvedCount = (data?.review.approved ?? 0) + (data?.review.edited ?? 0);
  const ungrounded = findings.filter((f) => !f.grounded).length;

  const categoryCount = (c: Category) =>
    findings.filter((f) => f.category === c).length;

  const visible = findings
    .filter((f) => tab === "All" || f.category === tab)
    .filter((f) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "approved")
        return f.review_status === "approved" || f.review_status === "edited";
      return f.review_status === statusFilter;
    })
    .sort(sortFindings);

  return (
    <div>
      {/* Header */}
      <div className="row" style={{ marginBottom: 6 }}>
        <Link href="/" className="small muted">
          ← All deals
        </Link>
      </div>
      <div className="row" style={{ alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 className="page-title">{deal.company}</h1>
          <div className="row" style={{ gap: 8 }}>
            <span className="chip">{deal.sector}</span>
            <span className="chip">{deal.deal_type}</span>
            {deal.deal_size_or_revenue_range && (
              <span className="chip">{deal.deal_size_or_revenue_range}</span>
            )}
          </div>
        </div>
        <span className="spacer" />
        {data?.memo && (
          <Link href={`/deals/${dealId}/memo`} className="btn">
            Open IC memo →
          </Link>
        )}
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {info && <div className="notice notice-info">{info}</div>}

      {/* Stats */}
      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="n">{data?.documents.length ?? 0}</div>
          <div className="l">Documents</div>
        </div>
        <div className="stat">
          <div className="n">{findings.length}</div>
          <div className="l">Findings</div>
        </div>
        <div className="stat">
          <div className="n" style={{ color: "var(--opp)" }}>
            {approvedCount}
          </div>
          <div className="l">Approved</div>
        </div>
        <div className="stat">
          <div className="n">{data?.review.pending ?? 0}</div>
          <div className="l">Pending review</div>
        </div>
        <div className="stat">
          <div className="n" style={{ color: ungrounded ? "var(--high)" : undefined }}>
            {ungrounded}
          </div>
          <div className="l">Ungrounded</div>
        </div>
      </div>

      {/* Data room */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Data room</span>
          <div className="row">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.xls,.txt,.csv"
              style={{ display: "none" }}
              onChange={(e) => upload(e.target.files)}
            />
            <button
              className="btn btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <span className="spinner dark" /> : null}
              {uploading ? "Ingesting…" : "Upload documents"}
            </button>
          </div>
        </div>
        <div className="panel-body">
          {(data?.documents.length ?? 0) === 0 ? (
            <div className="empty">
              No documents yet. Upload PDFs, Word, or Excel — financials,
              contracts, cap tables, and at least one org-chart / HRIS export
              (needed for the operational benchmark analysis).
            </div>
          ) : (
            data!.documents.map((d) => (
              <div className="doc-row" key={d.id}>
                <div>
                  <span className="doc-name">{d.filename}</span>{" "}
                  <span className="chip">{d.doc_kind}</span>
                </div>
                <div className="muted small">
                  {d.chunk_count} chunks · {(d.size_bytes / 1024).toFixed(0)} KB
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Analysis */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Grounded analysis</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={runAnalysis}
            disabled={analyzing || (data?.documents.length ?? 0) === 0}
          >
            {analyzing ? <span className="spinner" /> : null}
            {analyzing
              ? "Analyzing (4 categories)…"
              : findings.length
                ? "Re-run analysis"
                : "Run analysis"}
          </button>
        </div>
        <div className="panel-body">
          <p className="muted small" style={{ margin: 0 }}>
            Retrieval surfaces the most relevant chunks per category, then Claude
            extracts Risks, Opportunities and Open Questions — each grounded in a
            specific source citation. Every finding must then pass the human
            review gate below before it can reach the memo.
          </p>
        </div>
      </div>

      {/* Findings */}
      <div className="panel">
        <div className="panel-head" style={{ flexWrap: "wrap" }}>
          <span className="panel-title">Findings dashboard</span>
          <div className="row small">
            <span className="muted">Show:</span>
            {(["all", "pending", "approved", "rejected"] as const).map((s) => (
              <button
                key={s}
                className={`link-btn ${statusFilter === s ? "" : "muted"}`}
                style={{
                  textTransform: "capitalize",
                  fontWeight: statusFilter === s ? 700 : 600,
                }}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="tabs">
          <button
            className={`tab ${tab === "All" ? "active" : ""}`}
            onClick={() => setTab("All")}
          >
            All <span className="count">{findings.length}</span>
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`tab ${tab === c ? "active" : ""} ${c === "Operational" ? "hero" : ""}`}
              onClick={() => setTab(c)}
            >
              {c} <span className="count">{categoryCount(c)}</span>
            </button>
          ))}
        </div>

        <div className="panel-body">
          {findings.length === 0 ? (
            <div className="empty">
              No findings yet. Upload documents and run the analysis to generate
              grounded findings.
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">No findings match this filter.</div>
          ) : (
            <>
              <div
                className="notice notice-info"
                style={{ marginBottom: 16 }}
              >
                <strong>Review gate.</strong> Approve, edit, or reject each
                finding. Only approved (or edited) findings are passed to the IC
                memo — nothing flows from AI output straight into the memo.
              </div>
              {visible.map((f) => (
                <FindingCard key={f.id} finding={f} onPatch={patchFinding} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Memo */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Investment Committee memo</span>
          <div className="row">
            {data?.memo && (
              <Link href={`/deals/${dealId}/memo`} className="btn btn-sm">
                View latest
              </Link>
            )}
            <button
              className="btn btn-sm btn-primary"
              onClick={generateMemo}
              disabled={memoBusy || approvedCount === 0}
            >
              {memoBusy ? <span className="spinner" /> : null}
              {memoBusy
                ? "Assembling…"
                : data?.memo
                  ? "Regenerate memo"
                  : "Generate draft memo"}
            </button>
          </div>
        </div>
        <div className="panel-body">
          {approvedCount === 0 ? (
            <div className="muted small">
              Approve at least one finding to enable memo generation. The memo is
              assembled <strong>only</strong> from human-approved findings.
            </div>
          ) : (
            <div className="muted small">
              {approvedCount} approved finding(s) will be included. The draft
              opens with the required AI-assisted disclaimer and is exportable to
              Word.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
